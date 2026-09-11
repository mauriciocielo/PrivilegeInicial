'use client';
import { useRouter, usePathname } from 'next/navigation';
import { store, User, Empresa } from '../lib/store';
import { useState, useEffect } from 'react';
import BrandLogo from './BrandLogo';
import TwoFactorModal from './TwoFactorModal';
import {
  Settings, LayoutDashboard, Lightbulb, BrainCircuit, Radar, CalendarDays, Timer,
  NotebookPen, FolderInput, Scale, Target, Wallet, Users, CreditCard, Banknote,
  ReceiptText, Landmark, ClipboardList, Building2, ListTree, Tag, FileText,
  ShieldCheck, BarChart3, Truck, Car, Fuel, PiggyBank, Building, ScrollText,
  UserCog, ChevronsLeft, ChevronsRight, Search, Globe, Clock, ChevronDown,
  Bell, LogOut, Sun, Moon, Handshake, Gem, Briefcase, BookOpen, BarChart2, Calculator, AlertTriangle, Activity, Sliders, Presentation, type LucideIcon,
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
    section: 'Painel',
    items: [
      { label: 'Dashboard', href: '/consultor/dashboard', icon: LayoutDashboard },
      { label: 'Ecossistema BPO (IA)', href: '/consultor/bpo', icon: Activity },
      { label: 'Administrativo', href: '/consultor/administrativo', icon: Settings },
    ],
  },
  {
    section: 'Operação Diária',
    items: [
      { label: 'Lançamentos', href: '/consultor/lancamentos', icon: NotebookPen },
      { label: 'Importar OFX', href: '/consultor/importar-ofx', icon: FolderInput },
      { label: 'Agenda Semanal', href: '/consultor/agenda', icon: CalendarDays },
      { label: 'Atividades e Tempo', href: '/consultor/atividades', icon: Timer },
    ],
  },
  {
    section: 'Inteligência & Diagnóstico',
    items: [
      { label: 'Inteligência Financeira', href: '/consultor/inteligencia', icon: BrainCircuit },
      { label: 'Inteligência Tributária', href: '/consultor/inteligencia-tributaria', icon: Lightbulb },
      { label: 'Diagnóstico 360º', href: '/consultor/diagnostico-360', icon: Radar },
    ],
  },
  {
    section: 'Auditoria & C-Level',
    items: [
      { label: 'Valuation & Real-Value', href: '/consultor/valuation', icon: Calculator },
      { label: 'Budget & Orçamento', href: '/consultor/controle-orcamentario', icon: Presentation },
      { label: 'Benchmarking Cloud', href: '/consultor/benchmarking', icon: Activity },
      { label: 'Malha Fina & Risco', href: '/consultor/risco-fiscal', icon: AlertTriangle },
      { label: 'Simulador de Cenários', href: '/consultor/simulador-cenarios', icon: Sliders },
    ]
  },
  {
    section: 'Planejamento & Indicadores',
    items: [
      { label: 'Orçamento', href: '/consultor/orcamento', icon: PiggyBank },
      { label: 'Indicadores', href: '/consultor/indicadores', icon: Target },
      { label: 'Endividamento', href: '/consultor/endividamento', icon: Scale },
      { label: 'Projeção de Caixa', href: '/consultor/projecao-caixa', icon: Activity },
      { label: 'Imobilizado', href: '/consultor/imobilizado', icon: Building },
      { label: 'Curva ABC', href: '/consultor/curva-abc', icon: BarChart2 },
      { label: 'Balanço Patrimonial', href: '/consultor/balanco-patrimonial', icon: BookOpen },
    ],
  },
  {
    section: 'Financeiro',
    items: [
      { label: 'Clientes / Fornecedores', href: '/consultor/clientes', icon: Users },
      { label: 'Contas a Pagar', href: '/consultor/contas-pagar', icon: CreditCard },
      { label: 'Contas a Receber', href: '/consultor/contas-receber', icon: Banknote },
      { label: 'Contas via ERP', href: '/consultor/contas-erp', icon: Landmark },
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
    section: 'Relatórios & Auditoria',
    items: [
      { label: 'Relatórios Financeiros', href: '/consultor/relatorios', icon: BarChart3 },
      { label: 'Trilha de Auditoria (Logs)', href: '/consultor/auditoria', icon: ShieldCheck },
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
      { label: 'Importar OFX', href: '/cliente/importar-ofx', icon: FolderInput },
      { label: 'Contas via ERP', href: '/cliente/contas-erp', icon: Landmark },
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
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [isSidebarCompact, setIsSidebarCompact] = useState(false);
  const [searchEmpresa, setSearchEmpresa] = useState('');
  const [recentEmpresas, setRecentEmpresas] = useState<string[]>([]);

  // Submenus recolhíveis — por padrão só o "Painel" começa aberto (menu
  // limpo). Lembra o que o usuário abriu/fechou, e sempre mantém visível a
  // seção da página atual (nunca esconde onde você está).
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cf_sidebar_expanded_sections');
      setExpandedSections(saved ? JSON.parse(saved) : { 'Painel': true });
    } catch {
      setExpandedSections({ 'Painel': true });
    }
  }, []);

  // `efetivo` é o estado visualmente aberto/fechado já considerando o
  // fallback "seção da página atual abre sozinha" — sem isso, clicar numa
  // seção que só está aberta pelo fallback (nunca teve toggle explícito)
  // pareceria não fazer nada na primeira vez (undefined → true, já visível).
  const toggleSection = (section: string, efetivo: boolean) => {
    setExpandedSections(prev => {
      const next = { ...(prev || {}), [section]: !efetivo };
      try { localStorage.setItem('cf_sidebar_expanded_sections', JSON.stringify(next)); } catch {}
      return next;
    });
  };

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
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
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
    <header className="sidebar">
      <div 
        className="sidebar-logo" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          cursor: 'pointer'
        }}
        onClick={() => router.push(role === 'cliente' ? '/cliente/dashboard' : '/consultor/dashboard')}
      >
        <BrandLogo size={64} subtitle={isConsultorOrAdmin ? 'Portal do Consultor' : 'Portal do Cliente'} />
      </div>



      {/* Switcher de empresa movido para o Painel Administrativo de acordo com a solicitação */}

      <nav className="sidebar-nav">
        {nav.map(section => {
          const containsActive = section.items.some(item => item.href === pathname);
          // No desktop (topbar) isso não importa — o hover é quem manda lá.
          // No celular (accordion vertical), a seção da página atual abre
          // sozinha até o usuário tocar nela explicitamente.
          const isExpanded = expandedSections?.[section.section] ?? containsActive;
          return (
            <div key={section.section} className={isExpanded ? 'expanded' : ''}>
              <div className="nav-section" onClick={() => toggleSection(section.section, isExpanded)}>
                <span className="nav-section-label">
                  {section.section}
                  <ChevronDown size={14} style={{ opacity: 0.6, transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                </span>
              </div>

              <div className="dropdown-menu-wrapper">
                {section.items.map(item => {
                  const isActive = pathname === item.href;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`nav-item ${isActive ? 'active' : ''}`}
                      onClick={e => { e.preventDefault(); router.push(item.href); }}
                    >
                      <span className="nav-icon">
                        <item.icon size={16} strokeWidth={2.2} />
                      </span>
                      {item.label}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
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
                top: '100%',
                right: '0',
                width: '220px',
                background: '#1f2540',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                boxShadow: '0 20px 40px -10px rgba(0,0,0,0.6)',
                padding: '14px',
                zIndex: 1001,
                marginTop: '8px'
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
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', textAlign: 'left', display: 'flex', gap: '6px', alignItems: 'center' }}
                  onClick={() => { setShowProfilePopover(false); setShowTwoFactorModal(true); }}
                >
                  <ShieldCheck size={13} /> {user?.twoFactorEnabled ? 'Verificação em 2 Etapas (Ativa)' : 'Ativar Verificação em 2 Etapas'}
                </button>
                <button className="btn btn-secondary btn-sm" style={{ width: '100%', textAlign: 'left', display: 'flex', gap: '6px', alignItems: 'center' }} onClick={handleLogout}>
                  <LogOut size={13} /> Sair da Conta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <TwoFactorModal
        open={showTwoFactorModal}
        enabled={!!user?.twoFactorEnabled}
        onClose={() => setShowTwoFactorModal(false)}
        onChanged={(enabled) => {
          if (!user) return;
          const updated = { ...user, twoFactorEnabled: enabled };
          setUser(updated);
          store.setCurrentUser(updated);
        }}
      />
    </header>
  );
}
