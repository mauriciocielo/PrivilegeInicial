'use client';
import { useRouter, usePathname } from 'next/navigation';
import { store, User, Empresa } from '../lib/store';
import { useState, useEffect } from 'react';
import BrandLogo from './BrandLogo';

const getAvatarGradient = (name: string) => {
  const colors = [
    ['#8c1a22', '#52080d'], // wine
    ['#3b82f6', '#1d4ed8'], // blue
    ['#10b981', '#047857'], // green
    ['#f59e0b', '#b45309'], // amber
    ['#8b5cf6', '#6d28d9'], // purple
    ['#ec4899', '#be185d'], // pink
  ];
  const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [c1, c2] = colors[charCodeSum % colors.length];
  return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
};

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const consultorNav: { section: string; items: NavItem[] }[] = [
  {
    section: 'Principal',
    items: [
      { label: 'Administrativo', href: '/consultor/administrativo', icon: '⚙️' },
      { label: 'Dashboard', href: '/consultor/dashboard', icon: '📊' },
      { label: 'Inteligência Financeira', href: '/consultor/inteligencia', icon: '🧠' },
      { label: 'Lançamentos', href: '/consultor/lancamentos', icon: '📝' },
      { label: 'Importar OFX', href: '/consultor/importar-ofx', icon: '📂' },
      { label: 'Endividamento', href: '/consultor/endividamento', icon: '⚖️' },
      { label: 'Indicadores', href: '/consultor/indicadores', icon: '🎯' },
      { label: 'Orçamento', href: '/consultor/orcamento', icon: '💰' },
    ],
  },
  {
    section: 'Financeiro',
    items: [
      { label: 'Clientes / Fornecedores', href: '/consultor/clientes', icon: '👥' },
      { label: 'Contas a Pagar', href: '/consultor/contas-pagar', icon: '💸' },
      { label: 'Contas a Receber', href: '/consultor/contas-receber', icon: '💵' },
      { label: 'NFS-e', href: '/consultor/nfse', icon: '🧾' },
      { label: 'Integração C6 Bank', href: '/consultor/integracao-c6', icon: '🏦' },
      { label: 'Políticas Financeiras', href: '/consultor/politicas', icon: '📋' },
    ],
  },
  {
    section: 'Cadastros',
    items: [
      { label: 'Empresas', href: '/consultor/empresas', icon: '🏢' },
      { label: 'Usuários', href: '/consultor/usuarios', icon: '👥' },
      { label: 'Plano de Contas', href: '/consultor/plano-de-contas', icon: '📋' },
      { label: 'Atas de Atendimento', href: '/consultor/atas', icon: '📝' },
      { label: 'Portadores', href: '/consultor/portadores', icon: '🏦' },
    ],
  },
  {
    section: 'Relatórios',
    items: [
      { label: 'Relatórios', href: '/consultor/relatorios', icon: '📈' },
    ],
  },
];

const clienteNav: { section: string; items: NavItem[] }[] = [
  {
    section: 'Minha Empresa',
    items: [
      { label: 'Dashboard', href: '/cliente/dashboard', icon: '📊' },
      { label: 'Inteligência Financeira', href: '/cliente/inteligencia', icon: '🧠' },
      { label: 'Extrato', href: '/cliente/extrato', icon: '📋' },
      { label: 'Lançamentos', href: '/cliente/lancamentos', icon: '📝' },
      { label: 'Atas de Atendimento', href: '/cliente/atas', icon: '📝' },
      { label: 'Políticas Financeiras', href: '/cliente/politicas', icon: '📋' },
      { label: 'Relatórios', href: '/cliente/relatorios', icon: '📈' },
    ],
  },
];

const condominioNav: { section: string; items: NavItem[] }[] = [
  {
    section: 'Condomínios',
    items: [
      { label: 'Painel Condomínio', href: '/consultor/condominio', icon: '🏘️' },
      { label: 'Importar OFX', href: '/consultor/importar-ofx', icon: '📂' },
      { label: 'Atas de Reunião', href: '/consultor/atas', icon: '📝' },
      { label: 'Portadores / Contas', href: '/consultor/portadores', icon: '🏦' },
    ],
  },
  {
    section: 'Cadastros',
    items: [
      { label: 'Configurar Condos', href: '/consultor/empresas', icon: '⚙️' },
      { label: 'Usuários Síndicos', href: '/consultor/usuarios', icon: '👥' },
      { label: 'Plano de Contas', href: '/consultor/plano-de-contas', icon: '📋' },
    ]
  }
];
export default function Sidebar({ role }: { role: 'administrador' | 'consultor' | 'cliente' }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [appMode, setAppMode] = useState<'empresarial' | 'condominio'>('empresarial');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'idle'>('idle');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Sincronização de status do banco
    const initialStatus = sessionStorage.getItem('cf_postgres_synced') === 'true' ? 'synced' : 'idle';
    setSyncStatus(initialStatus);

    const handleSyncStatus = (e: Event) => {
      setSyncStatus((e as CustomEvent).detail);
    };
    window.addEventListener('cfSyncStatus', handleSyncStatus);
    return () => window.removeEventListener('cfSyncStatus', handleSyncStatus);
  }, []);

  useEffect(() => {
    // Carregamento de tema
    const saved = localStorage.getItem('cf_theme') || 'light';
    setTheme(saved as 'light' | 'dark');
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('cf_theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  // Estados customizados para Premium UI
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const [isSidebarCompact, setIsSidebarCompact] = useState(false);
  const [searchEmpresa, setSearchEmpresa] = useState('');
  const [recentEmpresas, setRecentEmpresas] = useState<string[]>([]);

  useEffect(() => {
    const savedRecents = localStorage.getItem('cf_recent_empresas');
    if (savedRecents) {
      try {
        setRecentEmpresas(JSON.parse(savedRecents));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cf_sidebar_compact') === 'true';
      setIsSidebarCompact(saved);
      // Dispatch immediately to synchronize outer layouts
      window.dispatchEvent(new CustomEvent('cfSidebarCompactChange', { detail: saved }));
    }
  }, []);

  const toggleCompact = () => {
    const next = !isSidebarCompact;
    setIsSidebarCompact(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cf_sidebar_compact', String(next));
      window.dispatchEvent(new CustomEvent('cfSidebarCompactChange', { detail: next }));
    }
  };

  const [pendenciasReconciliacao, setPendenciasReconciliacao] = useState(0);

  // Carregar contagem de pendências de conciliação
  useEffect(() => {
    const updatePendencias = () => {
      if (selectedEmpresa) {
        const isGroup = selectedEmpresa.startsWith('grupo:');
        let totalPending = 0;
        if (isGroup) {
          const gName = selectedEmpresa.split(':')[1];
          const emps = store.getEmpresas().filter(e => e.grupoEconomico === gName);
          emps.forEach(emp => {
            const ports = store.getPortadores(emp.id);
            ports.forEach(port => {
              totalPending += store.getOfxPendingTransactions(port.id, emp.id).length;
            });
          });
        } else {
          const ports = store.getPortadores(selectedEmpresa);
          ports.forEach(port => {
            totalPending += store.getOfxPendingTransactions(port.id, selectedEmpresa).length;
          });
        }
        setPendenciasReconciliacao(totalPending);
      }
    };

    updatePendencias();
    window.addEventListener('lancamentoChange', updatePendencias);
    window.addEventListener('empresaChange', updatePendencias);
    return () => {
      window.removeEventListener('lancamentoChange', updatePendencias);
      window.removeEventListener('empresaChange', updatePendencias);
    };
  }, [selectedEmpresa]);

  const activeEmpresa = selectedEmpresa.startsWith('grupo:')
    ? {
        id: selectedEmpresa,
        razaoSocial: `Grupo Consolidado - ${selectedEmpresa.split(':')[1]}`,
        nomeFantasia: `Grupo ${selectedEmpresa.split(':')[1]}`,
        cnpj: '',
        responsavel: '',
        email: '',
        telefone: '',
        createdAt: '',
        logoData: undefined
      }
    : empresas.find(e => e.id === selectedEmpresa);

  const isConsultorOrAdmin = role === 'consultor' || role === 'administrador';

  const selectableEmpresas = Array.from(new Map(empresas.map(e => [e.id, e])).values());

  // Obter grupos econômicos únicos
  const gruposEconomicos = Array.from(new Set(
    selectableEmpresas
      .map(e => e.grupoEconomico)
      .filter((g): g is string => !!g && g.trim() !== '')
  ));

  useEffect(() => {
    const u = store.getCurrentUser();
    setUser(u);
    if (u) {
      const all = store.getEmpresas();
      const allowed = role === 'administrador' ? all : all.filter(e => u.empresaIds?.includes(e.id));
      setEmpresas(allowed);

      const saved = sessionStorage.getItem('cf_empresa_sel');
      let targetId = '';
      if (saved && (saved.startsWith('grupo:') || allowed.find(e => e.id === saved))) {
        targetId = saved;
      } else if (allowed.length > 0) {
        targetId = allowed[0].id;
      }

      setSelectedEmpresa(targetId);
      if (targetId) {
        sessionStorage.setItem('cf_empresa_sel', targetId);
        const isGroup = targetId.startsWith('grupo:');
        let initialMode: 'empresarial' | 'condominio' = 'empresarial';
        if (!isGroup) {
          const emp = allowed.find(e => e.id === targetId);
          if (emp && emp.tipo === 'condominio') {
            initialMode = 'condominio';
          }
          // cooperativa uses empresarial nav
        }
        setAppMode(initialMode);
        sessionStorage.setItem('cf_app_mode', initialMode);
      } else {
        setAppMode('empresarial');
        sessionStorage.removeItem('cf_app_mode');
      }
    }
  }, [role, isConsultorOrAdmin]);

  const handleModeChange = (mode: 'empresarial' | 'condominio') => {
    setAppMode(mode);
    sessionStorage.setItem('cf_app_mode', mode);
    
    const all = store.getEmpresas();
    const u = store.getCurrentUser();
    if (u) {
      const allowed = isConsultorOrAdmin ? all : all.filter(e => u.empresaIds.includes(e.id));
      const filtered = allowed.filter(e => mode === 'condominio' ? e.tipo === 'condominio' : e.tipo !== 'condominio'); // cooperativa falls into empresarial
      
      if (filtered.length > 0) {
        setSelectedEmpresa(filtered[0].id);
        sessionStorage.setItem('cf_empresa_sel', filtered[0].id);
        window.dispatchEvent(new CustomEvent('empresaChange', { detail: filtered[0].id }));
      } else {
        setSelectedEmpresa('');
        sessionStorage.removeItem('cf_empresa_sel');
        window.dispatchEvent(new CustomEvent('empresaChange', { detail: '' }));
      }
    }
  };

  const handleEmpresaChange = (id: string) => {
    setSelectedEmpresa(id);
    sessionStorage.setItem('cf_empresa_sel', id);

    setRecentEmpresas(prev => {
      const newRecents = [id, ...prev.filter(x => x !== id)].slice(0, 3);
      localStorage.setItem('cf_recent_empresas', JSON.stringify(newRecents));
      return newRecents;
    });

    // Auto-detect mode based on selected company type
    const isGroup = id.startsWith('grupo:');
    let nextMode: 'empresarial' | 'condominio' = 'empresarial';
    if (!isGroup) {
      const emp = empresas.find(e => e.id === id);
      if (emp && emp.tipo === 'condominio') {
        nextMode = 'condominio';
      }
      // emp.tipo === 'cooperativa' stays as 'empresarial'
    }
    setAppMode(nextMode);
    sessionStorage.setItem('cf_app_mode', nextMode);

    window.dispatchEvent(new CustomEvent('empresaChange', { detail: id }));
    setShowCompanyDropdown(false);
    setSearchEmpresa('');
  };

  const handleLogout = () => {
    store.setCurrentUser(null);
    router.push('/');
  };

  const getFilteredNav = () => {
    if (role === 'cliente') return clienteNav;
    const baseNav = appMode === 'condominio' ? condominioNav : consultorNav;

    // Filtra rotas com base na configuração da empresa ativa
    const companyAllowed = (!selectedEmpresa.startsWith('grupo:') && activeEmpresa?.allowedRoutes) || [];
    const filterByCompany = (item: NavItem) => {
      if (item.href === '/consultor/dashboard') return true;
      if (item.href === '/consultor/administrativo') return true; // ALWAYS allow administrative screen!
      if (companyAllowed.length > 0) {
        return companyAllowed.some(route => item.href.startsWith(route));
      }
      return true;
    };

    if (role === 'administrador') {
      return baseNav.map(section => {
        const items = section.items.filter(filterByCompany);
        return { ...section, items };
      }).filter(section => section.items.length > 0);
    }

    // Se consultor, filtra itens do consultor + empresa
    const allowed = user?.allowedRoutes || ['/consultor/dashboard'];
    
    return baseNav.map(section => {
      const items = section.items.filter(item => {
        if (item.href === '/consultor/dashboard') return true;
        const userOk = allowed.some(route => item.href.startsWith(route));
        const companyOk = filterByCompany(item);
        return userOk && companyOk;
      });
      return { ...section, items };
    }).filter(section => section.items.length > 0);
  };

  const nav = getFilteredNav();
  const initials = user?.name?.split(' ').map(w => w[0]).slice(0, 2).join('') || 'U';

  return (
    <aside className={`sidebar ${isSidebarCompact ? 'compact' : ''}`} style={{ width: isSidebarCompact ? '70px' : 'var(--sidebar-w)' }}>
      <div 
        className="sidebar-logo" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          cursor: 'pointer',
          justifyContent: isSidebarCompact ? 'center' : 'space-between'
        }}
      >
        {!isSidebarCompact && (
          <div onClick={() => router.push(role === 'cliente' ? '/cliente/dashboard' : '/consultor/dashboard')}>
            <BrandLogo size={36} subtitle={isConsultorOrAdmin ? 'Portal do Consultor' : 'Portal do Cliente'} />
          </div>
        )}
        {isSidebarCompact && (
          <div style={{ fontSize: 20 }} onClick={() => router.push(role === 'cliente' ? '/cliente/dashboard' : '/consultor/dashboard')}>🛸</div>
        )}
        <button 
          onClick={toggleCompact}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '4px'
          }}
          title={isSidebarCompact ? "Expandir Menu" : "Recolher Menu"}
        >
          {isSidebarCompact ? '⏩' : '⏪'}
        </button>
      </div>



      {/* Switcher customizado Premium e Grupo Econômico */}
      {selectableEmpresas.length > 0 && !isSidebarCompact && (
        <div className="sidebar-empresa" style={{ position: 'relative', border: '1px solid var(--border)', background: 'var(--bg-card2)', padding: '10px 12px', borderRadius: '8px', margin: '0 16px 16px 16px' }}>
          <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            {appMode === 'condominio' ? 'Condomínio / Grupo Ativo' : 'Empresa / Grupo Ativo'}
          </label>
          <div 
            onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 8px', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-light)', minHeight: '36px' }}
          >
            {activeEmpresa?.logoData ? (
              <img 
                src={activeEmpresa.logoData} 
                alt="Logo" 
                style={{ height: '20px', width: '20px', objectFit: 'contain', borderRadius: '4px' }} 
              />
            ) : (
              <span style={{ fontSize: '14px' }}>🏢</span>
            )}
            <span style={{ flex: 1, fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
              {activeEmpresa?.nomeFantasia || activeEmpresa?.razaoSocial}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>▼</span>
          </div>

          {showCompanyDropdown && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', zIndex: 1000, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)', marginTop: '4px', maxHeight: '350px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '8px', borderBottom: '1px solid var(--border-light)' }}>
                <input 
                  type="text" 
                  placeholder="🔍 Buscar..." 
                  value={searchEmpresa}
                  onChange={e => setSearchEmpresa(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-body)', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ overflowY: 'auto', padding: '6px', flex: 1 }}>
              {(() => {
                const searchLower = searchEmpresa.toLowerCase();
                const filteredGrupos = gruposEconomicos.filter(g => g.toLowerCase().includes(searchLower));
                const filteredEmpresas = selectableEmpresas.filter(e => 
                  e.tipo !== 'condominio' && e.tipo !== 'cooperativa' &&
                  (e.razaoSocial.toLowerCase().includes(searchLower) || (e.nomeFantasia && e.nomeFantasia.toLowerCase().includes(searchLower)))
                );
                const filteredCondominios = selectableEmpresas.filter(e => 
                  e.tipo === 'condominio' &&
                  (e.razaoSocial.toLowerCase().includes(searchLower) || (e.nomeFantasia && e.nomeFantasia.toLowerCase().includes(searchLower)))
                );
                const filteredCooperativas = selectableEmpresas.filter(e => 
                  e.tipo === 'cooperativa' &&
                  (e.razaoSocial.toLowerCase().includes(searchLower) || (e.nomeFantasia && e.nomeFantasia.toLowerCase().includes(searchLower)))
                );

                const recentsObjs = searchEmpresa === '' ? recentEmpresas
                  .map(id => id.startsWith('grupo:') ? { id, razaoSocial: `Grupo Consolidado - ${id.split(':')[1]}`, nomeFantasia: `Grupo ${id.split(':')[1]}`, isGroup: true } : selectableEmpresas.find(e => e.id === id))
                  .filter(Boolean) as any[] : [];

                return (
                  <>
                    {searchEmpresa === '' && recentsObjs.length > 0 && (
                      <>
                        <div style={{ padding: '6px 8px', fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🕒 Recentes</div>
                        {recentsObjs.map((e, idx) => (
                          <div 
                            key={`recent:${e.id}:${idx}`}
                            onClick={() => handleEmpresaChange(e.id)}
                            style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', cursor: 'pointer', background: selectedEmpresa === e.id ? 'var(--border-light)' : 'transparent', color: 'var(--text-primary)', fontSize: '12px' }}
                            className="company-select-item"
                          >
                            {e.isGroup ? <span>🌐</span> : e.logoData ? (
                              <img src={e.logoData} alt="" style={{ height: '16px', width: '16px', objectFit: 'contain', borderRadius: '3px' }} />
                            ) : (
                              <span>{e.tipo === 'condominio' ? '🏘️' : e.tipo === 'cooperativa' ? '🤝' : '🏢'}</span>
                            )}
                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: e.isGroup ? 600 : 400 }}>
                              {e.nomeFantasia || e.razaoSocial}
                            </span>
                          </div>
                        ))}
                        <div style={{ height: '1px', background: 'var(--border-light)', margin: '6px 0' }} />
                      </>
                    )}

                    {filteredGrupos.length > 0 && (
                      <>
                        <div style={{ padding: '6px 8px', fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grupos Econômicos</div>
                        {filteredGrupos.map(g => (
                          <div 
                            key={`grupo:${g}`}
                            onClick={() => handleEmpresaChange(`grupo:${g}`)}
                            style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', cursor: 'pointer', background: selectedEmpresa === `grupo:${g}` ? 'var(--border-light)' : 'transparent', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}
                            className="company-select-item"
                          >
                            <span>🌐</span>
                            <span>Grupo {g} (Consolidado)</span>
                          </div>
                        ))}
                        <div style={{ height: '1px', background: 'var(--border-light)', margin: '6px 0' }} />
                      </>
                    )}
                    
                    {/* Empresas Group */}
                    {filteredEmpresas.length > 0 && (
                      <>
                        <div style={{ padding: '6px 8px', fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empresas</div>
                        {filteredEmpresas.map(e => (
                          <div 
                            key={e.id}
                            onClick={() => handleEmpresaChange(e.id)}
                            style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', cursor: 'pointer', background: selectedEmpresa === e.id ? 'var(--border-light)' : 'transparent', color: 'var(--text-primary)', fontSize: '12px' }}
                            className="company-select-item"
                          >
                            {e.logoData ? (
                              <img src={e.logoData} alt="" style={{ height: '16px', width: '16px', objectFit: 'contain', borderRadius: '3px' }} />
                            ) : (
                              <span>🏢</span>
                            )}
                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.nomeFantasia || e.razaoSocial}</span>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Cooperativas Group */}
                    {filteredCooperativas.length > 0 && (
                      <>
                        <div style={{ height: '1px', background: 'var(--border-light)', margin: '6px 0' }} />
                        <div style={{ padding: '6px 8px', fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🤝 Cooperativas</div>
                        {filteredCooperativas.map(e => (
                          <div 
                            key={e.id}
                            onClick={() => handleEmpresaChange(e.id)}
                            style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', cursor: 'pointer', background: selectedEmpresa === e.id ? 'var(--border-light)' : 'transparent', color: 'var(--text-primary)', fontSize: '12px' }}
                            className="company-select-item"
                          >
                            {e.logoData ? (
                              <img src={e.logoData} alt="" style={{ height: '16px', width: '16px', objectFit: 'contain', borderRadius: '3px' }} />
                            ) : (
                              <span>🤝</span>
                            )}
                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.nomeFantasia || e.razaoSocial}</span>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Condomínios Group */}
                    {filteredCondominios.length > 0 && (
                      <>
                        <div style={{ height: '1px', background: 'var(--border-light)', margin: '6px 0' }} />
                        <div style={{ padding: '6px 8px', fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏘️ Condomínios</div>
                        {filteredCondominios.map(e => (
                          <div 
                            key={e.id}
                            onClick={() => handleEmpresaChange(e.id)}
                            style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', cursor: 'pointer', background: selectedEmpresa === e.id ? 'var(--border-light)' : 'transparent', color: 'var(--text-primary)', fontSize: '12px' }}
                            className="company-select-item"
                          >
                            {e.logoData ? (
                              <img src={e.logoData} alt="" style={{ height: '16px', width: '16px', objectFit: 'contain', borderRadius: '3px' }} />
                            ) : (
                              <span>🏘️</span>
                            )}
                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.nomeFantasia || e.razaoSocial}</span>
                          </div>
                        ))}
                      </>
                    )}

                    {filteredGrupos.length === 0 && filteredEmpresas.length === 0 && filteredCondominios.length === 0 && filteredCooperativas.length === 0 && (
                      <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                        Nenhum resultado encontrado.
                      </div>
                    )}
                  </>
                );
              })()}
              </div>
            </div>
          )}
        </div>
      )}

      <nav className="sidebar-nav" style={{ flex: 1, padding: isSidebarCompact ? '0 10px' : '0 16px' }}>
        {nav.map(section => (
          <div key={section.section}>
            {!isSidebarCompact && (
              <div className="nav-section">
                <span className="nav-section-label">{section.section}</span>
              </div>
            )}
            {section.items.map(item => {
              const isActive = pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={e => { e.preventDefault(); router.push(item.href); }}
                  title={isSidebarCompact ? item.label : ''}
                  style={{
                    justifyContent: isSidebarCompact ? 'center' : 'flex-start',
                    padding: isSidebarCompact ? '10px 0' : '8px 12px',
                    borderRadius: '8px',
                    margin: '2px 0'
                  }}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {!isSidebarCompact && item.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer" style={{ padding: isSidebarCompact ? '12px' : '16px' }}>
        {/* Central de Notificações com ícone de Alertas (sino 🔔) */}
        {pendenciasReconciliacao > 0 && (
          <div 
            onClick={() => router.push(role === 'cliente' ? '/cliente/extrato' : '/consultor/importar-ofx')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarCompact ? 'center' : 'flex-start',
              gap: 8,
              fontSize: 11,
              fontWeight: 600,
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--yellow)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              marginBottom: 12,
              cursor: 'pointer'
            }}
            title={`${pendenciasReconciliacao} conciliações pendentes!`}
          >
            <span className="pulse-glow" style={{ fontSize: 14 }}>🔔</span>
            {!isSidebarCompact && (
              <span style={{ flex: 1 }}>{pendenciasReconciliacao} Pendentes</span>
            )}
          </div>
        )}

        {/* Glow Sync status indicator */}
        {syncStatus !== 'idle' && !isSidebarCompact && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 10,
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 20,
            background: syncStatus === 'synced' ? 'var(--green-bg)' : syncStatus === 'syncing' ? 'var(--yellow-bg)' : 'var(--red-bg)',
            color: syncStatus === 'synced' ? 'var(--green)' : syncStatus === 'syncing' ? 'var(--yellow)' : 'var(--red)',
            border: `1px solid ${syncStatus === 'synced' ? 'rgba(16, 185, 129, 0.2)' : syncStatus === 'syncing' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            marginBottom: 12,
            justifyContent: 'center',
          }}>
            <span 
              className={syncStatus === 'syncing' ? 'pulse-glow' : ''}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: syncStatus === 'synced' ? 'var(--green)' : syncStatus === 'syncing' ? 'var(--yellow)' : 'var(--red)',
                display: 'inline-block',
                boxShadow: `0 0 8px ${syncStatus === 'synced' ? 'var(--green)' : syncStatus === 'syncing' ? 'var(--yellow)' : 'var(--red)'}`
              }} 
            />
            {syncStatus === 'synced' ? 'NUVEM ATUALIZADA' : syncStatus === 'syncing' ? 'SALVANDO NA NUVEM...' : 'ERRO AO SALVAR'}
          </div>
        )}

        {/* Popover de Perfil */}
        <div style={{ position: 'relative' }}>
          <div 
            className="user-card" 
            onClick={() => setShowProfilePopover(!showProfilePopover)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: isSidebarCompact ? '4px' : '8px', justifyContent: isSidebarCompact ? 'center' : 'flex-start' }}
          >
            <div 
              className="user-avatar" 
              style={{ 
                position: 'relative', 
                overflow: 'hidden', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                width: '32px', 
                height: '32px', 
                minWidth: '32px',
                background: user ? getAvatarGradient(user.name) : undefined
              }}
            >
              {user?.avatarData ? (
                <img 
                  src={user.avatarData} 
                  alt={user.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} 
                />
              ) : (
                initials
              )}
            </div>
            {!isSidebarCompact && (
              <div className="user-info" style={{ flex: 1, overflow: 'hidden' }}>
                <div className="user-name" style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
                <div className="user-role" style={{ fontSize: '10px' }}>
                  {role === 'administrador' ? '💎 Admin' : role === 'consultor' ? '👔 Consultor' : '🏢 Cliente'}
                </div>
              </div>
            )}
          </div>

          {showProfilePopover && (
            <div 
              style={{ 
                position: 'absolute', 
                bottom: '100%', 
                left: isSidebarCompact ? '50px' : '0', 
                width: '220px', 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border)', 
                borderRadius: '8px', 
                boxShadow: '0 -10px 15px -3px rgba(0, 0, 0, 0.3)', 
                padding: '12px', 
                zIndex: 1001,
                marginBottom: '8px'
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{user?.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{user?.email}</div>
              <div style={{ height: '1px', background: 'var(--border-light)', margin: '8px 0' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Tema</span>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={toggleTheme}
                  >
                    {theme === 'dark' ? '☀️ Claro' : '🌙 Escuro'}
                  </button>
                </div>
                <button className="btn btn-secondary btn-sm" style={{ width: '100%', textAlign: 'left', display: 'flex', gap: '6px', alignItems: 'center' }} onClick={handleLogout}>
                  🚪 Sair da Conta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
