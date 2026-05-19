'use client';
import { useEffect, useState, useCallback } from 'react';
import { store, Empresa } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import GeminiTips from '../../../components/GeminiTips';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function ConsultorDashboard() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [empresaId, setEmpresaId] = useState('e1');
  const [resumo, setResumo] = useState<ReturnType<typeof store.getResumoMensal>>([]);
  const [totais, setTotais] = useState({ receitas: 0, despesas: 0, saldo: 0, portadores: 0 });
  const [portadoresList, setPortadoresList] = useState<{ nome: string; saldo: number; tipo: string }[]>([]);
  const [lancRecentes, setLancRecentes] = useState<ReturnType<typeof store.getLancamentos>>([]);
  const [categorias, setCategorias] = useState<{ name: string; value: number; color: string }[]>([]);
  const [endividamentos, setEndividamentos] = useState<ReturnType<typeof store.getEndividamentos>>([]);
  const [totalDivida, setTotalDivida] = useState(0);
  const [indicador, setIndicador] = useState<ReturnType<typeof store.getIndicadores>[0] | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });

  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4'];

  const load = useCallback((eId: string) => {
    const e = store.getEmpresas().find(x => x.id === eId) || null;
    setEmpresa(e);
    setEmpresaId(eId);

    const r = store.getResumoMensal(eId, 6);
    setResumo(r);

    const lancs = store.getLancamentos(eId).filter(l => l.status === 'realizado');
    
    // Filter by mesSelecionado
    const lancsMs = lancs.filter(l => l.data.startsWith(mesSelecionado));

    const rec = lancsMs.filter(l => l.tipo === 'receita').reduce((a, l) => a + l.valor, 0);
    const desp = lancsMs.filter(l => l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0);

    const ports = store.getPortadores(eId);
    const totalPort = ports.reduce((a, p) => a + store.getSaldoPortador(p.id, eId), 0);

    setTotais({ receitas: rec, despesas: desp, saldo: rec - desp, portadores: totalPort });
    setPortadoresList(ports.map(p => ({ nome: p.nome, saldo: store.getSaldoPortador(p.id, eId), tipo: p.tipo })));

    const sorted = [...lancs].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
    setLancRecentes(sorted);

    // Categoria pie
    const plano = store.getPlanoContas(eId);
    const despCats: Record<string, number> = {};
    lancsMs.filter(l => l.tipo === 'despesa').forEach(l => {
      const pc = plano.find(p => p.id === l.planoContaId);
      const nome = pc?.descricao || 'Outros';
      despCats[nome] = (despCats[nome] || 0) + l.valor;
    });
    setCategorias(
      Object.entries(despCats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))
    );

    const endivs = store.getEndividamentos(eId);
    setEndividamentos(endivs);
    setTotalDivida(endivs.reduce((acc, e) => acc + Math.max(0, e.valorAPagar - e.pagamentoMes), 0));

    const inds = store.getIndicadores(eId);
    setIndicador(inds.find(i => i.mes === mesSelecionado) || null);
  }, [mesSelecionado]);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || 'e1';
    load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  const [anoLabel, mesLabel] = mesSelecionado.split('-');
  const mesAtualLabel = new Date(Number(anoLabel), Number(mesLabel)-1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const mesesOptions: string[] = [];
  const hoje = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    mesesOptions.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard Operacional</div>
          <div className="page-subtitle">{empresa?.razaoSocial} — {mesAtualLabel}</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 12 }}>
          <select 
            className="form-control" 
            value={mesSelecionado} 
            onChange={e => setMesSelecionado(e.target.value)}
            style={{ width: 160 }}
          >
            {mesesOptions.map(m => {
              const [y, mo] = m.split('-');
              const d = new Date(Number(y), Number(mo)-1, 1);
              return <option key={m} value={m}>{d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</option>;
            })}
          </select>
          <a href="/consultor/lancamentos" className="btn btn-primary">
            ＋ Novo Lançamento
          </a>
        </div>
      </div>

      <div className="page-body">
        <GeminiTips
          empresaId={empresaId}
          dataIni={`${mesSelecionado}-01`}
          dataFim={`${mesSelecionado}-${new Date(Number(anoLabel), Number(mesLabel), 0).getDate()}`}
          contextKey={mesSelecionado}
        />
        
        {/* KPI Cards */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card green">
            <div className="stat-icon green">↑</div>
            <div className="stat-label">Receitas do Mês</div>
            <div className="stat-value">{fmt.currency(totais.receitas)}</div>
            <div className="stat-change up">▲ Realizado</div>
          </div>
          <div className="stat-card red">
            <div className="stat-icon red">↓</div>
            <div className="stat-label">Despesas do Mês</div>
            <div className="stat-value">{fmt.currency(totais.despesas)}</div>
            <div className="stat-change down">▼ Realizado</div>
          </div>
          <div className={`stat-card ${totais.saldo >= 0 ? 'blue' : 'red'}`}>
            <div className={`stat-icon ${totais.saldo >= 0 ? 'blue' : 'red'}`}>≈</div>
            <div className="stat-label">Resultado do Mês</div>
            <div className="stat-value" style={{ color: totais.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt.currency(totais.saldo)}
            </div>
            <div className={`stat-change ${totais.saldo >= 0 ? 'up' : 'down'}`}>
              {totais.saldo >= 0 ? '▲ Superávit' : '▼ Déficit'}
            </div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple">🏦</div>
            <div className="stat-label">Saldo Total em Caixa</div>
            <div className="stat-value">{fmt.currency(totais.portadores)}</div>
            <div className="stat-change up">▲ Todos portadores</div>
          </div>
          <div className="stat-card" style={{ borderTop: '4px solid #f59e0b', background: 'var(--bg-card)' }}>
            <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>⚖️</div>
            <div className="stat-label">Endividamento Ativo</div>
            <div className="stat-value" style={{ color: '#b45309' }}>{fmt.currency(totalDivida)}</div>
            <div className="stat-change" style={{ color: '#d97706' }}>Em aberto</div>
          </div>
        </div>

        {/* Indicadores de Negócio */}
        <div className="card" style={{ marginBottom: 24, padding: '16px 20px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ minWidth: 150 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>🎯 Indicadores do Mês</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Acompanhamento manual</div>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 24, borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Faturamento (Realizado)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{fmt.currency(indicador?.faturamento || 0)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Meta: {fmt.currency(empresa?.receitaMensalEstimada || 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Compras (Realizadas)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>{fmt.currency(indicador?.compras || 0)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Meta: {fmt.currency(empresa?.comprasMensalEstimada || 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Inadimplência</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--orange)' }}>{indicador?.inadimplencia || 0}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sobre o faturamento</div>
            </div>
          </div>
          {!indicador && (
            <a href="/consultor/indicadores" className="btn btn-secondary btn-sm" style={{ alignSelf: 'center' }}>＋ Preencher</a>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid-21" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Receitas vs Despesas</div>
                <div className="card-subtitle">Últimos 6 meses realizados</div>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resumo} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border-light)', borderRadius: 8 }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                    formatter={(v: any) => fmt.currency(Number(v || 0))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                  <Bar dataKey="receitas" name="Receitas" fill="var(--green)" radius={[4,4,0,0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="var(--red)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Despesas por Categoria</div>
                <div className="card-subtitle">Mês atual</div>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categorias} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                    {categorias.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt.currency(Number(v || 0))} contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border-light)', borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Saldo evolution + portadores */}
        <div className="grid-21" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Evolução do Saldo</div>
                <div className="card-subtitle">Resultado mensal acumulado</div>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={resumo}>
                  <defs>
                    <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => fmt.currency(Number(v || 0))} contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border-light)', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="saldo" name="Saldo" stroke="#3b82f6" fill="url(#gradSaldo)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Saldo por Portador</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {portadoresList.map((p, i) => {
                const pct = totais.portadores > 0 ? (Math.max(0, p.saldo) / totais.portadores) * 100 : 0;
                const color = COLORS[i % COLORS.length];
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🏦 {p.nome}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: p.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmt.currency(p.saldo)}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Endividamentos List (Se houver) */}
        {endividamentos.length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Resumo de Endividamentos</div>
                <div className="card-subtitle">Contratos e financiamentos em andamento</div>
              </div>
              <a href="/consultor/endividamento" className="btn btn-secondary btn-sm">Ver Detalhes →</a>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Banco / Conta</th>
                    <th>Contrato</th>
                    <th>Taxa</th>
                    <th>Faltantes</th>
                    <th>Parcela</th>
                    <th style={{ textAlign: 'right' }}>Saldo Devedor Estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {endividamentos.slice(0, 5).map(e => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 500 }}>{e.banco}</td>
                      <td>{e.contrato}</td>
                      <td>{e.taxa}%</td>
                      <td>{e.parcelasFaltantes}</td>
                      <td style={{ color: 'var(--red)' }}>{fmt.currency(e.parcela)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#b45309' }}>
                        {fmt.currency(Math.max(0, e.valorAPagar - e.pagamentoMes))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Lancamentos */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Últimos Lançamentos</div>
              <div className="card-subtitle">Movimentações mais recentes realizadas</div>
            </div>
            <a href="/consultor/lancamentos" className="btn btn-secondary btn-sm">Ver todos →</a>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Portador</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {lancRecentes.map(l => {
                  const port = store.getPortadores(empresaId).find(p => p.id === l.portadorId);
                  return (
                    <tr key={l.id}>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{fmt.date(l.data)}</td>
                      <td style={{ fontWeight: 500 }}>{l.descricao}</td>
                      <td>
                        <span className={`badge ${l.tipo === 'receita' ? 'badge-green' : 'badge-red'}`}>
                          {l.tipo === 'receita' ? '↑ Receita' : '↓ Despesa'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{port?.nome || '-'}</td>
                      <td>
                        <span className={`badge ${l.status === 'realizado' ? 'badge-blue' : 'badge-yellow'}`}>
                          {l.status === 'realizado' ? 'Realizado' : 'Previsto'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: l.tipo === 'receita' ? 'var(--green)' : 'var(--red)' }}>
                        {l.tipo === 'receita' ? '+' : '-'}{fmt.currency(l.valor)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
