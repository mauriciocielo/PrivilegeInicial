'use client';
import { useRouter, usePathname } from 'next/navigation';
import { store, User, Empresa } from '../lib/store';
import { useState, useEffect } from 'react';
import BrandLogo from './BrandLogo';
import {
  Settings, LayoutDashboard, Lightbulb, BrainCircuit, Radar, CalendarDays, Timer,
  NotebookPen, FolderInput, Scale, Target, Wallet, Users, CreditCard, Banknote,
  ReceiptText, Landmark, ClipboardList, Building2, ListTree, Tag, FileText,
  ShieldCheck, BarChart3, Truck, Car, Fuel, PiggyBank, Building, ScrollText,
  UserCog, ChevronsLeft, ChevronsRight, Search, Globe, Clock, ChevronDown,
  Bell, LogOut, Sun, Moon, Handshake, Gem, Briefcase, type LucideIcon,
} from 'lucide-react';

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
  icon: LucideIcon;
  adminOnly?: boolean;
}

const consultorNav: { section: string; items: NavItem[] }[] = [
  {
    section: 'Principal',
    items: [
      { label: 'Administrativo', href: '/consultor/administrativo', icon: Settings },
      { label: 'Dashboard', href: '/consultor/dashboard', icon: LayoutDashboard },
      { label: 'Inteligência Tributária', href: '/consultor/inteligencia-tributaria', icon: Lightbulb },
      { label: 'Inteligência Financeira', href: '/consultor/inteligencia', icon: BrainCircuit },
      { label: 'Diagnóstico 360º', href: '/consultor/diagnostico-360', icon: Radar },
      { label: 'Agenda Semanal', href: '/consultor/agenda', icon: CalendarDays },
      { label: 'Atividades e Tempo', href: '/consultor/atividades', icon: Timer },
      { label: 'Lançamentos', href: '/consultor/lancamentos', icon: NotebookPen },
      { label: 'Importar OFX', href: '/consultor/importar-ofx', icon: FolderInput },
      { label: 'Endividamento', href: '/consultor/endividamento', icon: Scale },
      { label: 'Indicadores', href: '/consultor/indicadores', icon: Target },
      { label: 'Orçamento', href: '/consultor/orcamento', icon: PiggyBank },
    ],
  },
  {
    section: 'Financeiro',
    items: [
      { label: 'Clientes / Fornecedores', href: '/consultor/clientes', icon: Users },
      { label: 'Contas a Pagar', href: '/consultor/contas-pagar', icon: CreditCard },
      { label: 'Contas a Receber', href: '/consultor/contas-receber', icon: Banknote },
      { label: 'NFS-e / Emissão', href: '/consultor/nfse', icon: ReceiptText },
      { label: 'APIs Open Finance', href: '/consultor/open-finance', icon: Landmark },
      { label: 'Políticas Financeiras', href: '/consultor/politicas', icon: ClipboardList },
    ],
  },
  {
    section: 'Cadastros',
    items: [
      { label: 'Empresas', href: '/consultor/empresas', icon: Building2 },
      { label: 'Usuários', href: '/consultor/usuarios', icon: UserCog },
      { label: 'Plano de Contas', href: '/consultor/plano-de-contas', icon: ListTree },
      { label: 'Centros de Custo', href: '/consultor/centros-custo', icon: Tag },
      { label: 'Atas de Atendimento', href: '/consultor/atas', icon: FileText },
      { label: 'Portadores', href: '/consultor/portadores', icon: Wallet },
      { label: 'Segurança & Auditoria', href: '/consultor/configuracoes-avancadas', icon: ShieldCheck, adminOnly: true },
    ],
  },
  {
    section: 'Relatórios',
    items: [
      { label: 'Relatórios', href: '/consultor/relatorios', icon: BarChart3 },
    ],
  },
  {
    section: 'Logística',
    items: [
      { label: 'Dashboard Frota', href: '/consultor/logistica/dashboard', icon: Truck },
      { label: 'Veículos e Motoristas', href: '/consultor/logistica/veiculos', icon: Car },
      { label: 'Controle de Gastos', href: '/consultor/logistica/despesas', icon: Fuel },
      { label: 'Orçamentos', href: '/consultor/logistica/orcamentos', icon: Target },
    ],
  },
];

const clienteNav: { section: string; items: NavItem[] }[] = [
  {
    section: 'Minha Empresa',
    items: [
      { label: 'Dashboard', href: '/cliente/dashboard', icon: LayoutDashboard },
      { label: 'Inteligência Financeira', href: '/cliente/inteligencia', icon: BrainCircuit },
      { label: 'Extrato', href: '/cliente/extrato', icon: ScrollText },
      { label: 'Lançamentos', href: '/cliente/lancamentos', icon: NotebookPen },
      { label: 'Atas de Atendimento', href: '/cliente/atas', icon: FileText },
      { label: 'Políticas Financeiras', href: '/cliente/politicas', icon: ClipboardList },
      { label: 'Relatórios', href: '/cliente/relatorios', icon: BarChart3 },
    ],
  },
  {
    section: 'Logística',
    items: [
      { label: 'Dashboard Frota', href: '/cliente/logistica/dashboard', icon: Truck },
      { label: 'Veículos e Motoristas', href: '/cliente/logistica/veiculos', icon: Car },
      { label: 'Controle de Gastos', href: '/cliente/logistica/despesas', icon: Fuel },
      { label: 'Orçamentos', href: '/cliente/logistica/orcamentos', icon: Target },
    ],
  },
];

const condominioNav: { section: string; items: NavItem[] }[] = [
  {
    section: 'Condomínios',
    items: [
      { label: 'Painel Condomínio', href: '/consultor/condominio', icon: Building },
      { label: 'Importar OFX', href: '/consultor/importar-ofx', icon: FolderInput },
      { label: 'Atas de Reunião', href: '/consultor/atas', icon: FileText },
      { label: 'Portadores / Contas', href: '/consultor/portadores', icon: Wallet },
    ],
  },
  {
    section: 'Cadastros',
    items: [
      { label: 'Configurar Condos', href: '/consultor/empresas', icon: Settings },
      { label: 'Usuários Síndicos', href: '/consultor/usuarios', icon: Users },
      { label: 'Plano de Contas', href: '/consultor/plano-de-contas', icon: ListTree },
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
    if (role === 'cliente') {
      const allowedClient = user?.allowedRoutes || [];
      if (allowedClient.length === 0) return clienteNav; // backward compatibility for clients that have no allowedRoutes configured yet
      return clienteNav.map(section => {
        const items = section.items.filter(item => {
          if (item.href === '/cliente/dashboard') return true;
          return allowedClient.some(route => item.href.startsWith(route));
        });
        return { ...section, items };
      }).filter(section => section.items.length > 0);
    }
    const baseNav = appMode === 'condominio' ? condominioNav : consultorNav;

    // Filtra rotas com base na configuração da empresa ativa
    const companyAllowed = (!selectedEmpresa.startsWith('grupo:') && activeEmpresa?.allowedRoutes) || [];
    const filterByCompany = (item: NavItem) => {
      if (item.href === '/consultor/dashboard') return true;
      if (item.href === '/consultor/administrativo') return true;
      if (companyAllowed.length > 0) {
        return companyAllowed.some(route => item.href.startsWith(route));
      }
      return true;
    };

    if (role === 'administrador') {
      return baseNav;
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
          <div
            className="logo-icon"
            style={{ cursor: 'pointer' }}
            onClick={() => router.push(role === 'cliente' ? '/cliente/dashboard' : '/consultor/dashboard')}
          >
            <Landmark size={18} color="#fff" strokeWidth={2.2} />
          </div>
        )}
        <button
          onClick={toggleCompact}
          className="sidebar-collapse-btn"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={isSidebarCompact ? "Expandir Menu" : "Recolher Menu"}
        >
          {isSidebarCompact ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>



      {/* Switcher customizado Premium e Grupo Econômico */}
      {selectableEmpresas.length > 0 && !isSidebarCompact && (
        <div className="sidebar-empresa" style={{ position: 'relative', padding: '10px 12px', borderRadius: '10px', margin: '0 12px 12px 12px' }}>
          <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-sidebar)', fontWeight: 700, display: 'block', marginBottom: '6px', letterSpacing: '1px' }}>
            {appMode === 'condominio' ? 'Condomínio / Grupo Ativo' : 'Empresa / Grupo Ativo'}
          </label>
          <div 
            onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '7px 10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-sidebar)', minHeight: '36px', transition: 'all 0.15s' }}
          >
            {activeEmpresa?.logoData ? (
              <img
                src={activeEmpresa.logoData}
                alt="Logo"
                style={{ height: '20px', width: '20px', objectFit: 'contain', borderRadius: '4px' }}
              />
            ) : (
              <Building2 size={14} color="var(--text-sidebar)" />
            )}
            <span style={{ flex: 1, fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-sidebar-title)' }}>
              {activeEmpresa?.nomeFantasia || activeEmpresa?.razaoSocial}
            </span>
            <ChevronDown
              size={13}
              color="var(--text-sidebar)"
              style={{ transition: 'transform var(--dur-base) var(--ease-out)', transform: showCompanyDropdown ? 'rotate(180deg)' : 'none' }}
            />
          </div>

          {showCompanyDropdown && (
            <div className="dropdown-anim-down" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-sidebar)', borderRadius: '10px', zIndex: 1000, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.6)', marginTop: '6px', maxHeight: '340px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '8px', borderBottom: '1px solid var(--border-sidebar)', position: 'relative' }}>
                <Search size={13} color="var(--text-sidebar)" style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchEmpresa}
                  onChange={e => setSearchEmpresa(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: '100%', padding: '7px 10px 7px 28px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border-sidebar)', background: 'var(--bg-sidebar-hover)', color: 'var(--text-sidebar-title)' }}
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
                        <div style={{ padding: '6px 8px', fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}><Clock size={11} /> Recentes</div>
                        {recentsObjs.map((e, idx) => (
                          <div
                            key={`recent:${e.id}:${idx}`}
                            onClick={() => handleEmpresaChange(e.id)}
                            style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '7px', cursor: 'pointer', background: selectedEmpresa === e.id ? 'rgba(140,26,34,0.1)' : 'transparent', color: selectedEmpresa === e.id ? '#8c1a22' : 'var(--text-sidebar-title)', fontSize: '13px', transition: 'background 0.1s', fontWeight: selectedEmpresa === e.id ? 700 : 500 }}
                            className="company-select-item"
                          >
                            {e.isGroup ? <Globe size={14} /> : e.logoData ? (
                              <img src={e.logoData} alt="" style={{ height: '16px', width: '16px', objectFit: 'contain', borderRadius: '3px' }} />
                            ) : (
                              e.tipo === 'condominio' ? <Building size={14} /> : e.tipo === 'cooperativa' ? <Handshake size={14} /> : <Building2 size={14} />
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
                            style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '7px', cursor: 'pointer', background: selectedEmpresa === `grupo:${g}` ? 'rgba(140,26,34,0.1)' : 'transparent', color: selectedEmpresa === `grupo:${g}` ? '#8c1a22' : 'var(--text-sidebar-title)', fontSize: '13px', fontWeight: selectedEmpresa === `grupo:${g}` ? 700 : 600 }}
                            className="company-select-item"
                          >
                            <Globe size={14} />
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
                            style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '7px', cursor: 'pointer', background: selectedEmpresa === e.id ? 'rgba(140,26,34,0.1)' : 'transparent', color: selectedEmpresa === e.id ? '#8c1a22' : 'var(--text-sidebar-title)', fontSize: '13px', transition: 'background 0.1s', fontWeight: selectedEmpresa === e.id ? 700 : 500 }}
                            className="company-select-item"
                          >
                            {e.logoData ? (
                              <img src={e.logoData} alt="" style={{ height: '16px', width: '16px', objectFit: 'contain', borderRadius: '3px' }} />
                            ) : (
                              <Building2 size={14} />
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
                        <div style={{ padding: '6px 8px', fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}><Handshake size={11} /> Cooperativas</div>
                        {filteredCooperativas.map(e => (
                          <div
                            key={e.id}
                            onClick={() => handleEmpresaChange(e.id)}
                            style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', cursor: 'pointer', background: selectedEmpresa === e.id ? 'rgba(140,26,34,0.1)' : 'transparent', color: selectedEmpresa === e.id ? '#8c1a22' : 'var(--text-sidebar-title)', fontSize: '13px', fontWeight: selectedEmpresa === e.id ? 700 : 500 }}
                            className="company-select-item"
                          >
                            {e.logoData ? (
                              <img src={e.logoData} alt="" style={{ height: '16px', width: '16px', objectFit: 'contain', borderRadius: '3px' }} />
                            ) : (
                              <Handshake size={14} />
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
                        <div style={{ padding: '6px 8px', fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}><Building size={11} /> Condomínios</div>
                        {filteredCondominios.map(e => (
                          <div
                            key={e.id}
                            onClick={() => handleEmpresaChange(e.id)}
                            style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', cursor: 'pointer', background: selectedEmpresa === e.id ? 'rgba(140,26,34,0.1)' : 'transparent', color: selectedEmpresa === e.id ? '#8c1a22' : 'var(--text-sidebar-title)', fontSize: '13px', fontWeight: selectedEmpresa === e.id ? 700 : 500 }}
                            className="company-select-item"
                          >
                            {e.logoData ? (
                              <img src={e.logoData} alt="" style={{ height: '16px', width: '16px', objectFit: 'contain', borderRadius: '3px' }} />
                            ) : (
                              <Building size={14} />
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

      <nav className="sidebar-nav" style={{ flex: 1, padding: isSidebarCompact ? '0 8px' : '0 10px' }}>
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
                    padding: isSidebarCompact ? '10px 0' : '9px 12px 9px 14px',
                    borderRadius: '9px',
                    margin: '1px 0',
                    fontSize: '13px',
                  }}
                >
                  <span className="nav-icon">
                    <item.icon size={17} strokeWidth={2.1} />
                  </span>
                  {!isSidebarCompact && item.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer" style={{ padding: isSidebarCompact ? '12px' : '16px' }}>
        {/* Central de Notificações — pendências de conciliação */}
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
              background: 'rgba(245,158,11,0.12)',
              color: 'var(--yellow)',
              border: '1px solid rgba(245,158,11,0.22)',
              marginBottom: 12,
              cursor: 'pointer'
            }}
            title={`${pendenciasReconciliacao} conciliações pendentes!`}
          >
            <Bell size={14} className="pulse-glow" style={{ flexShrink: 0 }} />
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
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              padding: isSidebarCompact ? '6px' : '10px 12px', 
              justifyContent: isSidebarCompact ? 'center' : 'flex-start',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-sidebar)',
              borderRadius: '12px',
              transition: 'background 0.2s',
              color: '#000'
            }}
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
                background: user ? getAvatarGradient(user.name) : undefined,
                color: '#fff',
                fontWeight: 700,
                fontSize: '12px',
                borderRadius: '50%',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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
                <div className="user-name" style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
                <div className="user-role" style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {role === 'administrador' ? <><Gem size={10} /> Administrador</> : role === 'consultor' ? <><Briefcase size={10} /> Consultor Especialista</> : <><Building2 size={10} /> Cliente Ativo</>}
                </div>
              </div>
            )}
          </div>

          {showProfilePopover && (
            <div
              className="dropdown-anim-up"
              style={{
                position: 'absolute',
                bottom: '100%',
                left: isSidebarCompact ? '50px' : '0',
                width: '220px',
                background: '#1f2540',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                boxShadow: '0 -20px 40px -10px rgba(0,0,0,0.6)',
                padding: '14px',
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
                    style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    onClick={toggleTheme}
                  >
                    {theme === 'dark' ? <><Sun size={12} /> Claro</> : <><Moon size={12} /> Escuro</>}
                  </button>
                </div>
                <button className="btn btn-secondary btn-sm" style={{ width: '100%', textAlign: 'left', display: 'flex', gap: '6px', alignItems: 'center' }} onClick={handleLogout}>
                  <LogOut size={13} /> Sair da Conta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
