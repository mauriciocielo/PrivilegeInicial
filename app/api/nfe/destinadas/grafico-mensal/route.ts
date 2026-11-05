import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { captureError } from '../../../../../lib/sentry-helper';
import { acessoNegado } from '../../../../../lib/nfse/servidor';

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const NOMES_MESES_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

function formatarLabelMes(mesStr: string): { label: string; mesNome: string } {
  // mesStr esperado: 'YYYY-MM'
  const partes = mesStr.split('-');
  if (partes.length === 2) {
    const ano = partes[0];
    const mesNum = parseInt(partes[1], 10);
    if (mesNum >= 1 && mesNum <= 12) {
      const abrev = NOMES_MESES_ABREV[mesNum - 1];
      const completo = NOMES_MESES[mesNum - 1];
      const ano2 = ano.slice(2);
      return {
        label: `${abrev}/${ano2}`,
        mesNome: `${completo}/${ano}`,
      };
    }
  }
  return { label: mesStr, mesNome: mesStr };
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const empresaId = url.searchParams.get('empresaId') || '';
    if (!empresaId) {
      return NextResponse.json({ error: 'Informe o ID da empresa/cliente.' }, { status: 400 });
    }

    const negado = await acessoNegado(auth.session, empresaId);
    if (negado) return negado;

    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
    });

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }

    const cnpjLimpo = empresa.cnpj.replace(/\D/g, '');

    // 1. Agrupamento mensal de NF-e (Mercadorias) e CT-e (Fretes)
    const nfeRows = await db.$queryRaw<Array<{
      mes: string;
      total: number;
      qtd_emitidas: number;
      qtd_recebidas: number;
      com_xml: number;
      sem_xml: number;
      total_cte: number;
      valor_total: number;
    }>>`
      SELECT 
        substring("dataEmissao" from 1 for 7) as mes,
        count(*)::int as total,
        count(*) filter (where "emitenteCnpj" LIKE ${'%' + cnpjLimpo + '%'})::int as qtd_emitidas,
        count(*) filter (where "emitenteCnpj" NOT LIKE ${'%' + cnpjLimpo + '%'})::int as qtd_recebidas,
        count(*) filter (where "possuiXml" = true)::int as com_xml,
        count(*) filter (where "possuiXml" = false or "possuiXml" is null)::int as sem_xml,
        count(*) filter (where substring("chaveAcesso" from 21 for 2) = '57')::int as total_cte,
        coalesce(sum("valorNf"), 0)::float as valor_total
      FROM "NfeDestinada"
      WHERE "empresaId" = ${empresaId} 
        AND "dataEmissao" IS NOT NULL 
        AND length("dataEmissao") >= 7
      GROUP BY mes
      ORDER BY mes ASC
    `;

    // 2. Agrupamento mensal de NFS-e (Serviços)
    const nfseRows = await db.$queryRaw<Array<{
      mes: string;
      total_nfse: number;
      valor_nfse: number;
    }>>`
      SELECT 
        substring("dataEmissao" from 1 for 7) as mes,
        count(*)::int as total_nfse,
        coalesce(sum("valorServicos"), 0)::float as valor_nfse
      FROM "NfsE"
      WHERE "empresaId" = ${empresaId} 
        AND "dataEmissao" IS NOT NULL 
        AND length("dataEmissao") >= 7
      GROUP BY mes
      ORDER BY mes ASC
    `;

    // 3. Combina os meses e monta os dados do gráfico
    const mapaMeses = new Map<string, {
      mes: string;
      label: string;
      mesNome: string;
      recebidas: number;
      emitidas: number;
      comXml: number;
      semXml: number;
      nfse: number;
      cte: number;
      total: number;
      valorTotal: number;
    }>();

    for (const r of nfeRows) {
      if (!r.mes) continue;
      const { label, mesNome } = formatarLabelMes(r.mes);
      mapaMeses.set(r.mes, {
        mes: r.mes,
        label,
        mesNome,
        recebidas: r.qtd_recebidas || 0,
        emitidas: r.qtd_emitidas || 0,
        comXml: r.com_xml || 0,
        semXml: r.sem_xml || 0,
        nfse: 0,
        cte: r.total_cte || 0,
        total: r.total || 0,
        valorTotal: r.valor_total || 0,
      });
    }

    for (const s of nfseRows) {
      if (!s.mes) continue;
      const existente = mapaMeses.get(s.mes);
      if (existente) {
        existente.nfse = s.total_nfse || 0;
        existente.total += s.total_nfse || 0;
        existente.valorTotal += s.valor_nfse || 0;
      } else {
        const { label, mesNome } = formatarLabelMes(s.mes);
        mapaMeses.set(s.mes, {
          mes: s.mes,
          label,
          mesNome,
          recebidas: 0,
          emitidas: 0,
          comXml: s.total_nfse || 0,
          semXml: 0,
          nfse: s.total_nfse || 0,
          cte: 0,
          total: s.total_nfse || 0,
          valorTotal: s.valor_nfse || 0,
        });
      }
    }

    const meses = Array.from(mapaMeses.values()).sort((a, b) => a.mes.localeCompare(b.mes));

    // 4. Calcula métricas e sumários do cliente
    let totalGeral = 0;
    let totalRecebidas = 0;
    let totalEmitidas = 0;
    let totalNfse = 0;
    let totalCte = 0;
    let totalComXml = 0;
    let valorAcumulado = 0;
    let mesPico = { mes: '', label: 'Nenhum', total: 0 };

    for (const m of meses) {
      totalGeral += m.total;
      totalRecebidas += m.recebidas;
      totalEmitidas += m.emitidas;
      totalNfse += m.nfse;
      totalCte += m.cte;
      totalComXml += m.comXml;
      valorAcumulado += m.valorTotal;

      if (m.total > mesPico.total) {
        mesPico = { mes: m.mes, label: m.label, total: m.total };
      }
    }

    const qtdMeses = meses.length || 1;
    const mediaMensal = Math.round(totalGeral / qtdMeses);
    const taxaXml = totalGeral > 0 ? Number(((totalComXml / totalGeral) * 100).toFixed(1)) : 100;

    return NextResponse.json({
      sucesso: true,
      empresa: {
        id: empresa.id,
        razaoSocial: empresa.razaoSocial,
        nomeFantasia: empresa.nomeFantasia,
        cnpj: empresa.cnpj,
      },
      resumo: {
        totalGeral,
        totalRecebidas,
        totalEmitidas,
        totalNfse,
        totalCte,
        totalComXml,
        taxaXml,
        mediaMensal,
        mesPico,
        valorAcumulado,
        quantidadeMeses: meses.length,
      },
      meses,
    });
  } catch (error) {
    console.error('Erro em GET nfe/destinadas/grafico-mensal:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar métricas mensais de arquivos.' }, { status: 500 });
  }
}
