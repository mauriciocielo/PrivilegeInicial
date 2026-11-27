import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { apenasDigitos } from '../../../../lib/nfse/dps';
import { criarZipBuffer, type ArquivoZip } from '../../../../lib/nfse/zip';
import { resolverEmpresasDaCarteira } from '../../../../lib/escritorio-carteira';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function limparPasta(texto: string): string {
  return (texto || 'Empresa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'Empresa';
}

/**
 * GET /api/escritorio/fechamento-fiscal?mes=YYYY-MM
 * Gera em 1 clique o Pacote de Fechamento Fiscal do Mês da carteira inteira:
 * - Planilha Excel consolidada (Resumo por Empresa + Notas Detalhadas)
 * - Pastas organizadas por cliente: CNPJ_RazaoSocial/NFSe_Prestadas/, NFSe_Tomadas/, NFe_Emitidas/, NFe_Recebidas/
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito ao escritório contábil.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const mesParam = (url.searchParams.get('mes') || '').trim();
    const competencia = /^\d{4}-\d{2}$/.test(mesParam)
      ? mesParam
      : new Date().toISOString().slice(0, 7);

    const { empresaIds } = await resolverEmpresasDaCarteira(auth.session.userId, auth.session.role);
    if (empresaIds.length === 0) {
      return NextResponse.json({ error: 'Nenhuma empresa vinculada à sua carteira.' }, { status: 404 });
    }

    const [empresas, nfses, nfes] = await Promise.all([
      db.empresa.findMany({
        where: { id: { in: empresaIds } },
        select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
        orderBy: { razaoSocial: 'asc' },
      }),
      db.nfsE.findMany({
        where: {
          empresaId: { in: empresaIds },
          status: { in: ['emitida', 'cancelada'] },
          OR: [
            { dataCompetencia: { startsWith: competencia } },
            { dataEmissao: { startsWith: competencia } },
          ],
        },
        include: { documento: { select: { nfseXml: true } } },
        orderBy: [{ dataEmissao: 'asc' }, { numero: 'asc' }],
      }),
      db.nfeDestinada.findMany({
        where: {
          empresaId: { in: empresaIds },
          dataEmissao: { startsWith: competencia },
        },
        select: {
          empresaId: true,
          chaveAcesso: true,
          numero: true,
          serie: true,
          dataEmissao: true,
          emitenteCnpj: true,
          emitenteNome: true,
          valorNf: true,
          situacao: true,
          xml: true,
        },
        orderBy: { dataEmissao: 'asc' },
      }),
    ]);

    const empMap = new Map(empresas.map((e) => [e.id, e]));
    const resumoMap = new Map<
      string,
      {
        razaoSocial: string;
        cnpj: string;
        qtdNfsePrestadas: number;
        totalNfsePrestadas: number;
        qtdNfseTomadas: number;
        totalNfseTomadas: number;
        qtdNfeEmitidas: number;
        totalNfeEmitidas: number;
        qtdNfeRecebidas: number;
        totalNfeRecebidas: number;
      }
    >();

    for (const e of empresas) {
      resumoMap.set(e.id, {
        razaoSocial: e.razaoSocial,
        cnpj: e.cnpj,
        qtdNfsePrestadas: 0,
        totalNfsePrestadas: 0,
        qtdNfseTomadas: 0,
        totalNfseTomadas: 0,
        qtdNfeEmitidas: 0,
        totalNfeEmitidas: 0,
        qtdNfeRecebidas: 0,
        totalNfeRecebidas: 0,
      });
    }

    const arquivos: ArquivoZip[] = [];
    const linhasDetalhe: Array<Record<string, any>> = [];
    let totalXmls = 0;

    // 1. NFS-e (Prestadas e Tomadas)
    for (const n of nfses) {
      const emp = empMap.get(n.empresaId);
      const res = resumoMap.get(n.empresaId);
      if (!emp || !res) continue;

      const cnpjEmp = apenasDigitos(emp.cnpj);
      const pCnpj = apenasDigitos(n.prestadorCnpj);
      const ehPrestada = !pCnpj || pCnpj === cnpjEmp;
      const val = Number(n.valorServicos || 0);

      if (n.status === 'emitida') {
        if (ehPrestada) {
          res.qtdNfsePrestadas++;
          res.totalNfsePrestadas += val;
        } else {
          res.qtdNfseTomadas++;
          res.totalNfseTomadas += val;
        }
      }

      linhasDetalhe.push({
        Empresa: emp.razaoSocial,
        CNPJ_Empresa: emp.cnpj,
        Tipo: ehPrestada ? 'NFS-e Prestada' : 'NFS-e Tomada',
        Numero: n.numero,
        Data_Emissao: n.dataEmissao.slice(0, 10),
        Situacao: n.status,
        Contraparte: ehPrestada ? n.tomadorRazaoSocial : n.prestadorRazaoSocial,
        CNPJ_CPF_Contraparte: ehPrestada ? n.tomadorCnpjCpf : n.prestadorCnpj,
        Valor: val,
        Chave: n.chaveAcesso || '',
      });

      if (n.documento?.nfseXml) {
        const pastaEmp = `${cnpjEmp}_${limparPasta(emp.nomeFantasia || emp.razaoSocial)}`;
        const sub = ehPrestada ? 'NFSe_Prestadas' : 'NFSe_Tomadas';
        const sufCancel = n.status === 'cancelada' ? '_CANCELADA' : '';
        const num = (n.numero || n.id.slice(0, 8)).replace(/\W+/g, '');
        arquivos.push({
          nome: `${pastaEmp}/${sub}/NFSe_${num}${sufCancel}.xml`,
          conteudo: Buffer.from(n.documento.nfseXml, 'utf8'),
        });
        totalXmls++;
      }
    }

    // 2. NF-e / CT-e (Emitidas e Recebidas)
    for (const n of nfes) {
      const emp = empMap.get(n.empresaId);
      const res = resumoMap.get(n.empresaId);
      if (!emp || !res) continue;

      const cnpjEmp = apenasDigitos(emp.cnpj);
      const eCnpj = apenasDigitos(n.emitenteCnpj);
      const ehEmitida = Boolean(cnpjEmp && eCnpj === cnpjEmp);
      const val = Number(n.valorNf || 0);

      if (n.situacao === 'autorizada') {
        if (ehEmitida) {
          res.qtdNfeEmitidas++;
          res.totalNfeEmitidas += val;
        } else {
          res.qtdNfeRecebidas++;
          res.totalNfeRecebidas += val;
        }
      }

      linhasDetalhe.push({
        Empresa: emp.razaoSocial,
        CNPJ_Empresa: emp.cnpj,
        Tipo: ehEmitida ? 'NF-e Emitida' : 'NF-e Recebida',
        Numero: n.numero || '',
        Data_Emissao: n.dataEmissao.slice(0, 10),
        Situacao: n.situacao,
        Contraparte: n.emitenteNome || '',
        CNPJ_CPF_Contraparte: n.emitenteCnpj || '',
        Valor: val,
        Chave: n.chaveAcesso,
      });

      if (n.xml) {
        const pastaEmp = `${cnpjEmp}_${limparPasta(emp.nomeFantasia || emp.razaoSocial)}`;
        const sub = ehEmitida ? 'NFe_Emitidas' : 'NFe_Recebidas';
        const sufCancel = n.situacao === 'cancelada' ? '_CANCELADA' : '';
        const num = (n.numero || n.chaveAcesso.slice(-9)).replace(/\W+/g, '');
        arquivos.push({
          nome: `${pastaEmp}/${sub}/NFe_${num}_${n.chaveAcesso.slice(-6)}${sufCancel}.xml`,
          conteudo: Buffer.from(n.xml, 'utf8'),
        });
        totalXmls++;
      }
    }

    // 3. Planilha Excel consolidada da carteira
    const linhasResumo = Array.from(resumoMap.values()).map((r) => ({
      Empresa: r.razaoSocial,
      CNPJ: r.cnpj,
      'Qtd NFS-e Prestadas': r.qtdNfsePrestadas,
      'Total NFS-e Prestadas (R$)': Math.round(r.totalNfsePrestadas * 100) / 100,
      'Qtd NF-e Emitidas': r.qtdNfeEmitidas,
      'Total NF-e Emitidas (R$)': Math.round(r.totalNfeEmitidas * 100) / 100,
      'Faturamento Total Mes (R$)': Math.round((r.totalNfsePrestadas + r.totalNfeEmitidas) * 100) / 100,
      'Qtd NFS-e Tomadas': r.qtdNfseTomadas,
      'Total NFS-e Tomadas (R$)': Math.round(r.totalNfseTomadas * 100) / 100,
      'Qtd NF-e Recebidas': r.qtdNfeRecebidas,
      'Total NF-e Recebidas (R$)': Math.round(r.totalNfeRecebidas * 100) / 100,
    }));

    const wb = XLSX.utils.book_new();
    const wsResumo = XLSX.utils.json_to_sheet(linhasResumo);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Carteira');
    const wsDetalhe = XLSX.utils.json_to_sheet(
      linhasDetalhe.length > 0
        ? linhasDetalhe
        : [{ Aviso: `Nenhuma nota fiscal encontrada na competência ${competencia}.` }]
    );
    XLSX.utils.book_append_sheet(wb, wsDetalhe, 'Notas Detalhadas');
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    arquivos.unshift({
      nome: `Resumo_Fechamento_${competencia}.xlsx`,
      conteudo: Buffer.from(xlsxBuffer),
    });

    const zipBuffer = criarZipBuffer(arquivos);
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="Fechamento_Fiscal_${competencia}.zip"`,
        'X-Total-Empresas': String(empresas.length),
        'X-Total-Xmls': String(totalXmls),
      },
    });
  } catch (error) {
    console.error('Erro em GET /api/escritorio/fechamento-fiscal:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar pacote de fechamento fiscal.' }, { status: 500 });
  }
}
