'use client';
import { useState, useEffect } from 'react';
import { store, User, Empresa } from '../../../lib/store';
import { uid } from '../../../lib/store';

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);
  const [form, setForm] = useState<Partial<User> & { newPassword?: string }>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    setUsers(store.getUsers());
    setEmpresas(store.getEmpresas());
  }, []);

  const openNew = () => { setEdit(null); setForm({ role: 'cliente', empresaIds: [] }); setShowModal(true); };
  const openEdit = (u: User) => { setEdit(u); setForm({ ...u, newPassword: '' }); setShowModal(true); };

  const toggleEmpresa = (id: string) => {
    const ids = form.empresaIds || [];
    setForm(f => ({ ...f, empresaIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] }));
  };

  const handleSave = () => {
    if (!form.name || !form.email) { alert('Preencha nome e e-mail.'); return; }
    if (!edit && !form.newPassword) { alert('Informe uma senha para o novo usuário.'); return; }
    const u: User = {
      id: edit?.id || uid(),
      name: form.name!,
      email: form.email!,
      password: form.newPassword || edit?.password || '123456',
      role: form.role as 'consultor' | 'cliente',
      empresaIds: form.empresaIds || [],
      createdAt: edit?.createdAt || new Date().toISOString(),
    };
    store.saveUser(u);
    setUsers(store.getUsers());
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este usuário?')) return;
    store.deleteUser(id);
    setUsers(store.getUsers());
  };

  const filtered = users.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Usuários</div>
          <div className="page-subtitle">{users.length} usuários cadastrados</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNew}>＋ Novo Usuário</button>
        </div>
      </div>

      <div className="page-body">
        <div className="card card-sm" style={{ marginBottom: 20 }}>
          <div className="search-bar">
            <span>🔍</span>
            <input placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Empresas Vinculadas</th>
                  <th>Cadastrado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const initials = u.name.split(' ').map(w => w[0]).slice(0,2).join('');
                  const emps = empresas.filter(e => u.empresaIds.includes(e.id));
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="user-avatar" style={{ width:32, height:32, fontSize:12 }}>{initials}</div>
                          <span style={{ fontWeight: 500 }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === 'consultor' ? 'badge-purple' : 'badge-blue'}`}>
                          {u.role === 'consultor' ? '👔 Consultor' : '🏢 Cliente'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {emps.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>Nenhuma</span> : emps.map(e => (
                          <span key={e.id} className="badge badge-gray" style={{ marginRight: 4 }}>{e.nomeFantasia}</span>
                        ))}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(u)}>✏️</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(u.id)}>🗑️</button>
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

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">{edit ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome Completo *</label>
                <input className="form-control" value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail *</label>
                <input type="email" className="form-control" value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Perfil</label>
                <select className="form-control" value={form.role||'cliente'} onChange={e=>setForm(f=>({...f,role:e.target.value as 'consultor'|'cliente'}))}>
                  <option value="consultor">Consultor</option>
                  <option value="cliente">Cliente</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{edit ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label>
                <input type="password" className="form-control" value={form.newPassword||''} onChange={e=>setForm(f=>({...f,newPassword:e.target.value}))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Empresas Vinculadas</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {empresas.map(e => {
                  const checked = (form.empresaIds || []).includes(e.id);
                  return (
                    <label key={e.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:'var(--radius-sm)', border:`1px solid ${checked ? 'var(--accent)' : 'var(--border-light)'}`, cursor:'pointer', background: checked ? 'var(--accent-glow)' : 'transparent', fontSize: 13, color: checked ? 'var(--accent-light)' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                      <input type="checkbox" style={{display:'none'}} checked={checked} onChange={() => toggleEmpresa(e.id)} />
                      {checked ? '✓' : '○'} {e.nomeFantasia}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>✓ Salvar Usuário</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
