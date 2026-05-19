'use client';
import { useState, useEffect } from 'react';
import { store, Empresa } from '../../../lib/store';
import { uid } from '../../../lib/store';

export default function EmpresasPage() {
  const [list, setList] = useState<Empresa[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<Empresa | null>(null);
  const [form, setForm] = useState<Partial<Empresa>>({});
  const [search, setSearch] = useState('');
  const [fetchingCnpj, setFetchingCnpj] = useState(false);

  const fetchCnpjData = async () => {
    const rawCnpj = form.cnpj?.replace(/\D/g, '');
    if (!rawCnpj || rawCnpj.length !== 14) {
      alert('Por favor, insira um CNPJ válido com 14 dígitos (apenas números) para consultar.');
      return;
    }
    setFetchingCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${rawCnpj}`);
      if (!res.ok) throw new Error('Não foi possível obter dados para este CNPJ.');
      const data = await res.json();
      setForm(f => ({
        ...f,
        razaoSocial: data.razao_social || data.nome || '',
        nomeFantasia: data.nome_fantasia || data.fantasia || data.razao_social || data.nome || '',
        responsavel: data.qsa?.[0]?.nome || '',
        email: data.email || '',
        telefone: data.ddd_telefone_1 || data.telefone || '',
      }));
    } catch (err) {
      console.error(err);
      alert('Erro ao buscar dados na Receita Federal. O CNPJ pode ser inválido ou o serviço está temporariamente instável. Preencha manualmente.');
    } finally {
      setFetchingCnpj(false);
    }
  };

  useEffect(() => { setList(store.getEmpresas()); }, []);

  const openNew = () => { setEdit(null); setForm({}); setShowModal(true); };
  const openEdit = (e: Empresa) => { setEdit(e); setForm({ ...e }); setShowModal(true); };

  const handleSave = () => {
    if (!form.razaoSocial || !form.cnpj) { alert('Preencha Razão Social e CNPJ.'); return; }
    const emp: Empresa = {
      id: edit?.id || uid(),
      razaoSocial: form.razaoSocial!,
      nomeFantasia: form.nomeFantasia || form.razaoSocial!,
      cnpj: form.cnpj!,
      responsavel: form.responsavel || '',
      email: form.email || '',
      telefone: form.telefone || '',
      createdAt: edit?.createdAt || new Date().toISOString(),
    };
    store.saveEmpresa(emp);
    setList(store.getEmpresas());
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta empresa? Todos os dados relacionados serão afetados.')) return;
    store.deleteEmpresa(id);
    setList(store.getEmpresas());
  };

  const filtered = list.filter(e =>
    !search || e.razaoSocial.toLowerCase().includes(search.toLowerCase()) ||
    e.nomeFantasia.toLowerCase().includes(search.toLowerCase()) ||
    e.cnpj.includes(search)
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Empresas</div>
          <div className="page-subtitle">{list.length} empresas cadastradas</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNew}>＋ Nova Empresa</button>
        </div>
      </div>

      <div className="page-body">
        <div className="card card-sm" style={{ marginBottom: 20 }}>
          <div className="search-bar">
            <span>🔍</span>
            <input placeholder="Buscar por nome, fantasia ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Razão Social</th>
                  <th>Nome Fantasia</th>
                  <th>CNPJ</th>
                  <th>Responsável</th>
                  <th>Contato</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.razaoSocial}</td>
                    <td>{e.nomeFantasia}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.cnpj}</td>
                    <td>{e.responsavel || '-'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(e)}>✏️</button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(e.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon">🏢</div><h3>Nenhuma empresa encontrada</h3></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{edit ? 'Editar Empresa' : 'Nova Empresa'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Razão Social *</label>
                <input className="form-control" value={form.razaoSocial||''} onChange={e=>setForm(f=>({...f,razaoSocial:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Nome Fantasia</label>
                <input className="form-control" value={form.nomeFantasia||''} onChange={e=>setForm(f=>({...f,nomeFantasia:e.target.value}))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">CNPJ *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-control" placeholder="Apenas números (14 dígitos)" value={form.cnpj||''} onChange={e=>setForm(f=>({...f,cnpj:e.target.value}))} />
                  {!edit && (
                    <button type="button" className="btn btn-secondary" onClick={fetchCnpjData} disabled={fetchingCnpj} style={{ padding: '8px 12px', fontSize: 12 }}>
                      {fetchingCnpj ? '⏳' : '🔍 Buscar Receita'}
                    </button>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Responsável</label>
                <input className="form-control" value={form.responsavel||''} onChange={e=>setForm(f=>({...f,responsavel:e.target.value}))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input type="email" className="form-control" value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-control" placeholder="(00) 00000-0000" value={form.telefone||''} onChange={e=>setForm(f=>({...f,telefone:e.target.value}))} />
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
