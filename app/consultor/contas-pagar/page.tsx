'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { store, type Lancamento, type PlanoConta, type Portador, type Empresa, type Cliente, uid } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

type Filtros = { portadorId: string; search: string; mes: string; planoContaId: string; clienteId: string; vencimento: 'todos' | 'vencidos' | 'hoje' | 'proximos7' | 'proximos30' };

const parseMoney = (value: unknown): number => {
  if (typeof value === 'number') return Math.abs(value);
  const raw = String(value || '').trim();
  if (!raw) return 0;
  return Math.abs(Number(raw.replace(/[R$\s]/g, '').replace(/\(/g, '-').replace(/\)/g, '').replace(/\./g, '').replace(',', '.'))) || 0;
};

const today = () => new Date().toISOString().split('T')[0];
const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export default function ContasPagarPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtros, setFiltros] = useState<Filtros>({ portadorId: '', search: '', mes: '', planoContaId: '', clienteId: '', vencimento: 'todos' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Lancamento | null>(null);
  const [contaSearch, setContaSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Lancamento>>({});

  const load = useCallback((eId: string) => {
    if (!eId) return;
    setEmpresaId(eId);
    const all = store.getLancamentos(eId).filter(l => l.tipo === 'despesa');
    setLancamentos(all);
    setPlanoContas(store.getPlanoContas(eId).filter(p => p.nivel === 3 && p.ativo && p.tipo === 'despesa'));
    setPortadores(store.getPortadores(eId).filter(p => p.ativo));
    setClientes(store.getClientes(eId).filter(c => c.ativo && (c.tipo === 'fornecedor' || c.tipo === 'ambos')));
    setEmpresa(store.getEmpresas().find(e => e.id === eId) || null);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || '';
    if (saved) load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  const todayStr = today();

  const filtered = useMemo(() => {
    return lancamentos.filter(l => {
      if (filtros.portadorId && l.portadorId !== filtros.portadorId) return false;
      if (filtros.planoContaId && l.planoContaId !== filtros.planoContaId) return false;
      if (filtros.clienteId && l.clienteId !== filtros.clienteId) return false;
      if (filtros.search && !l.descricao.toLowerCase().includes(filtros.search.toLowerCase())) return false;
      if (filtros.mes && !l.data.startsWith(filtros.mes)) return false;
      if (filtros.vencimento !== 'todos') {
        if (filtros.vencimento === 'vencidos' && (l.status === 'realizado' || l.data >= todayStr)) return false;
        if (filtros.vencimento === 'hoje' && l.data !== todayStr) return false;
        if (filtros.vencimento === 'proximos7' && (l.data < todayStr || l.data > addDays(todayStr, 7))) return false;
        if (filtros.vencimento === 'proximos30' && (l.data < todayStr || l.data > addDays(todayStr, 30))) return false;
      }
      return true;
    }).sort((a, b) => a.data.localeCompare(b.data));
  }, [lancamentos, filtros, todayStr]);

  const pendentes = useMemo(() => filtered.filter(l => l.status === 'previsto'), [filtered]);
  const pagos = useMemo(() => filtered.filter(l => l.status === 'realizado'), [filtered]);
  const totalPendente = useMemo(() => pendentes.reduce((a, l) => a + l.valor, 0), [pendentes]);
  const totalPago = useMemo(() => pagos.reduce((a, l) => a + l.valor, 0), [pagos]);
  const vencidos = useMemo(() => pendentes.filter(l => l.data < todayStr), [pendentes, todayStr]);

  const meses = useMemo(() => {
    const list: string[] = [];
    const hoje = new Date();
    for (let i = -2; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
  }, []);

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(l => l.id));

  const marcarPago = (id: string) => {
    const all = store.getLancamentos();
    const idx = all.findIndex(l => l.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], status: 'realizado', data: all[idx].data };
      store.saveLancamento(all[idx]);
      load(empresaId);
    }
  };

  const marcarPendente = (id: string) => {
    const all = store.getLancamentos();
    const idx = all.findIndex(l => l.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], status: 'previsto' };
      store.saveLancamento(all[idx]);
      load(empresaId);
    }
  };

  const marcarPagoLote = () => {
    if (!confirm(`Marcar ${selectedIds.length} conta(s) como PAGAS?`)) return;
    selectedIds.forEach(id => {
      const all = store.getLancamentos();
      const idx = all.findIndex(l => l.id === id);
      if (idx >= 0) {
        store.saveLancamento({ ...all[idx], status: 'realizado' });
      }
    });
    setSelectedIds([]);
    load(empresaId);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este lançamento?')) return;
    store.deleteLancamento(id);
    load(empresaId);
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  const openNew = () => {
    setEditItem(null);
    setContaSearch('');
    setForm({
      tipo: 'despesa',
      status: 'previsto',
      origem: 'manual',
      data: todayStr,
      empresaId,
    });
    setShowModal(true);
  };

  const openEdit = (l: Lancamento) => {
    setEditItem(l);
    setContaSearch('');
    setForm({ ...l });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.descricao || !form.valor || !form.planoContaId || !form.portadorId || !form.data) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 250));
    const lanc: Lancamento = {
      id: editItem?.id || uid(),
      empresaId,
      data: form.data!,
      descricao: form.descricao!,
      valor: parseMoney(form.valor),
      tipo: 'despesa',
      planoContaId: form.planoContaId!,
      portadorId: form.portadorId!,
      status: (form.status || 'previsto') as 'previsto' | 'realizado',
      numeroDocumento: form.numeroDocumento,
      observacao: form.observacao,
      clienteId: form.clienteId || undefined,
      origem: 'manual',
      createdAt: editItem?.createdAt || new Date().toISOString(),
    };
    store.saveLancamento(lanc);
    load(empresaId);
    setShowModal(false);
    setSaving(false);
  };

  const modalPlanoContas = useMemo(() => planoContas.filter(p => {
    if (!contaSearch) return true;
    const term = contaSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return `${p.codigo} ${p.descricao}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(term);
  }), [planoContas, contaSearch]);

  const getVencStatus = (l: Lancamento) => {
    if (l.status === 'realizado') return { label: 'Pago', cls: 'badge-blue' };
    if (l.data < todayStr) return { label: 'Vencido', cls: 'badge-red' };
    if (l.data === todayStr) return { label: 'Vence Hoje', cls: 'badge-yellow' };
    return { label: 'A Vencer', cls: 'badge-gray' };
  };

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
          <div className="page-title">💸 Contas a Pagar</div>
          <div className="page-subtitle">{empresa?.nomeFantasia || empresa?.razaoSocial} — {pendentes.length} pendente(s)</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
          {selectedIds.length > 0 && (
            <>
              <button className="btn btn-primary" onClick={marcarPagoLote}>
                ✅ Pagar {selectedIds.length} Selecionado(s)
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => {
                if (!confirm(`Excluir ${selectedIds.length} lançamento(s)?`)) return;
                selectedIds.forEach(id => store.deleteLancamento(id));
                setSelectedIds([]);
                load(empresaId);
              }}>
                🗑️ Excluir ({selectedIds.length})
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={openNew}>＋ Nova Conta a Pagar</button>
        </div>
      </div>

      <div className="page-body">
        {/* KPI Cards */}
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card red">
            <div className="stat-icon red">⏳</div>
            <div className="stat-label">Total Pendente</div>
            <div className="stat-value" style={{ fontSize: 18, color: 'var(--red)' }}>{fmt.currency(totalPendente)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{pendentes.length} conta(s)</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
            <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>⚠️</div>
            <div className="stat-label">Vencidas</div>
            <div className="stat-value" style={{ fontSize: 18, color: '#f59e0b' }}>{fmt.currency(vencidos.reduce((a, l) => a + l.valor, 0))}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{vencidos.length} conta(s)</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-icon blue">✅</div>
            <div className="stat-label">Total Pago (filtro)</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(totalPago)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{pagos.length} conta(s)</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple">📊</div>
            <div className="stat-label">Total Geral (filtro)</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(totalPendente + totalPago)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{filtered.length} conta(s)</div>
          </div>
        </div>

        {/* Quick Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([
            { key: 'todos', label: '📋 Todos' },
            { key: 'vencidos', label: '🔴 Vencidos' },
            { key: 'hoje', label: '🟡 Vence Hoje' },
            { key: 'proximos7', label: '📅 Próx. 7 dias' },
            { key: 'proximos30', label: '📆 Próx. 30 dias' },
          ] as const).map(f => (
            <button
              key={f.key}
              className={`btn ${filtros.vencimento === f.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12.5 }}
              onClick={() => setFiltros(x => ({ ...x, vencimento: f.key }))}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="card card-sm" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="search-bar">
              <span>🔍</span>
              <input placeholder="Buscar descrição..." value={filtros.search} onChange={e => setFiltros(f => ({ ...f, search: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <select className="form-control" value={filtros.mes} onChange={e => setFiltros(f => ({ ...f, mes: e.target.value }))}>
                <option value="">Todos os meses</option>
                {meses.map(m => {
                  const [y, mo] = m.split('-');
                  const d = new Date(Number(y), Number(mo) - 1, 1);
                  return <option key={m} value={m}>{d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</option>;
                })}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <select className="form-control" value={filtros.portadorId} onChange={e => setFiltros(f => ({ ...f, portadorId: e.target.value }))}>
                <option value="">Todos os portadores</option>
                {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <select className="form-control" value={filtros.planoContaId} onChange={e => setFiltros(f => ({ ...f, planoContaId: e.target.value }))}>
                <option value="">Todas as categorias</option>
                {planoContas.map(pc => <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.descricao}</option>)}
              </select>
            </div>
            {clientes.length > 0 && (
              <div className="form-group" style={{ margin: 0 }}>
                <select className="form-control" value={filtros.clienteId} onChange={e => setFiltros(f => ({ ...f, clienteId: e.target.value }))}>
                  <option value="">Todos os fornecedores</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia || c.nome}</option>)}
                </select>
              </div>
            )}
            {(filtros.portadorId || filtros.search || filtros.mes || filtros.planoContaId || filtros.clienteId || filtros.vencimento !== 'todos') && (
              <button className="btn btn-ghost btn-sm" onClick={() => setFiltros({ portadorId: '', search: '', mes: '', planoContaId: '', clienteId: '', vencimento: 'todos' })}>
                ✕ Limpar
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input type="checkbox" checked={filtered.length > 0 && selectedIds.length === filtered.length} onChange={toggleSelectAll} />
                  </th>
                  <th>Vencimento</th>
                  <th>Descrição / Fornecedor</th>
                  <th>Categoria</th>
                  <th>Portador</th>
                  <th>Nº Doc.</th>
                  <th>Situação</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">💸</div>
                      <h3>Nenhuma conta a pagar encontrada</h3>
                      <p>Ajuste os filtros ou cadastre uma nova conta.</p>
                    </div>
                  </td></tr>
                ) : filtered.map(l => {
                  const pc = planoContas.find(p => p.id === l.planoContaId);
                  const port = portadores.find(p => p.id === l.portadorId);
                  const { label, cls } = getVencStatus(l);
                  const isVencido = l.status === 'previsto' && l.data < todayStr;
                  return (
                    <tr key={l.id} style={{ background: selectedIds.includes(l.id) ? 'var(--bg-card2)' : undefined, opacity: l.status === 'realizado' ? 0.75 : 1 }}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedIds.includes(l.id)} onChange={() => toggleSelect(l.id)} />
                      </td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: isVencido ? 'var(--red)' : 'var(--text-secondary)', fontWeight: isVencido ? 700 : 400 }}>
                        {fmt.date(l.data)}
                      </td>
                      <td style={{ fontWeight: 500, maxWidth: 220 }}>
                        <div>{l.descricao}</div>
                        {l.clienteId && (() => { const c = clientes.find(x => x.id === l.clienteId); return c ? <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>🏭 {c.nomeFantasia || c.nome}</div> : null; })()}
                        {l.observacao && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{l.observacao}</div>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pc ? `${pc.codigo} - ${pc.descricao}` : '-'}</td>
                      <td style={{ fontSize: 12 }}>{port?.nome || '-'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.numeroDocumento || '-'}</td>
                      <td><span className={`badge ${cls}`}>{label}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--red)', whiteSpace: 'nowrap' }}>
                        -{fmt.currency(l.valor)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {l.status === 'previsto' ? (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              onClick={() => marcarPago(l.id)}
                              title="Marcar como pago"
                            >
                              ✅ Pagar
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              onClick={() => marcarPendente(l.id)}
                              title="Desfazer pagamento"
                            >
                              ↩ Desfazer
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(l)} title="Editar">✏️</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(l.id)} title="Excluir">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--bg-card2)' }}>
                    <td colSpan={7} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', paddingLeft: 12 }}>
                      {filtered.length} registro(s) | {pendentes.length} pendente(s) | {pagos.length} pago(s)
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>
                      -{fmt.currency(totalPendente + totalPago)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editItem ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Vencimento *</label>
                <input type="date" className="form-control" value={form.data || ''} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor *</label>
                <input type="number" step="0.01" min="0" className="form-control" value={form.valor ?? ''} onChange={e => setForm(f => ({ ...f, valor: e.target.value as any }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Descrição / Referência *</label>
              <input className="form-control" value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Fornecedor (Cadastrado)</label>
              <select className="form-control" value={form.clienteId || ''} onChange={e => setForm(f => ({ ...f, clienteId: e.target.value || undefined }))}>
                <option value="">— Sem vínculo com cadastro —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia || c.nome} ({c.cpfCnpj})</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Vincule ao fornecedor cadastrado para rastrear o histórico financeiro.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Categoria (Plano de Contas) *</label>
              <div className="search-bar" style={{ marginBottom: 8 }}>
                <input placeholder="Filtrar categorias..." className="form-control form-control-sm" value={contaSearch} onChange={e => setContaSearch(e.target.value)} />
              </div>
              <select className="form-control" value={form.planoContaId || ''} onChange={e => setForm(f => ({ ...f, planoContaId: e.target.value }))} size={4} style={{ maxHeight: 120 }}>
                <option value="">-- Selecione --</option>
                {modalPlanoContas.map(pc => <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.descricao}</option>)}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Portador / Conta *</label>
                <select className="form-control" value={form.portadorId || ''} onChange={e => setForm(f => ({ ...f, portadorId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={form.status || 'previsto'} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'previsto' | 'realizado' }))}>
                  <option value="previsto">Pendente (A Pagar)</option>
                  <option value="realizado">Pago</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nº Documento / NF</label>
                <input className="form-control" placeholder="Ex: NF-001234" value={form.numeroDocumento || ''} onChange={e => setForm(f => ({ ...f, numeroDocumento: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Observação</label>
                <input className="form-control" value={form.observacao || ''} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : '✓ Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
