'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { store, Empresa, Lancamento, Portador, PlanoConta } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import GeminiTips from '../../../components/GeminiTips';
import AnimatedCounter from '../../../components/AnimatedCounter';
import ProjecaoCaixaResumo from '../../../components/ProjecaoCaixaResumo';
import { TrendingUp, TrendingDown, Activity, Scale, Printer, Plus, LogOut } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function ConsultorDashboard() {
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);
  const handleLogout = () => {
    store.setCurrentUser(null);
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/');
  };

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [empresaId, setEmpresaId] = useState('e1');
  const [resumo, setResumo] = useState<ReturnType<typeof store.getResumoMensal>>([]);
  const [totais, setTotais] = useState({ receitas: 0, despesas: 0, saldo: 0, portadores: 0 });
  const [totaisAnterior, setTotaisAnterior] = useState({ receitas: 0, despesas: 0 });
  const [carregado, setCarregado] = useState(false);
  const [portadoresList, setPortadoresList] = useState<{ nome: string; saldo: number; tipo: string }[]>([]);
  const [lancRecentes, setLancRecentes] = useState<ReturnType<typeof store.getLancamentos>>([]);
  const [categorias, setCategorias] = useState<{ name: string; value: number; color: string }[]>([]);
  const [endividamentos, setEndividamentos] = useState<ReturnType<typeof store.getEndividamentos>>([]);
  const [totalDivida, setTotalDivida] = useState(0);
  const [titulosErp, setTitulosErp] = useState({ receberAberto: 0, pagarAberto: 0, vencidos: 0 });
  const [indicador, setIndicador] = useState<ReturnType<typeof store.getIndicadores>[0] | null>(null);
  const [valuation, setValuation] = useState({ ebitdaMedio: 0, mult: 5, divida: 0, valor: 0 });
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

    // Mesma competência, mês anterior — só para calcular a variação (MoM)
    // exibida nos cards de KPI, sempre relativa ao mês selecionado no filtro
    // (não ao mês corrente do calendário).
    const dataMesSelecionado = new Date(Number(anoPeriodo), Number(mesPeriodo) - 1, 1);
    const mesAnteriorDate = new Date(dataMesSelecionado.getFullYear(), dataMesSelecionado.getMonth() - 1, 1);
    const mesAnteriorStr = `${mesAnteriorDate.getFullYear()}-${String(mesAnteriorDate.getMonth() + 1).padStart(2, '0')}`;
    const lancsMsAnterior = lancs.filter(l => l.data.startsWith(mesAnteriorStr));
    const recAnterior = lancsMsAnterior.filter(l => {
      if (l.planoContaId === 'transf') return false;
      const pc = targetPlano.find(p => p.id === l.planoContaId);
      if (pc?.tipo === 'transferencia') return false;
      return l.tipo === 'receita';
    }).reduce((a, l) => {
      const pc = targetPlano.find(p => p.id === l.planoContaId);
      const isRedutora = pc && pc.descricao.trim().startsWith('( - )');
      return a + (isRedutora ? -l.valor : l.valor);
    }, 0);
    const despAnterior = lancsMsAnterior.filter(l => {
      if (l.planoContaId === 'transf') return false;
      const pc = targetPlano.find(p => p.id === l.planoContaId);
      if (pc?.tipo === 'transferencia') return false;
      return l.tipo === 'despesa';
    }).reduce((a, l) => a + l.valor, 0);
    setTotaisAnterior({ receitas: recAnterior, despesas: despAnterior });

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

    const totalDiv = endivs.reduce((acc, e) => acc + Math.max(0, e.valorAPagar - e.pagamentoMes), 0);
    setEndividamentos(endivs);
    setTotalDivida(totalDiv);
    setIndicador(inds.find(i => i.mes === mesSelecionado) || null);

    // Motor de Valuation 
    const ebitdas = r.map(m => m.receitas - m.despesas);
    const ebitdaMedio = ebitdas.reduce((acc, cur) => acc + cur, 0) / Math.max(ebitdas.length, 1);
    // Fórmula: (EBITDA Anualizado * Múltiplo Setorial) - Dívidas
    const valor = (ebitdaMedio * 12 * 5) - totalDiv;
    setValuation({ ebitdaMedio, mult: 5, divida: totalDiv, valor: valor > 0 ? valor : 0 });

    setCarregado(true);
  }, [mesSelecionado]);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    // Recarrega quando os dados mudam localmente, via WebSocket ou via sync com o servidor,
    // para que o dashboard atualize sozinho sem precisar dar F5.
    const dataChangeHandler = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
      load(current);
    };
    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataChangeHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataChangeHandler);
    };
  }, [load]);

  // Títulos lançados pelo ERP do cliente via API v1 — fora do sync local-first
  // (lib/store.ts), então precisam de uma busca própria. Visão consolidada de
  // grupo econômico fica de fora: a rota é por empresa.
  useEffect(() => {
    if (!empresaId || empresaId.startsWith('grupo:')) { setTitulosErp({ receberAberto: 0, pagarAberto: 0, vencidos: 0 }); return; }
    const hojeIso = new Date().toISOString().split('T')[0];
    Promise.all([
      fetch(`/api/contas-financeiras?tipo=receber&status=aberto,parcial&empresaId=${empresaId}`).then(r => r.ok ? r.json() : { contas: [] }),
      fetch(`/api/contas-financeiras?tipo=pagar&status=aberto,parcial&empresaId=${empresaId}`).then(r => r.ok ? r.json() : { contas: [] }),
    ]).then(([rec, pag]) => {
      const emAberto = (c: any) => c.valorLiquido - c.baixas.reduce((s: number, b: any) => s + b.valor, 0);
      const contasRec = rec.contas || [];
      const contasPag = pag.contas || [];
      const vencidos = [...contasRec, ...contasPag].filter((c: any) => c.dataVencimento < hojeIso).length;
      setTitulosErp({
        receberAberto: contasRec.reduce((s: number, c: any) => s + emAberto(c), 0),
        pagarAberto: contasPag.reduce((s: number, c: any) => s + emAberto(c), 0),
        vencidos,
      });
    }).catch(() => setTitulosErp({ receberAberto: 0, pagarAberto: 0, vencidos: 0 }));
  }, [empresaId]);

  const [anoLabel, mesLabel] = mesSelecionado.split('-');
  const mesAtualLabel = new Date(Number(anoLabel), Number(mesLabel)-1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const horaAgora = new Date().getHours();
  const saudacao = horaAgora < 12 ? 'Bom dia' : horaAgora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = userName.split(' ')[0];

  /** % de variação vs. o mesmo indicador no mês anterior — null quando a base é zero (evita ±Infinity/NaN). */
  const variacaoPct = (atual: number, anterior: number): number | null => anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
  const TrendBadge = ({ atual, anterior, favoravelSeMaior }: { atual: number; anterior: number; favoravelSeMaior: boolean }) => {
    const pct = variacaoPct(atual, anterior);
    if (pct === null) return null;
    const subiu = pct >= 0;
    const favoravel = subiu === favoravelSeMaior;
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 6, fontSize: 11, fontWeight: 800,
        color: favoravel ? 'var(--green)' : 'var(--red)',
      }}>
        {subiu ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>vs. mês anterior</span>
      </div>
    );
  };

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
          <div className="page-title">
            {primeiroNome ? `${saudacao}, ${primeiroNome}` : 'Painel de Controle — Consultoria'}
          </div>
          <div className="page-subtitle">
            {empresa?.razaoSocial} • Competência: {mesAtualLabel}
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 10 }}>
          <select 
            className="form-control" 
            value={mesSelecionado} 
            onChange={e => setMesSelecionado(e.target.value)}
            style={{ width: 170, background: '#ffffff', borderRadius: '99px', border: '1px solid #e5e5e5', fontWeight: 500, padding: '8px 14px' }}
          >
            {mesesOptions.map(m => {
              const [y, mo] = m.split('-');
              const d = new Date(Number(y), Number(mo)-1, 1);
              return <option key={m} value={m}>{d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</option>;
            })}
          </select>
          <a href={`/consultor/report-board?empresaId=${empresaId}&mes=${mesSelecionado}`} className="btn btn-secondary">
             <Printer size={14} /> Emitir Report (PDF)
          </a>
          <a href="/consultor/lancamentos" className="btn btn-primary">
            <Plus size={14} /> Novo Lançamento
          </a>
        </div>
      </div>

      <div className="page-body">
        {/* Card Editorial Principal (Padrão Home: #0a0a0a + Card Claro) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.15fr 1fr',
          gap: 20,
          marginBottom: 28,
        }}>
          <div style={{
            background: '#0a0a0a',
            color: '#ffffff',
            borderRadius: 24,
            padding: '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a3a3a3' }}>
                Caixa Consolidado ({empresa?.nomeFantasia || 'Empresa'})
              </span>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.1)', color: '#e5e5e5' }}>
                {mesAtualLabel}
              </span>
            </div>
            <div style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 44,
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              margin: '16px 0 12px',
            }}>
              <AnimatedCounter target={totais.portadores} prefix="R$ " decimals={2} />
            </div>
            <div style={{ fontSize: 12.5, color: '#a3a3a3' }}>
              Saldo consolidado nas contas e portadores ativos até o encerramento do período selecionado.
            </div>
          </div>

          <div className="card" style={{
            borderRadius: 24,
            padding: '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#600000', marginBottom: 6 }}>
                Valuation Estimado (Múltiplo {valuation.mult}x EBITDA)
              </div>
              <div style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 38,
                fontWeight: 400,
                lineHeight: 1.1,
                color: '#000000',
              }}>
                <AnimatedCounter target={valuation.valor} prefix="R$ " decimals={2} />
              </div>
              <div style={{ fontSize: 12.5, color: '#525252', marginTop: 8 }}>
                Baseado no EBITDA médio mensal de <strong><AnimatedCounter target={valuation.ebitdaMedio} prefix="R$ " decimals={2} /></strong> anualizado, deduzido do passivo de <strong><AnimatedCounter target={valuation.divida} prefix="R$ " decimals={2} /></strong>.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, paddingTop: 14, marginTop: 14, borderTop: '1px solid #f0f0f0', fontSize: 12 }}>
              <div>
                <span style={{ color: '#737373' }}>Faturamento Meta: </span>
                <strong style={{ color: '#171717' }}>{fmt.currency(indicador?.faturamento || empresa?.receitaMensalEstimada || 0)}</strong>
              </div>
              <div>
                <span style={{ color: '#737373' }}>Limite Compras: </span>
                <strong style={{ color: '#171717' }}>{fmt.currency(indicador?.compras || empresa?.comprasMensalEstimada || 0)}</strong>
              </div>
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
        <div className="stat-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card" style={{ opacity: carregado ? 1 : 0.4, transition: 'opacity .3s' }}>
            <div className="stat-icon green"><TrendingUp size={18} /></div>
            <div className="stat-label">Receitas Efetivas (Mês)</div>
            <div className="stat-value"><AnimatedCounter target={totais.receitas} prefix="R$ " decimals={2} /></div>
            {carregado && <TrendBadge atual={totais.receitas} anterior={totaisAnterior.receitas} favoravelSeMaior={true} />}
          </div>
          <div className="stat-card" style={{ opacity: carregado ? 1 : 0.4, transition: 'opacity .3s' }}>
            <div className="stat-icon red"><TrendingDown size={18} /></div>
            <div className="stat-label">Despesas Efetivas (Mês)</div>
            <div className="stat-value"><AnimatedCounter target={totais.despesas} prefix="R$ " decimals={2} /></div>
            {carregado && <TrendBadge atual={totais.despesas} anterior={totaisAnterior.despesas} favoravelSeMaior={false} />}
          </div>
          <div className="stat-card" style={{ opacity: carregado ? 1 : 0.4, transition: 'opacity .3s' }}>
            <div className={`stat-icon ${totais.saldo >= 0 ? 'blue' : 'red'}`}><Activity size={18} /></div>
            <div className="stat-label">Resultado Operacional Líquido</div>
            <div className="stat-value" style={{ color: totais.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
              <AnimatedCounter target={totais.saldo} prefix="R$ " decimals={2} />
            </div>
            {carregado && <TrendBadge atual={totais.saldo} anterior={totaisAnterior.receitas - totaisAnterior.despesas} favoravelSeMaior={true} />}
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow"><Scale size={18} /></div>
            <div className="stat-label">Total Endividamento Ativo</div>
            <div className="stat-value" style={{ color: '#b45309' }}><AnimatedCounter target={totalDivida} prefix="R$ " decimals={2} /></div>
          </div>
          <a href="/consultor/contas-erp" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
            <div className={`stat-icon ${titulosErp.vencidos > 0 ? 'red' : 'blue'}`}>
              <Scale size={18} />
            </div>
            <div className="stat-label">Títulos ERP em aberto {titulosErp.vencidos > 0 && `(${titulosErp.vencidos} vencidos)`}</div>
            <div className="stat-value" style={{ fontSize: 22 }}>
              <span style={{ color: 'var(--green)' }}>+{fmt.currency(titulosErp.receberAberto)}</span>
              {' / '}
              <span style={{ color: 'var(--red)' }}>-{fmt.currency(titulosErp.pagarAberto)}</span>
            </div>
          </a>
        </div>

        {/* Leitura rápida do caixa futuro — o detalhamento fica na tela dedicada */}
        <ProjecaoCaixaResumo empresaId={empresaId} meses={6} />

        {/* Charts Row */}
        <div className="grid-21" style={{ marginBottom: 32 }}>
          <div className="glass-card card-dynamic animate-slide-up" style={{ padding: '24px 28px', border: '1px solid rgba(255,255,255,0.94)', background: 'rgba(255,255,255,0.45)', animationDelay: '600ms', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <div>
                <div className="card-title text-gradient" style={{ fontSize: '18px', fontWeight: 800 }}>DRE Interativa — YOY / MoM</div>
                <div className="card-subtitle" style={{ fontSize: '13px' }}>Crescimento e Margem nos últimos 6 meses (Waterfall simulado)</div>
              </div>
            </div>
            <div className="chart-container" style={{ paddingTop: '12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={resumo} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }}
                    formatter={(v: any) => fmt.currency(Number(v || 0))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, paddingTop: 10 }} />
                  <Bar dataKey="receitas" name="Entradas (Revenue)" fill="url(#colorRecC)" radius={[4,4,0,0]} animationDuration={1500} animationEasing="ease-out" />
                  <Bar dataKey="despesas" name="Saídas (Costs)" fill="url(#colorDespC)" radius={[4,4,0,0]} animationDuration={1500} animationEasing="ease-out" />
                  <Bar dataKey="saldo" name="Margem Bruta (Net)" fill="var(--amber)" radius={[4,4,0,0]} animationDuration={1500} animationEasing="ease-out" />
                  <defs>
                    <linearGradient id="colorRecC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.7}/>
                    </linearGradient>
                    <linearGradient id="colorDespC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0.7}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                 {resumo.length >= 2 && (() => {
                    const atual = resumo[resumo.length - 1];
                    const anterior = resumo[resumo.length - 2];
                    const diffRec = atual.receitas - anterior.receitas;
                    const pctRec = anterior.receitas > 0 ? (diffRec / anterior.receitas) * 100 : 0;
                    return (
                      <div style={{ padding: '12px', background: 'rgba(255,255,255,0.94)', borderRadius: 8, border: '1px solid rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>MoM (Receita vs Mês Ant.)</span>
                         <span style={{ fontSize: 13, fontWeight: 800, color: diffRec >= 0 ? 'var(--green)' : 'var(--red)' }}>
                           {diffRec >= 0 ? '↗' : '↘'} {Math.abs(pctRec).toFixed(1)}% ({fmt.currency(diffRec)})
                         </span>
                      </div>
                    )
                 })()}
                 {resumo.length >= 2 && (() => {
                    const atual = resumo[resumo.length - 1];
                    const anterior = resumo[resumo.length - 2];
                    const diffDesp = atual.despesas - anterior.despesas;
                    const pctDesp = anterior.despesas > 0 ? (diffDesp / anterior.despesas) * 100 : 0;
                    return (
                      <div style={{ padding: '12px', background: 'rgba(255,255,255,0.94)', borderRadius: 8, border: '1px solid rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>MoM (Despesas vs Mês Ant.)</span>
                         <span style={{ fontSize: 13, fontWeight: 800, color: diffDesp <= 0 ? 'var(--green)' : 'var(--red)' }}>
                           {diffDesp <= 0 ? '↘' : '↗'} {Math.abs(pctDesp).toFixed(1)}% ({fmt.currency(diffDesp)})
                         </span>
                      </div>
                    )
                 })()}
              </div>
            </div>
          </div>

          <div className="glass-card card-dynamic animate-slide-up" style={{ padding: '24px 28px', border: '1px solid rgba(255,255,255,0.94)', background: 'rgba(255,255,255,0.45)', animationDelay: '700ms' }}>
            <div className="card-header">
              <div>
                <div className="card-title" style={{ fontSize: '18px', fontWeight: 800 }}>Mapeamento de Despesas</div>
                <div className="card-subtitle" style={{ fontSize: '13px' }}>Classificação ABC - Mês atual</div>
              </div>
            </div>
            <div className="chart-container" style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '120px', height: '120px', background: 'rgba(255,255,255,0.8)', filter: 'blur(20px)', borderRadius: '50%', zIndex: 0 }} />
              <ResponsiveContainer width="100%" height={290} style={{ zIndex: 1, position: 'relative' }}>
                <PieChart>
                  <Pie data={categorias} cx="50%" cy="50%" innerRadius={70} outerRadius={105} paddingAngle={4} dataKey="value" stroke="none" animationDuration={1500} animationEasing="ease-out">
                    {categorias.map((entry, i) => <Cell key={i} fill={entry.color} style={{ filter: 'drop-shadow(0px 4px 5px rgba(0,0,0,0.15))' }} />)}
                  </Pie>
                  <Tooltip 
                    formatter={(v: any) => fmt.currency(Number(v || 0))} 
                    contentStyle={{ background: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} 
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, paddingTop: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Saldo evolution + portadores */}
        <div className="grid-21" style={{ marginBottom: 32 }}>
          <div className="glass-card card-dynamic animate-slide-up" style={{ padding: '24px 28px', border: '1px solid rgba(255,255,255,0.94)', background: 'linear-gradient(145deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%)', animationDelay: '800ms', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ marginBottom: 24 }}>
              <div>
                <div className="card-title text-gradient" style={{ fontSize: '18px', fontWeight: 800 }}>Central de Relatórios e Auditoria</div>
                <div className="card-subtitle" style={{ fontSize: '13px' }}>Acesse os demonstrativos detalhados com inteligência artificial</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', flex: 1 }}>
                <a href={`/consultor/relatorios?empresaId=${empresaId}&tab=fluxo&mes=${mesSelecionado}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px', background: 'rgba(255,255,255,0.9)', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)', textDecoration: 'none', color: 'inherit', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', transition: 'all 0.3s' }} className="card-dynamic">
                  <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '12px' }}>
                    <Activity size={24} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Fluxo de Caixa Mensal</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Entradas, Saídas e Saldos Diários (Regime de Caixa)</div>
                  </div>
                  <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#3b82f6', color: '#fff', borderRadius: '50%', fontWeight: 800 }}>→</div>
                </a>

                <a href={`/consultor/relatorios?empresaId=${empresaId}&tab=dre&mes=${mesSelecionado}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px', background: 'rgba(255,255,255,0.9)', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)', textDecoration: 'none', color: 'inherit', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', transition: 'all 0.3s' }} className="card-dynamic">
                  <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '12px' }}>
                    <TrendingUp size={24} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>DRE Gerencial</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Análise de Resultados e Provisões (Regime de Competência)</div>
                  </div>
                  <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#10b981', color: '#fff', borderRadius: '50%', fontWeight: 800 }}>→</div>
                </a>

                <a href={`/consultor/balanco-patrimonial?empresaId=${empresaId}&mes=${mesSelecionado}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px', background: 'rgba(255,255,255,0.9)', borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.2)', textDecoration: 'none', color: 'inherit', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', transition: 'all 0.3s' }} className="card-dynamic">
                  <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '12px' }}>
                    <Scale size={24} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Balanço Patrimonial</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Ativos, Passivos, PL e Indicadores de Liquidez</div>
                  </div>
                  <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f59e0b', color: '#fff', borderRadius: '50%', fontWeight: 800 }}>→</div>
                </a>
            </div>
          </div>

          <div className="glass-card card-dynamic animate-slide-up" style={{ padding: '24px 28px', border: '1px solid rgba(255,255,255,0.94)', background: 'rgba(255,255,255,0.45)', animationDelay: '900ms' }}>
            <div className="card-header" style={{ marginBottom: '24px' }}>
              <div className="card-title" style={{ fontSize: '18px', fontWeight: 800 }}>Concentração nos Portadores</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {portadoresList.map((p, i) => {
                const pct = totais.portadores > 0 ? (Math.max(0, p.saldo) / totais.portadores) * 100 : 0;
                const color = COLORS[i % COLORS.length];
                return (
                  <div key={i} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.8)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, background: `${color}15`, borderRadius: '6px', color: color }}>🏦</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.nome}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: p.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmt.currency(p.saldo)}
                      </span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--border-light)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}80 0%, ${color} 100%)`, borderRadius: '10px', boxShadow: `0 0 10px ${color}40`, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Políticas e Diretrizes Estratégicas */}
            {(empresa?.politicaReceberName || empresa?.politicaComprasName || empresa?.politicaCobrancaName) && (
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16 }}>Políticas Estratégicas Estabelecidas</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {empresa.politicaReceberName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.94) 100%)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.8)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <span style={{ fontSize: 18, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>💵</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Contas a Receber</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{empresa.politicaReceberName}</div>
                        </div>
                      </div>
                      <a 
                        href={`/api/empresas/policy?id=${empresa.id}&type=receber`} 
                        download={empresa.politicaReceberName}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '4px 12px', background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--text-primary)' }}
                      >
                        Baixar Doc
                      </a>
                    </div>
                  )}
                  {empresa.politicaComprasName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.94) 100%)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.8)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <span style={{ fontSize: 18, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>🛒</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Compras / Suprimentos</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{empresa.politicaComprasName}</div>
                        </div>
                      </div>
                      <a 
                        href={`/api/empresas/policy?id=${empresa.id}&type=compras`} 
                        download={empresa.politicaComprasName}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '4px 12px', background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--text-primary)' }}
                      >
                        Baixar Doc
                      </a>
                    </div>
                  )}
                  {empresa.politicaCobrancaName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.94) 100%)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.8)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <span style={{ fontSize: 18, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>⚖️</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Cobrança / Crédito</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{empresa.politicaCobrancaName}</div>
                        </div>
                      </div>
                      <a 
                        href={`/api/empresas/policy?id=${empresa.id}&type=cobranca`} 
                        download={empresa.politicaCobrancaName}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '4px 12px', background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--text-primary)' }}
                      >
                        Baixar Doc
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
          <div className="glass-card" style={{ marginBottom: 32, padding: '28px' }}>
            <div className="card-header" style={{ marginBottom: 20 }}>
              <div>
                <div className="card-title text-gradient" style={{ fontSize: '20px', fontWeight: 800 }}>Resumo de Endividamentos</div>
                <div className="card-subtitle" style={{ fontSize: '13px' }}>Acompanhamento de contratos e financiamentos em andamento</div>
              </div>
              <a href="/consultor/endividamento" className="btn" style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.1)', color: 'var(--text-primary)', padding: '8px 16px' }}>Ver Detalhes →</a>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '800px' }}>
                {/* Custom Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 1.5fr', padding: '12px 16px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  <div>Banco / Conta</div>
                  <div>Contrato</div>
                  <div>Taxa</div>
                  <div>Faltantes</div>
                  <div>Parcela</div>
                  <div style={{ textAlign: 'right' }}>Saldo Devedor Estimado</div>
                </div>
                
                {/* Custom Table Body */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {endividamentos.slice(0, 5).map(e => (
                    <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 1.5fr', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: '12px', transition: 'all 0.2s', cursor: 'default' }} onMouseEnter={ev => ev.currentTarget.style.backgroundColor = '#fff'} onMouseLeave={ev => ev.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.96)'}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#b45309' }} />
                        {e.banco}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{e.contrato}</div>
                      <div style={{ fontWeight: 600 }}>{e.taxa}% /m</div>
                      <div style={{ fontWeight: 600 }}>{e.parcelasFaltantes}x</div>
                      <div style={{ color: 'var(--red)', fontWeight: 600 }}>{fmt.currency(e.parcela)}</div>
                      <div style={{ textAlign: 'right', fontWeight: 800, color: '#b45309', fontSize: '15px' }}>
                        {fmt.currency(Math.max(0, e.valorAPagar - e.pagamentoMes))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Lancamentos */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <div className="card-header" style={{ marginBottom: 20 }}>
            <div>
              <div className="card-title text-gradient" style={{ fontSize: '20px', fontWeight: 800 }}>Radar de Lançamentos</div>
              <div className="card-subtitle" style={{ fontSize: '13px' }}>Últimas movimentações financeiras executadas ou previstas</div>
            </div>
            <a href="/consultor/lancamentos" className="btn" style={{ background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', color: '#fff', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px 16px' }}>Gestão Completa →</a>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '900px' }}>
              {/* Custom Table Header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) 3fr 1.5fr 1.5fr 1fr 1.5fr', padding: '12px 16px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                <div>Data</div>
                <div>Descrição</div>
                <div>Tipo</div>
                <div>Portador</div>
                <div>Status</div>
                <div style={{ textAlign: 'right' }}>Valor</div>
              </div>
              
              {/* Custom Table Body */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {lancRecentes.map(l => {
                  const port = store.getPortadores(empresaId).find(p => p.id === l.portadorId);
                  return (
                    <div key={l.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) 3fr 1.5fr 1.5fr 1fr 1.5fr', alignItems: 'center', padding: '14px 16px', background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: '12px', transition: 'all 0.2s', cursor: 'default' }} onMouseEnter={ev => ev.currentTarget.style.backgroundColor = '#fff'} onMouseLeave={ev => ev.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.96)'}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>{fmt.date(l.data)}</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{l.descricao}</div>
                      <div>
                        {l.tipo === 'receita' ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'linear-gradient(90deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.05) 100%)', color: '#059669', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, border: '1px solid rgba(16,185,129,0.2)' }}>
                            <TrendingUp size={12} /> Receita
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'linear-gradient(90deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.05) 100%)', color: '#dc2626', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, border: '1px solid rgba(239,68,68,0.2)' }}>
                            <TrendingDown size={12} /> Despesa
                          </div>
                        )}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>{port?.nome || '-'}</div>
                      <div>
                        {l.status === 'realizado' ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2563eb', fontSize: '12px', fontWeight: 700 }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} /> Realizado
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d97706', fontSize: '12px', fontWeight: 700 }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d97706', display: 'inline-block' }} /> Previsto
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 800, fontSize: '15px', color: l.tipo === 'receita' ? '#10b981' : '#ef4444' }}>
                        {l.tipo === 'receita' ? '+' : '-'}{fmt.currency(l.valor)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
