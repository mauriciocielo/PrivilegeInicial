'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { store, User, Empresa, uid } from '../../../lib/store';
import { TIPO_EMPRESA_SO_EMISSOR, emiteViaProcuracao } from '../../../lib/nfse/emissor';
import { hashPassword } from '../../../lib/auth-hash';
import ImageCropper from '../../../components/ImageCropper';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';

const ROTA_CLIENTE_NFSE = '/cliente/nfse';

const AVAILABLE_SCREENS = [
  { label: '📊 Dashboard', route: '/consultor/dashboard' },
  { label: '🗺️ Radar Administrativo', route: '/consultor/administrativo' },
  { label: '💡 Inteligência Tributária', route: '/consultor/inteligencia-tributaria' },
  { label: '🔍 Diagnóstico 360º', route: '/consultor/diagnostico-360' },
  { label: '🧭 Perfil Comportamental', route: '/consultor/perfil-disc' },
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
  { label: '🔌 Contas via ERP', route: '/consultor/contas-erp' },
  { label: '🧾 NFS-e', route: '/consultor/nfse' },
  { label: '🏦 APIs Open Finance', route: '/consultor/open-finance' },
  { label: '📋 Políticas Financeiras', route: '/consultor/politicas' },
  { label: '🏦 Integração C6 Bank', route: '/consultor/integracao-c6' },
  { label: '🔮 Projeção de Caixa', route: '/consultor/projecao-caixa' },
  { label: '🤖 Ecossistema BPO (IA)', route: '/consultor/bpo' },
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
  { label: '📅 Agenda', route: '/cliente/agenda' },
  { label: '💰 Extrato Detalhado', route: '/cliente/extrato' },
  { label: '🧠 Inteligência Financeira', route: '/cliente/inteligencia' },
  { label: '📝 Lançamentos', route: '/cliente/lancamentos' },
  { label: '📂 Importar OFX', route: '/cliente/importar-ofx' },
  { label: '🏦 Contas via ERP', route: '/cliente/contas-erp' },
  { label: '📈 Relatórios', route: '/cliente/relatorios' },
  { label: '🚚 Módulo Logística', route: '/cliente/logistica' },
  { label: '📋 Políticas Financeiras', route: '/cliente/politicas' },
  { label: '📝 Atas de Atendimento', route: '/cliente/atas' },
];

interface EmpresaEmissoraInfo {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  tipo: string;
  nfseConfig?: {
    usarProcuracao?: boolean;
    procuracaoStatus?: 'ativa' | 'sem_procuracao' | 'indeterminada' | null;
  } | null;
}

type ModoCliente = 'nfse' | 'bpo';

function situacaoProcuracao(config: EmpresaEmissoraInfo['nfseConfig']): { texto: string; classe: string } {
  if (emiteViaProcuracao(config)) return { texto: 'Procuração ativa', classe: 'badge-green' };
  if (config?.usarProcuracao === false) return { texto: 'Certificado próprio', classe: 'badge-gray' };
  if (config?.procuracaoStatus === 'sem_procuracao') return { texto: 'Sem procuração', classe: 'badge-red' };
  if (config?.procuracaoStatus === 'indeterminada') return { texto: 'Não confirmada', classe: 'badge-yellow' };
  return { texto: 'Não verificada', classe: 'badge-gray' };
}

function gerarSenhaSugerida(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);
  const [form, setForm] = useState<Partial<User> & { newPassword?: string }>({});
  const [modoCliente, setModoCliente] = useState<ModoCliente>('nfse');
  const [buscaEmpresa, setBuscaEmpresa] = useState('');
  const [filtroEmpresa, setFiltroEmpresa] = useState<'todas' | 'procuracao' | 'so_emissor'>('todas');
  const [salvando, setSalvando] = useState(false);
  const [credencialRecente, setCredencialRecente] = useState<{ nome: string; email: string; senha: string } | null>(null);

  const [search, setSearch] = useState('');
  const [rawImageData, setRawImageData] = useState<string | null>(null);
  const [emissoresTodos, setEmissoresTodos] = useState<EmpresaEmissoraInfo[]>([]);
  const [emissoresEstado, setEmissoresEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando');

  // As empresas só emissoras não vêm no cadastro local: sem esta lista elas não aparecem para seleção.
  const carregarEmissores = useCallback(() => {
    setEmissoresEstado('carregando');
    fetch('/api/nfse/emissores')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('falha ao listar emissores'))))
      .then(d => {
        setEmissoresTodos(d?.empresas || []);
        setEmissoresEstado('ok');
      })
      .catch(() => setEmissoresEstado('erro'));
  }, []);

  useEffect(() => {
    const load = () => {
      setUsers(store.getUsers());
      setEmpresas(store.getEmpresas());
    };
    load();
    window.addEventListener('cfDataChange', load);
    carregarEmissores();
    return () => window.removeEventListener('cfDataChange', load);
  }, [carregarEmissores]);

  // Lista unificada de empresas (BPO + Só Emissor) com status de procuração NFS-e
  const todasEmpresasUnificadas = useMemo(() => {
    const mapa = new Map<string, EmpresaEmissoraInfo>();
    for (const e of empresas) {
      mapa.set(e.id, {
        id: e.id,
        razaoSocial: e.razaoSocial,
        nomeFantasia: e.nomeFantasia || e.razaoSocial,
        cnpj: e.cnpj || '',
        tipo: e.tipo || 'empresa',
        nfseConfig: null,
      });
    }
    for (const em of emissoresTodos) {
      const atual = mapa.get(em.id);
      mapa.set(em.id, {
        id: em.id,
        razaoSocial: em.razaoSocial || atual?.razaoSocial || '',
        nomeFantasia: em.nomeFantasia || em.razaoSocial || atual?.nomeFantasia || '',
        cnpj: em.cnpj || atual?.cnpj || '',
        tipo: em.tipo || atual?.tipo || 'empresa',
        nfseConfig: em.nfseConfig ?? atual?.nfseConfig ?? null,
      });
    }
    return Array.from(mapa.values()).sort((a, b) =>
      (a.nomeFantasia || a.razaoSocial).localeCompare(b.nomeFantasia || b.razaoSocial)
    );
  }, [empresas, emissoresTodos]);

  const ehUsuarioEmissorNfse = (u: User): boolean => {
    if (u.role !== 'cliente') return false;
    if ((u.allowedRoutes || []).includes(ROTA_CLIENTE_NFSE)) return true;
    const vinculadas = todasEmpresasUnificadas.filter(e => u.empresaIds?.includes(e.id));
    return vinculadas.some(e => e.tipo === TIPO_EMPRESA_SO_EMISSOR || emiteViaProcuracao(e.nfseConfig));
  };

  const openNew = (modoInicial: ModoCliente = 'bpo') => {
    setEdit(null);
    setModoCliente(modoInicial);
    setBuscaEmpresa('');
    setFiltroEmpresa(modoInicial === 'nfse' ? 'procuracao' : 'todas');
    setCredencialRecente(null);
    setForm({
      role: 'cliente',
      empresaIds: [],
      allowedRoutes: modoInicial === 'nfse' ? [ROTA_CLIENTE_NFSE] : ['/cliente/dashboard'],
      newPassword: modoInicial === 'nfse' ? gerarSenhaSugerida() : '',
    });
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEdit(u);
    const isNfse = ehUsuarioEmissorNfse(u);
    setModoCliente(isNfse ? 'nfse' : 'bpo');
    setBuscaEmpresa('');
    setFiltroEmpresa(isNfse ? 'procuracao' : 'todas');
    setCredencialRecente(null);
    setForm({ ...u, newPassword: '', allowedRoutes: u.allowedRoutes || [] });
    setShowModal(true);
  };

  const toggleEmpresa = (id: string) => {
    const ids = form.empresaIds || [];
    const selecionando = !ids.includes(id);
    const novasEmpresas = selecionando ? [...ids, id] : ids.filter(x => x !== id);
    const emp = todasEmpresasUnificadas.find(e => e.id === id);

    setForm(f => ({
      ...f,
      empresaIds: novasEmpresas,
      // Se estiver criando cliente de NFS-e e o nome ainda estiver em branco, sugere o nome da empresa
      name: (!f.name?.trim() && selecionando && form.role === 'cliente' && emp)
        ? (emp.nomeFantasia || emp.razaoSocial)
        : f.name,
    }));
  };

  const toggleRoute = (route: string) => {
    const routes = form.allowedRoutes || [];
    setForm(f => ({
      ...f,
      allowedRoutes: routes.includes(route) ? routes.filter(x => x !== route) : [...routes, route],
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
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!form.name?.trim() || !form.email?.trim()) {
      toast.error('Preencha nome e e-mail.');
      return;
    }
    if (!edit && !form.newPassword?.trim()) {
      toast.error('Informe uma senha para o novo usuário.');
      return;
    }
    if ((form.role === 'cliente' || form.role === 'consultor') && (!form.empresaIds || form.empresaIds.length === 0)) {
      toast.error('Selecione pelo menos uma empresa vinculada para este usuário.');
      return;
    }
    // O servidor substitui quem já usa o e-mail: um cadastro novo apagaria o login e os vínculos atuais.
    const emailNormalizado = form.email.trim().toLowerCase();
    const donoDoEmail = users.find(x => x.id !== edit?.id && x.email.trim().toLowerCase() === emailNormalizado);
    if (donoDoEmail) {
      toast.error(`Este e-mail já é de ${donoDoEmail.name}. Edite esse usuário para vincular mais empresas.`);
      return;
    }

    const rotasFinais = form.role === 'administrador'
      ? undefined
      : form.role === 'cliente' && modoCliente === 'nfse'
        ? [ROTA_CLIENTE_NFSE]
        : (form.allowedRoutes || []).filter(r => r !== ROTA_CLIENTE_NFSE);

    const senhaPlana = form.newPassword?.trim() || '';
    const u: User = {
      id: edit?.id || uid(),
      name: form.name.trim(),
      email: emailNormalizado,
      password: senhaPlana ? hashPassword(senhaPlana) : (edit?.password || ''),
      role: (form.role || 'cliente') as any,
      empresaIds: form.role === 'administrador' ? [] : (form.empresaIds || []),
      receberEmailDiario: !!form.receberEmailDiario,
      phone: form.phone || '',
      avatarData: form.avatarData,
      allowedRoutes: rotasFinais,
      createdAt: edit?.createdAt || new Date().toISOString(),
    };

    setSalvando(true);
    try {
      // Grava primeiro no PostgreSQL: é de lá que o login lê, e só confirma o que o servidor aceitou.
      const res = await fetch('/api/migrate-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'cf_users', data: [u] }),
      }).catch(() => null);
      const resposta = res?.ok ? await res.json().catch(() => null) : null;
      if (!resposta) {
        toast.error('Não foi possível gravar o usuário no servidor. Nada foi salvo; tente novamente.');
        return;
      }
      if (resposta.ignorados > 0) {
        toast.error('O servidor recusou este cadastro: seu perfil não tem permissão para este usuário ou para estas empresas.');
        return;
      }

      store.saveUser(u);
      setUsers(store.getUsers());

      if (senhaPlana && u.role === 'cliente') {
        setCredencialRecente({ nome: u.name, email: u.email, senha: senhaPlana });
        toast.success('Usuário salvo! Copie os dados de acesso abaixo para enviar ao cliente.');
      } else {
        toast.success('Usuário salvo com sucesso!');
        setShowModal(false);
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAsync('Excluir este usuário?'))) return;
    store.deleteUser(id);
    setUsers(store.getUsers());
  };

  const empresasFiltradasModal = useMemo(() => {
    const termo = buscaEmpresa.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, '');
    return todasEmpresasUnificadas.filter(e => {
      // Sempre exibe as que já estão marcadas no formulário
      const jaMarcada = (form.empresaIds || []).includes(e.id);
      if (!jaMarcada) {
        if (filtroEmpresa === 'procuracao' && !emiteViaProcuracao(e.nfseConfig)) {
          return false;
        }
        if (filtroEmpresa === 'so_emissor' && e.tipo !== TIPO_EMPRESA_SO_EMISSOR) {
          return false;
        }
      }
      if (!termo) return true;
      return (
        e.razaoSocial.toLowerCase().includes(termo) ||
        e.nomeFantasia.toLowerCase().includes(termo) ||
        (!!digitos && e.cnpj.replace(/\D/g, '').includes(digitos))
      );
    });
  }, [todasEmpresasUnificadas, buscaEmpresa, filtroEmpresa, form.empresaIds]);

  const selecionadas = todasEmpresasUnificadas.filter(e => (form.empresaIds || []).includes(e.id));
  const selecionadasComEmissao = selecionadas.filter(e => emiteViaProcuracao(e.nfseConfig));
  const selecionadasSemEmissao = selecionadas.filter(e => !emiteViaProcuracao(e.nfseConfig));

  const filtered = users.filter(
    u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const copiarCredencial = async (cred: { nome: string; email: string; senha: string }) => {
    const origem = typeof window !== 'undefined' ? window.location.origin : '';
    const msg = [
      `Olá, *${cred.nome}*!`,
      `Seu acesso ao portal já está liberado:`,
      ``,
      `🔗 *Link:* ${origem}/login`,
      `📧 *E-mail:* ${cred.email}`,
      `🔑 *Senha:* ${cred.senha}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(msg);
      toast.success('Dados de acesso copiados!');
    } catch {
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Usuários e Permissões</div>
          <div className="page-subtitle">{users.length} usuários cadastrados no sistema</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            style={{ borderColor: 'var(--green)', color: 'var(--green)', fontWeight: 600 }}
            onClick={() => openNew('nfse')}
          >
            🧾 Novo Cliente Emissor NFS-e
          </button>
          <button className="btn btn-primary" onClick={() => openNew('bpo')}>
            ＋ Novo Usuário
          </button>
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
                  const initials = u.name.split(' ').map(w => w[0]).slice(0, 2).join('');
                  const emps = todasEmpresasUnificadas.filter(e => u.empresaIds?.includes(e.id));
                  const clienteNfse = ehUsuarioEmissorNfse(u);

                  let roleText = clienteNfse ? '🧾 Cliente — Emissor NFS-e' : '🏢 Cliente — Portal BPO';
                  let roleBadge = clienteNfse ? 'badge-green' : 'badge-blue';
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
                      <td style={{ fontSize: 12, maxWidth: 340 }}>
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
                            {clienteNfse ? (
                              <div style={{ marginBottom: 6 }}>
                                <span className="badge badge-green" style={{ fontSize: 10 }}>
                                  🧾 Acesso direto ao Emissor Nacional de NFS-e
                                </span>
                              </div>
                            ) : (
                              <>
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
                              </>
                            )}
                            <strong style={{ display: 'block', marginBottom: 2 }}>Empresas vinculadas:</strong>
                            {emps.length === 0 ? (
                              <span style={{ color: 'var(--red)', fontSize: 11 }}>⚠️ Nenhuma empresa vinculada</span>
                            ) : emps.map(e => (
                              <span key={e.id} className="badge badge-gray" style={{ marginRight: 4, marginBottom: 2, fontSize: 10 }}>
                                {e.nomeFantasia || e.razaoSocial}{e.cnpj ? ` (${e.cnpj})` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(u)} title="Editar usuário">✏️</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(u.id)} title="Excluir usuário">🗑️</button>
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
          <div className="modal modal-lg" style={{ maxWidth: 820, maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {edit
                  ? 'Editar Usuário e Permissões'
                  : form.role === 'cliente' && modoCliente === 'nfse'
                    ? '🧾 Novo Login de Cliente — Emissor de NFS-e'
                    : 'Novo Usuário'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {credencialRecente && (
              <div style={{
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.4)',
                borderRadius: 10,
                padding: 14,
                marginBottom: 16,
              }}>
                <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: 13.5, marginBottom: 6 }}>
                  ✅ Acesso criado com sucesso!
                </div>
                <div style={{ fontSize: 12.5, marginBottom: 10, fontFamily: 'monospace' }}>
                  <strong>E-mail:</strong> {credencialRecente.email} &nbsp;|&nbsp; <strong>Senha:</strong> {credencialRecente.senha}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => copiarCredencial(credencialRecente)}>
                    📋 Copiar mensagem para enviar ao cliente
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>
                    Fechar janela
                  </button>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Perfil de Acesso</label>
                <select
                  className="form-control"
                  value={form.role || 'cliente'}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}
                >
                  <option value="cliente">🏢 Cliente (Emissor NFS-e ou Portal BPO)</option>
                  <option value="consultor">👔 Consultor (Equipe do Escritório)</option>
                  <option value="administrador">💎 Administrador (Acesso Total)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{edit ? 'Nova Senha (deixe vazio para manter)' : 'Senha Inicial *'}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontFamily: 'monospace', fontWeight: 600 }}
                    placeholder={edit ? 'Manter senha atual' : 'Digite ou gere ao lado'}
                    value={form.newPassword || ''}
                    onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ whiteSpace: 'nowrap', padding: '0 10px', fontSize: 12 }}
                    onClick={() => setForm(f => ({ ...f, newPassword: gerarSenhaSugerida() }))}
                  >
                    🎲 Gerar
                  </button>
                </div>
              </div>
            </div>

            {/* Seletor visual claro quando Perfil === Cliente */}
            {form.role === 'cliente' && (
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  O que este cliente vai acessar?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginTop: 6 }}>
                  <div
                    onClick={() => {
                      setModoCliente('nfse');
                      setFiltroEmpresa('procuracao');
                      setForm(f => ({ ...f, allowedRoutes: [ROTA_CLIENTE_NFSE] }));
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: `2px solid ${modoCliente === 'nfse' ? 'var(--green)' : 'var(--border-light)'}`,
                      background: modoCliente === 'nfse' ? 'rgba(34,197,94,0.08)' : 'var(--bg-card2)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: modoCliente === 'nfse' ? 'var(--green)' : 'var(--text-main)' }}>
                      🧾 Somente Emissor de NFS-e
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>
                      O cliente entra <strong>direto na tela de emissão de notas fiscais</strong> da empresa vinculada (usando a procuração do escritório), sem ver telas do BPO.
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setModoCliente('bpo');
                      setFiltroEmpresa('todas');
                      setForm(f => ({
                        ...f,
                        allowedRoutes: (f.allowedRoutes || []).filter(r => r !== ROTA_CLIENTE_NFSE),
                      }));
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: `2px solid ${modoCliente === 'bpo' ? 'var(--accent)' : 'var(--border-light)'}`,
                      background: modoCliente === 'bpo' ? 'var(--accent-glow)' : 'var(--bg-card2)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: modoCliente === 'bpo' ? 'var(--accent-light)' : 'var(--text-main)' }}>
                      📊 Portal Financeiro BPO
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>
                      Para clientes de BPO Financeiro que acompanham Dashboard, Extrato, Lançamentos, Relatórios e Atas.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="form-row" style={{ marginTop: 12 }}>
              <div className="form-group">
                <label className="form-label">Nome do Usuário / Cliente *</label>
                <input
                  className="form-control"
                  placeholder="Ex: João Silva ou Nome da Empresa"
                  value={form.name || ''}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail de Login *</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="cliente@empresa.com.br"
                  value={form.email || ''}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-row" style={{ marginTop: 12 }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {!(form.role === 'cliente' && modoCliente === 'nfse') && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-main)', marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={!!form.receberEmailDiario}
                      onChange={e => setForm(f => ({ ...f, receberEmailDiario: e.target.checked }))}
                    />
                    Receber resumo financeiro diário por e-mail e WhatsApp
                  </label>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Telefone / WhatsApp (opcional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="DDD + Número (apenas números)"
                  value={form.phone || ''}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                />
              </div>
            </div>

            {/* Seleção de Empresas Vinculadas com busca e filtro */}
            {(form.role === 'cliente' || form.role === 'consultor') && (
              <div className="form-group" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                    {form.role === 'cliente' && modoCliente === 'nfse'
                      ? '1️⃣ Selecione a(s) empresa(s) que este cliente poderá emitir NFS-e *'
                      : 'Empresas Vinculadas *'}
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(
                      [
                        { id: 'todas', label: `Todas (${todasEmpresasUnificadas.length})` },
                        {
                          id: 'procuracao',
                          label: `🧾 Com procuração ativa (${todasEmpresasUnificadas.filter(e => emiteViaProcuracao(e.nfseConfig)).length})`,
                        },
                        {
                          id: 'so_emissor',
                          label: `Só Emissor (${todasEmpresasUnificadas.filter(e => e.tipo === TIPO_EMPRESA_SO_EMISSOR).length})`,
                        },
                      ] as const
                    ).map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`btn btn-sm ${filtroEmpresa === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => setFiltroEmpresa(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {emissoresEstado === 'erro' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', marginBottom: 10, borderRadius: 8, background: 'rgba(245,158,11,0.14)', color: '#f59e0b', fontSize: 12.5, fontWeight: 600 }}>
                    ⚠️ Não foi possível carregar as empresas com procuração. A lista abaixo está incompleta.
                    <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={carregarEmissores}>
                      Tentar de novo
                    </button>
                  </div>
                )}

                <div className="search-bar" style={{ marginBottom: 10 }}>
                  <span>🔍</span>
                  <input
                    placeholder="Filtrar empresa por razão social, nome fantasia ou CNPJ..."
                    value={buscaEmpresa}
                    onChange={e => setBuscaEmpresa(e.target.value)}
                  />
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: 8,
                  maxHeight: 240,
                  overflowY: 'auto',
                  padding: 10,
                  background: 'var(--bg-card2)',
                  borderRadius: 8,
                  border: '1px solid var(--border-light)',
                }}>
                  {empresasFiltradasModal.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', fontSize: 12.5, color: 'var(--text-muted)', padding: 8 }}>
                      {emissoresEstado === 'carregando'
                        ? '⏳ Carregando empresas com procuração...'
                        : <>Nenhuma empresa encontrada neste filtro. Clique em &quot;Todas&quot; ou importe o CNPJ em <strong>NFS-e → Emissores por Procuração</strong>.</>}
                    </div>
                  ) : empresasFiltradasModal.map(e => {
                    const checked = (form.empresaIds || []).includes(e.id);
                    const soEmissor = e.tipo === TIPO_EMPRESA_SO_EMISSOR;
                    const situacao = situacaoProcuracao(e.nfseConfig);
                    // No cadastro de BPO, a situação só interessa quando a procuração muda o que o cliente acessa.
                    const mostrarSituacao = soEmissor || emiteViaProcuracao(e.nfseConfig) || (form.role === 'cliente' && modoCliente === 'nfse');
                    return (
                      <label
                        key={e.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: `1px solid ${checked ? 'var(--green)' : 'var(--border-light)'}`,
                          cursor: 'pointer',
                          background: checked ? 'rgba(34,197,94,0.1)' : 'var(--bg-base)',
                          fontSize: 12.5,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: checked ? 'var(--green)' : 'var(--text-main)' }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleEmpresa(e.id)} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.nomeFantasia || e.razaoSocial}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 20, flexWrap: 'wrap' }}>
                          {e.cnpj && <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{e.cnpj}</span>}
                          {mostrarSituacao && <span className={`badge ${situacao.classe}`} style={{ fontSize: 9, padding: '1px 5px' }}>{situacao.texto}</span>}
                          {soEmissor && <span className="badge badge-gray" style={{ fontSize: 9, padding: '1px 5px' }}>Só emissor</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
                {form.role === 'cliente' && modoCliente === 'nfse' && emissoresEstado === 'ok' && selecionadasSemEmissao.length > 0 && (
                  <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.14)', color: '#f59e0b', fontSize: 12.5, fontWeight: 600 }}>
                    ⚠️ Sem procuração ativa: {selecionadasSemEmissao.map(e => e.nomeFantasia || e.razaoSocial).join(', ')}. O cliente só emite por essas empresas depois que a procuração for confirmada.
                  </div>
                )}
                {form.role === 'cliente' && modoCliente === 'bpo' && emissoresEstado === 'ok' && selecionadasComEmissao.length > 0 && (
                  <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.14)', color: '#f59e0b', fontSize: 12.5, fontWeight: 600 }}>
                    ⚠️ {selecionadasComEmissao.map(e => e.nomeFantasia || e.razaoSocial).join(', ')} tem procuração ativa: com esse vínculo, o cliente entra só na emissão de NFS-e e não vê as telas do Portal BPO.
                  </div>
                )}
                {form.role === 'cliente' && modoCliente === 'nfse' && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                    💡 Dica: você também pode criar o login do cliente direto na tela de <strong>NFS-e → 🔑 Login do Cliente</strong> ou em <strong>🏢 Emissores por Procuração</strong>.
                  </div>
                )}
              </div>
            )}

            {/* Customização baseada no tipo de acesso */}
            {form.role === 'administrador' && (
              <div style={{ marginTop: 16, padding: '16px', background: 'rgba(46, 204, 113, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--green)' }}>
                <span style={{ fontSize: 16, marginRight: 8 }}>💎</span>
                <strong>Perfil Administrador:</strong> Este usuário terá acesso irrestrito a todas as empresas, configurações, geração de arquivos de remessa, relatórios e telas do sistema.
              </div>
            )}

            {(form.role === 'consultor' || (form.role === 'cliente' && modoCliente === 'bpo')) && (
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Telas e Rotas Autorizadas (Selecione quais módulos o {form.role} poderá acessar)
                </label>
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
                          opacity: isDashboard ? 0.7 : 1,
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

            <div className="form-row" style={{ marginTop: 14 }}>
              <div className="form-group">
                <label className="form-label">Foto do Usuário (opcional)</label>
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
            </div>

            <div className="form-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={salvando}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={salvando}>
                {salvando ? '⏳ Salvando...' : '✓ Salvar Usuário'}
              </button>
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
