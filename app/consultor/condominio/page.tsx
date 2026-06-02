'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { store, type Empresa, type Unidade, type Lancamento, type PlanoConta, type Portador } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import { uid } from '../../../lib/store';
import dynamic from 'next/dynamic';

// Recharts dynamically imported without SSR to prevent Next.js hydration errors
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });

type CondoTab = 'geral' | 'unidades' | 'taxas' | 'prestacao' | 'inadimplencia' | 'financeiro';

export default function CondominioHubPage() {
  const [condoId, setCondoId] = useState('');
  const [condo, setCondo] = useState<Empresa | null>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [activeTab, setActiveTab] = useState<CondoTab>('geral');

  // Unidade Modal
  const [showUniModal, setShowUniModal] = useState(false);
  const [editUni, setEditUni] = useState<Unidade | null>(null);
  const [uniForm, setUniForm] = useState<Partial<Unidade>>({});
  const [moradorMesmo, setMoradorMesmo] = useState(true);

  // Financeiro / Contas a Pagar & Receber
  const [finTipoFilter, setFinTipoFilter] = useState<'receita' | 'despesa' | ''>('');
  const [finStatusFilter, setFinStatusFilter] = useState<'previsto' | 'realizado' | ''>('');
  const [finMesFilter, setFinMesFilter] = useState('');
  const [finSearch, setFinSearch] = useState('');
  const [finUnidadeFilter, setFinUnidadeFilter] = useState('');

  const [showFinModal, setShowFinModal] = useState(false);
  const [editFinLanc, setEditFinLanc] = useState<Lancamento | null>(null);
  const [finForm, setFinForm] = useState<Partial<Lancamento> & { tipoTransacao?: 'receita' | 'despesa' }>({});
  const [finPlanoContaSearch, setFinPlanoContaSearch] = useState('');
  const [finSaving, setFinSaving] = useState(false);

  // Boleto Modal
  const [showBoletoModal, setShowBoletoModal] = useState(false);
  const [boletoLanc, setBoletoLanc] = useState<Lancamento | null>(null);

  const handleOpenNewFin = () => {
    setEditFinLanc(null);
    setFinPlanoContaSearch('');
    setFinForm({
      tipoTransacao: 'receita',
      tipo: 'receita',
      status: 'previsto',
      data: new Date().toISOString().split('T')[0],
      empresaId: condoId,
    });
    setShowFinModal(true);
  };

  const handleOpenEditFin = (l: Lancamento) => {
    setEditFinLanc(l);
    setFinPlanoContaSearch('');
    setFinForm({
      ...l,
      tipoTransacao: l.tipo,
    });
    setShowFinModal(true);
  };

  const handleSaveFinLanc = () => {
    if (!finForm.descricao || !finForm.valor || !finForm.planoContaId || !finForm.portadorId || !finForm.data) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }
    setFinSaving(true);
    const lanc: Lancamento = {
      id: editFinLanc?.id || uid(),
      empresaId: condoId,
      data: finForm.data!,
      descricao: finForm.descricao!,
      valor: Number(finForm.valor),
      tipo: finForm.tipoTransacao as 'receita' | 'despesa',
      planoContaId: finForm.planoContaId!,
      portadorId: finForm.portadorId!,
      status: (finForm.status || 'previsto') as 'previsto' | 'realizado',
      numeroDocumento: finForm.numeroDocumento || '',
      observacao: finForm.observacao || '',
      unidadeId: finForm.unidadeId || undefined,
      origem: 'manual',
      createdAt: editFinLanc?.createdAt || new Date().toISOString(),
    };
    store.saveLancamento(lanc);
    load(condoId);
    setFinSaving(false);
    setShowFinModal(false);
  };

  const handleDeleteFinLanc = (id: string) => {
    if (!confirm('Deseja realmente excluir este lançamento financeiro?')) return;
    store.deleteLancamento(id);
    load(condoId);
  };

  const handleQuickPayReceive = (lanc: Lancamento) => {
    const updated: Lancamento = {
      ...lanc,
      status: 'realizado',
    };
    store.saveLancamento(updated);
    load(condoId);
    alert(`${lanc.tipo === 'receita' ? 'Receita recebida' : 'Despesa paga'} com sucesso!`);
  };

  const handleOpenBoleto = (l: Lancamento) => {
    setBoletoLanc(l);
    setShowBoletoModal(true);
  };

  const filteredFinLancamentos = useMemo(() => {
    return lancamentos.filter(l => {
      if (finTipoFilter && l.tipo !== finTipoFilter) return false;
      if (finStatusFilter && l.status !== finStatusFilter) return false;
      if (finMesFilter && !l.data.startsWith(finMesFilter)) return false;
      if (finUnidadeFilter && l.unidadeId !== finUnidadeFilter) return false;
      if (finSearch && !l.descricao.toLowerCase().includes(finSearch.toLowerCase())) return false;
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data));
  }, [lancamentos, finTipoFilter, finStatusFilter, finMesFilter, finUnidadeFilter, finSearch]);

  const finSummary = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 7);
    
    let aReceberPendente = 0;
    let aPagarPendente = 0;
    let recebidoMes = 0;
    let pagoMes = 0;

    lancamentos.forEach(l => {
      if (l.status === 'previsto') {
        if (l.tipo === 'receita') aReceberPendente += l.valor;
        else aPagarPendente += l.valor;
      } else {
        if (l.data.startsWith(hoje)) {
          if (l.tipo === 'receita') recebidoMes += l.valor;
          else pagoMes += l.valor;
        }
      }
    });

    return { aReceberPendente, aPagarPendente, recebidoMes, pagoMes };
  }, [lancamentos]);

  // Taxas Generation
  const [mesCobranca, setMesCobranca] = useState(() => new Date().toISOString().slice(0, 7));
  const [tipoRateio, setTipoRateio] = useState<'fixo' | 'fracao'>('fixo');
  const [valorFixo, setValorFixo] = useState(350);
  const [orcamentoTotal, setOrcamentoTotal] = useState(5000);
  const [fundoReservaCheck, setFundoReservaCheck] = useState(true);

  // Prestacao de Contas
  const [mesPrestacao, setMesPrestacao] = useState(() => new Date().toISOString().slice(0, 7));

  const load = useCallback((eId: string) => {
    const list = store.getEmpresas();
    const active = list.find(e => e.id === eId) || null;
    setCondoId(eId);
    setCondo(active);
    
    if (active && active.tipo === 'condominio') {
      setUnidades(store.getUnidades(eId));
      setLancamentos(store.getLancamentos(eId));
      setPlanoContas(store.getPlanoContas(eId));
      if (active.taxaMensalPadrao) setValorFixo(active.taxaMensalPadrao);
    } else {
      setUnidades([]);
      setLancamentos([]);
      setPlanoContas([]);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || '';
    load(saved);

    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    
    const dataHandler = () => {
      const currentSaved = sessionStorage.getItem('cf_empresa_sel') || '';
      load(currentSaved);
    };
    window.addEventListener('cfDataChange', dataHandler);

    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataHandler);
    };
  }, [load]);

  // --- ABA 1: METRICAS GERAIS ---
  const metricas = useMemo(() => {
    const totalFees = lancamentos.filter(l => l.descricao.includes('Taxa Condominial'));
    const unpaidFees = totalFees.filter(l => l.status === 'previsto');
    const totalCount = totalFees.length || 1;
    const unpaidCount = unpaidFees.length;
    const inadimplenciaPct = Math.round((unpaidCount / totalCount) * 100);

    const reservePortador = store.getPortadores(condoId).find(p => p.nome.includes('Reserva'));
    const reserveBalance = reservePortador ? store.getSaldoPortador(reservePortador.id, condoId) : 0;
    
    const allPortadores = store.getPortadores(condoId);
    const totalCaixa = allPortadores.reduce((acc, p) => acc + store.getSaldoPortador(p.id, condoId), 0);

    return {
      inadimplenciaPct,
      reserveBalance,
      totalCaixa,
      totalUnidades: unidades.length
    };
  }, [lancamentos, unidades, condoId]);

  const chartData = useMemo(() => {
    // Agrupa receitas vs despesas nos últimos 6 meses
    const dataMap: Record<string, { mes: string; Receitas: number; Despesas: number }> = {};
    const hoje = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const k = d.toISOString().slice(0, 7);
      dataMap[k] = { mes: d.toLocaleString('pt-BR', { month: 'short' }), Receitas: 0, Despesas: 0 };
    }

    lancamentos.filter(l => l.status === 'realizado').forEach(l => {
      const k = l.data.slice(0, 7);
      if (dataMap[k]) {
        if (l.tipo === 'receita') dataMap[k].Receitas += l.valor;
        else dataMap[k].Despesas += l.valor;
      }
    });

    return Object.values(dataMap);
  }, [lancamentos]);

  // --- ABA 2: CRUD UNIDADES ---
  const handleOpenNewUni = () => {
    setEditUni(null);
    setUniForm({ fracaoIdeal: 0.1 });
    setMoradorMesmo(true);
    setShowUniModal(true);
  };

  const handleOpenEditUni = (u: Unidade) => {
    setEditUni(u);
    setUniForm({ ...u });
    const isSame = !u.moradorNome || u.moradorNome === u.proprietario;
    setMoradorMesmo(isSame);
    setShowUniModal(true);
  };

  const handleSaveUnidade = () => {
    if (!uniForm.identificacao || !uniForm.proprietario) {
      alert('Identificação e Proprietário são obrigatórios.');
      return;
    }
    const uni: Unidade = {
      id: editUni?.id || uid(),
      condominioId: condoId,
      identificacao: uniForm.identificacao!,
      proprietario: uniForm.proprietario!,
      proprietarioCpf: uniForm.proprietarioCpf || '',
      fracaoIdeal: Number(uniForm.fracaoIdeal) || 0.1,
      email: uniForm.email || '',
      telefone: uniForm.telefone || '',
      moradorNome: moradorMesmo ? uniForm.proprietario : (uniForm.moradorNome || ''),
      moradorCpf: moradorMesmo ? uniForm.proprietarioCpf : (uniForm.moradorCpf || ''),
      moradorEmail: moradorMesmo ? uniForm.email : (uniForm.moradorEmail || ''),
      moradorTelefone: moradorMesmo ? uniForm.telefone : (uniForm.moradorTelefone || ''),
    };
    store.saveUnidade(uni);
    setUnidades(store.getUnidades(condoId));
    setShowUniModal(false);
  };

  const handleDeleteUnidade = (id: string) => {
    if (!confirm('Excluir esta unidade? Todos os lançamentos do condomínio continuarão existindo.')) return;
    store.deleteUnidade(id);
    setUnidades(store.getUnidades(condoId));
  };

  // --- ABA 3: GERAR TAXAS ---
  const handleGerarTaxas = () => {
    if (unidades.length === 0) {
      alert('Cadastre unidades primeiro para poder faturar as taxas.');
      return;
    }
    
    // Procura por conta de receita condominial e conta de fundo de reserva
    const ordinariaPc = planoContas.find(p => p.codigo.startsWith('1.1.1.001') || p.descricao.includes('Ordinárias'));
    const reservaPc = planoContas.find(p => p.codigo.startsWith('1.1.1.004') || p.descricao.includes('Reserva'));
    const mainPortador = store.getPortadores(condoId).find(p => p.tipo === 'conta_corrente');
    
    if (!mainPortador) {
      alert('Cadastre um portador do tipo Conta Corrente para receber as taxas.');
      return;
    }

    const targetOrdId = ordinariaPc?.id || planoContas[0]?.id || 'pc1';
    
    let count = 0;
    const novosLancamentos: Lancamento[] = [];

    unidades.forEach(uni => {
      // Evita duplicar cobrança do mesmo mês e unidade
      const exists = lancamentos.some(l => l.unidadeId === uni.id && l.data.startsWith(mesCobranca) && l.descricao.includes('Taxa Condominial'));
      if (exists) return;

      const valorOrdinario = tipoRateio === 'fixo' ? valorFixo : (orcamentoTotal * uni.fracaoIdeal);
      
      // Cria lançamento principal de cobrança ordinária
      const mainLanc: Lancamento = {
        id: uid(),
        empresaId: condoId,
        data: `${mesCobranca}-10`, // vencimento dia 10
        descricao: `Taxa Condominial Ordinária - ${uni.identificacao}`,
        valor: Math.round(valorOrdinario * 100) / 100,
        tipo: 'receita',
        planoContaId: targetOrdId,
        portadorId: mainPortador.id,
        status: 'previsto',
        unidadeId: uni.id,
        origem: 'manual',
        createdAt: new Date().toISOString(),
      };
      store.saveLancamento(mainLanc);
      novosLancamentos.push(mainLanc);
      count++;

      // Se fundo de reserva ativo, gera provisão de transferência (se houver conta poupança reserva)
      if (fundoReservaCheck && condo?.fundoReservaPct) {
        const valorReserva = valorOrdinario * (condo.fundoReservaPct / 100);
        const reservePortador = store.getPortadores(condoId).find(p => p.nome.includes('Reserva'));
        const targetResId = reservaPc?.id || targetOrdId;
        
        if (reservePortador) {
          const resLanc: Lancamento = {
            id: uid(),
            empresaId: condoId,
            data: `${mesCobranca}-10`,
            descricao: `Fundo de Reserva (${condo.fundoReservaPct}%) - ${uni.identificacao}`,
            valor: Math.round(valorReserva * 100) / 100,
            tipo: 'receita',
            planoContaId: targetResId,
            portadorId: reservePortador.id,
            status: 'previsto',
            unidadeId: uni.id,
            origem: 'manual',
            createdAt: new Date().toISOString(),
          };
          store.saveLancamento(resLanc);
        }
      }
    });

    if (count > 0) {
      alert(`${count} lançamentos de taxas condominiais gerados para o mês ${mesCobranca}!`);
      load(condoId);
    } else {
      alert('As taxas ordinárias deste mês já foram geradas para todas as unidades cadastradas.');
    }
  };

  // --- ABA 4: PRESTACAO DE CONTAS ---
  const prestacaoData = useMemo(() => {
    const list = lancamentos.filter(l => l.data.startsWith(mesPrestacao) && l.status === 'realizado');
    
    // Agrupamentos
    let taxasOrdinarias = 0;
    let taxasExtra = 0;
    let multasJuros = 0;
    let fundoReservaEntradas = 0;
    let totalRecebido = 0;

    let pessoal = 0;
    let consumos = 0;
    let manutencao = 0;
    let despesasAdm = 0;
    let totalPago = 0;

    list.forEach(l => {
      const pc = planoContas.find(p => p.id === l.planoContaId);
      if (!pc) return;
      const cod = pc.codigo;

      if (l.tipo === 'receita') {
        if (cod.startsWith('1.1.1.001') || pc.descricao.includes('Ordinárias')) taxasOrdinarias += l.valor;
        else if (cod.startsWith('1.1.1.002') || pc.descricao.includes('Extraordinárias')) taxasExtra += l.valor;
        else if (cod.startsWith('1.1.1.003') || pc.descricao.includes('Multas')) multasJuros += l.valor;
        else if (cod.startsWith('1.1.1.004') || pc.descricao.includes('Reserva')) fundoReservaEntradas += l.valor;
        totalRecebido += l.valor;
      } else {
        if (cod.startsWith('3.1.1') || pc.descricao.includes('Zeladoria')) pessoal += l.valor;
        else if (cod.startsWith('3.1.2') || pc.descricao.includes('Água') || pc.descricao.includes('Energia')) consumos += l.valor;
        else if (cod.startsWith('3.1.17') || pc.descricao.includes('Elevadores') || pc.descricao.includes('Manutenção')) manutencao += l.valor;
        else despesasAdm += l.valor;
        totalPago += l.valor;
      }
    });

    return {
      taxasOrdinarias, taxasExtra, multasJuros, fundoReservaEntradas, totalRecebido,
      pessoal, consumos, manutencao, despesasAdm, totalPago,
      saldoMes: totalRecebido - totalPago
    };
  }, [lancamentos, planoContas, mesPrestacao]);

  // --- ABA 5: INADIMPLENCIA ---
  const inadimplenciaLista = useMemo(() => {
    // Seleciona todas as taxas em aberto (previsto)
    const emAberto = lancamentos.filter(l => l.status === 'previsto' && l.descricao.includes('Taxa Condominial'));
    const mapUnidade: Record<string, { unidade: Unidade; parcelas: string[]; totalDevido: number }> = {};

    emAberto.forEach(l => {
      if (!l.unidadeId) return;
      const uni = unidades.find(u => u.id === l.unidadeId);
      if (!uni) return;

      if (!mapUnidade[l.unidadeId]) {
        mapUnidade[l.unidadeId] = { unidade: uni, parcelas: [], totalDevido: 0 };
      }
      mapUnidade[l.unidadeId].parcelas.push(l.data.slice(0, 7));
      mapUnidade[l.unidadeId].totalDevido += l.valor;
    });

    return Object.values(mapUnidade).sort((a, b) => b.totalDevido - a.totalDevido);
  }, [lancamentos, unidades]);

  if (!condo || condo.tipo !== 'condominio') {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', marginTop: 30 }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>🏘️</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Selecione um Condomínio Ativo</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 450, margin: '0 auto 20px auto' }}>
          Para acessar os controles de condomínio, altere o Modo no topo do menu lateral para <strong>🏘️ Condomínios</strong> e selecione um condomínio de sua carteira.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Administração de Condomínios</div>
          <div className="page-subtitle">{condo.razaoSocial} — Gestão Contábil de Unidades</div>
        </div>
      </div>

      <div className="page-body">
        {/* Abas */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border-light)', paddingBottom: 12, overflowX: 'auto' }}>
          <button className={`btn ${activeTab === 'geral' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12.5 }} onClick={() => setActiveTab('geral')}>
            📊 Painel Geral
          </button>
          <button className={`btn ${activeTab === 'unidades' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12.5 }} onClick={() => setActiveTab('unidades')}>
            🚪 Unidades ({unidades.length})
          </button>
          <button className={`btn ${activeTab === 'taxas' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12.5 }} onClick={() => setActiveTab('taxas')}>
            💰 Gerar Taxas / Boletos
          </button>
          <button className={`btn ${activeTab === 'prestacao' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12.5 }} onClick={() => setActiveTab('prestacao')}>
            ⚖️ Prestação de Contas
          </button>
          <button className={`btn ${activeTab === 'inadimplencia' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12.5 }} onClick={() => setActiveTab('inadimplencia')}>
            ⚠️ Inadimplência ({inadimplenciaLista.length})
          </button>
          <button className={`btn ${activeTab === 'financeiro' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12.5 }} onClick={() => setActiveTab('financeiro')}>
            💸 Contas a Pagar/Receber
          </button>
        </div>

        {/* 1. PAINEL GERAL */}
        {activeTab === 'geral' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="stat-grid">
              <div className="stat-card blue">
                <div className="stat-icon blue">🚪</div>
                <div className="stat-label">Total Unidades</div>
                <div className="stat-value">{metricas.totalUnidades}</div>
              </div>
              <div className="stat-card red">
                <div className="stat-icon red">⚠️</div>
                <div className="stat-label">Inadimplência</div>
                <div className="stat-value">{metricas.inadimplenciaPct}%</div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon green">🛡️</div>
                <div className="stat-label">Fundo de Reserva</div>
                <div className="stat-value">{fmt.currency(metricas.reserveBalance)}</div>
              </div>
              <div className="stat-card purple">
                <div className="stat-icon purple">🏦</div>
                <div className="stat-label">Caixa Total</div>
                <div className="stat-value">{fmt.currency(metricas.totalCaixa)}</div>
              </div>
            </div>

            <div className="grid-12">
              <div className="card" style={{ gridColumn: 'span 8' }}>
                <h3 style={{ fontSize: 15, marginBottom: 16 }}>Balanço Recente (Receitas vs Despesas)</h3>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="mes" stroke="var(--text-muted)" style={{ fontSize: 11 }} />
                      <YAxis stroke="var(--text-muted)" style={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => fmt.currency(value as number)} />
                      <Legend />
                      <Bar dataKey="Receitas" fill="var(--green)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Despesas" fill="var(--red)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card" style={{ gridColumn: 'span 4' }}>
                <h3 style={{ fontSize: 15, marginBottom: 12 }}>Atalhos Rápidos</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setActiveTab('unidades')}>
                    🚪 Cadastrar Nova Unidade
                  </button>
                  <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setActiveTab('taxas')}>
                    💰 Faturar Taxas do Mês
                  </button>
                  <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setActiveTab('inadimplencia')}>
                    ⚠️ Verificar Devedores
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. UNIDADES */}
        {activeTab === 'unidades' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 15, margin: 0 }}>Cadastro de Unidades / Condôminos</h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mapeamento de apartamentos, frações ideais e moradores</span>
              </div>
              <button className="btn btn-primary" onClick={handleOpenNewUni}>＋ Cadastrar Unidade</button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Unidade</th>
                    <th>Proprietário / Morador</th>
                    <th>Fração Ideal</th>
                    <th>Contato E-mail</th>
                    <th>Telefone</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {unidades.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          <div className="empty-state-icon">🚪</div>
                          <h3>Nenhuma unidade cadastrada</h3>
                          <p>Cadastre as unidades para faturar as mensalidades ordinárias.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    unidades.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 700 }}>{u.identificacao}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{u.proprietario}</div>
                          {u.moradorNome && u.moradorNome !== u.proprietario && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                              👤 Morador: {u.moradorNome}
                            </div>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>{(u.fracaoIdeal * 100).toFixed(2)}%</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          <div>Prop: {u.email || '-'}</div>
                          {u.moradorEmail && u.moradorEmail !== u.email && (
                            <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>Mor: {u.moradorEmail}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          <div>Prop: {u.telefone || '-'}</div>
                          {u.moradorTelefone && u.moradorTelefone !== u.telefone && (
                            <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>Mor: {u.moradorTelefone}</div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleOpenEditUni(u)}>✏️</button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteUnidade(u.id)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. GERAR TAXAS */}
        {activeTab === 'taxas' && (
          <div className="grid-12">
            <div className="card" style={{ gridColumn: 'span 5' }}>
              <h3 style={{ fontSize: 15, marginBottom: 16 }}>💰 Gerar Boletos de Taxas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Mês da Competência *</label>
                  <input type="month" className="form-control" value={mesCobranca} onChange={e => setMesCobranca(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Modelo de Rateio</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      className={`btn ${tipoRateio === 'fixo' ? 'btn-primary' : 'btn-secondary'}`} 
                      style={{ flex: 1, fontSize: 12 }}
                      onClick={() => setTipoRateio('fixo')}
                    >
                      Valor Fixo Igual
                    </button>
                    <button 
                      className={`btn ${tipoRateio === 'fracao' ? 'btn-primary' : 'btn-secondary'}`} 
                      style={{ flex: 1, fontSize: 12 }}
                      onClick={() => setTipoRateio('fracao')}
                    >
                      Por Fração Ideal
                    </button>
                  </div>
                </div>

                {tipoRateio === 'fixo' ? (
                  <div className="form-group">
                    <label className="form-label">Valor Unitário Fixo (R$)</label>
                    <input type="number" className="form-control" value={valorFixo} onChange={e => setValorFixo(Number(e.target.value))} />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Orçamento Total Despesas do Mês (R$)</label>
                    <input type="number" className="form-control" value={orcamentoTotal} onChange={e => setOrcamentoTotal(Number(e.target.value))} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Este valor total será rateado proporcionalmente à fração de cada unidade.
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={fundoReservaCheck} onChange={e => setFundoReservaCheck(e.target.checked)} />
                    Cobrar provisão Fundo de Reserva ({condo.fundoReservaPct || 10}%) adicional
                  </label>
                </div>

                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={handleGerarTaxas}>
                  ⚡ Gerar Lançamentos de Cobrança
                </button>
              </div>
            </div>

            <div className="card" style={{ gridColumn: 'span 7' }}>
              <h3 style={{ fontSize: 15, marginBottom: 16 }}>📋 Prévia do Faturamento</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Unidade</th>
                      <th>Fração</th>
                      <th>Taxa Ordinária</th>
                      <th>Fundo Reserva</th>
                      <th style={{ textAlign: 'right' }}>Total Geral</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unidades.map(u => {
                      const ord = tipoRateio === 'fixo' ? valorFixo : (orcamentoTotal * u.fracaoIdeal);
                      const res = fundoReservaCheck ? (ord * ((condo.fundoReservaPct || 10) / 100)) : 0;
                      return (
                        <tr key={u.id}>
                          <td>{u.identificacao}</td>
                          <td>{(u.fracaoIdeal * 100).toFixed(1)}%</td>
                          <td>{fmt.currency(ord)}</td>
                          <td>{fmt.currency(res)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt.currency(ord + res)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: 'var(--bg-card2)', fontWeight: 800 }}>
                      <td colSpan={2}>Total Estimado:</td>
                      <td>
                        {fmt.currency(unidades.reduce((acc, u) => acc + (tipoRateio === 'fixo' ? valorFixo : (orcamentoTotal * u.fracaoIdeal)), 0))}
                      </td>
                      <td>
                        {fmt.currency(unidades.reduce((acc, u) => acc + (fundoReservaCheck ? ((tipoRateio === 'fixo' ? valorFixo : (orcamentoTotal * u.fracaoIdeal)) * ((condo.fundoReservaPct || 10) / 100)) : 0), 0))}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--primary)' }}>
                        {fmt.currency(unidades.reduce((acc, u) => {
                          const ord = tipoRateio === 'fixo' ? valorFixo : (orcamentoTotal * u.fracaoIdeal);
                          const res = fundoReservaCheck ? (ord * ((condo.fundoReservaPct || 10) / 100)) : 0;
                          return acc + ord + res;
                        }, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. PRESTACAO DE CONTAS */}
        {activeTab === 'prestacao' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 15, margin: 0 }}>Demonstrativo Mensal do Condomínio (Balancete)</h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Resumo de receitas arrecadadas e despesas líquidas liquidadas</span>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <input type="month" className="form-control" value={mesPrestacao} onChange={e => setMesPrestacao(e.target.value)} />
              </div>
            </div>

            <div className="table-wrap">
              <table className="table-compact">
                <thead>
                  <tr style={{ background: 'var(--bg-card2)' }}>
                    <th style={{ fontSize: 13, fontWeight: 700 }}>Histórico da Conta</th>
                    <th style={{ textAlign: 'right', fontSize: 13, fontWeight: 700 }}>Valores Recebidos / Pagos</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ fontWeight: 700 }}>
                    <td>RECEITAS CONDOMINIAIS</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: 24 }}>Taxas Condominiais Ordinárias</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt.currency(prestacaoData.taxasOrdinarias)}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: 24 }}>Fundo de Reserva (Aportes/Provisões)</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt.currency(prestacaoData.fundoReservaEntradas)}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: 24 }}>Taxas Extras / Obras</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt.currency(prestacaoData.taxasExtra)}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: 24 }}>Acréscimos (Multas/Juros de Atraso)</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt.currency(prestacaoData.multasJuros)}</td>
                  </tr>
                  <tr style={{ background: 'var(--bg-card)', fontWeight: 800 }}>
                    <td>(=) TOTAL DE RECEITAS</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt.currency(prestacaoData.totalRecebido)}</td>
                  </tr>

                  <tr style={{ height: 20 }}></tr>

                  <tr style={{ fontWeight: 700 }}>
                    <td>DESPESAS ORDINÁRIAS</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: 24 }}>Despesas com Pessoal / Zeladores / Portaria</td>
                    <td style={{ textAlign: 'right', color: 'var(--red)' }}>-{fmt.currency(prestacaoData.pessoal)}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: 24 }}>Despesas de Consumo (Água/Energia Comum)</td>
                    <td style={{ textAlign: 'right', color: 'var(--red)' }}>-{fmt.currency(prestacaoData.consumos)}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: 24 }}>Despesas de Manutenção (Elevadores/Portão/Limpeza)</td>
                    <td style={{ textAlign: 'right', color: 'var(--red)' }}>-{fmt.currency(prestacaoData.manutencao)}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: 24 }}>Outras Despesas Administrativas</td>
                    <td style={{ textAlign: 'right', color: 'var(--red)' }}>-{fmt.currency(prestacaoData.despesasAdm)}</td>
                  </tr>
                  <tr style={{ background: 'var(--bg-card)', fontWeight: 800 }}>
                    <td>(=) TOTAL DE DESPESAS</td>
                    <td style={{ textAlign: 'right', color: 'var(--red)' }}>-{fmt.currency(prestacaoData.totalPago)}</td>
                  </tr>

                  <tr style={{ height: 20 }}></tr>

                  <tr style={{ background: 'var(--border-light)', fontWeight: 900, fontSize: 13.5 }}>
                    <td>(=) SUPERÁVIT / SALDO FINANCEIRO LÍQUIDO DO MÊS</td>
                    <td style={{ textAlign: 'right', color: prestacaoData.saldoMes >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmt.currency(prestacaoData.saldoMes)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. INADIMPLENCIA */}
        {activeTab === 'inadimplencia' && (
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>⚠️ Relação de Unidades Devedoras (Em aberto)</h3>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 16 }}>
              Abaixo são listados os condôminos que possuem taxas ordinárias com status "Previsto" (não reconciliadas no banco).
            </span>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Unidade</th>
                    <th>Proprietário</th>
                    <th>Meses em Atraso</th>
                    <th>Total Acumulado</th>
                    <th>Contato Telefônico</th>
                    <th>Ações BPO / Cobrança</th>
                  </tr>
                </thead>
                <tbody>
                  {inadimplenciaLista.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          <div className="empty-state-icon">✓</div>
                          <h3>Excelente! Nenhuma inadimplência encontrada</h3>
                          <p>Todas as unidades estão com as taxas condominiais quitadas.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    inadimplenciaLista.map((item, idx) => {
                      const msg = encodeURIComponent(`Olá ${item.unidade.proprietario}, informamos que constam taxas condominiais pendentes para a unidade ${item.unidade.identificacao} referentes aos meses: ${item.parcelas.join(', ')}, totalizando ${fmt.currency(item.totalDevido)}. Favor entrar em contato para regularizarmos os débitos. Atenciosamente, Administradora Privilege.`);
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700, color: 'var(--red)' }}>{item.unidade.identificacao}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.unidade.proprietario}</div>
                            {item.unidade.moradorNome && item.unidade.moradorNome !== item.unidade.proprietario && (
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Morador: {item.unidade.moradorNome}</div>
                            )}
                          </td>
                          <td>
                            {item.parcelas.map(p => (
                              <span key={p} className="badge badge-gray" style={{ marginRight: 4, fontSize: 10 }}>{p}</span>
                            ))}
                          </td>
                          <td style={{ fontWeight: 800, color: 'var(--red)' }}>{fmt.currency(item.totalDevido)}</td>
                          <td style={{ fontSize: 11, lineHeight: '14px' }}>
                            <div>Prop: {item.unidade.telefone || '-'}</div>
                            {item.unidade.moradorTelefone && item.unidade.moradorTelefone !== item.unidade.telefone && (
                              <div style={{ marginTop: 2 }}>Mor: {item.unidade.moradorTelefone}</div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <a 
                                href={`https://api.whatsapp.com/send?phone=${item.unidade.telefone?.replace(/\D/g, '')}&text=${msg}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '4px 10px', justifyContent: 'center' }}
                              >
                                💬 Cobrar Proprietário
                              </a>
                              {item.unidade.moradorTelefone && item.unidade.moradorTelefone !== item.unidade.telefone && (
                                <a 
                                  href={`https://api.whatsapp.com/send?phone=${item.unidade.moradorTelefone?.replace(/\D/g, '')}&text=${encodeURIComponent(`Olá ${item.unidade.moradorNome}, informamos que constam taxas condominiais pendentes para a unidade ${item.unidade.identificacao} referentes aos meses: ${item.parcelas.join(', ')}, totalizando ${fmt.currency(item.totalDevido)}. Favor regularizar os débitos ou repassar ao proprietário. Atenciosamente, Administradora Privilege.`)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-ghost btn-sm"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '3px 8px', border: '1px solid var(--border)', justifyContent: 'center' }}
                                >
                                  💬 Cobrar Morador
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. CONTAS A PAGAR E RECEBER */}
        {activeTab === 'financeiro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Overview cards */}
            <div className="stat-grid">
              <div className="stat-card blue">
                <div className="stat-icon blue">💰</div>
                <div className="stat-label">A Receber (Pendente)</div>
                <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(finSummary.aReceberPendente)}</div>
              </div>
              <div className="stat-card red">
                <div className="stat-icon red">💸</div>
                <div className="stat-label">A Pagar (Pendente)</div>
                <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(finSummary.aPagarPendente)}</div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon green">✓</div>
                <div className="stat-label">Recebido no Mês</div>
                <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(finSummary.recebidoMes)}</div>
              </div>
              <div className="stat-card purple">
                <div className="stat-icon purple">🏦</div>
                <div className="stat-label">Pago no Mês</div>
                <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(finSummary.pagoMes)}</div>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="card card-sm">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="search-bar">
                    <span>🔍</span>
                    <input 
                      placeholder="Buscar descrição..." 
                      value={finSearch} 
                      onChange={e => setFinSearch(e.target.value)} 
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>Mês</label>
                    <input 
                      type="month" 
                      className="form-control" 
                      style={{ height: 38 }}
                      value={finMesFilter} 
                      onChange={e => setFinMesFilter(e.target.value)} 
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>Tipo</label>
                    <select className="form-control" style={{ height: 38 }} value={finTipoFilter} onChange={e => setFinTipoFilter(e.target.value as any)}>
                      <option value="">Todos os tipos</option>
                      <option value="receita">Receitas (A Receber)</option>
                      <option value="despesa">Despesas (A Pagar)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>Status</label>
                    <select className="form-control" style={{ height: 38 }} value={finStatusFilter} onChange={e => setFinStatusFilter(e.target.value as any)}>
                      <option value="">Todos os status</option>
                      <option value="previsto">Pendente</option>
                      <option value="realizado">Liquidado/Pago</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>Unidade</label>
                    <select className="form-control" style={{ height: 38 }} value={finUnidadeFilter} onChange={e => setFinUnidadeFilter(e.target.value)}>
                      <option value="">Todas as unidades</option>
                      {unidades.map(u => (
                        <option key={u.id} value={u.id}>{u.identificacao} - {u.proprietario}</option>
                      ))}
                    </select>
                  </div>
                  {(finTipoFilter || finStatusFilter || finMesFilter || finUnidadeFilter || finSearch) && (
                    <button className="btn btn-ghost btn-sm" style={{ height: 38 }} onClick={() => { setFinTipoFilter(''); setFinStatusFilter(''); setFinMesFilter(''); setFinUnidadeFilter(''); setFinSearch(''); }}>
                      ✕ Limpar
                    </button>
                  )}
                </div>
                
                <button className="btn btn-primary" onClick={handleOpenNewFin}>
                  ＋ Lançar Conta
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Vencimento</th>
                      <th>Descrição</th>
                      <th>Unidade</th>
                      <th>Plano de Contas</th>
                      <th>Portador</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFinLancamentos.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="empty-state">
                            <div className="empty-state-icon">📋</div>
                            <h3>Nenhum lançamento financeiro encontrado</h3>
                            <p>Adicione um lançamento manual ou utilize a aba "Gerar Taxas".</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredFinLancamentos.map(l => {
                        const pc = planoContas.find(p => p.id === l.planoContaId);
                        const port = store.getPortadores(condoId).find(p => p.id === l.portadorId);
                        const uni = unidades.find(u => u.id === l.unidadeId);
                        return (
                          <tr key={l.id}>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmt.date(l.data)}</td>
                            <td style={{ fontWeight: 600 }}>
                              <div>{l.descricao}</div>
                              {l.observacao && <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: 4 }}>{l.observacao}</div>}
                            </td>
                            <td>{uni ? <span className="badge badge-gray">{uni.identificacao}</span> : '-'}</td>
                            <td style={{ fontSize: 12 }}>{pc ? `${pc.codigo} - ${pc.descricao}` : '-'}</td>
                            <td style={{ fontSize: 12 }}>{port?.nome || '-'}</td>
                            <td>
                              <span className={`badge ${l.status === 'realizado' ? 'badge-green' : 'badge-yellow'}`}>
                                {l.status === 'realizado' ? 'Liquidado' : 'Pendente'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: l.tipo === 'receita' ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                              {l.tipo === 'receita' ? '+' : '-'}{fmt.currency(l.valor)}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {l.status === 'previsto' && (
                                  <>
                                    <button 
                                      className="btn btn-ghost btn-sm" 
                                      style={{ padding: '4px 8px', fontSize: 11, border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: 4 }} 
                                      onClick={() => handleQuickPayReceive(l)}
                                    >
                                      ✓ Liquidar
                                    </button>
                                    {l.tipo === 'receita' && (
                                      <button 
                                        className="btn btn-secondary btn-sm" 
                                        style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                        onClick={() => handleOpenBoleto(l)}
                                      >
                                        📄 Boleto
                                      </button>
                                    )}
                                  </>
                                )}
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleOpenEditFin(l)}>✏️</button>
                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteFinLanc(l.id)}>🗑️</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unidade Modal */}
      {showUniModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowUniModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editUni ? 'Editar Unidade' : 'Cadastrar Unidade'}</h2>
              <button className="modal-close" onClick={() => setShowUniModal(false)}>✕</button>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Identificação da Unidade *</label>
                <input 
                  className="form-control" 
                  placeholder="Ex: Apto 101, Casa 12" 
                  value={uniForm.identificacao || ''} 
                  onChange={e => setUniForm(f => ({ ...f, identificacao: e.target.value }))} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Fração Ideal (Proporção) *</label>
                <input 
                  type="number"
                  step="0.0001"
                  className="form-control" 
                  placeholder="Ex: 0.125" 
                  value={uniForm.fracaoIdeal || 0.1} 
                  onChange={e => setUniForm(f => ({ ...f, fracaoIdeal: Number(e.target.value) }))} 
                />
              </div>
            </div>

            <fieldset style={{ border: '1px solid var(--border-light)', borderRadius: 8, padding: '12px 16px', margin: '12px 0' }}>
              <legend style={{ fontSize: 11.5, fontWeight: 700, padding: '0 8px', color: 'var(--primary)' }}>Dados do Proprietário</legend>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nome do Proprietário *</label>
                  <input 
                    className="form-control" 
                    placeholder="Ex: Carlos Santos" 
                    value={uniForm.proprietario || ''} 
                    onChange={e => setUniForm(f => ({ ...f, proprietario: e.target.value }))} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">CPF do Proprietário</label>
                  <input 
                    className="form-control" 
                    placeholder="Ex: 111.111.111-11" 
                    value={uniForm.proprietarioCpf || ''} 
                    onChange={e => setUniForm(f => ({ ...f, proprietarioCpf: e.target.value }))} 
                  />
                </div>
              </div>

              <div className="form-row" style={{ marginTop: 10 }}>
                <div className="form-group">
                  <label className="form-label">E-mail de Contato</label>
                  <input 
                    type="email"
                    className="form-control" 
                    placeholder="Ex: carlos@email.com" 
                    value={uniForm.email || ''} 
                    onChange={e => setUniForm(f => ({ ...f, email: e.target.value }))} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone (Cobrança WhatsApp)</label>
                  <input 
                    className="form-control" 
                    placeholder="Ex: 54991112222" 
                    value={uniForm.telefone || ''} 
                    onChange={e => setUniForm(f => ({ ...f, telefone: e.target.value }))} 
                  />
                </div>
              </div>
            </fieldset>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0', fontSize: 13, userSelect: 'none', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                id="moradorMesmo" 
                checked={moradorMesmo} 
                onChange={e => setMoradorMesmo(e.target.checked)} 
                style={{ cursor: 'pointer', width: 16, height: 16 }}
              />
              <label htmlFor="moradorMesmo" style={{ cursor: 'pointer', fontWeight: 600 }}>Morador é o mesmo que o Proprietário</label>
            </div>

            {!moradorMesmo && (
              <fieldset style={{ border: '1px solid var(--border-light)', borderRadius: 8, padding: '12px 16px', margin: '12px 0' }}>
                <legend style={{ fontSize: 11.5, fontWeight: 700, padding: '0 8px', color: 'var(--primary)' }}>Dados do Morador</legend>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nome do Morador *</label>
                    <input 
                      className="form-control" 
                      placeholder="Ex: Pedro Alvares" 
                      value={uniForm.moradorNome || ''} 
                      onChange={e => setUniForm(f => ({ ...f, moradorNome: e.target.value }))} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CPF do Morador</label>
                    <input 
                      className="form-control" 
                      placeholder="Ex: 000.000.000-00" 
                      value={uniForm.moradorCpf || ''} 
                      onChange={e => setUniForm(f => ({ ...f, moradorCpf: e.target.value }))} 
                    />
                  </div>
                </div>

                <div className="form-row" style={{ marginTop: 10 }}>
                  <div className="form-group">
                    <label className="form-label">E-mail do Morador</label>
                    <input 
                      type="email"
                      className="form-control" 
                      placeholder="Ex: morador@email.com" 
                      value={uniForm.moradorEmail || ''} 
                      onChange={e => setUniForm(f => ({ ...f, moradorEmail: e.target.value }))} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telefone do Morador</label>
                    <input 
                      className="form-control" 
                      placeholder="Ex: 54991118888" 
                      value={uniForm.moradorTelefone || ''} 
                      onChange={e => setUniForm(f => ({ ...f, moradorTelefone: e.target.value }))} 
                    />
                  </div>
                </div>
              </fieldset>
            )}

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowUniModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveUnidade}>✓ Salvar Unidade</button>
            </div>
          </div>
        </div>
      )}

      {/* Financeiro Modal */}
      {showFinModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowFinModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editFinLanc ? 'Editar Conta' : 'Lançar Conta'}</h2>
              <button className="modal-close" onClick={() => setShowFinModal(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['receita', 'despesa'] as const).map(t => {
                const isSelected = finForm.tipoTransacao === t;
                let colorClass = 'btn-secondary';
                if (isSelected) {
                  if (t === 'receita') colorClass = 'btn-success';
                  else colorClass = 'btn-danger';
                }
                return (
                  <button
                    key={t}
                    className={`btn ${colorClass}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setFinForm(f => ({ ...f, tipoTransacao: t, tipo: t }))}
                  >
                    {t === 'receita' ? 'Receita (A Receber)' : 'Despesa (A Pagar)'}
                  </button>
                );
              })}
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Data de Vencimento *</label>
                <input type="date" className="form-control" value={finForm.data || ''} onChange={e => setFinForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor (R$) *</label>
                <input type="number" step="0.01" className="form-control" value={finForm.valor ?? ''} onChange={e => setFinForm(f => ({ ...f, valor: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Descrição *</label>
              <input className="form-control" placeholder="Ex: Manutenção de Portão, Taxa Convenção" value={finForm.descricao || ''} onChange={e => setFinForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Unidade Associada (Opcional)</label>
                <select className="form-control" value={finForm.unidadeId || ''} onChange={e => setFinForm(f => ({ ...f, unidadeId: e.target.value }))}>
                  <option value="">Nenhuma (Condomínio Geral)</option>
                  {unidades.map(u => <option key={u.id} value={u.id}>{u.identificacao} - {u.proprietario}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={finForm.status || 'previsto'} onChange={e => setFinForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="previsto">Pendente (Previsto)</option>
                  <option value="realizado">Liquidado (Realizado)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Categoria (Plano de Contas) *</label>
              <div className="search-bar" style={{ marginBottom: 8 }}>
                <input
                  placeholder="Filtrar categorias..."
                  className="form-control form-control-sm"
                  value={finPlanoContaSearch}
                  onChange={e => setFinPlanoContaSearch(e.target.value)}
                />
              </div>
              <select
                className="form-control"
                value={finForm.planoContaId || ''}
                onChange={e => setFinForm(f => ({ ...f, planoContaId: e.target.value }))}
                style={{ maxHeight: '120px' }}
                size={4}
              >
                <option value="">-- Selecione --</option>
                {planoContas
                  .filter(p => p.nivel === 3 && p.tipo === finForm.tipoTransacao && (!finPlanoContaSearch || p.descricao.toLowerCase().includes(finPlanoContaSearch.toLowerCase()) || p.codigo.includes(finPlanoContaSearch)))
                  .map(pc => (
                    <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.descricao}</option>
                  ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Portador *</label>
                <select className="form-control" value={finForm.portadorId || ''} onChange={e => setFinForm(f => ({ ...f, portadorId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {store.getPortadores(condoId).filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Observação / Histórico</label>
                <input className="form-control" placeholder="Dados adicionais..." value={finForm.observacao || ''} onChange={e => setFinForm(f => ({ ...f, observacao: e.target.value }))} />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowFinModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveFinLanc} disabled={finSaving}>{finSaving ? 'Salvando...' : 'Salvar Lançamento'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Boleto Modal */}
      {showBoletoModal && boletoLanc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBoletoModal(false)}>
          <div className="modal boleto-modal-container" style={{ maxWidth: 800, padding: 24, background: '#fff', color: '#000', fontFamily: 'Courier New, monospace', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body * {
                  visibility: hidden !important;
                }
                .boleto-modal-container, .boleto-modal-container * {
                  visibility: visible !important;
                }
                .boleto-modal-container {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            ` }} />

            {/* Header with Print action */}
            <div className="modal-header no-print" style={{ fontFamily: 'var(--font-sans)', borderBottom: '1px solid var(--border-light)', paddingBottom: 12, marginBottom: 20 }}>
              <h2 className="modal-title">Visualizar Boleto Bancário</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Imprimir / Salvar PDF</button>
                <button className="modal-close" onClick={() => setShowBoletoModal(false)}>✕</button>
              </div>
            </div>

            {/* Simulated Boleto layout sheet */}
            <div className="boleto-sheet" style={{ border: '2px solid #000', padding: 15, background: '#fff' }}>
              {/* Top Header */}
              <div style={{ display: 'flex', borderBottom: '2px solid #000', paddingBottom: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, marginRight: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 26 }}>🏦</span> <strong style={{ fontFamily: 'var(--font-sans)', letterSpacing: -1 }}>PRIVILEGE BANCO</strong>
                </div>
                <div style={{ borderLeft: '2px solid #000', borderRight: '2px solid #000', padding: '0 15px', fontSize: 18, fontWeight: 900 }}>
                  001-9
                </div>
                <div style={{ flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 900, fontFamily: 'monospace' }}>
                  00190.00009 01234.567894 00000.120002 8 980100000{Math.floor(boletoLanc.valor).toString().padStart(4, '0')}
                </div>
              </div>

              {/* Row 1 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 3, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Local de Pagamento</div>
                  <div style={{ fontSize: 10 }}>PAGÁVEL EM QUALQUER BANCO OU VIA PIX</div>
                </div>
                <div style={{ flex: 1, padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Vencimento</div>
                  <div style={{ fontSize: 11, fontWeight: 'bold', textAlign: 'right' }}>{fmt.date(boletoLanc.data)}</div>
                </div>
              </div>

              {/* Row 2 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 3, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Beneficiário</div>
                  <div style={{ fontSize: 10, fontWeight: 'bold' }}>{condo?.razaoSocial} — CNPJ: {condo?.cnpj}</div>
                </div>
                <div style={{ flex: 1, padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Agência / Código do Beneficiário</div>
                  <div style={{ fontSize: 10, textAlign: 'right' }}>1234-5 / 987654-3</div>
                </div>
              </div>

              {/* Row 3 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Data do Documento</div>
                  <div style={{ fontSize: 10 }}>{new Date(boletoLanc.createdAt || Date.now()).toISOString().split('T')[0]}</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Número do Documento</div>
                  <div style={{ fontSize: 10 }}>{boletoLanc.numeroDocumento || boletoLanc.id.slice(0, 8).toUpperCase()}</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Espécie Doc.</div>
                  <div style={{ fontSize: 10 }}>RC</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Aceite</div>
                  <div style={{ fontSize: 10 }}>N</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Data Processamento</div>
                  <div style={{ fontSize: 10 }}>{new Date(boletoLanc.createdAt || Date.now()).toISOString().split('T')[0]}</div>
                </div>
                <div style={{ flex: 1, padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Nosso Número</div>
                  <div style={{ fontSize: 10, textAlign: 'right' }}>09/12345678-9</div>
                </div>
              </div>

              {/* Row 4 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Uso do Banco</div>
                  <div style={{ fontSize: 10 }}></div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Carteira</div>
                  <div style={{ fontSize: 10 }}>09</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Espécie</div>
                  <div style={{ fontSize: 10 }}>R$</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Quantidade</div>
                  <div style={{ fontSize: 10 }}></div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Valor</div>
                  <div style={{ fontSize: 10 }}></div>
                </div>
                <div style={{ flex: 1, padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>(=) Valor do Documento</div>
                  <div style={{ fontSize: 11, fontWeight: 'bold', textAlign: 'right' }}>{fmt.currency(boletoLanc.valor)}</div>
                </div>
              </div>

              {/* Row 5 Instructions & Details */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 3, borderRight: '1px solid #000', padding: 6, minHeight: 120 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Instruções (Texto de responsabilidade do Beneficiário)</div>
                  <div style={{ fontSize: 10, marginTop: 5, lineHeight: '14px' }}>
                    • COBRANÇA REFERENTE A TAXA CONDOMINIAL DO MÊS DE COMPETÊNCIA DO CONDOMÍNIO.<br />
                    • APÓS O VENCIMENTO COBRAR MULTA DE 2,0% E JUROS DE 1,0% AO MÊS.<br />
                    • EM CASO DE DÚVIDAS ENTRAR EM CONTATO COM A ADMINISTRADORA PRIVILEGE.<br />
                    • NÃO RECEBER APÓS 30 DIAS DO VENCIMENTO SEM AUTORIZAÇÃO.<br />
                    <br />
                    <strong style={{ color: 'var(--primary)' }}>PAGAMENTO FACILITADO VIA PIX: ESCANEIE O QR CODE AO LADO.</strong>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ padding: 4, borderBottom: '1px solid #000' }}>
                    <div style={{ fontSize: 8, fontWeight: 'bold' }}>(-) Desconto / Abatimento</div>
                    <div style={{ fontSize: 10, textAlign: 'right' }}>-</div>
                  </div>
                  <div style={{ padding: 4, borderBottom: '1px solid #000' }}>
                    <div style={{ fontSize: 8, fontWeight: 'bold' }}>(-) Outras Deduções</div>
                    <div style={{ fontSize: 10, textAlign: 'right' }}>-</div>
                  </div>
                  <div style={{ padding: 4, borderBottom: '1px solid #000' }}>
                    <div style={{ fontSize: 8, fontWeight: 'bold' }}>(+) Mora / Multa</div>
                    <div style={{ fontSize: 10, textAlign: 'right' }}>-</div>
                  </div>
                  <div style={{ padding: 4 }}>
                    <div style={{ fontSize: 8, fontWeight: 'bold' }}>(=) Valor Cobrado</div>
                    <div style={{ fontSize: 10, textAlign: 'right' }}>-</div>
                  </div>
                </div>
              </div>

              {/* Row 6 Payer info */}
              <div style={{ padding: 6, borderBottom: '1px solid #000' }}>
                <div style={{ fontSize: 8, fontWeight: 'bold' }}>Pagador</div>
                {(() => {
                  const uni = unidades.find(u => u.id === boletoLanc.unidadeId);
                  return (
                    <div style={{ fontSize: 10, lineHeight: '14px' }}>
                      <strong>{uni ? uni.proprietario : 'Morador Geral'}</strong> — Unidade: {uni ? uni.identificacao : 'N/A'}<br />
                      E-mail: {uni?.email || 'N/A'} — Fone: {uni?.telefone || 'N/A'}<br />
                      {condo?.razaoSocial} — CEP: 95000-000 — RS
                    </div>
                  );
                })()}
              </div>

              {/* Barcode & Pix Code Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, padding: '0 10px' }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 5 }}>Ficha de Compensação (Código de Barras Bancário)</div>
                  {/* Simulated Barcode */}
                  <div style={{ display: 'flex', height: 45, width: 420, alignItems: 'stretch' }}>
                    {Array.from({ length: 55 }).map((_, idx) => {
                      const isWide = (idx * 7) % 3 === 0;
                      const isGap = (idx * 5) % 4 === 0;
                      return (
                        <div 
                          key={idx} 
                          style={{ 
                            width: isWide ? 4 : 1.5, 
                            background: isGap ? 'transparent' : '#000', 
                            marginRight: 1 
                          }} 
                        />
                      );
                    })}
                  </div>
                </div>

                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>PAGAR VIA PIX:</div>
                  {/* Pix QR Code simulation */}
                  <div style={{ width: 80, height: 80, border: '2px solid #000', padding: 3, display: 'flex', flexWrap: 'wrap', background: '#fff' }}>
                    {Array.from({ length: 64 }).map((_, idx) => {
                      const fill = (idx * 3) % 2 === 0 || idx < 8 || idx % 8 === 0 || (idx > 55 && idx % 2 === 0);
                      return (
                        <div 
                          key={idx} 
                          style={{ 
                            width: '12.5%', 
                            height: '12.5%', 
                            background: fill ? '#000' : 'transparent' 
                          }} 
                        />
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 7, fontWeight: 'bold', color: 'var(--green)' }}>PIX COBRANÇA</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
