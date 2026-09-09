'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { store, uid, Endividamento, Lancamento, PlanoConta, Portador, ProjecaoFaturamento } from '../../../lib/store';
import { toast } from 'sonner';
import { fmt } from '../../../lib/reports';
import { projetarCaixa, parcelaPrice, type NovoFinanciamento } from '../../../lib/projecao-caixa';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

export default function ProjecaoCaixaPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [endividamentos, setEndividamentos] = useState<Endividamento[]>([]);
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [projecoes, setProjecoes] = useState<ProjecaoFaturamento[]>([]);
  const [horizonte, setHorizonte] = useState(12);
  const [editandoPrevisao, setEditandoPrevisao] = useState(false);

  const [simulando, setSimulando] = useState(false);
  const [sim, setSim] = useState({ valor: '100000', parcelas: '24', taxaMensal: '1.8', carencia: '0', creditarNoCaixa: true });

  const load = useCallback((eId: string) => {
    if (!eId) return;
    setEmpresaId(eId);
    setLancamentos(store.getLancamentos(eId));
    setPlanoContas(store.getPlanoContas(eId));
    setEndividamentos(store.getEndividamentos(eId));
    setPortadores(store.getPortadores(eId));
    setProjecoes(store.getProjecoesFaturamento(eId));
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    const dataHandler = () => load(sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? ''));
    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataHandler);
    };
  }, [load]);

  // Ponto de partida: o dinheiro que existe hoje nas contas.
  const saldoInicial = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0];
    return portadores.reduce((s, p) => s + store.getSaldoPortador(p.id, empresaId, hoje), 0);
  }, [portadores, empresaId]);

  const simulacao: NovoFinanciamento | null = useMemo(() => {
    if (!simulando) return null;
    return {
      valor: Number(sim.valor) || 0,
      parcelas: Number(sim.parcelas) || 0,
      taxaMensal: Number(sim.taxaMensal) || 0,
      carencia: Number(sim.carencia) || 0,
      creditarNoCaixa: sim.creditarNoCaixa,
    };
  }, [simulando, sim]);

  const base = useMemo(
    () => projetarCaixa({ meses: horizonte, saldoInicial, lancamentos, planoContas, endividamentos, projecoes }),
    [horizonte, saldoInicial, lancamentos, planoContas, endividamentos, projecoes]
  );

  const comEmprestimo = useMemo(
    () => (simulacao
      ? projetarCaixa({ meses: horizonte, saldoInicial, lancamentos, planoContas, endividamentos, simulacao, projecoes })
      : null),
    [simulacao, horizonte, saldoInicial, lancamentos, planoContas, endividamentos, projecoes]
  );

  const dadosGrafico = useMemo(() => base.meses.map((m, i) => ({
    mes: m.label,
    'Sem financiamento': Math.round(m.saldoFinal),
    ...(comEmprestimo ? { 'Com financiamento': Math.round(comEmprestimo.meses[i].saldoFinal) } : {}),
  })), [base, comEmprestimo]);

  const parcelaSimulada = simulacao ? parcelaPrice(simulacao.valor, simulacao.taxaMensal, simulacao.parcelas) : 0;
  const custoTotal = simulacao ? parcelaSimulada * simulacao.parcelas - simulacao.valor : 0;

  const corSaldo = (v: number) => (v < 0 ? 'var(--red)' : v < saldoInicial * 0.2 ? 'var(--yellow)' : 'var(--green)');
  const atual = comEmprestimo || base;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Projeção de Caixa</div>
          <div className="page-subtitle">
            Saldo em conta, recebimentos e pagamentos previstos e o serviço da dívida, mês a mês
          </div>
        </div>
        <div className="header-actions">
          <select className="form-control" style={{ width: 150 }} value={horizonte} onChange={e => setHorizonte(Number(e.target.value))}>
            {[6, 12, 18, 24, 36].map(n => <option key={n} value={n}>{n} meses</option>)}
          </select>
        </div>
      </div>

      <div className="page-body">
        {/* Indicadores */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="card stat-card">
            <div className="stat-icon blue">💰</div>
            <div className="stat-label">Saldo em conta hoje</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{fmt.currency(saldoInicial)}</div>
          </div>
          <div className="card stat-card">
            <div className={`stat-icon ${atual.menorSaldo < 0 ? 'red' : 'green'}`}>📉</div>
            <div className="stat-label">Menor saldo no período</div>
            <div className="stat-value" style={{ fontSize: 24, color: corSaldo(atual.menorSaldo) }}>
              {fmt.currency(atual.menorSaldo)}
            </div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon purple">🏦</div>
            <div className="stat-label">Serviço da dívida ({horizonte}m)</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{fmt.currency(atual.totalServicoDivida)}</div>
          </div>
          <div className="card stat-card">
            <div className={`stat-icon ${(atual.coberturaServicoDivida ?? 9) < 1 ? 'red' : 'green'}`}>🛡️</div>
            <div className="stat-label">Cobertura da dívida</div>
            <div className="stat-value" style={{ fontSize: 24, color: (atual.coberturaServicoDivida ?? 9) < 1 ? 'var(--red)' : 'var(--green)' }}>
              {atual.coberturaServicoDivida === null ? '—' : `${atual.coberturaServicoDivida.toFixed(2)}x`}
            </div>
          </div>
        </div>

        {/* Alerta de aperto */}
        {atual.primeiroMesNegativo && (
          <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--red)' }}>
            <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>
              ⚠️ O caixa fica negativo em {atual.meses.find(m => m.competencia === atual.primeiroMesNegativo)?.label}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Considerando os lançamentos já previstos e as parcelas em aberto, a empresa chega a{' '}
              <strong>{fmt.currency(atual.menorSaldo)}</strong> no pior mês. Antecipar recebimentos, alongar
              prazos ou reduzir o serviço da dívida evita a necessidade de capital de giro emergencial.
            </div>
          </div>
        )}

        {/* Simulador */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title">Simular novo financiamento</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={simulando} onChange={e => setSimulando(e.target.checked)} />
              Aplicar à projeção
            </label>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Valor (R$)</label>
              <input className="form-control" type="number" value={sim.valor} onChange={e => setSim(s => ({ ...s, valor: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Parcelas</label>
              <input className="form-control" type="number" value={sim.parcelas} onChange={e => setSim(s => ({ ...s, parcelas: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Taxa (% a.m.)</label>
              <input className="form-control" type="number" step="0.01" value={sim.taxaMensal} onChange={e => setSim(s => ({ ...s, taxaMensal: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Carência (meses)</label>
              <input className="form-control" type="number" value={sim.carencia} onChange={e => setSim(s => ({ ...s, carencia: e.target.value }))} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={sim.creditarNoCaixa} onChange={e => setSim(s => ({ ...s, creditarNoCaixa: e.target.checked }))} />
            Creditar o valor no caixa (desmarque para financiamento de bem, que não passa pelo caixa)
          </label>

          {simulacao && simulacao.parcelas > 0 && (
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Parcela</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt.currency(parcelaSimulada)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Total pago</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt.currency(parcelaSimulada * simulacao.parcelas)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Custo dos juros</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>{fmt.currency(custoTotal)}</div>
              </div>
              {comEmprestimo && (
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Menor saldo com o empréstimo</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: corSaldo(comEmprestimo.menorSaldo) }}>
                    {fmt.currency(comEmprestimo.menorSaldo)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Curva */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><div className="card-title">Evolução do saldo de caixa</div></div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={dadosGrafico} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => fmt.currency(Number(v))} />
              <Legend />
              <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="Sem financiamento" stroke="#3b82f6" fill="rgba(59,130,246,0.15)" strokeWidth={2} />
              {comEmprestimo && (
                <Area type="monotone" dataKey="Com financiamento" stroke="#8c1a22" fill="rgba(140,26,34,0.12)" strokeWidth={2} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela mês a mês */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title">Detalhamento mensal</div>
            <button className={`btn btn-sm ${editandoPrevisao ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEditandoPrevisao(!editandoPrevisao)}>
              {editandoPrevisao ? 'Concluir edição manual' : 'Substituir previsão (manual)'}
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th style={{ textAlign: 'right' }}>Entradas</th>
                  <th style={{ textAlign: 'right' }}>Saídas (Operacionais)</th>
                  <th style={{ textAlign: 'right' }}>Geração operacional</th>
                  <th style={{ textAlign: 'right' }}>Serviço da dívida</th>
                  <th style={{ textAlign: 'right' }}>Comprometimento</th>
                  <th style={{ textAlign: 'right' }}>Saldo final</th>
                </tr>
              </thead>
              <tbody>
                {atual.meses.map(m => {
                  const paramProj = projecoes.find(p => p.competencia === m.competencia);
                  return (
                    <tr key={m.competencia} style={{ background: paramProj ? 'rgba(59, 130, 246, 0.05)' : undefined }}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {m.label}
                        {paramProj && <span title="Valor manual inserido" style={{ marginLeft: 6, fontSize: 10, background: 'var(--blue)', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>MANUAL</span>}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--green)' }}>
                        {editandoPrevisao ? (
                           <input type="number" className="form-control form-control-sm" style={{ width: 100, display: 'inline-block', textAlign: 'right' }} 
                                  value={paramProj ? paramProj.faturamento : ''} placeholder={m.entradas.toString()} step="100"
                                  onChange={e => {
                                    const val = Number(e.target.value) || 0;
                                    const p = paramProj || { id: uid(), empresaId, competencia: m.competencia, faturamento: 0, despesas: 0 };
                                    store.saveProjecaoFaturamento({ ...p, faturamento: val });
                                    setProjecoes(store.getProjecoesFaturamento(empresaId));
                                  }} />
                        ) : fmt.currency(m.entradas)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--red)' }}>
                        {editandoPrevisao ? (
                           <input type="number" className="form-control form-control-sm" style={{ width: 100, display: 'inline-block', textAlign: 'right' }} 
                                  value={paramProj ? paramProj.despesas : ''} placeholder={m.saidasOperacionais.toString()} step="100"
                                  onChange={e => {
                                    const val = Number(e.target.value) || 0;
                                    const p = paramProj || { id: uid(), empresaId, competencia: m.competencia, faturamento: 0, despesas: 0 };
                                    store.saveProjecaoFaturamento({ ...p, despesas: val });
                                    setProjecoes(store.getProjecoesFaturamento(empresaId));
                                  }} />
                        ) : fmt.currency(m.saidasOperacionais)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt.currency(m.geracaoOperacional)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt.currency(m.servicoDivida)}</td>
                      <td style={{ textAlign: 'right', color: m.comprometimento > 1 ? 'var(--red)' : 'var(--text-secondary)' }}>
                        {m.servicoDivida === 0 ? '—'
                          : m.comprometimento === Infinity ? '∞'
                          : `${(m.comprometimento * 100).toFixed(0)}%`}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: corSaldo(m.saldoFinal) }}>
                        {fmt.currency(m.saldoFinal)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 4px 0', lineHeight: 1.6 }}>
            A projeção usa apenas lançamentos com status <strong>previsto</strong> — os realizados já estão
            refletidos no saldo em conta. Quanto mais completo o contas a pagar e a receber, mais fiel a curva.
          </div>
        </div>
      </div>
    </>
  );
}
