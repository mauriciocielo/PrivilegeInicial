import { describe, it, expect } from 'vitest';
import { projetarCaixa, parcelaPrice } from './projecao-caixa';
import type { Endividamento, Lancamento, PlanoConta } from './store';

const BASE = new Date(2026, 0, 15); // 15/01/2026 — projeção começa em fevereiro

const planoContas: PlanoConta[] = [
  { id: 'rec', codigo: '1', descricao: 'Receita', tipo: 'receita', nivel: 1, ativo: true, empresaId: 'e1' },
  { id: 'desp', codigo: '2', descricao: 'Despesa', tipo: 'despesa', nivel: 1, ativo: true, empresaId: 'e1' },
  { id: 'tr', codigo: '3', descricao: 'Transferência', tipo: 'transferencia', nivel: 1, ativo: true, empresaId: 'e1' },
];

const lanc = (data: string, tipo: 'receita' | 'despesa', valor: number, planoContaId = tipo === 'receita' ? 'rec' : 'desp', status = 'previsto'): Lancamento =>
  ({ id: Math.random().toString(36), empresaId: 'e1', data, descricao: 'x', valor, tipo, status, planoContaId } as Lancamento);

const divida = (parcela: number, parcelasFaltantes: number): Endividamento =>
  ({
    id: Math.random().toString(36), empresaId: 'e1', tipo: 'bancario', banco: 'B', conta: '', contrato: 'C',
    taxa: 1, indexador: '', parcela, parcelasFaltantes, valorQuitacao: 0, valorAPagar: 0, garantia: '', pagamentoMes: 10,
  } as Endividamento);

describe('parcelaPrice', () => {
  it('divide linearmente quando não há juros', () => {
    expect(parcelaPrice(1200, 0, 12)).toBeCloseTo(100, 5);
  });

  it('calcula a parcela pela Tabela Price', () => {
    // 10.000 em 12x a 1% a.m. ≈ 888,49
    expect(parcelaPrice(10000, 1, 12)).toBeCloseTo(888.49, 1);
  });

  it('retorna zero para prazo inválido', () => {
    expect(parcelaPrice(1000, 1, 0)).toBe(0);
  });
});

describe('projetarCaixa', () => {
  it('acumula o saldo somando entradas e subtraindo saídas previstas', () => {
    const r = projetarCaixa({
      meses: 2, saldoInicial: 1000, planoContas, endividamentos: [], hoje: BASE,
      lancamentos: [lanc('2026-02-10', 'receita', 500), lanc('2026-02-20', 'despesa', 200)],
    });
    expect(r.meses[0].entradas).toBe(500);
    expect(r.meses[0].saidasOperacionais).toBe(200);
    expect(r.meses[0].saldoFinal).toBe(1300); // 1000 + 500 - 200
  });

  it('ignora lançamentos já realizados — eles já estão no saldo inicial', () => {
    const r = projetarCaixa({
      meses: 1, saldoInicial: 0, planoContas, endividamentos: [], hoje: BASE,
      lancamentos: [lanc('2026-02-10', 'receita', 999, 'rec', 'realizado')],
    });
    expect(r.meses[0].entradas).toBe(0);
  });

  it('ignora transferências entre contas', () => {
    const r = projetarCaixa({
      meses: 1, saldoInicial: 0, planoContas, endividamentos: [], hoje: BASE,
      lancamentos: [lanc('2026-02-10', 'receita', 800, 'tr')],
    });
    expect(r.meses[0].entradas).toBe(0);
  });

  it('lança o serviço da dívida apenas enquanto houver parcelas', () => {
    const r = projetarCaixa({
      meses: 4, saldoInicial: 0, planoContas, lancamentos: [], hoje: BASE,
      endividamentos: [divida(300, 2)],
    });
    expect(r.meses.map(m => m.servicoDivida)).toEqual([300, 300, 0, 0]);
    expect(r.totalServicoDivida).toBe(600);
  });

  it('aponta o primeiro mês em que o caixa fica negativo', () => {
    const r = projetarCaixa({
      meses: 3, saldoInicial: 500, planoContas, lancamentos: [], hoje: BASE,
      endividamentos: [divida(300, 3)],
    });
    // 500-300=200 | 200-300=-100 -> negativo no 2º mês (março/2026)
    expect(r.primeiroMesNegativo).toBe('2026-03');
    expect(r.menorSaldo).toBe(-400);
  });

  it('credita o valor do financiamento simulado e cobra as parcelas após a carência', () => {
    const r = projetarCaixa({
      meses: 4, saldoInicial: 0, planoContas, lancamentos: [], endividamentos: [], hoje: BASE,
      simulacao: { valor: 1000, parcelas: 2, taxaMensal: 0, carencia: 1, creditarNoCaixa: true },
    });
    expect(r.meses[0].entradas).toBe(1000);      // crédito no 1º mês
    expect(r.meses[0].servicoDivida).toBe(0);    // carência
    expect(r.meses[1].servicoDivida).toBe(500);
    expect(r.meses[2].servicoDivida).toBe(500);
    expect(r.meses[3].servicoDivida).toBe(0);
  });

  it('calcula a cobertura do serviço da dívida', () => {
    const r = projetarCaixa({
      meses: 2, saldoInicial: 0, planoContas, hoje: BASE,
      lancamentos: [lanc('2026-02-10', 'receita', 1000), lanc('2026-03-10', 'receita', 1000)],
      endividamentos: [divida(500, 2)],
    });
    // geração 2000 / serviço 1000 = 2
    expect(r.coberturaServicoDivida).toBeCloseTo(2, 5);
  });

  it('usa a projeção informada no lugar dos lançamentos previstos do mês', () => {
    const r = projetarCaixa({
      meses: 2, saldoInicial: 0, planoContas, endividamentos: [], hoje: BASE,
      lancamentos: [lanc('2026-02-10', 'receita', 100), lanc('2026-03-10', 'receita', 100)],
      projecoes: [{ id: 'p1', empresaId: 'e1', competencia: '2026-02', faturamento: 5000, despesas: 2000 }],
    });
    // Fevereiro: vale a projeção informada, e NÃO a soma com o lançamento.
    expect(r.meses[0].entradas).toBe(5000);
    expect(r.meses[0].saidasOperacionais).toBe(2000);
    // Março: sem projeção informada, volta a usar os lançamentos previstos.
    expect(r.meses[1].entradas).toBe(100);
  });

  it('não divide por zero quando não há dívida', () => {
    const r = projetarCaixa({
      meses: 1, saldoInicial: 0, planoContas, lancamentos: [], endividamentos: [], hoje: BASE,
    });
    expect(r.coberturaServicoDivida).toBeNull();
  });

  it('soma o saldo em aberto de contas a receber/pagar da API do ERP, pela competência do vencimento', () => {
    const r = projetarCaixa({
      meses: 2, saldoInicial: 0, planoContas, lancamentos: [], endividamentos: [], hoje: BASE,
      contasReceber: [
        { dataVencimento: '2026-02-05', valorLiquido: 1000, status: 'aberto', baixas: [] },
        { dataVencimento: '2026-02-20', valorLiquido: 500, status: 'parcial', baixas: [{ valor: 200 }] }, // resta 300
        { dataVencimento: '2026-03-01', valorLiquido: 900, status: 'liquidado', baixas: [{ valor: 900 }] }, // já pago, não entra
        { dataVencimento: '2026-03-01', valorLiquido: 400, status: 'cancelado', baixas: [] }, // cancelado, não entra
      ],
      contasPagar: [
        { dataVencimento: '2026-02-10', valorLiquido: 600, status: 'aberto', baixas: [] },
      ],
    });
    expect(r.meses[0].entradas).toBe(1300); // 1000 + 300
    expect(r.meses[0].saidasOperacionais).toBe(600);
    expect(r.meses[1].entradas).toBe(0);
  });

  it('projeção manual substitui também as contas a receber/pagar da API, não soma os dois', () => {
    const r = projetarCaixa({
      meses: 1, saldoInicial: 0, planoContas, lancamentos: [], endividamentos: [], hoje: BASE,
      contasReceber: [{ dataVencimento: '2026-02-05', valorLiquido: 1000, status: 'aberto', baixas: [] }],
      projecoes: [{ id: 'p1', empresaId: 'e1', competencia: '2026-02', faturamento: 5000, despesas: 0 }],
    });
    expect(r.meses[0].entradas).toBe(5000);
  });
});
