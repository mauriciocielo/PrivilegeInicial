'use client';
import { useState, useEffect } from 'react';
import { store, User, Empresa } from '../../../lib/store';
import { uid } from '../../../lib/store';
import { hashPassword } from '../../../lib/auth-hash';
import ImageCropper from '../../../components/ImageCropper';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';

const AVAILABLE_SCREENS = [
  { label: '📊 Dashboard', route: '/consultor/dashboard' },
  { label: '🗺️ Radar Administrativo', route: '/consultor/administrativo' },
  { label: '💡 Inteligência Tributária', route: '/consultor/inteligencia-tributaria' },
  { label: '🔍 Diagnóstico 360º', route: '/consultor/diagnostico-360' },
  { label: '⏱️ Atividades e Tempos', route: '/consultor/atividades' },
  { label: '📅 Agenda Semanal', route: '/consultor/agenda' },
  { label: '🎬 Apresentação Cliente', route: '/consultor/apresentacao' },
  { label: '🧠 Inteligência Financeira', route: '/consultor/inteligencia' },
  { label: '📝 Lançamentos', route: '/consultor/lancamentos' },
  { label: '📂 Importar OFX', route: '/consultor/importar-ofx' },
  { label: '⚖️ Endividamento', route: '/consultor/endividamento' },
  { label: '🎯 Indicadores', route: '/consultor/indicadores' },
  { label: '💰 Orçamento', route: '/consultor/orcamento' },
  { label: '👥 Clientes / Fornecedores', route: '/consultor/clientes' },
  { label: '💸 Contas a Pagar', route: '/consultor/contas-pagar' },
  { label: '💵 Contas a Receber', route: '/consultor/contas-receber' },
  { label: '🧾 NFS-e', route: '/consultor/nfse' },
  { label: '🏦 APIs Open Finance', route: '/consultor/open-finance' },
  { label: '📋 Políticas Financeiras', route: '/consultor/politicas' },
  { label: '🏦 Integração C6 Bank', route: '/consultor/integracao-c6' },
  { label: '🏢 Empresas', route: '/consultor/empresas' },
  { label: '👥 Usuários e Permissões', route: '/consultor/usuarios' },
  { label: '📋 Plano de Contas', route: '/consultor/plano-de-contas' },
  { label: '🏷️ Centros de Custo', route: '/consultor/centros-custo' },
  { label: '📝 Atas de Atendimento', route: '/consultor/atas' },
  { label: '🏦 Portadores / Contas', route: '/consultor/portadores' },
  { label: '🔒 Segurança & Auditoria', route: '/consultor/configuracoes-avancadas' },
  { label: '📈 Relatórios', route: '/consultor/relatorios' },
  { label: '🚚 Logística', route: '/consultor/logistica' },
  { label: '🏘️ Painel Condomínio', route: '/consultor/condominio' },
];

const AVAILABLE_CLIENT_SCREENS = [
  { label: '📊 Dashboard', route: '/cliente/dashboard' },
  { label: '💰 Extrato Detalhado', route: '/cliente/extrato' },
  { label: '🧠 Inteligência Financeira', route: '/cliente/inteligencia' },
  { label: '📝 Lançamentos', route: '/cliente/lancamentos' },
  { label: '📂 Importar OFX', route: '/cliente/importar-ofx' },
  { label: '📈 Relatórios', route: '/cliente/relatorios' },
  { label: '🚚 Módulo Logística', route: '/cliente/logistica' },
  { label: '📋 Políticas Financeiras', route: '/cliente/politicas' },
  { label: '📝 Atas de Atendimento', route: '/cliente/atas' },
];

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);
  const [form, setForm] = useState<Partial<User> & { newPassword?: string }>({});
  const [search, setSearch] = useState('');
  const [rawImageData, setRawImageData] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      setUsers(store.getUsers());
      setEmpresas(store.getEmpresas());
    };
    load();
    window.addEventListener('cfDataChange', load);
    return () => window.removeEventListener('cfDataChange', load);
  }, []);

  const openNew = () => { 
    setEdit(null); 
    setForm({ role: 'cliente', empresaIds: [], allowedRoutes: [] }); 
    setShowModal(true); 
  };
  
  const openEdit = (u: User) => { 
    setEdit(u); 
    setForm({ ...u, newPassword: '', allowedRoutes: u.allowedRoutes || [] }); 
    setShowModal(true); 
  };

  const toggleEmpresa = (id: string) => {
    const ids = form.empresaIds || [];
    setForm(f => ({ ...f, empresaIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] }));
  };

  const toggleRoute = (route: string) => {
    const routes = form.allowedRoutes || [];
    setForm(f => ({
      ...f,
      allowedRoutes: routes.includes(route) ? routes.filter(x => x !== route) : [...routes, route]
    }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setRawImageData(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Permite selecionar o mesmo arquivo novamente
  };

  const handleSave = () => {
    if (!form.name || !form.email) { toast.error('Preencha nome e e-mail.'); return; }
    if (!edit && !form.newPassword) { toast.error('Informe uma senha para o novo usuário.'); return; }
    
    const u: User = {
      id: edit?.id || uid(),
      name: form.name!,
      email: form.email!,
      password: form.newPassword ? hashPassword(form.newPassword) : (edit?.password || hashPassword('123456')),
      role: (form.role || 'cliente') as any,
      empresaIds: form.role === 'administrador' ? [] : (form.empresaIds || []),
      receberEmailDiario: !!form.receberEmailDiario,
      phone: form.phone || '',
      avatarData: form.avatarData,
      allowedRoutes: form.role === 'administrador' ? undefined : (form.allowedRoutes || []),
      createdAt: edit?.createdAt || new Date().toISOString(),
    };
    store.saveUser(u);
    setUsers(store.getUsers());
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAsync('Excluir este usuário?'))) return;
    store.deleteUser(id);
    setUsers(store.getUsers());
  };

  const filtered = users.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Usuários e Permissões</div>
          <div className="page-subtitle">{users.length} usuários cadastrados no sistema</div>
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
                  <th>Perfil / Nível</th>
                  <th>Empresas / Telas</th>
                  <th>Cadastrado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const initials = u.name.split(' ').map(w => w[0]).slice(0,2).join('');
                  const emps = empresas.filter(e => u.empresaIds?.includes(e.id));
                  
                  let roleText = '🏢 Cliente';
                  let roleBadge = 'badge-blue';
                  if (u.role === 'administrador') {
                    roleText = '💎 Administrador';
                    roleBadge = 'badge-green';
                  } else if (u.role === 'consultor') {
                    roleText = '👔 Consultor';
                    roleBadge = 'badge-purple';
                  }

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 12, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {u.avatarData ? (
                              <img src={u.avatarData === '__PRUNED_IN_LOCAL_STAGE__' ? `/api/users/avatar?id=${u.id}` : u.avatarData} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            ) : (
                              initials
                            )}
                          </div>
                          <span style={{ fontWeight: 500 }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td>
                        <span className={`badge ${roleBadge}`}>
                          {roleText}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, maxWidth: 300 }}>
                        {u.role === 'administrador' && (
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Acesso Total (Todas as Telas e Empresas)</span>
                        )}
                        {u.role === 'consultor' && (
                          <div>
                            <strong style={{ display: 'block', marginBottom: 2 }}>Telas permitidas ({u.allowedRoutes?.length || 0}):</strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 6 }}>
                              {(u.allowedRoutes || ['/consultor/dashboard']).map(r => {
                                const screen = AVAILABLE_SCREENS.find(s => s.route === r);
                                return (
                                  <span key={r} className="badge badge-gray" style={{ fontSize: 10 }}>
                                    {screen?.label.split(' ')[1] || r.split('/').pop()}
                                  </span>
                                );
                              })}
                            </div>
                            <strong style={{ display: 'block', marginBottom: 2 }}>Empresas:</strong>
                            {emps.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Nenhuma (Sem acesso)</span> : emps.map(e => (
                              <span key={e.id} className="badge badge-gray" style={{ marginRight: 4, fontSize: 10 }}>{e.nomeFantasia}</span>
                            ))}
                          </div>
                        )}
                        {u.role === 'cliente' && (
                          <div>
                            <strong style={{ display: 'block', marginBottom: 2 }}>Telas permitidas ({u.allowedRoutes?.length || 0}):</strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 6 }}>
                              {(!u.allowedRoutes || u.allowedRoutes.length === 0) ? (
                                <span className="badge badge-gray" style={{ fontSize: 10 }}>Acesso Total (Antigo)</span>
                              ) : u.allowedRoutes.map(r => {
                                const screen = AVAILABLE_CLIENT_SCREENS.find(s => s.route === r);
                                return (
                                  <span key={r} className="badge badge-gray" style={{ fontSize: 10 }}>
                                    {screen?.label.split(' ')[1] || r.split('/').pop()}
                                  </span>
                                );
                              })}
                            </div>
                            <strong style={{ display: 'block', marginBottom: 2 }}>Empresas:</strong>
                            {emps.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>Nenhuma</span> : emps.map(e => (
                              <span key={e.id} className="badge badge-gray" style={{ marginRight: 4 }}>{e.nomeFantasia}</span>
                            ))}
                          </div>
                        )}
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
              <h2 className="modal-title">{edit ? 'Editar Usuário e Permissões' : 'Novo Usuário'}</h2>
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
                <label className="form-label">Perfil de Acesso</label>
                <select 
                  className="form-control" 
                  value={form.role||'cliente'} 
                  onChange={e=>setForm(f=>({...f,role:e.target.value as any}))}
                >
                  <option value="administrador">💎 Administrador (Acesso Total)</option>
                  <option value="consultor">👔 Consultor (Acesso Customizado)</option>
                  <option value="cliente">🏢 Cliente (Acesso à Empresa)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{edit ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label>
                <input type="password" className="form-control" value={form.newPassword||''} onChange={e=>setForm(f=>({...f,newPassword:e.target.value}))} />
              </div>
            </div>

             <div className="form-row" style={{ marginTop: 16 }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-main)', marginBottom: 8 }}>
                  <input 
                    type="checkbox" 
                    checked={!!form.receberEmailDiario} 
                    onChange={e => setForm(f => ({ ...f, receberEmailDiario: e.target.checked }))} 
                  />
                  Receber resumo financeiro diário por e-mail e WhatsApp
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Telefone / WhatsApp (Ex: 5546999048990) *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="DDD + Número (apenas números)" 
                  value={form.phone || ''} 
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} 
                />
              </div>
            </div>

            <div className="form-row" style={{ marginTop: 16 }}>
              <div className="form-group">
                <label className="form-label">Foto do Usuário</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ fontSize: 12 }} />
                  {form.avatarData && (
                    <img 
                      src={form.avatarData === '__PRUNED_IN_LOCAL_STAGE__' && edit ? `/api/users/avatar?id=${edit.id}` : form.avatarData} 
                      alt="Miniatura" 
                      style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: '50%', border: '1px solid var(--border-light)' }} 
                    />
                  )}
                </div>
              </div>
              <div className="form-group">
                {/* Espaçador para alinhamento */}
              </div>
            </div>

            {/* Customização baseada no tipo de acesso */}
            {form.role === 'administrador' && (
              <div style={{ marginTop: 16, padding: '16px', background: 'rgba(46, 204, 113, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--green)' }}>
                <span style={{ fontSize: 16, marginRight: 8 }}>💎</span>
                <strong>Perfil Administrador:</strong> Este usuário terá acesso irrestrito a todas as empresas, configurações, geração de arquivos de remessa, relatórios e telas do sistema.
              </div>
            )}

            {(form.role === 'consultor' || form.role === 'cliente') && (
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Telas e Rotas Autorizadas (Selecione quais módulos o {form.role} poderá acessar)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginTop: 8, padding: '12px', background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                  {(form.role === 'consultor' ? AVAILABLE_SCREENS : AVAILABLE_CLIENT_SCREENS).map(screen => {
                    const checked = (form.allowedRoutes || []).includes(screen.route);
                    const isDashboard = screen.route.includes('/dashboard');
                    return (
                      <label 
                        key={screen.route} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 8, 
                          padding: '6px 10px', 
                          borderRadius: 'var(--radius-sm)', 
                          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-light)'}`, 
                          cursor: isDashboard ? 'not-allowed' : 'pointer', 
                          background: checked ? 'var(--accent-glow)' : 'transparent', 
                          fontSize: 12, 
                          color: checked ? 'var(--accent-light)' : 'var(--text-secondary)',
                          opacity: isDashboard ? 0.7 : 1
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={checked || isDashboard} 
                          disabled={isDashboard}
                          onChange={() => toggleRoute(screen.route)}
                        />
                        {screen.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {(form.role === 'cliente' || form.role === 'consultor') && (
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Empresas Vinculadas</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {empresas.map(e => {
                    const checked = (form.empresaIds || []).includes(e.id);
                    return (
                      <label key={e.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:'var(--radius-sm)', border:`1px solid ${checked ? 'var(--accent)' : 'var(--border-light)'}`, cursor:'pointer', background: checked ? 'var(--accent-glow)' : 'transparent', fontSize: 13, color: checked ? 'var(--accent-light)' : 'var(--text-secondary)' }}>
                        <input type="checkbox" style={{display:'none'}} checked={checked} onChange={() => toggleEmpresa(e.id)} />
                        {checked ? '✓' : '○'} {e.nomeFantasia || e.razaoSocial}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>✓ Salvar Usuário</button>
            </div>
          </div>
        </div>
      )}
      {rawImageData && (
        <ImageCropper
          src={rawImageData}
          aspectRatio="circle"
          onCrop={(cropped) => {
            setForm(f => ({ ...f, avatarData: cropped }));
            setRawImageData(null);
          }}
          onCancel={() => setRawImageData(null)}
        />
      )}
    </>
  );
}
