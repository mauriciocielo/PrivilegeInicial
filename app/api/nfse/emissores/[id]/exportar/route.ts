import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import logoNfse from '../../../../../../lib/nfse/dados/logo-nfse.json';
import db from '../../../../../../lib/prisma';
import { requireAuth } from '../../../../../../lib/api-auth';
import { captureError } from '../../../../../../lib/sentry-helper';
import { acessoEmissaoNegado } from '../../../../../../lib/nfse/servidor';
import { apenasDigitos } from '../../../../../../lib/nfse/dps';
import {
  gerarDanfsePdf, gerarDanfsePdfUnico, lerDadosDanfse, marcaDaguaDaNota, urlConsultaPublica,
} from '../../../../../../lib/nfse/danfse';
import { criarZipBuffer, type ArquivoZip } from '../../../../../../lib/nfse/zip';

function limparNomeArquivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'Nota';
}

/**
 * Exporta as notas fiscais da empresa no mês informado (`mes=YYYY-MM`).
 * Parâmetros:
 * - `mes`: YYYY-MM (filtra pela dataEmissao ou dataCompetencia da nota)
 * - `papel`: 'prestadas' | 'tomadas' | 'todas' (padrão 'prestadas')
 * - `formato`: 'xml' | 'pdf' | 'ambos' | 'pdf_unico' (padrão 'ambos')
 * - `incluirCanceladas`: '1' | '0' (padrão '0', exporta apenas emitidas)
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;
    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const url = new URL(request.url);
    const mes = (url.searchParams.get('mes') || '').trim();
    const papel = url.searchParams.get('papel') || 'prestadas';
    const formato = url.searchParams.get('formato') || 'ambos';
    const incluirCanceladas = url.searchParams.get('incluirCanceladas') === '1';

    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { cnpj: true, razaoSocial: true, nomeFantasia: true },
    });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    const cnpjEmpresa = apenasDigitos(empresa.cnpj);

    const todasNotas = await db.nfsE.findMany({
      where: {
        empresaId,
        chaveAcesso: { not: null },
        ...(incluirCanceladas ? { status: { in: ['emitida', 'cancelada'] } } : { status: 'emitida' }),
      },
      include: {
        documento: { select: { nfseXml: true, eventoXml: true } },
      },
      orderBy: [{ dataEmissao: 'asc' }, { numero: 'asc' }],
    });

    const filtradas = todasNotas.filter(n => {
      if (!n.documento?.nfseXml) return false;
      if (mes && !n.dataEmissao.startsWith(mes) && n.dataCompetencia !== mes) return false;
      const prestDoc = apenasDigitos(n.prestadorCnpj || '');
      const ehTomada = prestDoc !== '' && prestDoc !== cnpjEmpresa;
      if (papel === 'prestadas' && ehTomada) return false;
      if (papel === 'tomadas' && !ehTomada) return false;
      return true;
    });

    if (filtradas.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma nota com XML autorizado encontrada para o período e filtro selecionados.' },
        { status: 404 },
      );
    }

    const logoPng = Buffer.from(logoNfse.png, 'base64');
    const sufixoPapel = papel === 'tomadas' ? 'ServicosTomados' : papel === 'todas' ? 'TodasNotas' : 'NotasEmitidas';
    const sufixoMes = mes || 'Periodo';
    const nomeEmpresa = limparNomeArquivo(empresa.nomeFantasia || empresa.razaoSocial || cnpjEmpresa);

    if (formato === 'pdf_unico') {
      const paginas = [];
      for (const n of filtradas) {
        const dados = lerDadosDanfse(n.documento!.nfseXml);
        const qrPng = await QRCode.toBuffer(urlConsultaPublica(dados.chave), { errorCorrectionLevel: 'M', margin: 0, width: 300 });
        paginas.push({
          dados,
          opcoes: {
            logoPng,
            qrPng,
            marcaDagua: marcaDaguaDaNota(n.status, n.documento!.eventoXml),
          },
        });
      }
      const pdfUnico = gerarDanfsePdfUnico(paginas);
      return new Response(new Uint8Array(pdfUnico), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="DANFSe-${nomeEmpresa}-${sufixoPapel}-${sufixoMes}.pdf"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const arquivos: ArquivoZip[] = [];
    const nomesUsados = new Set<string>();
    const garantirUnico = (nomeBase: string, ext: string): string => {
      let candidato = `${nomeBase}.${ext}`;
      let seq = 2;
      while (nomesUsados.has(candidato)) {
        candidato = `${nomeBase}_${seq}.${ext}`;
        seq++;
      }
      nomesUsados.add(candidato);
      return candidato;
    };

    for (const n of filtradas) {
      const prestDoc = apenasDigitos(n.prestadorCnpj || '');
      const ehTomada = prestDoc !== '' && prestDoc !== cnpjEmpresa;
      const contraparte = limparNomeArquivo(ehTomada ? n.prestadorRazaoSocial : n.tomadorRazaoSocial);
      const numStr = (n.numero || 'SN').replace(/\D/g, '') || 'SN';
      const prefixoStatus = n.status === 'cancelada' ? 'CANCELADA_' : '';
      const base = `${prefixoStatus}NFSe_${numStr}_${n.dataEmissao}_${contraparte}`;

      if (formato === 'xml' || formato === 'ambos') {
        arquivos.push({
          nome: garantirUnico(formato === 'ambos' ? `xml/${base}` : base, 'xml'),
          conteudo: Buffer.from(n.documento!.nfseXml, 'utf8'),
        });
      }

      if (formato === 'pdf' || formato === 'ambos') {
        const dados = lerDadosDanfse(n.documento!.nfseXml);
        const qrPng = await QRCode.toBuffer(urlConsultaPublica(dados.chave), { errorCorrectionLevel: 'M', margin: 0, width: 300 });
        const pdf = gerarDanfsePdf(dados, {
          logoPng,
          qrPng,
          marcaDagua: marcaDaguaDaNota(n.status, n.documento!.eventoXml),
        });
        arquivos.push({
          nome: garantirUnico(formato === 'ambos' ? `pdf/${base}` : base, 'pdf'),
          conteudo: pdf,
        });
      }
    }

    const zip = criarZipBuffer(arquivos);
    return new Response(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="NFSe-${nomeEmpresa}-${sufixoPapel}-${sufixoMes}.zip"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Erro em GET nfse/emissores/exportar:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao exportar as notas fiscais.' }, { status: 500 });
  }
}
