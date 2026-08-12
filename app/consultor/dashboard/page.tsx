'use client';
import { useEffect, useState, useCallback } from 'react';
import { store, Empresa, Lancamento, Portador, PlanoConta } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import GeminiTips from '../../../components/GeminiTips';
import AnimatedCounter from '../../../components/AnimatedCounter';
import { TrendingUp, TrendingDown, Activity, Scale, Printer, Plus } from 'lucide-react';
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
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const u = store.getCurrentUser();
    if (u) {
      setUserName(u.name);
    }
  }, []);

  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4'];

  const load = useCallback((eId: string) => {
    const isGroup = eId.startsWith('grupo:');
    const grupoName = isGroup ? eId.split(':')[1] : '';

    let activeEmp: Empresa | null = null;
    let targetLancs: Lancamento[] = [];
    let targetPorts: Portador[] = [];
    let targetPlano: PlanoConta[] = [];

    if (isGroup) {
      const empsInGroup = store.getEmpresas().filter(e => e.grupoEconomico === grupoName);
      activeEmp = {
        id: eId,
        razaoSocial: `Grupo Consolidado - ${grupoName}`,
        nomeFantasia: `Grupo ${grupoName}`,
        cnpj: '',
        responsavel: '',
        email: '',
        telefone: '',
        createdAt: new Date().toISOString()
      };
      empsInGroup.forEach(emp => {
        targetLancs.push(...store.getLancamentos(emp.id));
        targetPorts.push(...store.getPortadores(emp.id));
        targetPlano.push(...store.getPlanoContas(emp.id));
      });
    } else {
      activeEmp = store.getEmpresas().find(x => x.id === eId) || null;
      targetLancs = store.getLancamentos(eId);
      targetPorts = store.getPortadores(eId);
      targetPlano = store.getPlanoContas(eId);
    }

    setEmpresa(activeEmp);
    setEmpresaId(eId);

    const r = isGroup
      ? store.getResumoMensalGrupoEconomico(grupoName, 6)
      : store.getResumoMensal(eId, 6);
    setResumo(r);

    const lancs = targetLancs.filter(l => l.status === 'realizado');
    const lancsMs = lancs.filter(l => l.data.startsWith(mesSelecionado));

    const rec = lancsMs.filter(l => {
      if (l.planoContaId === 'transf') return false;
      const pc = targetPlano.find(p => p.id === l.planoContaId);
      if (pc?.tipo === 'transferencia') return false;
      return l.tipo === 'receita';
    }).reduce((a, l) => {
      const pc = targetPlano.find(p => p.id === l.planoContaId);
      const isRedutora = pc && pc.descricao.trim().startsWith('( - )');
      return a + (isRedutora ? -l.valor : l.valor);
    }, 0);
    const desp = lancsMs.filter(l => {
      if (l.planoContaId === 'transf') return false;
      const pc = targetPlano.find(p => p.id === l.planoContaId);
      if (pc?.tipo === 'transferencia') return false;
      return l.tipo === 'despesa';
    }).reduce((a, l) => a + l.valor, 0);

    const [anoPeriodo, mesPeriodo] = mesSelecionado.split('-');
    const lastDay = new Date(Number(anoPeriodo), Number(mesPeriodo), 0).getDate();
    const dataFimPeriodo = `${mesSelecionado}-${String(lastDay).padStart(2, '0')}`;
    
    const totalPort = targetPorts.reduce((a, p) => a + store.getSaldoPortador(p.id, p.empresaId, dataFimPeriodo), 0);

    setTotais({ receitas: rec, despesas: desp, saldo: rec - desp, portadores: totalPort });
    setPortadoresList(targetPorts.map(p => ({ nome: p.nome, saldo: store.getSaldoPortador(p.id, p.empresaId, dataFimPeriodo), tipo: p.tipo })));

    const sorted = [...lancs].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
    setLancRecentes(sorted);

    const despCats: Record<string, number> = {};
    lancsMs.filter(l => {
      if (l.planoContaId === 'transf') return false;
      const pc = targetPlano.find(p => p.id === l.planoContaId);
      if (pc?.tipo === 'transferencia') return false;
      return l.tipo === 'despesa';
    }).forEach(l => {
      const pc = targetPlano.find(p => p.id === l.planoContaId);
      const nome = pc?.descricao || 'Outros';
      despCats[nome] = (despCats[nome] || 0) + l.valor;
    });
    setCategorias(
      Object.entries(despCats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))
    );

    let endivs: any[] = [];
    let inds: any[] = [];
    if (isGroup) {
      const empsInGroup = store.getEmpresas().filter(e => e.grupoEconomico === grupoName);
      empsInGroup.forEach(emp => {
        endivs.push(...store.getEndividamentos(emp.id));
        inds.push(...store.getIndicadores(emp.id));
      });
    } else {
      endivs = store.getEndividamentos(eId);
      inds = store.getIndicadores(eId);
    }

    setEndividamentos(endivs);
    setTotalDivida(endivs.reduce((acc, e) => acc + Math.max(0, e.valorAPagar - e.pagamentoMes), 0));
    setIndicador(inds.find(i => i.mes === mesSelecionado) || null);
  }, [mesSelecionado]);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
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
      <div className="page-header glass-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span className="text-gradient">Painel Operacional do Consultor</span>
            {userName && (
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(10px)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.2)' }}>
                Olá, {userName}! Seja bem-vindo(a) 👋
              </span>
            )}
          </div>
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
          <a href={`/consultor/report-board?empresaId=${empresaId}&mes=${mesSelecionado}`} className="btn btn-secondary" style={{ background: '#030712', color: '#fff', border: 'none' }}>
             <Printer size={14} /> Board Report (PDF)
          </a>
          <a href="/consultor/lancamentos" className="btn btn-primary">
            <Plus size={14} /> Novo Lançamento
          </a>
        </div>
      </div>

      <div className="page-body">
        {/* Welcome Banner */}
        <div className="glass-card" style={{
          padding: '28px 32px',
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
              Foco da Operação em <span className="text-gradient">{mesAtualLabel}</span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
              Resumo gerencial e execução do fôlego da <strong>{empresa?.razaoSocial}</strong>.
            </div>
          </div>
          <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.5)', padding: '16px 24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Saldo Atual Consolidado</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: totais.portadores >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>
              <AnimatedCounter target={totais.portadores} prefix="R$ " decimals={2} />
            </div>
          </div>
        </div>

        <GeminiTips
          empresaId={empresaId}
          dataIni={`${mesSelecionado}-01`}
          dataFim={`${mesSelecionado}-${new Date(Number(anoLabel), Number(mesLabel), 0).getDate()}`}
          contextKey={mesSelecionado}
        />
        
        {/* KPI Cards */}
        <div className="stat-grid" style={{ marginBottom: 32 }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <div className="stat-icon green"><TrendingUp size={20} /></div>
            <div className="stat-label">Receitas do Mês (Real)</div>
            <div className="stat-value"><AnimatedCounter target={totais.receitas} prefix="R$ " decimals={2} /></div>
          </div>
          <div className="glass-card" style={{ padding: '20px' }}>
            <div className="stat-icon red"><TrendingDown size={20} /></div>
            <div className="stat-label">Despesas do Mês (Real)</div>
            <div className="stat-value"><AnimatedCounter target={totais.despesas} prefix="R$ " decimals={2} /></div>
          </div>
          <div className="glass-card" style={{ padding: '20px' }}>
            <div className={`stat-icon ${totais.saldo >= 0 ? 'blue' : 'red'}`}><Activity size={20} /></div>
            <div className="stat-label">Resultado Efetivo</div>
            <div className="stat-value" style={{ color: totais.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
              <AnimatedCounter target={totais.saldo} prefix="R$ " decimals={2} />
            </div>
          </div>
          <div className="glass-card" style={{ padding: '20px' }}>
             <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><Scale size={20} /></div>
             <div className="stat-label">Total Endividamento</div>
             <div className="stat-value" style={{ color: '#b45309' }}><AnimatedCounter target={totalDivida} prefix="R$ " decimals={2} /></div>
          </div>
        </div>

        {/* Indicadores de Negócio */}
        <div className="glass-card" style={{ marginBottom: 32, padding: '20px 24px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ minWidth: 150 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5 }}>🎯 Metas do Mês</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Painel Estratégico</div>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 32, borderLeft: '1px dashed var(--border)', paddingLeft: 24 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Faturamento (Realizado)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{fmt.currency(indicador?.faturamento || 0)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Meta: {fmt.currency(empresa?.receitaMensalEstimada || 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Compras (Realizadas)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>{fmt.currency(indicador?.compras || 0)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Meta: {fmt.currency(empresa?.comprasMensalEstimada || 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Taxa Inadimplência</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--orange)' }}>{indicador?.inadimplencia || 0}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sobre faturamento geral</div>
            </div>
          </div>
          {!indicador && (
            <a href="/consultor/indicadores" className="btn btn-primary btn-sm" style={{ alignSelf: 'center', padding: '10px 16px' }}>＋ Atualizar Metas</a>
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
              <ResponsiveContainer width="100%" height={280}>
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
              <ResponsiveContainer width="100%" height={280}>
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
        <div className="grid-21" style={{ marginBottom: 32 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Evolução Líquida (Caixa Real)</div>
                <div className="card-subtitle">Evolução do fôlego de capital</div>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={resumo}>
                  <defs>
                    <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#8c1a22" stopOpacity={0.4} />
                       <stop offset="95%" stopColor="#8c1a22" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => fmt.currency(Number(v || 0))} contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border-light)', borderRadius: 8, color: '#fff' }} />
                  <Area type="monotone" dataKey="saldo" name="Saldo Efetivo" stroke="#8c1a22" fill="url(#gradSaldo)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <div className="card-title">Concentração nos Portadores</div>
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

            {/* Políticas e Diretrizes Estratégicas */}
            {(empresa?.politicaReceberName || empresa?.politicaComprasName || empresa?.politicaCobrancaName) && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px dashed var(--border-light)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>Políticas Estratégicas</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {empresa.politicaReceberName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-card2)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 16 }}>💵</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>Contas a Receber</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{empresa.politicaReceberName}</div>
                        </div>
                      </div>
                      <a 
                        href={`/api/empresas/policy?id=${empresa.id}&type=receber`} 
                        download={empresa.politicaReceberName}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 10, padding: '2px 8px' }}
                      >
                        Baixar
                      </a>
                    </div>
                  )}
                  {empresa.politicaComprasName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-card2)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 16 }}>🛒</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>Compras / Suprimentos</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{empresa.politicaComprasName}</div>
                        </div>
                      </div>
                      <a 
                        href={`/api/empresas/policy?id=${empresa.id}&type=compras`} 
                        download={empresa.politicaComprasName}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 10, padding: '2px 8px' }}
                      >
                        Baixar
                      </a>
                    </div>
                  )}
                  {empresa.politicaCobrancaName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-card2)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 16 }}>⚖️</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>Cobrança / Crédito</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{empresa.politicaCobrancaName}</div>
                        </div>
                      </div>
                      <a 
                        href={`/api/empresas/policy?id=${empresa.id}&type=cobranca`} 
                        download={empresa.politicaCobrancaName}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 10, padding: '2px 8px' }}
                      >
                        Baixar
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
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
