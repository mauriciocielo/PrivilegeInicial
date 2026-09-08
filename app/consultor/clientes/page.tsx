'use client';
import { useState, useEffect, useMemo } from 'react';
import { store, type Cliente, type Lancamento, uid } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';

type Tab = 'lista' | 'historico';
type TipoFiltro = '' | 'cliente' | 'fornecedor' | 'ambos';

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function ClientesPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('');
  const [apenasAtivos, setApenasAtivos] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Cliente | null>(null);
  const [form, setForm] = useState<Partial<Cliente>>({});
  const [saving, setSaving] = useState(false);
  const [fetchingDoc, setFetchingDoc] = useState(false);
  const [tab, setTab] = useState<Tab>('lista');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);

  const load = (eId: string) => {
    if (!eId) return;
    setEmpresaId(eId);
    setClientes(store.getClientes(eId));
    setLancamentos(store.getLancamentos(eId));
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || '';
    if (saved) load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    const dataChangeHandler = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || '';
      if (current) load(current);
    };
    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataChangeHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataChangeHandler);
    };
  }, []);

  const filtered = useMemo(() => {
    return clientes.filter(c => {
      if (apenasAtivos && !c.ativo) return false;
      if (tipoFiltro && c.tipo !== tipoFiltro) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        c.nome.toLowerCase().includes(s) ||
        (c.nomeFantasia || '').toLowerCase().includes(s) ||
        c.cpfCnpj.replace(/\D/g, '').includes(s.replace(/\D/g, '')) ||
        (c.email || '').toLowerCase().includes(s) ||
        (c.cidade || '').toLowerCase().includes(s)
      );
    });
  }, [clientes, search, tipoFiltro, apenasAtivos]);

  // Busca dados por CNPJ na Receita Federal
  const fetchCnpj = async () => {
    const raw = (form.cpfCnpj || '').replace(/\D/g, '');
    if (raw.length !== 14) { toast.error('Informe um CNPJ válido (14 dígitos) para consultar.'); return; }
    setFetchingDoc(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
      if (!res.ok) throw new Error('CNPJ não encontrado ou serviço indisponível.');
      const d = await res.json();
      setForm(f => ({
        ...f,
        nome: (d.razao_social || d.nome || '').toUpperCase(),
        nomeFantasia: (d.nome_fantasia || d.fantasia || d.razao_social || '').toUpperCase(),
        email: d.email || f.email || '',
        telefone: d.ddd_telefone_1 || d.telefone || f.telefone || '',
        endereco: [d.logradouro, d.numero, d.complemento].filter(Boolean).join(', '),
        cidade: d.municipio || f.cidade || '',
        estado: d.uf || f.estado || '',
        cep: (d.cep || '').replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2'),
        cpfCnpj: raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'),
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao consultar CNPJ.');
    } finally { setFetchingDoc(false); }
  };

  const openNew = () => {
    setEditItem(null);
    setForm({ tipo: 'cliente', ativo: true, empresaId });
    setShowModal(true);
  };

  const openEdit = (c: Cliente) => {
    setEditItem(c);
    setForm({ ...c });
    setShowModal(true);
  };

  const openHistorico = (c: Cliente) => {
    setSelectedCliente(c);
    setTab('historico');
  };

  const handleSave = async () => {
    if (!form.nome || !form.cpfCnpj) { toast.error('Preencha Nome e CPF/CNPJ.'); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 250));
    const cliente: Cliente = {
      id: editItem?.id || uid(),
      empresaId,
      tipo: form.tipo || 'cliente',
      nome: form.nome!,
      nomeFantasia: form.nomeFantasia || '',
      cpfCnpj: form.cpfCnpj!,
      email: form.email || '',
      telefone: form.telefone || '',
      celular: form.celular || '',
      endereco: form.endereco || '',
      cidade: form.cidade || '',
      estado: form.estado || '',
      cep: form.cep || '',
      contato: form.contato || '',
      observacao: form.observacao || '',
      limiteCredito: Number(form.limiteCredito) || 0,
      ativo: form.ativo !== false,
      createdAt: editItem?.createdAt || new Date().toISOString(),
    };
    store.saveCliente(cliente);
    setClientes(store.getClientes(empresaId));
    setShowModal(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAsync('Excluir este cadastro? Os lançamentos vinculados não serão excluídos.'))) return;
    store.deleteCliente(id);
    setClientes(store.getClientes(empresaId));
    if (selectedCliente?.id === id) { setSelectedCliente(null); setTab('lista'); }
  };

  const toggleAtivo = (c: Cliente) => {
    store.saveCliente({ ...c, ativo: !c.ativo });
    setClientes(store.getClientes(empresaId));
    if (selectedCliente?.id === c.id) setSelectedCliente({ ...c, ativo: !c.ativo });
  };

  // Histórico financeiro do cliente selecionado
  const historicoLancs = useMemo(() => {
    if (!selectedCliente) return [];
    return lancamentos
      .filter(l => l.clienteId === selectedCliente.id)
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [lancamentos, selectedCliente]);

  const totalReceber = useMemo(() => historicoLancs.filter(l => l.tipo === 'receita' && l.status === 'previsto').reduce((a, l) => a + l.valor, 0), [historicoLancs]);
  const totalRecebido = useMemo(() => historicoLancs.filter(l => l.tipo === 'receita' && l.status === 'realizado').reduce((a, l) => a + l.valor, 0), [historicoLancs]);
  const totalPagar = useMemo(() => historicoLancs.filter(l => l.tipo === 'despesa' && l.status === 'previsto').reduce((a, l) => a + l.valor, 0), [historicoLancs]);
  const totalPago = useMemo(() => historicoLancs.filter(l => l.tipo === 'despesa' && l.status === 'realizado').reduce((a, l) => a + l.valor, 0), [historicoLancs]);

  const badgeTipo = (tipo: string) => {
    if (tipo === 'cliente') return <span className="badge badge-green">Cliente</span>;
    if (tipo === 'fornecedor') return <span className="badge badge-blue">Fornecedor</span>;
    return <span className="badge badge-purple">Ambos</span>;
  };

  const totalClientes = clientes.filter(c => c.ativo && (c.tipo === 'cliente' || c.tipo === 'ambos')).length;
  const totalFornecedores = clientes.filter(c => c.ativo && (c.tipo === 'fornecedor' || c.tipo === 'ambos')).length;

  if (!empresaId) return (
    <div className="page-body">
      <div className="empty-state">
        <div className="empty-state-icon">🏢</div>
        <h3>Selecione uma empresa</h3>
        <p>Use o seletor no menu lateral para escolher a empresa.</p>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">👥 Clientes & Fornecedores</div>
          <div className="page-subtitle">{filtered.length} cadastro(s) encontrado(s)</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNew}>＋ Novo Cadastro</button>
        </div>
      </div>

      <div className="page-body">

        {/* KPI Cards */}
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card green">
            <div className="stat-icon green">👤</div>
            <div className="stat-label">Clientes Ativos</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{totalClientes}</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-icon blue">🏭</div>
            <div className="stat-label">Fornecedores Ativos</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{totalFornecedores}</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple">#</div>
            <div className="stat-label">Total de Cadastros</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{clientes.length}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--accent)' }}>
            <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}>📊</div>
            <div className="stat-label">Inativos</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{clientes.filter(c => !c.ativo).length}</div>
          </div>
        </div>

        {/* Tabs */}
        {tab === 'historico' && selectedCliente && (
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setTab('lista'); setSelectedCliente(null); }}>
              ← Voltar à Lista
            </button>
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              📋 Histórico: {selectedCliente.nomeFantasia || selectedCliente.nome}
            </span>
            {badgeTipo(selectedCliente.tipo)}
          </div>
        )}

        {tab === 'historico' && selectedCliente ? (
          /* ---- HISTÓRICO FINANCEIRO ---- */
          <>
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card green">
                <div className="stat-icon green">💰</div>
                <div className="stat-label">A Receber (pendente)</div>
                <div className="stat-value" style={{ fontSize: 16, color: 'var(--green)' }}>{fmt.currency(totalReceber)}</div>
              </div>
              <div className="stat-card blue">
                <div className="stat-icon blue">✅</div>
                <div className="stat-label">Já Recebido</div>
                <div className="stat-value" style={{ fontSize: 16 }}>{fmt.currency(totalRecebido)}</div>
              </div>
              <div className="stat-card red">
                <div className="stat-icon red">💸</div>
                <div className="stat-label">A Pagar (pendente)</div>
                <div className="stat-value" style={{ fontSize: 16, color: 'var(--red)' }}>{fmt.currency(totalPagar)}</div>
              </div>
              <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
                <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>🏦</div>
                <div className="stat-label">Total Pago a Fornecedor</div>
                <div className="stat-value" style={{ fontSize: 16 }}>{fmt.currency(totalPago)}</div>
              </div>
            </div>

            {/* Dados do cadastro */}
            <div className="card card-sm" style={{ marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {[
                  { label: 'CPF/CNPJ', value: selectedCliente.cpfCnpj },
                  { label: 'E-mail', value: selectedCliente.email },
                  { label: 'Telefone', value: selectedCliente.telefone || selectedCliente.celular },
                  { label: 'Cidade / UF', value: [selectedCliente.cidade, selectedCliente.estado].filter(Boolean).join(' / ') },
                  { label: 'Contato', value: selectedCliente.contato },
                  { label: 'Limite de Crédito', value: selectedCliente.limiteCredito ? fmt.currency(selectedCliente.limiteCredito) : '—' },
                ].map(({ label, value }) => value ? (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>{value}</div>
                  </div>
                ) : null)}
              </div>
              {selectedCliente.observacao && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', borderLeft: '3px solid var(--accent)' }}>
                  💬 {selectedCliente.observacao}
                </div>
              )}
            </div>

            {/* Lançamentos vinculados */}
            <div className="card">
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 700, fontSize: 14 }}>
                Lançamentos Vinculados ({historicoLancs.length})
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Tipo</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoLancs.length === 0 ? (
                      <tr><td colSpan={5}>
                        <div className="empty-state" style={{ padding: 30 }}>
                          <div className="empty-state-icon">📭</div>
                          <h3>Nenhum lançamento vinculado</h3>
                          <p>Vincule este cadastro ao criar ou editar lançamentos em Contas a Pagar/Receber.</p>
                        </div>
                      </td></tr>
                    ) : historicoLancs.map(l => (
                      <tr key={l.id}>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{fmt.date(l.data)}</td>
                        <td style={{ fontWeight: 500 }}>{l.descricao}</td>
                        <td>{l.tipo === 'receita' ? <span className="badge badge-green">Receita</span> : <span className="badge badge-red">Despesa</span>}</td>
                        <td><span className={`badge ${l.status === 'realizado' ? 'badge-blue' : 'badge-yellow'}`}>{l.status === 'realizado' ? 'Realizado' : 'Previsto'}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: l.tipo === 'receita' ? 'var(--green)' : 'var(--red)' }}>
                          {l.tipo === 'receita' ? '+' : '-'}{fmt.currency(l.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* ---- LISTA DE CLIENTES/FORNECEDORES ---- */
          <>
            {/* Filtros */}
            <div className="card card-sm" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
                  <span>🔍</span>
                  <input
                    placeholder="Buscar por nome, CNPJ/CPF, e-mail, cidade..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <select className="form-control" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value as TipoFiltro)}>
                    <option value="">Todos os tipos</option>
                    <option value="cliente">Clientes</option>
                    <option value="fornecedor">Fornecedores</option>
                    <option value="ambos">Ambos</option>
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={apenasAtivos} onChange={e => setApenasAtivos(e.target.checked)} />
                  Apenas Ativos
                </label>
              </div>
            </div>

            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nome / Razão Social</th>
                      <th>CPF / CNPJ</th>
                      <th>Tipo</th>
                      <th>Cidade / UF</th>
                      <th>Contato</th>
                      <th>Limite de Crédito</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={8}>
                        <div className="empty-state">
                          <div className="empty-state-icon">👥</div>
                          <h3>Nenhum cadastro encontrado</h3>
                          <p>Clique em "＋ Novo Cadastro" para adicionar um cliente ou fornecedor.</p>
                        </div>
                      </td></tr>
                    ) : filtered.map(c => (
                      <tr key={c.id} style={{ opacity: c.ativo ? 1 : 0.55 }}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{c.nome}</div>
                          {c.nomeFantasia && c.nomeFantasia !== c.nome && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.nomeFantasia}</div>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.cpfCnpj}</td>
                        <td>{badgeTipo(c.tipo)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {[c.cidade, c.estado].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <div>{c.contato || '—'}</div>
                          {c.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>}
                        </td>
                        <td style={{ fontSize: 12, textAlign: 'right' }}>
                          {c.limiteCredito ? fmt.currency(c.limiteCredito) : '—'}
                        </td>
                        <td>
                          <span className={`badge ${c.ativo ? 'badge-green' : 'badge-gray'}`}>
                            {c.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              onClick={() => openHistorico(c)}
                              title="Ver histórico de lançamentos"
                            >
                              📋 Histórico
                            </button>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(c)} title="Editar">✏️</button>
                            <button
                              className="btn btn-ghost btn-sm btn-icon"
                              onClick={() => toggleAtivo(c)}
                              title={c.ativo ? 'Desativar' : 'Reativar'}
                            >
                              {c.ativo ? '🔕' : '✅'}
                            </button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id)} title="Excluir">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de Cadastro */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">{editItem ? 'Editar Cadastro' : 'Novo Cliente / Fornecedor'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {/* Tipo */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['cliente', 'fornecedor', 'ambos'] as const).map(t => (
                <button
                  key={t}
                  className={`btn ${form.tipo === t ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setForm(f => ({ ...f, tipo: t }))}
                >
                  {t === 'cliente' ? '👤 Cliente' : t === 'fornecedor' ? '🏭 Fornecedor' : '🔄 Ambos'}
                </button>
              ))}
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">CPF / CNPJ *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-control"
                    placeholder="Apenas números"
                    value={form.cpfCnpj || ''}
                    onChange={e => setForm(f => ({ ...f, cpfCnpj: e.target.value }))}
                  />
                  {!editItem && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '8px 12px', fontSize: 12, whiteSpace: 'nowrap' }}
                      onClick={fetchCnpj}
                      disabled={fetchingDoc}
                    >
                      {fetchingDoc ? '⏳' : '🔍 Buscar CNPJ'}
                    </button>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Situação</label>
                <select className="form-control" value={form.ativo ? 'ativo' : 'inativo'} onChange={e => setForm(f => ({ ...f, ativo: e.target.value === 'ativo' }))}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Razão Social / Nome *</label>
                <input className="form-control" value={form.nome || ''} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Nome Fantasia / Apelido</label>
                <input className="form-control" value={form.nomeFantasia || ''} onChange={e => setForm(f => ({ ...f, nomeFantasia: e.target.value }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input type="email" className="form-control" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-control" placeholder="(00) 0000-0000" value={form.telefone || ''} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Celular / WhatsApp</label>
                <input className="form-control" placeholder="(00) 00000-0000" value={form.celular || ''} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Endereço</label>
                <input className="form-control" placeholder="Rua, Número, Complemento" value={form.endereco || ''} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">CEP</label>
                <input className="form-control" placeholder="00000-000" value={form.cep || ''} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Cidade</label>
                <input className="form-control" value={form.cidade || ''} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">UF</label>
                <select className="form-control" value={form.estado || ''} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  <option value="">UF</option>
                  {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome do Contato / Responsável</label>
                <input className="form-control" placeholder="Ex: João da Silva" value={form.contato || ''} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Limite de Crédito (R$)</label>
                <input type="number" step="0.01" min="0" className="form-control" value={form.limiteCredito ?? ''} onChange={e => setForm(f => ({ ...f, limiteCredito: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Observações Internas</label>
              <textarea
                className="form-control"
                rows={3}
                style={{ resize: 'vertical' }}
                value={form.observacao || ''}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                placeholder="Condições comerciais, prazo de pagamento, notas diversas..."
              />
            </div>

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : '✓ Salvar Cadastro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
