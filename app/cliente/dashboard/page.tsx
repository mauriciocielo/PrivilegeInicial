'use client';
import { useEffect, useState, useCallback } from 'react';
import { store, Empresa } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import GeminiTips from '../../../components/GeminiTips';
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

  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4'];

  const load = useCallback((eId: string) => {
    const user = store.getCurrentUser();
    const e = store.getEmpresas().find(x => x.id === eId && (!user || user.empresaIds.includes(x.id))) || null;
    setEmpresa(e);
    setEmpresaId(eId);

    const r = store.getResumoMensal(eId, 6);
    setResumo(r);
    setTendencia(r);

    const lancs = store.getLancamentos(eId).filter(l => l.status === 'realizado');
    const mesAtual = new Date();
    const lancsMs = lancs.filter(l => {
      const d = new Date(l.data);
      return d.getMonth() === mesAtual.getMonth() && d.getFullYear() === mesAtual.getFullYear();
    });
    const rec = lancsMs.filter(l => l.tipo === 'receita').reduce((a, l) => a + l.valor, 0);
    const desp = lancsMs.filter(l => l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0);

    const ports = store.getPortadores(eId);
    const totalPort = ports.reduce((a, p) => a + store.getSaldoPortador(p.id, eId), 0);
    setTotais({ receitas: rec, despesas: desp, saldo: rec - desp, portadores: totalPort });
    setPortadoresList(ports.map(p => ({ nome: p.nome, saldo: store.getSaldoPortador(p.id, eId), tipo: p.tipo })));

    const plano = store.getPlanoContas(eId);
    const despCats: Record<string, number> = {};
    lancsMs.filter(l => l.tipo === 'despesa').forEach(l => {
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
    const eId = user?.empresaIds?.[0] || sessionStorage.getItem('cf_empresa_sel') || 'e1';
    load(eId);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  const margem = totais.receitas > 0 ? ((totais.saldo / totais.receitas) * 100) : 0;
  const mesAtualLabel = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Visão Geral — {empresa?.nomeFantasia}</div>
          <div className="page-subtitle">{mesAtualLabel} • Dados financeiros em tempo real</div>
        </div>
      </div>

      <div className="page-body">
        {/* Welcome Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(124,58,237,0.15))',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              Olá! Bem-vindo ao seu painel financeiro 👋
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              {empresa?.razaoSocial} • CNPJ: {empresa?.cnpj}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Saldo em Caixa</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: totais.portadores >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt.currency(totais.portadores)}
            </div>
          </div>
        </div>
        
        <GeminiTips empresaId={empresaId} />

        {/* KPIs */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card green">
            <div className="stat-icon green">↑</div>
            <div className="stat-label">Receitas do Mês</div>
            <div className="stat-value">{fmt.currency(totais.receitas)}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-icon red">↓</div>
            <div className="stat-label">Despesas do Mês</div>
            <div className="stat-value">{fmt.currency(totais.despesas)}</div>
          </div>
          <div className={`stat-card ${totais.saldo >= 0 ? 'blue' : 'red'}`}>
            <div className={`stat-icon ${totais.saldo >= 0 ? 'blue' : 'red'}`}>≈</div>
            <div className="stat-label">Resultado do Mês</div>
            <div className="stat-value" style={{ color: totais.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt.currency(totais.saldo)}
            </div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple">%</div>
            <div className="stat-label">Margem do Período</div>
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
                <div className="card-title">Evolução Financeira</div>
                <div className="card-subtitle">Receitas, despesas e resultado nos últimos 6 meses</div>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
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
              <ResponsiveContainer width="100%" height="100%">
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
                <div className="card-title">Tendência de Resultado</div>
                <div className="card-subtitle">Resultado líquido mensal</div>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
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
                  <Area type="monotone" dataKey="saldo" name="Resultado" stroke="#22c55e" fill="url(#gradPos)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Saldo por Portador</div>
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
          </div>
        </div>
      </div>
    </>
  );
}
