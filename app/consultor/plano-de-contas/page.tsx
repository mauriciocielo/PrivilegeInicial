'use client';
import { useState, useEffect, useCallback } from 'react';
import { store, PlanoConta } from '../../../lib/store';
import { uid } from '../../../lib/store';

export default function PlanoContasPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [plano, setPlano] = useState<PlanoConta[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<PlanoConta | null>(null);
  const [form, setForm] = useState<Partial<PlanoConta>>({});
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [search, setSearch] = useState('');

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setPlano(store.getPlanoContas(eId));
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || 'e1';
    load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  const openNew = (parent?: PlanoConta) => {
    setEdit(null);
    const nivelPai = parent ? parent.nivel + 1 : 1;
    const codigoPai = parent ? parent.codigo + '.' : '';
    setForm({
      tipo: parent?.tipo || 'receita',
      nivel: nivelPai,
      parentId: parent?.id,
      ativo: true,
      empresaId,
      codigo: codigoPai,
    });
    setShowModal(true);
  };

  const openEdit = (pc: PlanoConta) => {
    setEdit(pc);
    setForm({ ...pc });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.codigo || !form.descricao) { alert('Preencha código e descrição.'); return; }
    const pc: PlanoConta = {
      id: edit?.id || uid(),
      codigo: form.codigo!,
      descricao: form.descricao!,
      tipo: form.tipo as 'receita' | 'despesa',
      nivel: form.nivel || 1,
      parentId: form.parentId,
      ativo: form.ativo !== false,
      empresaId,
    };
    store.savePlanoConta(pc);
    setPlano(store.getPlanoContas(empresaId));
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    const children = plano.filter(p => p.parentId === id);
    if (children.length > 0) { alert('Não é possível excluir uma conta com subcategorias.'); return; }
    if (!confirm('Excluir esta conta?')) return;
    store.deletePlanoConta(id);
    setPlano(store.getPlanoContas(empresaId));
  };

  const toggleAtivo = (pc: PlanoConta) => {
    store.savePlanoConta({ ...pc, ativo: !pc.ativo });
    setPlano(store.getPlanoContas(empresaId));
  };

  const filtered = plano.filter(p => {
    if (filtroTipo !== 'todos' && p.tipo !== filtroTipo) return false;
    if (search && !p.descricao.toLowerCase().includes(search.toLowerCase()) && !p.codigo.includes(search)) return false;
    return true;
  }).sort((a, b) => a.codigo.localeCompare(b.codigo));

  const getNivelStyle = (nivel: number) => ({
    paddingLeft: `${(nivel - 1) * 20}px`,
    fontWeight: nivel === 1 ? 700 : nivel === 2 ? 600 : 400,
    fontSize: nivel === 1 ? '14px' : nivel === 2 ? '13px' : '12.5px',
    color: nivel === 1 ? 'var(--text-primary)' : nivel === 2 ? 'var(--text-primary)' : 'var(--text-secondary)',
  });

  const parents = plano.filter(p => p.nivel < 3);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Plano de Contas</div>
          <div className="page-subtitle">{plano.filter(p => p.ativo).length} contas ativas</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => openNew()}>＋ Nova Conta</button>
        </div>
      </div>

      <div className="page-body">
        <div className="card card-sm" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="tabs" style={{ margin: 0, border: 'none' }}>
              {(['todos','receita','despesa'] as const).map(t => (
                <button key={t} className={`tab ${filtroTipo === t ? 'active' : ''}`} onClick={() => setFiltroTipo(t)} style={{ padding: '6px 14px' }}>
                  {t === 'todos' ? 'Todos' : t === 'receita' ? '↑ Receitas' : '↓ Despesas'}
                </button>
              ))}
            </div>
            <div className="search-bar">
              <span>🔍</span>
              <input placeholder="Buscar conta..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Nível</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(pc => (
                  <tr key={pc.id} style={{ opacity: pc.ativo ? 1 : 0.5 }}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{pc.codigo}</td>
                    <td style={getNivelStyle(pc.nivel)}>
                      {pc.nivel > 1 && <span style={{ color: 'var(--border-light)', marginRight: 4 }}>{'└─'.padStart(pc.nivel * 2 - 2, '  ')}</span>}
                      {pc.descricao}
                    </td>
                    <td>
                      <span className={`badge ${pc.tipo === 'receita' ? 'badge-green' : 'badge-red'}`}>
                        {pc.tipo === 'receita' ? '↑ Receita' : '↓ Despesa'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nível {pc.nivel}</td>
                    <td>
                      <label className="toggle" onClick={() => toggleAtivo(pc)}>
                        <input type="checkbox" readOnly checked={pc.ativo} />
                        <div className="toggle-track" />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pc.ativo ? 'Ativo' : 'Inativo'}</span>
                      </label>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {pc.nivel < 3 && (
                          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => openNew(pc)}>+ Sub</button>
                        )}
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(pc)}>✏️</button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(pc.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{edit ? 'Editar Conta' : 'Nova Conta'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Código *</label>
                <input className="form-control" placeholder="Ex: 1.1.1" value={form.codigo||''} onChange={e=>setForm(f=>({...f,codigo:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-control" value={form.tipo||'receita'} onChange={e=>setForm(f=>({...f,tipo:e.target.value as 'receita'|'despesa'}))}>
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição *</label>
              <input className="form-control" value={form.descricao||''} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nível</label>
                <select className="form-control" value={form.nivel||1} onChange={e=>setForm(f=>({...f,nivel:Number(e.target.value)}))}>
                  <option value={1}>1 — Grupo Principal</option>
                  <option value={2}>2 — Subgrupo</option>
                  <option value={3}>3 — Conta Analítica</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Conta Pai</label>
                <select className="form-control" value={form.parentId||''} onChange={e=>setForm(f=>({...f,parentId:e.target.value||undefined}))}>
                  <option value="">Nenhuma (raiz)</option>
                  {parents.map(p => <option key={p.id} value={p.id}>{p.codigo} - {p.descricao}</option>)}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>✓ Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
