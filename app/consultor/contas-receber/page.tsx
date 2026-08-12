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

export default function ContasReceberPage() {
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

  // C6 Boleto modal state
  const [showC6BoletoModal, setShowC6BoletoModal] = useState(false);
  const [c6BoletoLanc, setC6BoletoLanc] = useState<Lancamento | null>(null);
  const [c6Sacado, setC6Sacado] = useState({ nome: '', cpfCnpj: '', endereco: '' });

  const load = useCallback((eId: string) => {
    if (!eId) return;
    setEmpresaId(eId);
    const all = store.getLancamentos(eId).filter(l => l.tipo === 'receita');
    setLancamentos(all);
    setPlanoContas(store.getPlanoContas(eId).filter(p => p.nivel === 3 && p.ativo && p.tipo === 'receita'));
    setPortadores(store.getPortadores(eId).filter(p => p.ativo));
    setClientes(store.getClientes(eId).filter(c => c.ativo && (c.tipo === 'cliente' || c.tipo === 'ambos')));
    setEmpresa(store.getEmpresas().find(e => e.id === eId) || null);
  }, []);

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
  const recebidos = useMemo(() => filtered.filter(l => l.status === 'realizado'), [filtered]);
  const totalPendente = useMemo(() => pendentes.reduce((a, l) => a + l.valor, 0), [pendentes]);
  const totalRecebido = useMemo(() => recebidos.reduce((a, l) => a + l.valor, 0), [recebidos]);
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

  const marcarRecebido = (id: string) => {
    const all = store.getLancamentos();
    const idx = all.findIndex(l => l.id === id);
    if (idx >= 0) {
      store.saveLancamento({ ...all[idx], status: 'realizado' });
      load(empresaId);
    }
  };

  const marcarPendente = (id: string) => {
    const all = store.getLancamentos();
    const idx = all.findIndex(l => l.id === id);
    if (idx >= 0) {
      store.saveLancamento({ ...all[idx], status: 'previsto' });
      load(empresaId);
    }
  };

  const marcarRecebidoLote = () => {
    if (!confirm(`Marcar ${selectedIds.length} conta(s) como RECEBIDAS?`)) return;
    selectedIds.forEach(id => {
      const all = store.getLancamentos();
      const idx = all.findIndex(l => l.id === id);
      if (idx >= 0) store.saveLancamento({ ...all[idx], status: 'realizado' });
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
    setForm({ tipo: 'receita', status: 'previsto', origem: 'manual', data: todayStr, empresaId });
    setShowModal(true);
  };

  const openEdit = (l: Lancamento) => {
    setEditItem(l);
    setContaSearch('');
    setForm({ ...l });
    setShowModal(true);
  };

  const openC6Boleto = (l: Lancamento) => {
    setC6BoletoLanc(l);
    // Auto-fill sacado from linked cliente
    const cli = l.clienteId ? clientes.find(c => c.id === l.clienteId) : null;
    setC6Sacado({
      nome: cli?.nome || '',
      cpfCnpj: cli?.cpfCnpj || '',
      endereco: [cli?.endereco, cli?.cidade, cli?.estado].filter(Boolean).join(', '),
    });
    setShowC6BoletoModal(true);
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
      tipo: 'receita',
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
    if (l.status === 'realizado') return { label: 'Recebido', cls: 'badge-blue' };
    if (l.data < todayStr) return { label: 'Vencido', cls: 'badge-red' };
    if (l.data === todayStr) return { label: 'Vence Hoje', cls: 'badge-yellow' };
    return { label: 'A Receber', cls: 'badge-green' };
  };

  const hasC6 = empresa?.bancoBoleto === 'c6';

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
          <div className="page-title">💰 Contas a Receber</div>
          <div className="page-subtitle">
            {empresa?.nomeFantasia || empresa?.razaoSocial} — {pendentes.length} pendente(s)
            {hasC6 && <span className="badge badge-gray" style={{ marginLeft: 8, background: '#000', color: '#fff', fontSize: 10 }}>🖤 C6 Bank</span>}
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
          {selectedIds.length > 0 && (
            <>
              <button className="btn btn-primary" onClick={marcarRecebidoLote}>
                ✅ Receber {selectedIds.length} Selecionado(s)
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
          <button className="btn btn-primary" onClick={openNew}>＋ Nova Conta a Receber</button>
        </div>
      </div>

      <div className="page-body">
        {/* KPI Cards */}
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card green">
            <div className="stat-icon green">⏳</div>
            <div className="stat-label">Total a Receber</div>
            <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>{fmt.currency(totalPendente)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{pendentes.length} conta(s)</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid #ef4444' }}>
            <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>⚠️</div>
            <div className="stat-label">Vencidas (Inadimplência)</div>
            <div className="stat-value" style={{ fontSize: 18, color: '#ef4444' }}>{fmt.currency(vencidos.reduce((a, l) => a + l.valor, 0))}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{vencidos.length} conta(s)</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-icon blue">✅</div>
            <div className="stat-label">Total Recebido (filtro)</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(totalRecebido)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{recebidos.length} conta(s)</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple">📊</div>
            <div className="stat-label">Total Geral (filtro)</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(totalPendente + totalRecebido)}</div>
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
              <input placeholder="Buscar descrição / cliente..." value={filtros.search} onChange={e => setFiltros(f => ({ ...f, search: e.target.value }))} />
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
                  <option value="">Todos os clientes</option>
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
                  <th>Descrição / Cliente</th>
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
                      <div className="empty-state-icon">💰</div>
                      <h3>Nenhuma conta a receber encontrada</h3>
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
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: isVencido ? '#ef4444' : 'var(--text-secondary)', fontWeight: isVencido ? 700 : 400 }}>
                        {fmt.date(l.data)}
                      </td>
                      <td style={{ fontWeight: 500, maxWidth: 220 }}>
                        <div>{l.descricao}</div>
                        {l.clienteId && (() => { const c = clientes.find(x => x.id === l.clienteId); return c ? <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2, fontWeight: 600 }}>👤 {c.nomeFantasia || c.nome}</div> : null; })()}
                        {l.observacao && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{l.observacao}</div>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pc ? `${pc.codigo} - ${pc.descricao}` : '-'}</td>
                      <td style={{ fontSize: 12 }}>{port?.nome || '-'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.numeroDocumento || '-'}</td>
                      <td><span className={`badge ${cls}`}>{label}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--green)', whiteSpace: 'nowrap' }}>
                        +{fmt.currency(l.valor)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {/* C6 Boleto button — only for pending receivables on C6-enabled companies */}
                          {l.status === 'previsto' && hasC6 && (
                            <button
                              className="btn btn-sm"
                              style={{ padding: '4px 8px', fontSize: 11, background: '#000', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              onClick={() => openC6Boleto(l)}
                              title="Emitir boleto via C6 Bank"
                            >
                              🖤 Boleto C6
                            </button>
                          )}
                          {l.status === 'previsto' && (() => {
                            const cli = l.clienteId ? clientes.find(c => c.id === l.clienteId) : null;
                            const tel = cli?.celular || cli?.telefone || '';
                            if (!tel) return null;
                            const cleanTel = tel.replace(/\D/g, '');
                            const msg = encodeURIComponent(
                              `Olá, ${cli?.nomeFantasia || cli?.nome}!\n\nRelembramos que a cobrança "${l.descricao}" no valor de R$ ${l.valor.toFixed(2)} vence em ${new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')}.\n\nPara efetuar o pagamento rápido, utilize o Pix copia e cola abaixo:\n\n00020101021226870014br.gov.bcb.pix2565api.c6bank.com.br/qr/v2/cobv/${l.id}\n\nQualquer dúvida, fale conosco.\nAtenciosamente,\n${empresa?.nomeFantasia || empresa?.razaoSocial}`
                            );
                            return (
                              <a
                                href={`https://wa.me/55${cleanTel}?text=${msg}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: 11, padding: '4px 8px', background: 'rgba(37, 211, 102, 0.08)', color: '#25D366', borderColor: 'rgba(37, 211, 102, 0.25)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                                title="Enviar cobrança via WhatsApp"
                              >
                                💬 Cobrar
                              </a>
                            );
                          })()}
                          {l.status === 'previsto' ? (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              onClick={() => marcarRecebido(l.id)}
                              title="Marcar como recebido"
                            >
                              ✅ Receber
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              onClick={() => marcarPendente(l.id)}
                              title="Desfazer recebimento"
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
                      {filtered.length} registro(s) | {pendentes.length} pendente(s) | {recebidos.length} recebido(s)
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>
                      +{fmt.currency(totalPendente + totalRecebido)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Modal Nova/Editar Conta */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editItem ? 'Editar Conta a Receber' : 'Nova Conta a Receber'}</h2>
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
              <label className="form-label">Cliente Vinculado</label>
              <select className="form-control" value={form.clienteId || ''} onChange={e => setForm(f => ({ ...f, clienteId: e.target.value || undefined }))}>
                <option value="">— Sem vínculo com cadastro —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia || c.nome} ({c.cpfCnpj})</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Vincule ao cliente para rastrear histórico e preencher o boleto automaticamente.</div>
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
                  <option value="previsto">Pendente (A Receber)</option>
                  <option value="realizado">Recebido</option>
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

      {/* C6 Bank Boleto Modal */}
      {showC6BoletoModal && c6BoletoLanc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowC6BoletoModal(false)}>
          <div className="modal c6-boleto-modal-container" style={{ maxWidth: 820, padding: 24, background: '#fff', color: '#000', fontFamily: 'Courier New, monospace', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body * { visibility: hidden !important; }
                .c6-boleto-modal-container, .c6-boleto-modal-container * { visibility: visible !important; }
                .c6-boleto-modal-container {
                  position: absolute !important; left: 0 !important; top: 0 !important;
                  width: 100% !important; margin: 0 !important; padding: 16px !important;
                  box-shadow: none !important; border: none !important;
                }
                .no-print { display: none !important; }
              }
            ` }} />

            {/* Header — no-print */}
            <div className="no-print" style={{ fontFamily: 'var(--font-sans)', borderBottom: '1px solid #e5e7eb', paddingBottom: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🖤 Emissão de Boleto — C6 Bank</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Preencha os dados do sacado antes de imprimir</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ background: '#000', borderColor: '#000', fontFamily: 'var(--font-sans)' }} onClick={() => window.print()}>🖨️ Imprimir / PDF</button>
                <button className="modal-close" onClick={() => setShowC6BoletoModal(false)}>✕</button>
              </div>
            </div>

            {/* Sacado form — no-print */}
            <div className="no-print" style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#374151' }}>📋 Dados do Pagador (Sacado)</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 2, minWidth: 200, margin: 0 }}>
                  <label className="form-label" style={{ fontFamily: 'var(--font-sans)' }}>Nome / Razão Social</label>
                  <input className="form-control" value={c6Sacado.nome} onChange={e => setC6Sacado(s => ({ ...s, nome: e.target.value }))} placeholder="Nome do cliente / devedor" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 160, margin: 0 }}>
                  <label className="form-label" style={{ fontFamily: 'var(--font-sans)' }}>CPF / CNPJ</label>
                  <input className="form-control" value={c6Sacado.cpfCnpj} onChange={e => setC6Sacado(s => ({ ...s, cpfCnpj: e.target.value }))} placeholder="000.000.000-00" />
                </div>
                <div className="form-group" style={{ flex: 2, minWidth: 200, margin: 0 }}>
                  <label className="form-label" style={{ fontFamily: 'var(--font-sans)' }}>Endereço</label>
                  <input className="form-control" value={c6Sacado.endereco} onChange={e => setC6Sacado(s => ({ ...s, endereco: e.target.value }))} placeholder="Rua, Nº — Cidade — UF" />
                </div>
              </div>
            </div>

            {/* Boleto Document */}
            <div className="boleto-sheet" style={{ border: '2px solid #000', padding: 14, background: '#fff' }}>
              {/* Bank header */}
              <div style={{ display: 'flex', borderBottom: '2px solid #000', paddingBottom: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, marginRight: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 22, background: '#000', color: '#fff', padding: '2px 10px', borderRadius: 4, fontFamily: 'sans-serif', fontWeight: 800, letterSpacing: -0.5 }}>C6</span>
                  <strong style={{ fontFamily: 'sans-serif', letterSpacing: -0.5 }}>C6 BANK</strong>
                </div>
                <div style={{ borderLeft: '2px solid #000', borderRight: '2px solid #000', padding: '0 15px', fontSize: 18, fontWeight: 900 }}>336-7</div>
                <div style={{ flex: 1, textAlign: 'right', fontSize: 12, fontWeight: 900, fontFamily: 'monospace' }}>
                  33690.{String(Math.floor(c6BoletoLanc.valor)).padStart(5,'0')} {c6BoletoLanc.id.slice(0,10).replace(/[^0-9]/g,'0')} 98765.432105 1 9801{String(Math.floor(c6BoletoLanc.valor*100)).padStart(12,'0')}
                </div>
              </div>

              {/* Row 1 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 3, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Local de Pagamento</div>
                  <div style={{ fontSize: 10 }}>PAGÁVEL EM QUALQUER AGÊNCIA BANCÁRIA, INTERNET BANKING OU VIA PIX C6 BANK</div>
                </div>
                <div style={{ flex: 1, padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Vencimento</div>
                  <div style={{ fontSize: 12, fontWeight: 'bold', textAlign: 'right' }}>{fmt.date(c6BoletoLanc.data)}</div>
                </div>
              </div>

              {/* Row 2 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 3, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Beneficiário</div>
                  <div style={{ fontSize: 10, fontWeight: 'bold' }}>{empresa?.razaoSocial} — CNPJ: {empresa?.cnpj}</div>
                </div>
                <div style={{ flex: 1, padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Agência / Cód. Beneficiário</div>
                  <div style={{ fontSize: 10, textAlign: 'right' }}>0001 / 951357-8</div>
                </div>
              </div>

              {/* Row 3 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Data do Documento</div>
                  <div style={{ fontSize: 10 }}>{fmt.date(c6BoletoLanc.createdAt?.split('T')[0] || todayStr)}</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Número do Documento</div>
                  <div style={{ fontSize: 10 }}>{c6BoletoLanc.numeroDocumento || c6BoletoLanc.id.slice(0, 8).toUpperCase()}</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Espécie Doc.</div>
                  <div style={{ fontSize: 10 }}>DM</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Aceite</div>
                  <div style={{ fontSize: 10 }}>N</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Data Processamento</div>
                  <div style={{ fontSize: 10 }}>{fmt.date(todayStr)}</div>
                </div>
                <div style={{ flex: 1, padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Nosso Número</div>
                  <div style={{ fontSize: 10, textAlign: 'right' }}>01/{c6BoletoLanc.id.slice(-8).toUpperCase()}-P</div>
                </div>
              </div>

              {/* Row 4 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Carteira</div>
                  <div style={{ fontSize: 10 }}>01 (C6 COB)</div>
                </div>
                <div style={{ flex: 1, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Espécie</div>
                  <div style={{ fontSize: 10 }}>R$</div>
                </div>
                <div style={{ flex: 2, borderRight: '1px solid #000', padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Referência</div>
                  <div style={{ fontSize: 10, fontWeight: 600 }}>{c6BoletoLanc.descricao}</div>
                </div>
                <div style={{ flex: 1, padding: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>(=) Valor do Documento</div>
                  <div style={{ fontSize: 12, fontWeight: 'bold', textAlign: 'right' }}>{fmt.currency(c6BoletoLanc.valor)}</div>
                </div>
              </div>

              {/* Row 5 — Instructions & deductions */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 3, borderRight: '1px solid #000', padding: 6, minHeight: 100 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>Instruções (Responsabilidade do Beneficiário)</div>
                  <div style={{ fontSize: 10, marginTop: 5, lineHeight: '15px' }}>
                    • COBRANÇA REFERENTE A {c6BoletoLanc.descricao.toUpperCase()}.<br />
                    • APÓS O VENCIMENTO COBRAR MORA DE R$ 1,50 AO DIA E MULTA DE 2,0%.<br />
                    • NÃO RECEBER APÓS 30 DIAS DO VENCIMENTO.<br />
                    • SAC C6 BANK: 0800 666 2000.<br />
                    <br />
                    <strong>PAGUE UTILIZANDO O QR CODE PIX DO C6 BANK AO LADO.</strong>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ padding: 4, borderBottom: '1px solid #000' }}>
                    <div style={{ fontSize: 8, fontWeight: 'bold' }}>(-) Desconto</div>
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
                    <div style={{ fontSize: 11, fontWeight: 'bold', textAlign: 'right' }}>{fmt.currency(c6BoletoLanc.valor)}</div>
                  </div>
                </div>
              </div>

              {/* Payer info */}
              <div style={{ padding: 6, borderBottom: '1px solid #000' }}>
                <div style={{ fontSize: 8, fontWeight: 'bold' }}>Pagador (Sacado)</div>
                <div style={{ fontSize: 10, lineHeight: '15px' }}>
                  <strong>{c6Sacado.nome || 'SACADO NÃO INFORMADO'}</strong>
                  {c6Sacado.cpfCnpj && <> — CPF/CNPJ: {c6Sacado.cpfCnpj}</>}
                  {c6Sacado.endereco && <><br />{c6Sacado.endereco}</>}
                </div>
              </div>

              {/* Barcode + QR Code */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, padding: '0 8px' }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 4 }}>Ficha de Compensação — C6 Bank (336)</div>
                  <div style={{ display: 'flex', height: 46, width: 400, alignItems: 'stretch' }}>
                    {Array.from({ length: 58 }).map((_, idx) => {
                      const isWide = (idx * 5) % 3 === 0;
                      const isGap = (idx * 7) % 4 === 0;
                      return <div key={idx} style={{ width: isWide ? 4 : 1.5, background: isGap ? 'transparent' : '#000', marginRight: 0.8 }} />;
                    })}
                  </div>
                  <div style={{ fontSize: 9, marginTop: 4, fontFamily: 'monospace' }}>
                    33690.{String(Math.floor(c6BoletoLanc.valor)).padStart(5,'0')} {c6BoletoLanc.id.slice(0,10).replace(/[^0-9]/g,'0')} 98765.432105 1 9801{String(Math.floor(c6BoletoLanc.valor*100)).padStart(12,'0')}
                  </div>
                </div>

                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 'bold' }}>PIX C6 BANK</div>
                  <div style={{ width: 80, height: 80, border: '2px solid #000', padding: 3, display: 'flex', flexWrap: 'wrap', background: '#fff' }}>
                    {Array.from({ length: 64 }).map((_, idx) => {
                      const fill = (idx * 5) % 3 === 0 || idx < 8 || idx % 8 === 0 || (idx > 50 && idx % 2 === 0);
                      return <div key={idx} style={{ width: '12.5%', height: '12.5%', background: fill ? '#000' : 'transparent' }} />;
                    })}
                  </div>
                  <div style={{ fontSize: 7, fontWeight: 'bold' }}>PIX COBRANÇA</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
