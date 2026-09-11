// ============================================================
// PROJEÇÃO DE CAIXA COM SERVIÇO DA DÍVIDA
// ============================================================
// Até aqui o sistema tinha uma única projeção — dentro da tela de
// Endividamento — que somava parcelas mês a mês e ignorava três coisas:
// o mês de vencimento cadastrado (todo contrato entrava a partir do mês
// seguinte), a carência, e o próprio caixa. Ou seja, mostrava o quanto sai,
// nunca o que sobra.
//
// Aqui o cálculo é único e puro (sem acesso a store/DOM), para poder ser
// testado e reaproveitado pela projeção real e pelo simulador de novos
// financiamentos.

import type { Endividamento, Lancamento, PlanoConta, ProjecaoFaturamento } from './store';

export interface MesProjecao {
  /** YYYY-MM */
  competencia: string;
  label: string;
  entradas: number;
  saidasOperacionais: number;
  /** Parcelas de dívida com vencimento no mês. */
  servicoDivida: number;
  /** entradas − saídas operacionais (antes da dívida). */
  geracaoOperacional: number;
  /** Saldo acumulado ao final do mês, já descontada a dívida. */
  saldoFinal: number;
  /** Quanto da geração operacional é consumido pela dívida (0–1+). */
  comprometimento: number;
}

export interface ResultadoProjecao {
  meses: MesProjecao[];
  saldoInicial: number;
  /** Primeiro mês em que o saldo fica negativo, se houver. */
  primeiroMesNegativo: string | null;
  menorSaldo: number;
  totalServicoDivida: number;
  /**
   * Índice de cobertura do serviço da dívida: geração operacional dividida
   * pelo serviço da dívida no período. Abaixo de 1 significa que a operação
   * não paga as parcelas — é o número que o banco olha para conceder crédito.
   */
  coberturaServicoDivida: number | null;
}

export interface NovoFinanciamento {
  valor: number;
  parcelas: number;
  /** Taxa de juros mensal, em porcentagem (ex.: 1.8 para 1,8% a.m.). */
  taxaMensal: number;
  /** Meses até a primeira parcela. 0 = já no próximo mês. */
  carencia: number;
  /** Entra como entrada no caixa no mês da contratação. */
  creditarNoCaixa: boolean;
}

const somaMeses = (base: Date, n: number) => new Date(base.getFullYear(), base.getMonth() + n, 1);
const competenciaDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const rotuloDe = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/**
 * Parcela pela Tabela Price. Com juros zero divide linearmente — sem esse
 * caso a fórmula dividiria por zero.
 */
export function parcelaPrice(valor: number, taxaMensalPct: number, parcelas: number): number {
  if (parcelas <= 0) return 0;
  const i = taxaMensalPct / 100;
  if (i === 0) return valor / parcelas;
  return (valor * i) / (1 - Math.pow(1 + i, -parcelas));
}

/**
 * Distribui as parcelas de um contrato nos meses da janela, respeitando o dia
 * de vencimento cadastrado. `pagamentoMes` guarda o DIA do vencimento; quando
 * não informado, assume-se que a parcela cai em todos os meses restantes.
 */
function parcelasNoMes(divida: Endividamento, indiceMes: number): number {
  if (divida.parcelasFaltantes <= 0) return 0;
  // A parcela existe enquanto houver parcelas faltantes a partir do mês 1.
  return indiceMes < divida.parcelasFaltantes ? (divida.parcela || 0) : 0;
}

/**
 * Formato mínimo de ContaReceber/ContaPagar (o modelo Prisma alimentado pela
 * API v1 de integração ERP) necessário para entrar na projeção — evita que
 * lib/projecao-caixa.ts (puro, sem acesso a rede) precise importar o client
 * do Prisma.
 */
export interface ContaFinanceiraProjetavel {
  dataVencimento: string;
  valorLiquido: number;
  status: 'aberto' | 'parcial' | 'liquidado' | 'cancelado';
  baixas: { valor: number }[];
}

export interface ParametrosProjecao {
  meses: number;
  saldoInicial: number;
  lancamentos: Lancamento[];
  planoContas: PlanoConta[];
  endividamentos: Endividamento[];
  /**
   * Faturamento/despesas previstos pelo consultor. Para a competência em que
   * houver projeção informada, ela SUBSTITUI os lançamentos previstos daquele
   * mês — somar os dois contaria a mesma receita duas vezes.
   */
  projecoes?: ProjecaoFaturamento[];
  /**
   * Títulos em aberto vindos da API v1 (ERP do cliente) — somados aos
   * lançamentos previstos pelo saldo ainda não baixado, na competência do
   * vencimento. Também entram sob a mesma regra de substituição por
   * `projecoes`, para não contar a mesma receita/despesa duas vezes quando o
   * consultor já informou uma previsão manual para o mês.
   */
  contasReceber?: ContaFinanceiraProjetavel[];
  contasPagar?: ContaFinanceiraProjetavel[];
  /** Quando informado, simula a contratação de um novo financiamento. */
  simulacao?: NovoFinanciamento | null;
  /** Base de cálculo; default = hoje. Existe para tornar o teste determinístico. */
  hoje?: Date;
}

const saldoEmAberto = (c: ContaFinanceiraProjetavel) =>
  Math.max(0, c.valorLiquido - c.baixas.reduce((s, b) => s + b.valor, 0));

export function projetarCaixa(p: ParametrosProjecao): ResultadoProjecao {
  const hoje = p.hoje ? new Date(p.hoje) : new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const ehTransferencia = (l: Lancamento) => {
    if (l.planoContaId === 'transf') return true;
    const pc = p.planoContas.find(c => c.id === l.planoContaId);
    return pc?.tipo === 'transferencia';
  };

  const meses: MesProjecao[] = [];
  let saldo = p.saldoInicial;

  // Parcela do financiamento simulado, quando houver.
  const parcelaSimulada = p.simulacao
    ? parcelaPrice(p.simulacao.valor, p.simulacao.taxaMensal, p.simulacao.parcelas)
    : 0;

  for (let i = 1; i <= p.meses; i++) {
    const d = somaMeses(inicio, i);
    const competencia = competenciaDe(d);

    // Projeção informada pelo consultor tem precedência sobre os lançamentos
    // previstos da mesma competência.
    const informada = p.projecoes?.find(pr => pr.competencia === competencia);

    let entradas = 0;
    let saidas = 0;
    if (informada) {
      entradas = informada.faturamento || 0;
      saidas = informada.despesas || 0;
    } else {
      // Lançamentos previstos da competência. Realizados ficam de fora: já
      // estão refletidos no saldo inicial dos portadores.
      for (const l of p.lancamentos) {
        if (!l.data?.startsWith(competencia)) continue;
        if (l.status !== 'previsto') continue;
        if (ehTransferencia(l)) continue;
        if (l.tipo === 'receita') entradas += l.valor;
        else saidas += l.valor;
      }

      // Títulos em aberto lançados via API do ERP (fora do lib/store.ts
      // local-first) — soma o saldo ainda não baixado, na competência do
      // vencimento.
      for (const c of p.contasReceber || []) {
        if (c.status !== 'aberto' && c.status !== 'parcial') continue;
        if (!c.dataVencimento?.startsWith(competencia)) continue;
        entradas += saldoEmAberto(c);
      }
      for (const c of p.contasPagar || []) {
        if (c.status !== 'aberto' && c.status !== 'parcial') continue;
        if (!c.dataVencimento?.startsWith(competencia)) continue;
        saidas += saldoEmAberto(c);
      }
    }

    // Serviço da dívida já contratada.
    let servico = 0;
    for (const e of p.endividamentos) servico += parcelasNoMes(e, i - 1);

    // Financiamento simulado: crédito no primeiro mês, parcelas após a carência.
    if (p.simulacao) {
      if (i === 1 && p.simulacao.creditarNoCaixa) entradas += p.simulacao.valor;
      const mesDaParcela = i - 1 - p.simulacao.carencia;
      if (mesDaParcela >= 0 && mesDaParcela < p.simulacao.parcelas) servico += parcelaSimulada;
    }

    const geracao = entradas - saidas;
    saldo += geracao - servico;

    meses.push({
      competencia,
      label: rotuloDe(d),
      entradas,
      saidasOperacionais: saidas,
      servicoDivida: servico,
      geracaoOperacional: geracao,
      saldoFinal: saldo,
      comprometimento: geracao > 0 ? servico / geracao : (servico > 0 ? Infinity : 0),
    });
  }

  const totalServico = meses.reduce((s, m) => s + m.servicoDivida, 0);
  const totalGeracao = meses.reduce((s, m) => s + m.geracaoOperacional, 0);
  const negativo = meses.find(m => m.saldoFinal < 0);

  return {
    meses,
    saldoInicial: p.saldoInicial,
    primeiroMesNegativo: negativo ? negativo.competencia : null,
    menorSaldo: meses.length ? Math.min(...meses.map(m => m.saldoFinal)) : p.saldoInicial,
    totalServicoDivida: totalServico,
    coberturaServicoDivida: totalServico > 0 ? totalGeracao / totalServico : null,
  };
}
