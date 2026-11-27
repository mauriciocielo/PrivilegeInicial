import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { apenasDigitos } from '../../../../lib/nfse/dps';
import { resolverEmpresasDaCarteira } from '../../../../lib/escritorio-carteira';

export const dynamic = 'force-dynamic';

const TETO_MEI = 81_000;
const SUBLIMITE_SIMPLES = 3_600_000;
const TETO_SIMPLES = 4_800_000;

function inicioUltimos12Meses(competencia: string): string {
  const [anoStr, mesStr] = competencia.split('-');
  const ano = Number(anoStr) || new Date().getFullYear();
  const mes = Number(mesStr) || new Date().getMonth() + 1;
  const d = new Date(ano, mes - 12, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function fimDaCompetencia(competencia: string): string {
  const [anoStr, mesStr] = competencia.split('-');
  const ano = Number(anoStr) || new Date().getFullYear();
  const mes = Number(mesStr) || new Date().getMonth() + 1;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
}

/**
 * GET /api/escritorio/saude-carteira?mes=YYYY-MM
 * Painel executivo "Saúde da Carteira" do escritório contábil:
 * - Semáforo por empresa (Certificado A1, Recorrências pendentes, Faturamento mês e RBT12 MEI/Simples)
 * - KPIs consolidados da carteira inteira.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito ao painel do escritório.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const mesParam = (url.searchParams.get('mes') || '').trim();
    const competencia = /^\d{4}-\d{2}$/.test(mesParam)
      ? mesParam
      : new Date().toISOString().slice(0, 7);

    const { vinculo, ehAdminEscritorio, empresaIds } = await resolverEmpresasDaCarteira(
      auth.session.userId,
      auth.session.role
    );

    if (empresaIds.length === 0) {
      return NextResponse.json({
        competencia,
        escritorio: vinculo
          ? { id: vinculo.escritorioId, nome: vinculo.nomeEscritorio, papel: vinculo.papel }
          : null,
        ehAdminEscritorio,
        resumo: {
          totalEmpresas: 0,
          verdes: 0,
          amarelas: 0,
          vermelhas: 0,
          certVencidos: 0,
          certVencendo: 0,
          alertasRbt12: 0,
          recorrenciasPendentes: 0,
          faturamentoMesTotal: 0,
          rbt12CarteiraTotal: 0,
        },
        empresas: [],
      });
    }

    const inicio12m = inicioUltimos12Meses(competencia);
    const fimComp = fimDaCompetencia(competencia);

    const [empresasRaw, nfses12m, nfes12m] = await Promise.all([
      db.empresa.findMany({
        where: { id: { in: empresaIds } },
        select: {
          id: true,
          razaoSocial: true,
          nomeFantasia: true,
          cnpj: true,
          telefone: true,
          email: true,
          nfseConfig: {
            select: {
              opSimpNac: true,
              usarProcuracao: true,
              procuracaoStatus: true,
              certValidoAte: true,
              certTitular: true,
              certPfxCifrado: true,
            },
          },
        },
        orderBy: { razaoSocial: 'asc' },
      }),
      db.nfsE.findMany({
        where: {
          empresaId: { in: empresaIds },
          status: 'emitida',
          dataEmissao: { gte: inicio12m, lte: `${fimComp}T23:59:59` },
        },
        select: {
          empresaId: true,
          prestadorCnpj: true,
          dataEmissao: true,
          dataCompetencia: true,
          valorServicos: true,
        },
      }),
      db.nfeDestinada.findMany({
        where: {
          empresaId: { in: empresaIds },
          situacao: 'autorizada',
          dataEmissao: { gte: inicio12m, lte: `${fimComp}T23:59:59` },
        },
        select: {
          empresaId: true,
          emitenteCnpj: true,
          dataEmissao: true,
          valorNf: true,
        },
      }),
    ]);

    // Recorrências ativas por empresa (tabela auxiliar opcional)
    const recorrenciasPorEmpresa = new Map<string, number>();
    try {
      const recRows = await db.$queryRawUnsafe<Array<{ empresa_id: string; total: number }>>(
        `SELECT empresa_id, COUNT(*)::int AS total
         FROM nfse_recorrencias
         WHERE ativo = TRUE AND empresa_id = ANY($1::text[])
         GROUP BY empresa_id`,
        empresaIds
      );
      for (const r of recRows) {
        recorrenciasPorEmpresa.set(String(r.empresa_id), Number(r.total || 0));
      }
    } catch {
      // Tabela nfse_recorrencias ainda não criada — ignora
    }

    const cnpjPorEmpresa = new Map<string, string>();
    for (const e of empresasRaw) {
      cnpjPorEmpresa.set(e.id, apenasDigitos(e.cnpj));
    }

    // Agrega faturamento do mês e RBT12 por empresa
    const agg = new Map<
      string,
      {
        nfseMesQtd: number;
        nfseMesValor: number;
        nfeEmitMesQtd: number;
        nfeEmitMesValor: number;
        nfeRecMesQtd: number;
        nfeRecMesValor: number;
        rbt12: number;
      }
    >();

    const getAgg = (id: string) => {
      let cur = agg.get(id);
      if (!cur) {
        cur = {
          nfseMesQtd: 0,
          nfseMesValor: 0,
          nfeEmitMesQtd: 0,
          nfeEmitMesValor: 0,
          nfeRecMesQtd: 0,
          nfeRecMesValor: 0,
          rbt12: 0,
        };
        agg.set(id, cur);
      }
      return cur;
    };

    for (const n of nfses12m) {
      const cnpjEmp = cnpjPorEmpresa.get(n.empresaId) || '';
      const pCnpj = apenasDigitos(n.prestadorCnpj);
      const ehPrestada = !pCnpj || pCnpj === cnpjEmp;
      if (!ehPrestada) continue;
      const val = Number(n.valorServicos || 0);
      const cur = getAgg(n.empresaId);
      cur.rbt12 += val;
      if (n.dataEmissao.startsWith(competencia) || n.dataCompetencia === competencia) {
        cur.nfseMesQtd++;
        cur.nfseMesValor += val;
      }
    }

    for (const n of nfes12m) {
      const cnpjEmp = cnpjPorEmpresa.get(n.empresaId) || '';
      const eCnpj = apenasDigitos(n.emitenteCnpj);
      const ehEmitida = Boolean(cnpjEmp && eCnpj === cnpjEmp);
      const val = Number(n.valorNf || 0);
      const cur = getAgg(n.empresaId);
      if (ehEmitida) {
        cur.rbt12 += val;
        if (n.dataEmissao.startsWith(competencia)) {
          cur.nfeEmitMesQtd++;
          cur.nfeEmitMesValor += val;
        }
      } else if (n.dataEmissao.startsWith(competencia)) {
        cur.nfeRecMesQtd++;
        cur.nfeRecMesValor += val;
      }
    }

    const agora = Date.now();
    const resumo = {
      totalEmpresas: empresasRaw.length,
      verdes: 0,
      amarelas: 0,
      vermelhas: 0,
      certVencidos: 0,
      certVencendo: 0,
      alertasRbt12: 0,
      recorrenciasPendentes: 0,
      faturamentoMesTotal: 0,
      rbt12CarteiraTotal: 0,
    };

    const lista = empresasRaw.map((emp) => {
      const cfg = emp.nfseConfig;
      const a = getAgg(emp.id);
      const faturamentoMes = Math.round((a.nfseMesValor + a.nfeEmitMesValor) * 100) / 100;
      const rbt12 = Math.round(a.rbt12 * 100) / 100;

      // Certificado A1
      let statusCertificado: 'valido' | 'vencendo' | 'vencido' | 'procuracao' | 'ausente' = 'ausente';
      let diasCertificado: number | null = null;
      const certValidoAte = cfg?.certValidoAte ? cfg.certValidoAte.toISOString() : null;

      if (cfg?.certValidoAte) {
        diasCertificado = Math.ceil((cfg.certValidoAte.getTime() - agora) / (1000 * 60 * 60 * 24));
        if (diasCertificado < 0) {
          statusCertificado = 'vencido';
          resumo.certVencidos++;
        } else if (diasCertificado <= 30) {
          statusCertificado = 'vencendo';
          resumo.certVencendo++;
        } else {
          statusCertificado = 'valido';
        }
      } else if (cfg?.usarProcuracao || cfg?.procuracaoStatus === 'ativa') {
        statusCertificado = 'procuracao';
      }

      // Regime e Teto RBT12
      const opSimp = cfg?.opSimpNac ?? 3;
      const regime: 'MEI' | 'Simples Nacional' | 'Regime Normal' =
        opSimp === 2 ? 'MEI' : opSimp === 1 ? 'Regime Normal' : 'Simples Nacional';
      const tetoRbt12 = regime === 'MEI' ? TETO_MEI : regime === 'Simples Nacional' ? TETO_SIMPLES : null;
      const sublimiteRbt12 = regime === 'Simples Nacional' ? SUBLIMITE_SIMPLES : null;
      const percentualTeto = tetoRbt12 ? Math.round((rbt12 / tetoRbt12) * 1000) / 10 : null;

      let alertaRbt12: 'ok' | 'atencao' | 'critico' = 'ok';
      let textoRbt12 = '';
      if (regime === 'MEI') {
        if (rbt12 >= TETO_MEI) {
          alertaRbt12 = 'critico';
          textoRbt12 = `Estouro MEI (${percentualTeto}% de R$ 81 mil)`;
        } else if (rbt12 >= TETO_MEI * 0.8) {
          alertaRbt12 = 'atencao';
          textoRbt12 = `Próximo do teto MEI (${percentualTeto}%)`;
        }
      } else if (regime === 'Simples Nacional') {
        if (rbt12 >= TETO_SIMPLES) {
          alertaRbt12 = 'critico';
          textoRbt12 = `Estouro Simples (${percentualTeto}% de R$ 4,8M)`;
        } else if (rbt12 >= SUBLIMITE_SIMPLES) {
          alertaRbt12 = 'critico';
          textoRbt12 = `Acima do sublimite estadual (R$ 3,6M)`;
        } else if (rbt12 >= SUBLIMITE_SIMPLES * 0.8) {
          alertaRbt12 = 'atencao';
          textoRbt12 = `Próximo do sublimite R$ 3,6M`;
        }
      }
      if (alertaRbt12 !== 'ok') resumo.alertasRbt12++;

      const totalRecorrencias = recorrenciasPorEmpresa.get(emp.id) || 0;
      const recorrenciaPendente = totalRecorrencias > 0 && a.nfseMesQtd === 0;
      if (recorrenciaPendente) resumo.recorrenciasPendentes++;

      const alertas: string[] = [];
      if (statusCertificado === 'vencido') alertas.push(`Certificado A1 vencido há ${Math.abs(diasCertificado || 0)}d`);
      else if (statusCertificado === 'vencendo') alertas.push(`Certificado A1 vence em ${diasCertificado}d`);
      if (textoRbt12) alertas.push(textoRbt12);
      if (recorrenciaPendente) alertas.push(`${totalRecorrencias} recorrência(s) ainda não emitida(s) no mês`);

      let semaforo: 'verde' | 'amarelo' | 'vermelho' = 'verde';
      if (statusCertificado === 'vencido' || alertaRbt12 === 'critico') {
        semaforo = 'vermelho';
        resumo.vermelhas++;
      } else if (statusCertificado === 'vencendo' || alertaRbt12 === 'atencao' || recorrenciaPendente) {
        semaforo = 'amarelo';
        resumo.amarelas++;
      } else {
        resumo.verdes++;
      }

      resumo.faturamentoMesTotal += faturamentoMes;
      resumo.rbt12CarteiraTotal += rbt12;

      return {
        id: emp.id,
        razaoSocial: emp.razaoSocial,
        nomeFantasia: emp.nomeFantasia,
        cnpj: emp.cnpj,
        telefone: emp.telefone,
        email: emp.email,
        regime,
        statusCertificado,
        diasCertificado,
        certValidoAte,
        faturamentoMes,
        nfseMesQtd: a.nfseMesQtd,
        nfseMesValor: Math.round(a.nfseMesValor * 100) / 100,
        nfeEmitMesQtd: a.nfeEmitMesQtd,
        nfeEmitMesValor: Math.round(a.nfeEmitMesValor * 100) / 100,
        nfeRecMesQtd: a.nfeRecMesQtd,
        nfeRecMesValor: Math.round(a.nfeRecMesValor * 100) / 100,
        rbt12,
        tetoRbt12,
        sublimiteRbt12,
        percentualTeto,
        alertaRbt12,
        totalRecorrencias,
        recorrenciaPendente,
        semaforo,
        alertas,
      };
    });

    // Ordena por prioridade de atenção: vermelho -> amarelo -> verde, depois faturamento desc
    const peso = { vermelho: 0, amarelo: 1, verde: 2 };
    lista.sort((a, b) => peso[a.semaforo] - peso[b.semaforo] || b.faturamentoMes - a.faturamentoMes);

    resumo.faturamentoMesTotal = Math.round(resumo.faturamentoMesTotal * 100) / 100;
    resumo.rbt12CarteiraTotal = Math.round(resumo.rbt12CarteiraTotal * 100) / 100;

    return NextResponse.json({
      competencia,
      escritorio: vinculo
        ? { id: vinculo.escritorioId, nome: vinculo.nomeEscritorio, papel: vinculo.papel }
        : null,
      ehAdminEscritorio,
      resumo,
      empresas: lista,
    });
  } catch (error) {
    console.error('Erro em GET /api/escritorio/saude-carteira:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar saúde da carteira.' }, { status: 500 });
  }
}
