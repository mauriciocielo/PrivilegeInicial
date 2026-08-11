'use client';
import { useEffect, useState } from 'react';
import { store, CentroCusto, Empresa } from '../../../lib/store';

export default function CentrosCustoPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [activeCompany, setActiveCompany] = useState<Empresa | null>(null);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<CentroCusto>>({});

  const load = (eId: string) => {
    setEmpresaId(eId);
    setCentros(store.getCentrosCusto(eId));
    setActiveCompany(store.getEmpresas().find(e => e.id === eId) || null);
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    load(saved);

    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, []);

  const openForm = (cc: CentroCusto | null = null) => {
    if (cc) setForm(cc);
    else setForm({ empresaId, ativo: true });
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome) {
      alert('Nome do centro de custo é obrigatório.');
      return;
    }

    store.saveCentroCusto({
      id: form.id || 'cc_' + Date.now().toString(36),
      empresaId: form.empresaId || empresaId,
      nome: form.nome,
      codigo: form.codigo,
      ativo: form.ativo ?? true,
      createdAt: form.createdAt || new Date().toISOString()
    });

    setShowModal(false);
    load(empresaId);
  };

  const handleDelete = (id: string) => {
    if (confirm('Excluir este centro de custo? Isso não alterará os lançamentos que já o utilizaram.')) {
      store.deleteCentroCusto(id);
      load(empresaId);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Centros de Custo (Rateio/Safra)</div>
          <div className="page-subtitle">{activeCompany?.nomeFantasia} — Operação Agronegócio / Projetos</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => openForm()}>＋ Novo Centro de Custo</button>
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ marginBottom: 24, padding: 20, borderLeft: '4px solid var(--accent)' }}>
           <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>💡 Como usar Centros de Custo (Unidades de Negócio)</h4>
           <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
             Crie <strong>Fazendas</strong> (ex: Fazenda Boa Esperança), <strong>Culturas/Safras</strong> (ex: Safra Soja 2025/2026), <strong>Projetos</strong> ou <strong>Filiais</strong>. Ao lançar uma despesa, você poderá vinculá-la a estes Centros independentemente da Categoria normal do Plano de Contas, gerando um grau altíssimo de precisão gerencial.
           </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome (Fazenda / Safra / Obra)</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {centros.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      Nenhum centro de custo cadastrado para esta empresa.
                    </td>
                  </tr>
                ) : (
                  centros.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{c.codigo || '-'}</td>
                      <td style={{ fontWeight: 500 }}>{c.nome}</td>
                      <td>
                        <span className={`badge ${c.ativo ? 'badge-green' : 'badge-red'}`}>
                          {c.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openForm(c)}>✏️</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>{form.id ? 'Editar Centro de Custo/Safra' : 'Novo Centro de Custo/Safra'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="modal-body form-grid">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Código da Unidade / CC (Opcional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: CC-01, SAFRA-25"
                  value={form.codigo || ''}
                  onChange={e => setForm({ ...form, codigo: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 10' }}>
                <label>Nome do Centro de Custo / Safra *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: Fazenda Santa Cruz / Safra Soja 2025"
                  value={form.nome || ''}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group" style={{ gridColumn: 'span 12', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="ccAtivo" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} />
                <label htmlFor="ccAtivo" style={{ margin: 0, fontWeight: 500, cursor: 'pointer' }}>Centro de Custo Ativo</label>
              </div>

              <div className="modal-footer" style={{ gridColumn: 'span 12' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">💾 Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
