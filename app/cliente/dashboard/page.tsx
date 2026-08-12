'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { store, Empresa } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import GeminiTips from '../../../components/GeminiTips';
import AnimatedCounter from '../../../components/AnimatedCounter';
import AIInsights from '../../../components/AIInsights';
import HealthScore from '../../../components/HealthScore';
import { TrendingUp, TrendingDown, Activity, Percent } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function ClienteDashboard() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [empresaId, setEmpresaId] = useState('e1');
  const [resumo, setResumo] = useState<ReturnType<typeof store.getResumoMensal>>([]);
  const [totais, setTotais] = useState({ receitas: 0, despesas: 0, saldo: 0, portadores: 0 });
  const [portadoresList, setPortadoresList] = useState<{ nome: string; saldo: number; tipo: string }[]>([]);
  const [categorias, setCategorias] = useState<{ name: string; value: number; color: string }[]>([]);
  const [tendencia, setTendencia] = useState<{ mes: string; receitas: number; despesas: number; saldo: number }[]>([]);
  const [userName, setUserName] = useState('');
  
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });

  const meses = useMemo(() => {
    const list: string[] = [];
    const hoje = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
  }, []);

  const [dataIni, dataFim] = useMemo(() => {
    const [ano, mes] = mesSelecionado.split('-').map(Number);
    const dIni = `${mesSelecionado}-01`;
    const dFim = new Date(ano, mes, 0).toISOString().split('T')[0];
    return [dIni, dFim];
  }, [mesSelecionado]);

  useEffect(() => {
    const u = store.getCurrentUser();
    if (u) {
      setUserName(u.name);
    }
  }, []);

  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4'];

  const load = useCallback((eId: string, mesSel: string) => {
    const user = store.getCurrentUser();
    const e = store.getEmpresas().find(x => x.id === eId && (!user || user.empresaIds.includes(x.id))) || null;
    setEmpresa(e);
    setEmpresaId(eId);

    const r = store.getResumoMensal(eId, 6);
    setResumo(r);
    setTendencia(r);

    const lancs = store.getLancamentos(eId).filter(l => l.status === 'realizado');
    const lancsMs = lancs.filter(l => l.data.startsWith(mesSel));
    const plano = store.getPlanoContas(eId);
    const rec = lancsMs.filter(l => {
      if (l.planoContaId === 'transf') return false;
      const pc = plano.find(p => p.id === l.planoContaId);
      if (pc?.tipo === 'transferencia') return false;
      return l.tipo === 'receita';
    }).reduce((a, l) => {
      const pc = plano.find(p => p.id === l.planoContaId);
      const isRedutora = pc && pc.descricao.trim().startsWith('( - )');
      return a + (isRedutora ? -l.valor : l.valor);
    }, 0);
    const desp = lancsMs.filter(l => {
      if (l.planoContaId === 'transf') return false;
      const pc = plano.find(p => p.id === l.planoContaId);
      if (pc?.tipo === 'transferencia') return false;
      return l.tipo === 'despesa';
    }).reduce((a, l) => a + l.valor, 0);

    const [ano, mes] = mesSel.split('-').map(Number);
    const dataFimPeriodo = new Date(ano, mes, 0).toISOString().split('T')[0];
    const ports = store.getPortadores(eId);
    const totalPort = ports.reduce((a, p) => a + store.getSaldoPortador(p.id, eId, dataFimPeriodo), 0);
    setTotais({ receitas: rec, despesas: desp, saldo: rec - desp, portadores: totalPort });
    setPortadoresList(ports.map(p => ({ nome: p.nome, saldo: store.getSaldoPortador(p.id, eId, dataFimPeriodo), tipo: p.tipo })));

    const despCats: Record<string, number> = {};
    lancsMs.filter(l => {
      if (l.planoContaId === 'transf') return false;
      const pc = plano.find(p => p.id === l.planoContaId);
      if (pc?.tipo === 'transferencia') return false;
      return l.tipo === 'despesa';
    }).forEach(l => {
      const pc = plano.find(p => p.id === l.planoContaId);
      const nome = pc?.descricao || 'Outros';
      despCats[nome] = (despCats[nome] || 0) + l.valor;
    });
    setCategorias(
      Object.entries(despCats).sort((a,b)=>b[1]-a[1]).slice(0,6)
        .map(([name,value],i)=>({ name, value, color: COLORS[i % COLORS.length] }))
    );
  }, []);

  useEffect(() => {
    const user = store.getCurrentUser();
    const defaultEmpresaId = user?.empresaIds?.[0] || store.getEmpresas()[0]?.id || '';
    const saved = sessionStorage.getItem('cf_empresa_sel') || defaultEmpresaId;
    load(saved, mesSelecionado);
    
    const handler = (e: Event) => load((e as CustomEvent).detail, mesSelecionado);
    const dataHandler = () => {
      const u = store.getCurrentUser();
      const current = sessionStorage.getItem('cf_empresa_sel') || u?.empresaIds?.[0] || store.getEmpresas()[0]?.id || '';
      load(current, mesSelecionado);
    };

    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataHandler);
    };
  }, [load, mesSelecionado]);

  const margem = totais.receitas > 0 ? ((totais.saldo / totais.receitas) * 100) : 0;
  
  const hojeData = new Date();
  const diaDaSemana = hojeData.getDay(); // 0 (Dom) a 6 (Sáb)
  
  const inicioSemana = new Date(hojeData);
  inicioSemana.setDate(hojeData.getDate() - diaDaSemana);
  const inicioSemanaStr = inicioSemana.toISOString().split('T')[0];

  const fimSemana = new Date(hojeData);
  fimSemana.setDate(hojeData.getDate() + (6 - diaDaSemana));
  const fimSemanaStr = fimSemana.toISOString().split('T')[0];

  // Cálculos da semana atual
  const lancsSemana = store.getLancamentos(empresaId).filter(l => 
    l.data >= inicioSemanaStr && l.data <= fimSemanaStr && l.planoContaId !== 'transf'
  );

  const entradasSemana = lancsSemana.filter(l => l.tipo === 'receita').reduce((a, l) => a + l.valor, 0);
  const saidasSemana = lancsSemana.filter(l => l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0);
  
  const [ySel, moSel] = mesSelecionado.split('-');
  const dSel = new Date(Number(ySel), Number(moSel) - 1, 1);
  const mesAtualLabel = dSel.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <>
      <div className="page-header glass-header">
        <div>
          <div className="page-title text-gradient">Painel Executivo — {empresa?.nomeFantasia}</div>
          <div className="page-subtitle">{mesAtualLabel} • Resumo direto ao ponto</div>
        </div>
        <div className="header-actions">
          <select 
            className="form-control" 
            value={mesSelecionado} 
            onChange={e => setMesSelecionado(e.target.value)}
            style={{ width: '200px', background: 'var(--bg-card)', borderRadius: '20px' }}
          >
            {meses.map(m => {
              const [y, mo] = m.split('-');
              const d = new Date(Number(y), Number(mo) - 1, 1);
              return (
                <option key={m} value={m}>
                  {d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                </option>
              );
            })}
          </select>
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
              Olá, <span className="text-gradient">{userName}</span>! 👋
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
              Aqui está o pulso financeiro da <strong>{empresa?.razaoSocial}</strong>.
            </div>
          </div>
          <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.5)', padding: '16px 24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Saldo Atual em Caixa</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: totais.portadores >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>
              <AnimatedCounter target={totais.portadores} prefix="R$ " decimals={2} />
            </div>
          </div>
        </div>
        
        <GeminiTips 
          empresaId={empresaId} 
          dataIni={dataIni} 
          dataFim={dataFim} 
          contextKey={mesSelecionado} 
        />
        
        {/* Painel de IA / Inteligência */}
        <AIInsights empresaId={empresaId} mesSelecionado={mesSelecionado} />

        {/* Foco na Semana */}
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-secondary)' }}>Esta Semana (Sobrevivência)</h3>
        <div className="grid-2" style={{ marginBottom: 32 }}>
           <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--green)' }}>
             <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Entradas da Semana</div>
             <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', marginTop: 8 }}><AnimatedCounter target={entradasSemana} prefix="R$ " decimals={2} /></div>
             <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>Tudo que está previsto para entrar até sábado.</div>
           </div>
           <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--red)' }}>
             <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Saídas da Semana</div>
             <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--red)', marginTop: 8 }}><AnimatedCounter target={saidasSemana} prefix="R$ " decimals={2} /></div>
             <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>Tudo que precisa ser pago até sábado.</div>
           </div>
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-secondary)' }}>Resumo do Mês ({mesAtualLabel})</h3>
        <div className="stat-grid" style={{ marginBottom: 32 }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <div className="stat-icon green"><TrendingUp size={20} /></div>
            <div className="stat-label">Entradas no Mês</div>
            <div className="stat-value"><AnimatedCounter target={totais.receitas} prefix="R$ " decimals={2} /></div>
          </div>
          <div className="glass-card" style={{ padding: '20px' }}>
            <div className="stat-icon red"><TrendingDown size={20} /></div>
            <div className="stat-label">Saídas no Mês</div>
            <div className="stat-value"><AnimatedCounter target={totais.despesas} prefix="R$ " decimals={2} /></div>
          </div>
          <div className="glass-card" style={{ padding: '20px' }}>
            <div className={`stat-icon ${totais.saldo >= 0 ? 'blue' : 'red'}`}><Activity size={20} /></div>
            <div className="stat-label">O que Sobrou (Fôlego)</div>
            <div className="stat-value" style={{ color: totais.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
              <AnimatedCounter target={totais.saldo} prefix="R$ " decimals={2} />
            </div>
          </div>
          <div className="glass-card" style={{ padding: '20px' }}>
            <div className="stat-icon purple"><Percent size={20} /></div>
            <div className="stat-label">Margem Limpa</div>
            <div className="stat-value" style={{ color: margem >= 20 ? 'var(--green)' : margem >= 0 ? 'var(--yellow)' : 'var(--red)' }}>
              {margem.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid-21" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title text-gradient" style={{ fontSize: '18px' }}>Evolução Financeira</div>
                <div className="card-subtitle">Receitas, despesas e resultado líquido mensal</div>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={resumo} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border-light)', borderRadius: 8 }} formatter={(v: any) => fmt.currency(Number(v || 0))} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                  <Bar dataKey="receitas" name="Receitas" fill="var(--green)" radius={[4,4,0,0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="var(--red)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Distribuição de Despesas</div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={categorias} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                    {categorias.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt.currency(Number(v || 0))} contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border-light)', borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10, color: 'var(--text-secondary)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Área de saldo + portadores */}
        <div className="grid-21">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title text-gradient" style={{ fontSize: '18px' }}>Crescimento & Sobrevivência (Margem)</div>
                <div className="card-subtitle">Resultado líquido mensal e fôlego em caixa</div>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={tendencia}>
                  <defs>
                    <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => fmt.currency(Number(v || 0))} contentStyle={{ background: 'var(--bg-card2)', border: '1px solid var(--border-light)', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="saldo" name="Resultado Líquido" stroke="#22c55e" fill="url(#gradPos)" strokeWidth={4} style={{ filter: 'drop-shadow(0 0 10px rgba(34,197,94,0.3))' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <HealthScore empresaId={empresaId} mesSelecionado={mesSelecionado} />
            
            <div className="card">
              <div className="card-header">
              <div className="card-title">Saldo por Portador no Periodo</div>
            </div>
            {portadoresList.map((p, i) => {
              const pct = totais.portadores > 0 ? (Math.max(0, p.saldo) / Math.max(totais.portadores, 1)) * 100 : 0;
              return (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>🏦 {p.nome}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: p.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmt.currency(p.saldo)}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              );
            })}

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
        </div>
      </div>
    </>
  );
}
