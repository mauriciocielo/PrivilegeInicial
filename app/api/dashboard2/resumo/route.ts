import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { filtroEmpresasNfse } from '../../../../lib/nfse/escopo';
import { ehHorarioNoturnoBrasilia } from '../../../../lib/nfe/monitor';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const filtroEmpresas = await filtroEmpresasNfse(auth.session);
    const empresasPermitidas = await db.empresa.findMany({
      where: filtroEmpresas,
      select: { id: true, cnpj: true, razaoSocial: true, nomeFantasia: true },
    });
    const ids = empresasPermitidas.map(e => e.id);

    const agora = new Date();
    const em30Dias = new Date(Date.now() + 30 * 86_400_000);
    const vinteQuatroHorasAtras = new Date(Date.now() - 24 * 3600 * 1000);

    // Consultas agregadas em paralelo
    const [
      totalNotas,
      totalCte,
      totalNfeEmitidas,
      totalNfeRecebidas,
      somaValor,
      totalNfse,
      totalNfseTomadas,
      configs,
      totalErros24h,
      situacoesFiscais,
    ] = await Promise.all([
      db.nfeDestinada.count({ where: { empresaId: { in: ids } } }),
      db.nfeDestinada.count({
        where: {
          empresaId: { in: ids },
          chaveAcesso: { contains: '57' },
        },
      }),
      db.nfeDestinada.count({
        where: {
          empresaId: { in: ids },
          tipoOperacao: 1,
        },
      }),
      db.nfeDestinada.count({
        where: {
          empresaId: { in: ids },
          tipoOperacao: 0,
        },
      }),
      db.nfeDestinada.aggregate({
        where: { empresaId: { in: ids } },
        _sum: { valorNf: true },
      }),
      db.nfsE.count({ where: { empresaId: { in: ids } } }),
      db.nfsE.count({
        where: {
          empresaId: { in: ids },
          prestadorRazaoSocial: 'Prestador não informado',
        },
      }),
      db.nfseConfig.findMany({
        where: { empresaId: { in: ids } },
        select: {
          empresaId: true,
          certValidoAte: true,
          certPfxCifrado: true,
          usarProcuracao: true,
          procuracaoStatus: true,
        },
      }),
      db.fiscalMonitorLog.count({
        where: {
          status: 'erro',
          createdAt: { gte: vinteQuatroHorasAtras },
        },
      }),
      db.certidaoFiscal.findMany({
        where: { empresaId: { in: ids } },
        select: {
          empresaId: true,
          situacao: true,
          validoAte: true,
        },
      }),
    ]);

    // Métricas de Certificados A1
    let comCertificado = 0;
    let vencendo30d = 0;
    let vencidos = 0;
    let comProcuracao = 0;

    for (const c of configs) {
      if (c.usarProcuracao) comProcuracao++;
      if (c.certPfxCifrado) {
        comCertificado++;
        if (c.certValidoAte) {
          const val = new Date(c.certValidoAte);
          if (val < agora) vencidos++;
          else if (val <= em30Dias) vencendo30d++;
        }
      }
    }
    const semCertificado = Math.max(0, ids.length - comCertificado);

    // Métricas de CNDs
    let cndSemPendencias = 0;
    let cndComEfeito = 0;
    let cndComPendencias = 0;
    let cndAtencao = 0;

    for (const sf of situacoesFiscais) {
      const sit = (sf.situacao || '').toUpperCase();
      if (sit.includes('SEM_PENDENCIAS') || sit.includes('NEGATIVA')) cndSemPendencias++;
      else if (sit.includes('COM_EFEITO') || sit.includes('SUSPENSO')) cndComEfeito++;
      else if (sit.includes('PENDENCIA') || sit.includes('POSITIVA')) cndComPendencias++;
      else cndAtencao++;
    }
    const cndNaoConsultadas = Math.max(0, ids.length - situacoesFiscais.length);

    const totalNfseEmitidas = Math.max(0, totalNfse - totalNfseTomadas);

    return NextResponse.json({
      resumo: {
        totalEmpresas: ids.length,
        ehHorarioNoturno: ehHorarioNoturnoBrasilia(),
        notas: {
          totalGeral: totalNotas + totalNfse,
          totalNfe: totalNotas - totalCte,
          totalCte,
          totalNfeEmitidas,
          totalNfeRecebidas,
          totalNfse,
          totalNfseEmitidas,
          totalNfseTomadas,
          valorTotal: somaValor._sum.valorNf || 0,
        },
        cnds: {
          total: ids.length,
          semPendencias: cndSemPendencias,
          comEfeito: cndComEfeito,
          comPendencias: cndComPendencias,
          atencao: cndAtencao,
          naoConsultadas: cndNaoConsultadas,
        },
        certificados: {
          totalEmpresas: ids.length,
          comCertificado,
          comProcuracao,
          vencendo30d,
          vencidos,
          semCertificado,
        },
        monitor: {
          totalAtivos: ids.length,
          erros24h: totalErros24h,
          frequenciaMinutos: 10,
        },
      },
    });
  } catch (error) {
    console.error('Erro em GET dashboard2/resumo:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar resumo fiscal.' }, { status: 500 });
  }
}
