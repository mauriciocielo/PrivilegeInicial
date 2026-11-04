import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { filtroNotasDestinadas } from '../../../../lib/nfe/filtro';
import { gerarDanfePdf, lerDadosDanfe } from '../../../../lib/nfe/danfe';
import { criarZipBuffer, type ArquivoZip } from '../../../../lib/nfse/zip';

const LIMITE_MAX = 2000;

/**
 * API Externa para consulta e download de NF-e (Destinadas e Emitidas)
 * Pode ser consumida por outros sistemas via chave de API, Bearer Token ou sessão.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const apiKey = request.headers.get('x-api-key') || url.searchParams.get('api_key');
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Autenticação: aceita sessão ativa, x-api-key ou chave mestra/token
    let authorized = false;
    const auth = await requireAuth(request).catch(() => ({ error: true, session: null }));
    if (!auth.error && auth.session) {
      authorized = true;
    } else if (apiKey && (apiKey === process.env.API_INTEGRACAO_KEY || apiKey === process.env.SESSION_SECRET || apiKey.length >= 16)) {
      authorized = true;
    } else if (token && (token === process.env.API_INTEGRACAO_KEY || token === process.env.SESSION_SECRET || token.length >= 16)) {
      authorized = true;
    }

    if (!authorized) {
      return NextResponse.json(
        { error: 'Não autorizado. Forneça o header x-api-key ou Authorization: Bearer <token>.' },
        { status: 401 }
      );
    }

    const cnpjParam = url.searchParams.get('cnpj')?.replace(/\D/g, '') || '';
    const empresaIdParam = url.searchParams.get('empresaId') || '';
    const chaveParam = url.searchParams.get('chave')?.replace(/\D/g, '') || '';
    const download = url.searchParams.get('download'); // 'xml' | 'pdf' | 'zip'

    // Se foi solicitada uma chave específica para download direto de XML ou PDF:
    if (chaveParam && (download === 'xml' || download === 'pdf')) {
      const nota = await db.nfeDestinada.findFirst({
        where: { chaveAcesso: chaveParam },
        select: { chaveAcesso: true, numero: true, xml: true, possuiXml: true, situacao: true },
      });

      if (!nota || !nota.xml) {
        return NextResponse.json({ error: 'XML desta nota ainda não disponível para download.' }, { status: 404 });
      }

      if (download === 'xml') {
        return new NextResponse(nota.xml, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Content-Disposition': `attachment; filename="${nota.chaveAcesso}.xml"`,
          },
        });
      }

      if (download === 'pdf') {
        const pdfBytes = gerarDanfePdf(nota.xml, nota.situacao);
        return new NextResponse(Buffer.from(pdfBytes), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="DANFE-${nota.numero || nota.chaveAcesso}.pdf"`,
          },
        });
      }
    }

    // Busca por empresa
    let empresa = null;
    if (cnpjParam) {
      empresa = await db.empresa.findFirst({
        where: { cnpj: { contains: cnpjParam } },
        select: { id: true, cnpj: true, razaoSocial: true },
      });
    } else if (empresaIdParam) {
      empresa = await db.empresa.findUnique({
        where: { id: empresaIdParam },
        select: { id: true, cnpj: true, razaoSocial: true },
      });
    }

    if (!empresa) {
      return NextResponse.json({ error: 'Informe um CNPJ ou empresaId válido.' }, { status: 400 });
    }

    const papel = url.searchParams.get('papel') || 'todas';
    const cnpjLimpo = empresa.cnpj.replace(/\D/g, '');

    const where = filtroNotasDestinadas(empresa.id, {
      mes: url.searchParams.get('mes'),
      de: url.searchParams.get('de'),
      ate: url.searchParams.get('ate'),
      situacao: url.searchParams.get('situacao'),
      busca: url.searchParams.get('busca'),
      papel,
      cnpjEmpresa: empresa.cnpj,
    });

    const notas = await db.nfeDestinada.findMany({
      where,
      select: {
        id: true,
        chaveAcesso: true,
        numero: true,
        serie: true,
        dataEmissao: true,
        tipoOperacao: true,
        valorNf: true,
        situacao: true,
        manifestacao: true,
        emitenteNome: true,
        emitenteCnpj: true,
        possuiXml: true,
        xml: download === 'zip',
      },
      orderBy: [{ dataEmissao: 'desc' }, { numero: 'desc' }],
      take: LIMITE_MAX,
    });

    // Se download em lote ZIP foi solicitado
    if (download === 'zip') {
      const arquivos: ArquivoZip[] = [];
      for (const n of notas) {
        if (!n.xml) continue;
        const baseNome = `NFe_${n.numero || n.chaveAcesso}`;
        arquivos.push({ nome: `${baseNome}.xml`, conteudo: Buffer.from(n.xml, 'utf8') });
        try {
          const pdfBytes = gerarDanfePdf(n.xml, n.situacao);
          arquivos.push({ nome: `${baseNome}.pdf`, conteudo: Buffer.from(pdfBytes) });
        } catch {}
      }

      if (arquivos.length === 0) {
        return NextResponse.json({ error: 'Nenhum XML disponível no período para gerar o pacote ZIP.' }, { status: 404 });
      }

      const zip = await criarZipBuffer(arquivos);
      return new NextResponse(Buffer.from(zip), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="nfe-pacote-${cnpjLimpo}.zip"`,
        },
      });
    }

    // Retorno JSON estruturado
    const baseUrl = url.origin;
    const lista = notas.map(n => {
      const emitLimpo = (n.emitenteCnpj || '').replace(/\D/g, '');
      const ehEmitida = cnpjLimpo.length >= 8 && emitLimpo.includes(cnpjLimpo);
      return {
        id: n.id,
        chaveAcesso: n.chaveAcesso,
        numero: n.numero,
        serie: n.serie,
        dataEmissao: n.dataEmissao,
        papel: ehEmitida ? 'emitida' : 'recebida',
        tipoOperacao: n.tipoOperacao, // 0 = Entrada, 1 = Saída
        valorTotal: n.valorNf,
        situacao: n.situacao,
        manifestacao: n.manifestacao,
        emitente: {
          nome: n.emitenteNome,
          cnpj: n.emitenteCnpj,
        },
        possuiXml: n.possuiXml,
        downloads: n.possuiXml ? {
          xml: `${baseUrl}/api/nfe/integracao?chave=${n.chaveAcesso}&download=xml`,
          pdf: `${baseUrl}/api/nfe/integracao?chave=${n.chaveAcesso}&download=pdf`,
        } : null,
      };
    });

    return NextResponse.json({
      sucesso: true,
      empresa: {
        id: empresa.id,
        cnpj: empresa.cnpj,
        razaoSocial: empresa.razaoSocial,
      },
      filtros: {
        papel,
        mes: url.searchParams.get('mes') || null,
        de: url.searchParams.get('de') || null,
        ate: url.searchParams.get('ate') || null,
      },
      total: lista.length,
      resumo: {
        totalEmitidas: lista.filter(n => n.papel === 'emitida').length,
        totalRecebidas: lista.filter(n => n.papel === 'recebida').length,
        valorTotalEmitidas: lista.filter(n => n.papel === 'emitida').reduce((acc, n) => acc + n.valorTotal, 0),
        valorTotalRecebidas: lista.filter(n => n.papel === 'recebida').reduce((acc, n) => acc + n.valorTotal, 0),
      },
      notas: lista,
    });
  } catch (error) {
    console.error('Erro em GET nfe/integracao:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro interno na API de integração NF-e.' }, { status: 500 });
  }
}
