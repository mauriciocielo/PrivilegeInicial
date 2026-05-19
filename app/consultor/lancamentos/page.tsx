'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { store, Lancamento, PlanoConta, Portador } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import GeminiQuickEntry from '../../../components/GeminiQuickEntry';
import { uid } from '../../../lib/store';

type Filtros = { tipo: string; status: string; portadorId: string; search: string; mes: string, semPlano: boolean };

export default function LancamentosPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [filtros, setFiltros] = useState<Filtros>({ tipo: '', status: '', portadorId: '', search: '', mes: '', semPlano: false });
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Lancamento | null>(null);
  const [form, setForm] = useState<Partial<Lancamento> & { tipoTransacao?: 'receita' | 'despesa' | 'transferencia', portadorDestinoId?: string }>({});
  const [contaSearch, setContaSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showReclassModal, setShowReclassModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<'reclassificar' | 'transferir'>('reclassificar');
  const [reclassContaId, setReclassContaId] = useState('');
  const [reclassContaSearch, setReclassContaSearch] = useState('');
  const [reclassPortadorId, setReclassPortadorId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setLancamentos(store.getLancamentos(eId));
    setPlanoContas(store.getPlanoContas(eId).filter(p => p.nivel === 3 && p.ativo));
    setPortadores(store.getPortadores(eId).filter(p => p.ativo));
  }, []);

  const matchesConta = (conta: PlanoConta, search: string) => {
    const term = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!term) return true;
    const text = `${conta.codigo} ${conta.descricao}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return text.includes(term);
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || 'e1';
    load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  const filtered = useMemo(() => {
    return lancamentos.filter(l => {
      if (filtros.tipo && l.tipo !== filtros.tipo) return false;
      if (filtros.status && l.status !== filtros.status) return false;
      if (filtros.portadorId && l.portadorId !== filtros.portadorId) return false;
      if (filtros.search && !l.descricao.toLowerCase().includes(filtros.search.toLowerCase())) return false;
      if (filtros.mes && !l.data.startsWith(filtros.mes)) return false;
      if (filtros.semPlano) {
        const hasPlan = planoContas.some(pc => pc.id === l.planoContaId);
        if (hasPlan && l.planoContaId !== 'transf') return false;
      }
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data));
  }, [lancamentos, filtros, planoContas]);

  const totRec = useMemo(() => filtered.filter(l => l.tipo === 'receita' && l.status === 'realizado').reduce((a, l) => a + l.valor, 0), [filtered]);
  const totDesp = useMemo(() => filtered.filter(l => l.tipo === 'despesa' && l.status === 'realizado').reduce((a, l) => a + l.valor, 0), [filtered]);

  const openNew = () => {
    setEditItem(null);
    setContaSearch('');
    setForm({
      tipoTransacao: 'receita',
      tipo: 'receita',
      status: 'realizado',
      origem: 'manual',
      data: new Date().toISOString().split('T')[0],
      empresaId,
    });
    setShowModal(true);
  };

  const openEdit = (l: Lancamento) => {
    setEditItem(l);
    setContaSearch('');
    setForm({ ...l, tipoTransacao: l.tipo });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (form.tipoTransacao === 'transferencia') {
      if (!form.descricao || !form.valor || !form.portadorId || !form.portadorDestinoId || !form.data) {
        alert('Preencha todos os campos da transferência.');
        return;
      }
      setSaving(true);
      await new Promise(r => setTimeout(r, 300));

      const ts = new Date().toISOString();
      // Despesa (Saída da Origem)
      store.saveLancamento({
        id: uid(), empresaId, data: form.data, descricao: `[Transf. Saída] ${form.descricao}`, valor: Number(form.valor),
        tipo: 'despesa', planoContaId: 'transf', portadorId: form.portadorId, status: form.status as any, origem: 'manual', createdAt: ts
      });
      // Receita (Entrada no Destino)
      store.saveLancamento({
        id: uid(), empresaId, data: form.data, descricao: `[Transf. Entrada] ${form.descricao}`, valor: Number(form.valor),
        tipo: 'receita', planoContaId: 'transf', portadorId: form.portadorDestinoId, status: form.status as any, origem: 'manual', createdAt: ts
      });

    } else {
      if (!form.descricao || !form.valor || !form.planoContaId || !form.portadorId || !form.data) {
        alert('Preencha todos os campos obrigatórios.');
        return;
      }
      setSaving(true);
      await new Promise(r => setTimeout(r, 300));
      const lanc: Lancamento = {
        id: editItem?.id || uid(),
        empresaId,
        data: form.data!,
        descricao: form.descricao!,
        valor: Number(form.valor),
        tipo: form.tipoTransacao as 'receita' | 'despesa',
        planoContaId: form.planoContaId!,
        portadorId: form.portadorId!,
        status: form.status as 'previsto' | 'realizado',
        numeroDocumento: form.numeroDocumento,
        observacao: form.observacao,
        attachmentName: form.attachmentName,
        attachmentData: form.attachmentData,
        origem: 'manual',
        createdAt: editItem?.createdAt || new Date().toISOString(),
      };
      store.saveLancamento(lanc);
    }

    setLancamentos(store.getLancamentos(empresaId));
    setShowModal(false);
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Deseja excluir este lançamento?')) return;
    store.deleteLancamento(id);
    setLancamentos(store.getLancamentos(empresaId));
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      setForm(f => ({ ...f, attachmentName: file.name, attachmentData: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(l => l.id));
    }
  };

  const selectMissing = () => {
    const ids = filtered.filter(l => !l.planoContaId || !planoContas.some(pc => pc.id === l.planoContaId)).map(l => l.id);
    setSelectedIds(ids);
  };

  const handleBulkReclassify = () => {
    if (bulkMode === 'transferir') {
      if (!reclassPortadorId) { alert('Selecione o portador destino.'); return; }
      if (!transferDate) { alert('Informe a data da transferência.'); return; }
      const ts = new Date().toISOString();
      const newLancamentos: Lancamento[] = [];
      lancamentos.filter(l => selectedIds.includes(l.id)).forEach(l => {
        if (l.portadorId === reclassPortadorId) return;
        newLancamentos.push({
          id: uid(),
          empresaId,
          data: transferDate,
          descricao: `[Transf. Saída] ${l.descricao}`,
          valor: Number(l.valor),
          tipo: 'despesa', planoContaId: 'transf', portadorId: l.portadorId,
          status: 'realizado', origem: 'manual', createdAt: ts,
        });
        newLancamentos.push({
          id: uid(),
          empresaId,
          data: transferDate,
          descricao: `[Transf. Entrada] ${l.descricao}`,
          valor: Number(l.valor),
          tipo: 'receita', planoContaId: 'transf', portadorId: reclassPortadorId,
          status: 'realizado', origem: 'manual', createdAt: ts,
        });
      });
      store.saveLancamentos(newLancamentos);
      setLancamentos(store.getLancamentos(empresaId));
      setSelectedIds([]);
      setShowReclassModal(false);
      return;
    }

    if (!reclassContaId && !reclassPortadorId) { alert('Selecione uma conta ou um portador.'); return; }
    const updatedItems = lancamentos
      .filter(l => selectedIds.includes(l.id))
      .map(l => ({
        ...l,
        planoContaId: reclassContaId || l.planoContaId,
        portadorId: reclassPortadorId || l.portadorId
      }));

    store.saveLancamentos(updatedItems);
    setLancamentos(store.getLancamentos(empresaId));
    setSelectedIds([]);
    setShowReclassModal(false);
  };

  const meses = useMemo(() => {
    const list: string[] = [];
    const hoje = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
  }, []);

  const modalPlanoContas = useMemo(() => {
    return planoContas.filter(p => p.tipo === form.tipoTransacao && matchesConta(p, contaSearch));
  }, [planoContas, form.tipoTransacao, contaSearch]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Lançamentos</div>
          <div className="page-subtitle">{filtered.length} lançamentos encontrados</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={selectMissing} title="Selecionar todos os lançamentos sem plano de contas configurado">
            🎯 Selecionar s/ Plano
          </button>
          {selectedIds.length > 0 && (
            <>
              <button className="btn btn-secondary" onClick={() => { setBulkMode('reclassificar'); setReclassContaId(''); setReclassContaSearch(''); setReclassPortadorId(''); setTransferDate(new Date().toISOString().split('T')[0]); setShowReclassModal(true); }}>
                🔄 Ações em Lote ({selectedIds.length})
              </button>
              <button className="btn btn-primary" onClick={() => { setBulkMode('transferir'); setReclassContaId(''); setReclassContaSearch(''); setReclassPortadorId(''); setTransferDate(new Date().toISOString().split('T')[0]); setShowReclassModal(true); }}>
                ⇄ Transferir em Lote
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={openNew}>＋ Novo Lançamento</button>
        </div>
      </div>

      <div className="page-body">
        <GeminiQuickEntry empresaId={empresaId} onSuccess={() => load(empresaId)} />

        {/* Totais */}
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card green">
            <div className="stat-icon green">↑</div>
            <div className="stat-label">Receitas (filtro)</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(totRec)}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-icon red">↓</div>
            <div className="stat-label">Despesas (filtro)</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(totDesp)}</div>
          </div>
          <div className={`stat-card ${totRec - totDesp >= 0 ? 'blue' : 'red'}`}>
            <div className={`stat-icon ${totRec - totDesp >= 0 ? 'blue' : 'red'}`}>≈</div>
            <div className="stat-label">Resultado</div>
            <div className="stat-value" style={{ fontSize: 18, color: totRec - totDesp >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt.currency(totRec - totDesp)}
            </div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple">#</div>
            <div className="stat-label">Total de Registros</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{filtered.length}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="card card-sm" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="search-bar">
              <span>🔍</span>
              <input
                placeholder="Buscar descrição..."
                value={filtros.search}
                onChange={e => setFiltros(f => ({ ...f, search: e.target.value }))}
              />
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
              <select className="form-control" value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Todos os tipos</option>
                <option value="receita">Receitas</option>
                <option value="despesa">Despesas</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <select className="form-control" value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
                <option value="">Todos os status</option>
                <option value="realizado">Realizado</option>
                <option value="previsto">Previsto</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <select className="form-control" value={filtros.portadorId} onChange={e => setFiltros(f => ({ ...f, portadorId: e.target.value }))}>
                <option value="">Todos os portadores</option>
                {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" id="check-semplano" checked={filtros.semPlano} onChange={e => setFiltros(f => ({ ...f, semPlano: e.target.checked }))} />
              <label htmlFor="check-semplano" style={{ fontSize: 13, color: 'var(--text-secondary)', userSelect: 'none', cursor: 'pointer' }}>Sem Plano</label>
            </div>
            {(filtros.tipo || filtros.status || filtros.portadorId || filtros.search || filtros.mes || filtros.semPlano) && (
              <button className="btn btn-ghost btn-sm" onClick={() => setFiltros({ tipo: '', status: '', portadorId: '', search: '', mes: '', semPlano: false })}>
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
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Plano de Contas</th>
                  <th>Portador</th>
                  <th>Nº Doc.</th>
                  <th>Status</th>
                  <th>Origem</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📭</div>
                      <h3>Nenhum lançamento encontrado</h3>
                      <p>Ajuste os filtros ou adicione um novo lançamento.</p>
                    </div>
                  </td></tr>
                ) : filtered.map(l => {
                  const pc = planoContas.find(p => p.id === l.planoContaId);
                  const port = portadores.find(p => p.id === l.portadorId);
                  return (
                    <tr key={l.id} style={{ background: selectedIds.includes(l.id) ? 'var(--bg-card2)' : undefined }}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedIds.includes(l.id)} onChange={() => toggleSelect(l.id)} />
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmt.date(l.data)}</td>
                      <td style={{ fontWeight: 500, maxWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {l.descricao}
                          {l.attachmentData && (
                            <a
                              href={`data:application/octet-stream;base64,${l.attachmentData}`}
                              download={l.attachmentName}
                              title={`Anexo: ${l.attachmentName}`}
                              style={{ textDecoration: 'none', fontSize: 14 }}
                            >📎</a>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pc ? `${pc.codigo} - ${pc.descricao}` : '-'}</td>
                      <td style={{ fontSize: 12 }}>{port?.nome || '-'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.numeroDocumento || '-'}</td>
                      <td><span className={`badge ${l.status === 'realizado' ? 'badge-blue' : 'badge-yellow'}`}>{l.status === 'realizado' ? 'Realizado' : 'Previsto'}</span></td>
                      <td><span className={`badge ${l.origem === 'ofx' ? 'badge-purple' : 'badge-gray'}`}>{l.origem === 'ofx' ? 'OFX' : 'Manual'}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: l.tipo === 'receita' ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                        {l.tipo === 'receita' ? '+' : '-'}{fmt.currency(l.valor)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(l)} title="Editar">✏️</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(l.id)} title="Excluir">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editItem ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['receita', 'despesa', 'transferencia'] as const).map(t => {
                if (editItem && t === 'transferencia') return null;
                const isSelected = form.tipoTransacao === t;
                let colorClass = 'btn-secondary';
                if (isSelected) {
                  if (t === 'receita') colorClass = 'btn-success';
                  else if (t === 'despesa') colorClass = 'btn-danger';
                  else colorClass = 'btn-primary';
                }
                return (
                  <button
                    key={t}
                    className={`btn ${colorClass}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setForm(f => ({ ...f, tipoTransacao: t }))}
                  >
                    {t === 'receita' ? '↑ Receita' : t === 'despesa' ? '↓ Despesa' : '⇄ Transferência'}
                  </button>
                )
              })}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Data *</label>
                <input type="date" className="form-control" value={form.data || ''} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor (R$) *</label>
                <input type="number" step="0.01" min="0" className="form-control" placeholder="0,00" value={form.valor || ''} onChange={e => setForm(f => ({ ...f, valor: parseFloat(e.target.value) }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Descrição *</label>
              <input type="text" className="form-control" placeholder="Descreva o lançamento..." value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>

            <div className="form-row">
              {form.tipoTransacao !== 'transferencia' ? (
                <div className="form-group">
                  <label className="form-label">Plano de Contas *</label>
                  <input
                    className="form-control"
                    placeholder="Pesquisar por código ou descrição..."
                    value={contaSearch}
                    onChange={e => setContaSearch(e.target.value)}
                    style={{ marginBottom: 8 }}
                  />
                  <select className="form-control" value={form.planoContaId || ''} onChange={e => setForm(f => ({ ...f, planoContaId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {modalPlanoContas.map(p => (
                      <option key={p.id} value={p.id}>{p.codigo} - {p.descricao}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Portador Destino *</label>
                  <select className="form-control" value={form.portadorDestinoId || ''} onChange={e => setForm(f => ({ ...f, portadorDestinoId: e.target.value }))}>
                    <option value="">Selecione o destino...</option>
                    {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{form.tipoTransacao === 'transferencia' ? 'Portador Origem *' : 'Portador *'}</label>
                <select className="form-control" value={form.portadorId || ''} onChange={e => setForm(f => ({ ...f, portadorId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={form.status || 'realizado'} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'realizado' | 'previsto' }))}>
                  <option value="realizado">Realizado</option>
                  <option value="previsto">Previsto</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nº Documento</label>
                <input type="text" className="form-control" placeholder="NF, OS, Boleto..." value={form.numeroDocumento || ''} onChange={e => setForm(f => ({ ...f, numeroDocumento: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Observação</label>
              <textarea className="form-control" placeholder="Observações adicionais..." value={form.observacao || ''} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Comprovante / Anexo</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="file" className="form-control" onChange={handleFileChange} style={{ fontSize: 12 }} />
                {form.attachmentName && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ {form.attachmentName}</span>}
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '⏳ Salvando...' : '✓ Salvar Lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReclassModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReclassModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Ações em Lote</h2>
              <button className="modal-close" onClick={() => setShowReclassModal(false)}>✕</button>
            </div>
            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
              Você está prestes a alterar <strong>{selectedIds.length}</strong> lançamento(s). Escolha o novo Plano de Contas e/ou Portador para aplicá-los a todos os selecionados. Deixe em branco o que não deseja alterar.
            </div>
            <div className="form-group" style={{ display: bulkMode === 'transferir' ? 'none' : undefined }}>
              <label className="form-label">Novo Plano de Contas</label>
              <select className="form-control" value={reclassContaId} onChange={e => setReclassContaId(e.target.value)}>
                <option value="">Manter atual...</option>
                {planoContas.map(p => (
                  <option key={p.id} value={p.id}>{p.tipo === 'receita' ? '↑' : '↓'} {p.codigo} - {p.descricao}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{bulkMode === 'transferir' ? 'Portador Destino' : 'Transferir para Portador'}</label>
              <select className="form-control" value={reclassPortadorId} onChange={e => setReclassPortadorId(e.target.value)}>
                <option value="">{bulkMode === 'transferir' ? 'Selecione o destino...' : 'Manter atual...'}</option>
                {portadores.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowReclassModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleBulkReclassify}>🔄 Aplicar Alterações</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
