'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Layers,
  Plus,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Edit3,
  DollarSign,
  Users,
  Building2,
  Receipt,
  Zap,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import SaasEscritoriosNfseTab from '../../../components/SaasEscritoriosNfseTab';

const ALL_MODULES = [
  { id: 'administrativo', label: 'Administrativo' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'pessoas', label: 'Pessoas' },
];

const PLANS = ['Starter', 'Pro 360º', 'Enterprise', 'BPO Completo', 'Somente WhatsApp', 'Personalizado'];

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

export default function SaasBackofficePage() {
  const [activeTab, setActiveTab] = useState<'cadastros' | 'movimentacoes' | 'contadores'>('cadastros');
  const [tenants, setTenants] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [availableEmpresas, setAvailableEmpresas] = useState<any[]>([]);
  const [platformStats, setPlatformStats] = useState({
    empresasCount: 0,
    usersCount: 0,
    whatsappConnectedCount: 0,
    quizzesCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTenant, setSearchTenant] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [movTypeFilter, setMovTypeFilter] = useState('todos');
  const [movStatusFilter, setMovStatusFilter] = useState('todos');

  // Modal Cadastro SaaS
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [tenantForm, setTenantForm] = useState<any>({
    id: '',
    empresa_id: '',
    company_name: '',
    cnpj: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    plan_name: 'Pro 360º',
    monthly_value: 990,
    billing_day: 10,
    status: 'ativa',
    modules: ['administrativo', 'financeiro', 'comercial', 'marketing', 'pessoas'],
    notes: '',
  });
  const [savingTenant, setSavingTenant] = useState(false);
  const [buscandoCnpjTenant, setBuscandoCnpjTenant] = useState(false);

  async function buscarCnpjReceitaTenant(cnpjRaw: string) {
    const dig = String(cnpjRaw || '').replace(/\D/g, '');
    if (dig.length !== 14) {
      toast.error('Informe os 14 dígitos do CNPJ para consultar na Receita Federal.');
      return;
    }
    setBuscandoCnpjTenant(true);
    try {
      const res = await fetch(`/api/nfse/dados-publicos?cnpj=${dig}`);
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(dados.error || 'CNPJ não encontrado na Receita Federal.');
        return;
      }
      const cnpjFmt = dig.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
      setTenantForm((f: any) => ({
        ...f,
        cnpj: cnpjFmt,
        company_name: dados.razaoSocial || dados.nomeFantasia || f.company_name,
        contact_name: dados.responsavel || f.contact_name,
        contact_email: dados.email || f.contact_email,
        contact_phone: dados.telefone || f.contact_phone,
      }));
      toast.success('Dados preenchidos automaticamente pela Receita Federal!');
    } catch {
      toast.error('Erro de conexão ao consultar a Receita Federal.');
    } finally {
      setBuscandoCnpjTenant(false);
    }
  }

  // Modal Movimentação SaaS
  const [showMovModal, setShowMovModal] = useState(false);
  const [movForm, setMovForm] = useState<any>({
    id: '',
    tenant_id: '',
    tenant_name: '',
    movement_type: 'mensalidade',
    amount: 0,
    status: 'pendente',
    reference_month: new Date().toISOString().slice(0, 7),
    due_date: new Date().toISOString().slice(0, 10),
    payment_method: 'Pix',
    description: '',
  });
  const [savingMov, setSavingMov] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/saas', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setTenants(data.tenants || []);
        setMovements(data.movements || []);
        setPlatformStats(data.platformStats || { empresasCount: 0, usersCount: 0, whatsappConnectedCount: 0, quizzesCount: 0 });
        setAvailableEmpresas(data.availableEmpresas || []);
      } else {
        toast.error(data.error || 'Erro ao carregar dados SaaS');
      }
    } catch {
      toast.error('Falha ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const kpis = useMemo(() => {
    const activeTenants = tenants.filter(t => t.status === 'ativa');
    const trialTenants = tenants.filter(t => t.status === 'trial');
    const mrr = activeTenants.reduce((acc, t) => acc + Number(t.monthly_value || 0), 0);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthPaid = movements
      .filter(m => m.status === 'pago' && (m.reference_month === currentMonth || String(m.paid_at || '').startsWith(currentMonth)))
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);
    const totalPending = movements
      .filter(m => m.status === 'pendente' || m.status === 'atrasado')
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);

    return {
      mrr,
      arr: mrr * 12,
      activeCount: activeTenants.length,
      trialCount: trialTenants.length,
      monthPaid,
      totalPending,
    };
  }, [tenants, movements]);

  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      if (statusFilter !== 'todos' && t.status !== statusFilter) return false;
      if (searchTenant.trim()) {
        const q = searchTenant.toLowerCase();
        return (
          String(t.company_name || '').toLowerCase().includes(q) ||
          String(t.cnpj || '').toLowerCase().includes(q) ||
          String(t.contact_name || '').toLowerCase().includes(q) ||
          String(t.plan_name || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tenants, statusFilter, searchTenant]);

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      if (movTypeFilter !== 'todos' && m.movement_type !== movTypeFilter) return false;
      if (movStatusFilter !== 'todos' && m.status !== movStatusFilter) return false;
      return true;
    });
  }, [movements, movTypeFilter, movStatusFilter]);

  function openNewTenant() {
    setTenantForm({
      id: '',
      empresa_id: '',
      company_name: '',
      cnpj: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      plan_name: 'Pro 360º',
      monthly_value: 990,
      billing_day: 10,
      status: 'ativa',
      modules: ['administrativo', 'financeiro', 'comercial', 'marketing', 'pessoas'],
      notes: '',
    });
    setShowTenantModal(true);
  }

  function openEditTenant(t: any) {
    setTenantForm({
      ...t,
      modules: Array.isArray(t.modules) ? t.modules : ['administrativo', 'financeiro', 'comercial', 'marketing', 'pessoas'],
    });
    setShowTenantModal(true);
  }

  async function handleSaveTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantForm.company_name.trim() || savingTenant) return;
    setSavingTenant(true);
    try {
      const res = await fetch('/api/saas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_tenant', ...tenantForm }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Cadastro SaaS salvo com sucesso!');
        setShowTenantModal(false);
        await loadData();
      } else {
        toast.error(data.error || 'Erro ao salvar cadastro');
      }
    } finally {
      setSavingTenant(false);
    }
  }

  async function handleDeleteTenant(id: string) {
    if (!confirm('Deseja remover este assinante SaaS?')) return;
    await fetch('/api/saas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_tenant', id }),
    });
    toast.success('Assinante removido.');
    loadData();
  }

  async function handleSyncEmpresas() {
    const res = await fetch('/api/saas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_empresas' }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(`${data.added || 0} empresa(s) importada(s) para a carteira SaaS!`);
      loadData();
    }
  }

  function openNewMovement(preselectedTenant?: any) {
    const first = preselectedTenant || tenants[0];
    setMovForm({
      id: '',
      tenant_id: first?.id || '',
      tenant_name: first?.company_name || '',
      movement_type: 'mensalidade',
      amount: Number(first?.monthly_value || 0),
      status: 'pendente',
      reference_month: new Date().toISOString().slice(0, 7),
      due_date: new Date().toISOString().slice(0, 10),
      payment_method: 'Pix',
      description: first ? `Mensalidade — ${first.plan_name}` : '',
    });
    setShowMovModal(true);
  }

  async function handleSaveMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!movForm.tenant_id || savingMov) return;
    setSavingMov(true);
    try {
      const res = await fetch('/api/saas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_movement', ...movForm }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Movimentação registrada!');
        setShowMovModal(false);
        await loadData();
      } else {
        toast.error(data.error || 'Erro ao registrar movimentação');
      }
    } finally {
      setSavingMov(false);
    }
  }

  async function handleMarkPaid(m: any) {
    await fetch('/api/saas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_movement',
        ...m,
        status: 'pago',
        paid_at: new Date().toISOString(),
      }),
    });
    toast.success(`Pagamento de ${m.tenant_name} baixado!`);
    loadData();
  }

  async function handleDeleteMovement(id: string) {
    if (!confirm('Deseja excluir esta movimentação?')) return;
    await fetch('/api/saas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_movement', id }),
    });
    loadData();
  }

  async function handleGenerateBilling() {
    const refMonth = new Date().toISOString().slice(0, 7);
    const res = await fetch('/api/saas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_monthly_billing', reference_month: refMonth }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(`${data.created || 0} mensalidade(s) gerada(s) para ${refMonth}!`);
      loadData();
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={26} color="var(--accent)" />
            Gestão SaaS — Cadastros &amp; Movimentações
          </div>
          <div className="page-subtitle">
            Controle central dos assinantes, planos, módulos liberados, mensalidades e movimentações financeiras da plataforma.
          </div>
        </div>
        <div className="header-actions">
          <button type="button" onClick={loadData} className="btn btn-secondary">
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>
      <div className="page-body">

      {/* KPIs do SaaS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>MRR (Receita Mensal)</span>
            <DollarSign size={15} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6, color: 'var(--accent)' }}>{fmtBRL(kpis.mrr)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>ARR projetado: {fmtBRL(kpis.arr)}</div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Recebido no Mês</span>
            <CheckCircle2 size={15} color="#16a34a" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6, color: '#16a34a' }}>{fmtBRL(kpis.monthPaid)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>A receber: {fmtBRL(kpis.totalPending)}</div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Carteira de Assinantes</span>
            <Building2 size={15} color="var(--gold)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{kpis.activeCount} ativos</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            {kpis.trialCount} em trial · {tenants.length} total
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Uso Real da Plataforma</span>
            <Users size={15} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8, lineHeight: 1.5 }}>
            {platformStats.empresasCount} empresas · {platformStats.usersCount} usuários
            <br />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
              {platformStats.whatsappConnectedCount} WhatsApp(s) online · {platformStats.quizzesCount} quizzes
            </span>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <button
          type="button"
          onClick={() => setActiveTab('cadastros')}
          className={activeTab === 'cadastros' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 13 }}
        >
          <Building2 size={15} /> Cadastros SaaS ({tenants.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('movimentacoes')}
          className={activeTab === 'movimentacoes' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 13 }}
        >
          <Receipt size={15} /> Movimentações SaaS ({movements.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('contadores')}
          className={activeTab === 'contadores' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 13 }}
        >
          <Users size={15} /> Contadores Terceiros (NFS-e)
        </button>
      </div>

      {activeTab === 'contadores' && <SaasEscritoriosNfseTab />}

      {/* ABA 1: CADASTROS SAAS */}
      {activeTab === 'cadastros' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 30, width: 250, fontSize: 12.5 }}
                  placeholder="Buscar empresa, CNPJ ou plano..."
                  value={searchTenant}
                  onChange={e => setSearchTenant(e.target.value)}
                />
              </div>
              <select
                className="form-control"
                style={{ width: 150, fontSize: 12.5 }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="todos">Todos status</option>
                <option value="ativa">Ativa</option>
                <option value="trial">Trial</option>
                <option value="pendente">Pendente</option>
                <option value="suspensa">Suspensa</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={handleSyncEmpresas} className="btn btn-secondary" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={14} /> Importar Empresas da Base
              </button>
              <button type="button" onClick={openNewTenant} className="btn btn-primary" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> Novo Cadastro SaaS
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>Empresa / Assinante</th>
                  <th style={{ padding: '10px 8px' }}>Plano</th>
                  <th style={{ padding: '10px 8px' }}>MRR</th>
                  <th style={{ padding: '10px 8px' }}>Venc.</th>
                  <th style={{ padding: '10px 8px' }}>Áreas Liberadas</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</td></tr>
                ) : filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhum assinante cadastrado ainda. Clique em <strong>Importar Empresas da Base</strong> ou <strong>Novo Cadastro SaaS</strong>.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 700 }}>{t.company_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {t.cnpj || 'Sem CNPJ'} {t.contact_name ? `· ${t.contact_name}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: 700 }}>{t.plan_name}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 800, color: 'var(--accent)' }}>{fmtBRL(t.monthly_value)}</td>
                      <td style={{ padding: '10px 8px' }}>Dia {t.billing_day}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(t.modules || []).map((m: string) => (
                            <span
                              key={m}
                              style={{
                                fontSize: 10.5,
                                padding: '2px 7px',
                                borderRadius: 999,
                                background: 'var(--bg-card2)',
                                border: '1px solid var(--border)',
                                textTransform: 'capitalize',
                              }}
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: 999,
                            textTransform: 'uppercase',
                            background:
                              t.status === 'ativa'
                                ? 'var(--green-bg)'
                                : t.status === 'trial'
                                ? 'var(--blue-bg)'
                                : t.status === 'cancelada'
                                ? 'var(--red-bg)'
                                : 'var(--yellow-bg)',
                            color:
                              t.status === 'ativa'
                                ? 'var(--green)'
                                : t.status === 'trial'
                                ? 'var(--blue)'
                                : t.status === 'cancelada'
                                ? 'var(--red)'
                                : 'var(--yellow)',
                          }}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => openNewMovement(t)}
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', fontSize: 11 }}
                            title="Lançar movimentação/cobrança"
                          >
                            <DollarSign size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditTenant(t)}
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px' }}
                            title="Editar cadastro"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTenant(t.id)}
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', color: '#dc2626' }}
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
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

      {/* ABA 2: MOVIMENTAÇÕES SAAS */}
      {activeTab === 'movimentacoes' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select
                className="form-control"
                style={{ width: 170, fontSize: 12.5 }}
                value={movTypeFilter}
                onChange={e => setMovTypeFilter(e.target.value)}
              >
                <option value="todos">Todos os tipos</option>
                <option value="mensalidade">Mensalidade</option>
                <option value="implantacao">Implantação</option>
                <option value="upgrade">Upgrade</option>
                <option value="downgrade">Downgrade</option>
                <option value="novo_cadastro">Novo Cadastro</option>
                <option value="cancelamento">Cancelamento</option>
                <option value="estorno">Estorno</option>
              </select>
              <select
                className="form-control"
                style={{ width: 150, fontSize: 12.5 }}
                value={movStatusFilter}
                onChange={e => setMovStatusFilter(e.target.value)}
              >
                <option value="todos">Todos status</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
                <option value="atrasado">Atrasado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={handleGenerateBilling} className="btn btn-secondary" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={14} /> Gerar Mensalidades do Mês
              </button>
              <button type="button" onClick={() => openNewMovement()} className="btn btn-primary" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> Nova Movimentação
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>Assinante</th>
                  <th style={{ padding: '10px 8px' }}>Tipo</th>
                  <th style={{ padding: '10px 8px' }}>Competência / Venc.</th>
                  <th style={{ padding: '10px 8px' }}>Forma</th>
                  <th style={{ padding: '10px 8px' }}>Valor</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhuma movimentação encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 700 }}>{m.tenant_name}</div>
                        {m.description && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.description}</div>}
                      </td>
                      <td style={{ padding: '10px 8px', textTransform: 'capitalize', fontWeight: 600 }}>
                        {String(m.movement_type || '').replace('_', ' ')}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {m.reference_month || '—'} {m.due_date ? `· ${m.due_date}` : ''}
                      </td>
                      <td style={{ padding: '10px 8px' }}>{m.payment_method || 'Pix'}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 800 }}>{fmtBRL(m.amount)}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: 999,
                            textTransform: 'uppercase',
                            background:
                              m.status === 'pago'
                                ? 'var(--green-bg)'
                                : m.status === 'cancelado' || m.status === 'atrasado'
                                ? 'var(--red-bg)'
                                : 'var(--yellow-bg)',
                            color:
                              m.status === 'pago'
                                ? 'var(--green)'
                                : m.status === 'cancelado' || m.status === 'atrasado'
                                ? 'var(--red)'
                                : 'var(--yellow)',
                          }}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {m.status !== 'pago' && m.status !== 'cancelado' && (
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(m)}
                              className="btn btn-secondary"
                              style={{ padding: '5px 9px', fontSize: 11, color: '#16a34a', fontWeight: 700 }}
                            >
                              ✓ Baixar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteMovement(m.id)}
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', color: '#dc2626' }}
                          >
                            <Trash2 size={13} />
                          </button>
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

      {/* MODAL CADASTRO / EDIÇÃO SAAS (Portal no document.body) */}
      {showTenantModal && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setShowTenantModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.58)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleSaveTenant}
            className="card"
            style={{ width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
              {tenantForm.id ? 'Editar Assinante SaaS' : 'Novo Cadastro SaaS'}
            </h2>

            {availableEmpresas.length > 0 && !tenantForm.id && (
              <div>
                <label className="form-label">Vincular Empresa já cadastrada (opcional)</label>
                <select
                  className="form-control"
                  value={tenantForm.empresa_id}
                  onChange={e => {
                    const emp = availableEmpresas.find(x => x.id === e.target.value);
                    if (emp) {
                      setTenantForm((f: any) => ({
                        ...f,
                        empresa_id: emp.id,
                        company_name: emp.nome,
                        cnpj: emp.cnpj,
                        contact_name: emp.responsavel,
                        contact_email: emp.email,
                        contact_phone: emp.telefone,
                      }));
                    } else {
                      setTenantForm((f: any) => ({ ...f, empresa_id: '' }));
                    }
                  }}
                >
                  <option value="">-- Digitar manualmente --</option>
                  {availableEmpresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nome} ({emp.cnpj})</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="form-label">CNPJ (busca automática na Receita)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="00.000.000/0001-00"
                    value={tenantForm.cnpj || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setTenantForm((f: any) => ({ ...f, cnpj: val }));
                      const dig = val.replace(/\D/g, '');
                      if (dig.length === 14 && !buscandoCnpjTenant) {
                        buscarCnpjReceitaTenant(dig);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={buscandoCnpjTenant}
                    onClick={() => buscarCnpjReceitaTenant(tenantForm.cnpj || '')}
                    style={{ whiteSpace: 'nowrap', fontSize: 12, padding: '0 10px' }}
                    title="Consultar dados na Receita Federal"
                  >
                    {buscandoCnpjTenant ? '...' : 'Buscar'}
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label">Nome da Empresa *</label>
                <input
                  type="text"
                  className="form-control"
                  value={tenantForm.company_name}
                  onChange={e => setTenantForm((f: any) => ({ ...f, company_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="form-label">Responsável</label>
                <input
                  type="text"
                  className="form-control"
                  value={tenantForm.contact_name || ''}
                  onChange={e => setTenantForm((f: any) => ({ ...f, contact_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Telefone / WhatsApp</label>
                <input
                  type="text"
                  className="form-control"
                  value={tenantForm.contact_phone || ''}
                  onChange={e => setTenantForm((f: any) => ({ ...f, contact_phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Plano</label>
                <select
                  className="form-control"
                  value={tenantForm.plan_name}
                  onChange={e => setTenantForm((f: any) => ({ ...f, plan_name: e.target.value }))}
                >
                  {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Valor Mensal (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={tenantForm.monthly_value}
                  onChange={e => setTenantForm((f: any) => ({ ...f, monthly_value: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="form-label">Dia de Vencimento</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  className="form-control"
                  value={tenantForm.billing_day}
                  onChange={e => setTenantForm((f: any) => ({ ...f, billing_day: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="form-label">Status da Assinatura</label>
                <select
                  className="form-control"
                  value={tenantForm.status}
                  onChange={e => setTenantForm((f: any) => ({ ...f, status: e.target.value }))}
                >
                  <option value="ativa">Ativa</option>
                  <option value="trial">Trial</option>
                  <option value="pendente">Pendente</option>
                  <option value="suspensa">Suspensa</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">Grandes Áreas Liberadas</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ALL_MODULES.map(mod => {
                  const checked = (tenantForm.modules || []).includes(mod.id);
                  return (
                    <label
                      key={mod.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                        background: checked ? 'var(--accent-glow)' : 'transparent',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setTenantForm((f: any) => ({
                            ...f,
                            modules: checked
                              ? (f.modules || []).filter((x: string) => x !== mod.id)
                              : [...(f.modules || []), mod.id],
                          }))
                        }
                      />
                      {mod.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button type="button" onClick={() => setShowTenantModal(false)} className="btn btn-secondary">Cancelar</button>
              <button type="submit" disabled={savingTenant} className="btn btn-primary">
                {savingTenant ? 'Salvando...' : 'Salvar Cadastro'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODAL MOVIMENTAÇÃO SAAS (Portal no document.body) */}
      {showMovModal && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setShowMovModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.58)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleSaveMovement}
            className="card"
            style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Nova Movimentação SaaS</h2>

            <div>
              <label className="form-label">Assinante</label>
              <select
                className="form-control"
                value={movForm.tenant_id}
                onChange={e => {
                  const t = tenants.find(x => x.id === e.target.value);
                  setMovForm((f: any) => ({
                    ...f,
                    tenant_id: e.target.value,
                    tenant_name: t?.company_name || '',
                    amount: t ? Number(t.monthly_value || 0) : f.amount,
                  }));
                }}
                required
              >
                <option value="">Selecione...</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.company_name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="form-label">Tipo</label>
                <select
                  className="form-control"
                  value={movForm.movement_type}
                  onChange={e => setMovForm((f: any) => ({ ...f, movement_type: e.target.value }))}
                >
                  <option value="mensalidade">Mensalidade</option>
                  <option value="implantacao">Implantação</option>
                  <option value="upgrade">Upgrade</option>
                  <option value="downgrade">Downgrade</option>
                  <option value="estorno">Estorno</option>
                </select>
              </div>
              <div>
                <label className="form-label">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={movForm.amount}
                  onChange={e => setMovForm((f: any) => ({ ...f, amount: Number(e.target.value) }))}
                  required
                />
              </div>
              <div>
                <label className="form-label">Competência (AAAA-MM)</label>
                <input
                  type="text"
                  className="form-control"
                  value={movForm.reference_month}
                  onChange={e => setMovForm((f: any) => ({ ...f, reference_month: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Vencimento</label>
                <input
                  type="date"
                  className="form-control"
                  value={movForm.due_date}
                  onChange={e => setMovForm((f: any) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Forma de Pagamento</label>
                <select
                  className="form-control"
                  value={movForm.payment_method}
                  onChange={e => setMovForm((f: any) => ({ ...f, payment_method: e.target.value }))}
                >
                  <option value="Pix">Pix</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Transferência">Transferência</option>
                </select>
              </div>
              <div>
                <label className="form-label">Status</label>
                <select
                  className="form-control"
                  value={movForm.status}
                  onChange={e => setMovForm((f: any) => ({ ...f, status: e.target.value }))}
                >
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="atrasado">Atrasado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">Descrição</label>
              <input
                type="text"
                className="form-control"
                value={movForm.description}
                onChange={e => setMovForm((f: any) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button type="button" onClick={() => setShowMovModal(false)} className="btn btn-secondary">Cancelar</button>
              <button type="submit" disabled={savingMov} className="btn btn-primary">
                {savingMov ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
      </div>
    </>
  );
}
