'use client';
import { useState, useEffect, useCallback } from 'react';
import { store, PlanoConta, type TransactionPattern } from '../../../lib/store';
import { uid } from '../../../lib/store';

export default function PlanoContasPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [plano, setPlano] = useState<PlanoConta[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<PlanoConta | null>(null);
  const [form, setForm] = useState<Partial<PlanoConta>>({});
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'receita' | 'despesa' | 'transferencia'>('todos');
  const [search, setSearch] = useState('');

  // Estados de Regras de IA
  const [activePageTab, setActivePageTab] = useState<'contas' | 'regras'>('contas');
  const [regras, setRegras] = useState<TransactionPattern[]>([]);
  const [showRegraModal, setShowRegraModal] = useState(false);
  const [regraForm, setRegraForm] = useState<Partial<TransactionPattern>>({});

  // Estado de Árvore Retrátil
  const [collapsedKeys, setCollapsedKeys] = useState<Record<string, boolean>>({});
  const toggleCollapse = (id: string) => {
    setCollapsedKeys(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setPlano(store.getPlanoContas(eId));
    setRegras(store.getTransactionPatterns(eId));
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  const handleSaveRegra = () => {
    if (!regraForm.pattern || !regraForm.categoryId) {
      alert('Preencha o termo da regra e selecione a categoria.');
      return;
    }
    const pt: TransactionPattern = {
      id: regraForm.id || 'pt_' + Math.random().toString(36).slice(2, 9),
      empresaId,
      pattern: regraForm.pattern!,
      categoryId: regraForm.categoryId!,
    };
    store.saveTransactionPattern(pt);
    setRegras(store.getTransactionPatterns(empresaId));
    setShowRegraModal(false);
    setRegraForm({});
  };

  const handleDeleteRegra = (id: string) => {
    if (!confirm('Deseja excluir esta regra de classificação automática?')) return;
    store.deleteTransactionPattern(id);
    setRegras(store.getTransactionPatterns(empresaId));
  };

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
      tipo: form.tipo as 'receita' | 'despesa' | 'transferencia',
      nivel: form.nivel || 1,
      parentId: form.parentId,
      ativo: form.ativo !== false,
      empresaId,
      dreCategoria: form.dreCategoria,
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
        {/* Abas Principais */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-light)', paddingBottom: 10 }}>
          <button className={`btn ${activePageTab === 'contas' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setActivePageTab('contas')}>
            📋 Estrutura de Contas
          </button>
          <button className={`btn ${activePageTab === 'regras' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setActivePageTab('regras')}>
            🧠 Regras de Classificação IA
          </button>
        </div>

        {activePageTab === 'contas' && (
          <>
            <div className="card card-sm" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="tabs" style={{ margin: 0, border: 'none' }}>
                  {(['todos','receita','despesa','transferencia'] as const).map(t => (
                    <button key={t} className={`tab ${filtroTipo === t ? 'active' : ''}`} onClick={() => setFiltroTipo(t)} style={{ padding: '6px 14px' }}>
                      {t === 'todos' ? 'Todos' : t === 'receita' ? '↑ Receitas' : t === 'despesa' ? '↓ Despesas' : '🔄 Transferências'}
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
                    {(() => {
                      // We need collapsible state. Let's use a React state or local state. Since page.tsx is a client component, let's inject a state hook at the top, or track it in a state.
                      // Let's look at the top of the file to see how we define states.
                      // We will use standard React state defined at the top. Let's add expandedState tracker.
                      // We can check if any parent is collapsed to hide a child row.
                      return filtered.map(pc => {
                        // Check if parent is collapsed
                        const parentCollapsed = plano.some(p => {
                          if (p.nivel < pc.nivel && pc.codigo.startsWith(p.codigo + '.')) {
                            // If this parent exists and is collapsed
                            const isCollapsed = collapsedKeys[p.id];
                            if (isCollapsed) return true;
                          }
                          return false;
                        });

                        if (parentCollapsed) return null;

                        const hasChildren = plano.some(p => p.parentId === pc.id);
                        const isExpanded = !collapsedKeys[pc.id];

                        return (
                          <tr key={pc.id} style={{ opacity: pc.ativo ? 1 : 0.5 }}>
                            <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{pc.codigo}</td>
                            <td 
                              style={{ ...getNivelStyle(pc.nivel), cursor: 'pointer' }}
                              onClick={() => openEdit(pc)}
                              title="Clique para editar"
                            >
                              {pc.nivel > 1 && <span style={{ color: 'var(--border-light)', marginRight: 4 }}>{'└─'.padStart(pc.nivel * 2 - 2, '  ')}</span>}
                              {hasChildren && (
                                <button 
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '0 4px',
                                    marginRight: 4,
                                    fontSize: 10
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCollapse(pc.id);
                                  }}
                                >
                                  {isExpanded ? '▼' : '▶'}
                                </button>
                              )}
                              {pc.descricao}
                            </td>
                            <td>
                              <span className={`badge ${pc.tipo === 'receita' ? 'badge-green' : pc.tipo === 'transferencia' ? 'badge-purple' : 'badge-red'}`}>
                                {pc.tipo === 'receita' ? '↑ Receita' : pc.tipo === 'transferencia' ? '🔄 Transferência' : '↓ Despesa'}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nível {pc.nivel}</td>
                            <td>
                              <span className={`badge ${pc.ativo ? 'badge-blue' : 'badge-gray'}`}>
                                {pc.ativo ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {pc.nivel < 3 && (
                                  <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '4px 8px' }} title="Nova Subconta" onClick={() => openNew(pc)}>+ Sub</button>
                                )}
                                <button className="btn btn-ghost btn-sm btn-icon" title="Editar" onClick={() => openEdit(pc)}>✏️</button>
                                <button className="btn btn-ghost btn-sm btn-icon" title={pc.ativo ? 'Inativar' : 'Ativar'} onClick={() => toggleAtivo(pc)}>
                                  {pc.ativo ? '⏸️' : '▶️'}
                                </button>
                                <button className="btn btn-danger btn-sm btn-icon" title="Excluir" onClick={() => handleDelete(pc.id)}>🗑️</button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activePageTab === 'regras' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Regras automáticas aprendidas pelo sistema a partir dos seus lançamentos ou configuradas manualmente.
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => { setRegraForm({}); setShowRegraModal(true); }}>
                ＋ Nova Regra Manual
              </button>
            </div>

            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Padrão de Texto (Histórico)</th>
                      <th>Categoria Vinculada</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regras.length === 0 ? (
                      <tr>
                        <td colSpan={3}>
                          <div className="empty-state">
                            <div className="empty-state-icon">🧠</div>
                            <h3>Nenhuma regra configurada</h3>
                            <p>O sistema cria regras automaticamente quando você categoriza transações no OFX.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      regras.map(r => {
                        const pc = plano.find(p => p.id === r.categoryId);
                        return (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{r.pattern}</td>
                            <td>
                              {pc ? (
                                <span className={`badge ${pc.tipo === 'receita' ? 'badge-green' : pc.tipo === 'transferencia' ? 'badge-purple' : 'badge-red'}`}>
                                  {pc.codigo} - {pc.descricao}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Categoria não encontrada ({r.categoryId})</span>
                              )}
                            </td>
                            <td>
                              <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteRegra(r.id)}>
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
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
                <select className="form-control" value={form.tipo||'receita'} onChange={e=>setForm(f=>({...f,tipo:e.target.value as 'receita'|'despesa'|'transferencia'}))}>
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                  <option value="transferencia">Transferência</option>
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
            <div className="form-group">
              <label className="form-label">Estrutura DRE (Classificação)</label>
              <select className="form-control" value={form.dreCategoria || ''} onChange={e=>setForm(f=>({...f,dreCategoria:e.target.value}))}>
                <option value="">Não classificado (Outros)</option>
                <option value="receita_vendas">Receita total de Vendas</option>
                <option value="impostos">Despesas com Impostos</option>
                <option value="cmv">CMV (Custo de Mercadoria)</option>
                <option value="despesas_fixas">Despesas Fixas</option>
                <option value="despesas_variaveis">Despesas Variáveis</option>
                <option value="despesas_pessoal">Despesas com Pessoal</option>
                <option value="despesas_bancarias">Despesas Bancárias</option>
                <option value="despesas_terceiros">Despesas com Terceiros</option>
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Selecione em qual linha do DRE Gerencial esta conta deve aparecer.
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>✓ Salvar</button>
            </div>
          </div>
        </div>
      )}
      {showRegraModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRegraModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Nova Regra de IA</h2>
              <button className="modal-close" onClick={() => setShowRegraModal(false)}>✕</button>
            </div>
            
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Termo / Histórico Bancário *</label>
              <input 
                className="form-control" 
                placeholder="Ex: POSTO IPIRANGA, MERCADINHO, PIX TRANSF..." 
                value={regraForm.pattern || ''} 
                onChange={e => setRegraForm(f => ({ ...f, pattern: e.target.value.toUpperCase() }))} 
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Ao importar um OFX, qualquer histórico que contenha este texto será sugerido para a categoria selecionada abaixo.
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Categoria Correspondente *</label>
              <select 
                className="form-control" 
                value={regraForm.categoryId || ''} 
                onChange={e => setRegraForm(f => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="">Selecione...</option>
                {plano.filter(p => p.nivel === 3 && p.ativo).map(p => (
                  <option key={p.id} value={p.id}>{p.codigo} - {p.descricao} ({p.tipo === 'receita' ? 'Receita' : p.tipo === 'transferencia' ? 'Transferência' : 'Despesa'})</option>
                ))}
              </select>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowRegraModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveRegra}>✓ Salvar Regra</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
