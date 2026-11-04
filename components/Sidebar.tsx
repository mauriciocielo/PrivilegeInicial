'use client';
import { useRouter, usePathname } from 'next/navigation';
import { store, User, Empresa } from '../lib/store';
import { useAcessoNfse } from '../lib/nfse/use-acesso-nfse';
import { useState, useEffect, useRef } from 'react';
import BrandLogo from './BrandLogo';
import TwoFactorModal from './TwoFactorModal';
import {
  Settings, LayoutDashboard, Lightbulb, BrainCircuit, Radar, CalendarDays, Timer,
  NotebookPen, FolderInput, Scale, Target, Wallet, Users, CreditCard, Banknote,
  ReceiptText, Landmark, ClipboardList, Building2, ListTree, Tag, FileText,
  ShieldCheck, BarChart3, Truck, Car, Fuel, PiggyBank, Building, ScrollText,
  UserCog, UserSearch, ChevronsLeft, ChevronsRight, Search, Globe, Clock, ChevronDown,
  Bell, LogOut, Sun, Moon, Handshake, Gem, Briefcase, BookOpen, BarChart2, Calculator, AlertTriangle, Activity, Sliders, Presentation, Inbox, type LucideIcon,
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
      { label: 'Ecossistema BPO', href: '/consultor/bpo', icon: Activity },
      { label: 'Agenda Semanal', href: '/consultor/agenda', icon: CalendarDays },
      { label: 'Atividades e Tempo', href: '/consultor/atividades', icon: Timer },
      { label: 'Administrativo', href: '/consultor/administrativo', icon: Settings },
    ],
  },
  {
    section: 'Financeiro',
    items: [
      { label: 'Lançamentos', href: '/consultor/lancamentos', icon: NotebookPen },
      { label: 'Importar OFX', href: '/consultor/importar-ofx', icon: FolderInput },
      { label: 'Contas a Pagar', href: '/consultor/contas-pagar', icon: CreditCard },
      { label: 'Contas a Receber', href: '/consultor/contas-receber', icon: Banknote },
      { label: 'Contas via ERP', href: '/consultor/contas-erp', icon: Landmark },
      { label: 'NFS-e / Emissão', href: '/consultor/nfse', icon: ReceiptText },
      { label: 'NF-e Destinadas', href: '/consultor/nfe-destinadas', icon: Inbox },
      { label: 'Situação Fiscal & CNDs', href: '/consultor/cnd-federal', icon: ShieldCheck },
      { label: 'APIs Open Finance', href: '/consultor/open-finance', icon: Landmark },
      { label: 'Políticas Financeiras', href: '/consultor/politicas', icon: ClipboardList },
    ],
  },
  {
    section: 'Planejamento',
    items: [
      { label: 'Projeção de Caixa', href: '/consultor/projecao-caixa', icon: Activity },
      { label: 'Orçamento', href: '/consultor/orcamento', icon: PiggyBank },
      { label: 'Budget & Orçamento', href: '/consultor/controle-orcamentario', icon: Presentation },
      { label: 'Indicadores', href: '/consultor/indicadores', icon: Target },
      { label: 'Endividamento', href: '/consultor/endividamento', icon: Scale },
      { label: 'Balanço Patrimonial', href: '/consultor/balanco-patrimonial', icon: BookOpen },
      { label: 'Curva ABC', href: '/consultor/curva-abc', icon: BarChart2 },
      { label: 'Imobilizado', href: '/consultor/imobilizado', icon: Building },
    ],
  },
  {
    section: 'Inteligência',
    items: [
      { label: 'Inteligência Financeira', href: '/consultor/inteligencia', icon: BrainCircuit },
      { label: 'Inteligência Tributária', href: '/consultor/inteligencia-tributaria', icon: Lightbulb },
      { label: 'Diagnóstico 360º', href: '/consultor/diagnostico-360', icon: Radar },
      { label: 'Perfil Comportamental', href: '/consultor/perfil-disc', icon: UserSearch },
      { label: 'Valuation & Real-Value', href: '/consultor/valuation', icon: Calculator },
      { label: 'Simulador de Cenários', href: '/consultor/simulador-cenarios', icon: Sliders },
      { label: 'Benchmarking Cloud', href: '/consultor/benchmarking', icon: Activity },
      { label: 'Malha Fina & Risco', href: '/consultor/risco-fiscal', icon: AlertTriangle },
    ],
  },
  {
    section: 'Cadastros & Gestão',
    items: [
      { label: 'Empresas', href: '/consultor/empresas', icon: Building2 },
      { label: 'Clientes / Fornecedores', href: '/consultor/clientes', icon: Users },
      { label: 'Usuários', href: '/consultor/usuarios', icon: UserCog },
      { label: 'Plano de Contas', href: '/consultor/plano-de-contas', icon: ListTree },
      { label: 'Centros de Custo', href: '/consultor/centros-custo', icon: Tag },
      { label: 'Portadores', href: '/consultor/portadores', icon: Wallet },
      { label: 'Atas de Atendimento', href: '/consultor/atas', icon: FileText },
      { label: 'Relatórios Financeiros', href: '/consultor/relatorios', icon: BarChart3 },
      { label: 'Trilha de Auditoria (Logs)', href: '/consultor/auditoria', icon: ShieldCheck },
      { label: 'Segurança & Auditoria', href: '/consultor/configuracoes-avancadas', icon: ShieldCheck, adminOnly: true },
      { label: 'Frota — Dashboard', href: '/consultor/logistica/dashboard', icon: Truck },
      { label: 'Frota — Veículos', href: '/consultor/logistica/veiculos', icon: Car },
      { label: 'Frota — Gastos', href: '/consultor/logistica/despesas', icon: Fuel },
      { label: 'Frota — Orçamentos', href: '/consultor/logistica/orcamentos', icon: Target },
    ],
  },
];

const clienteNav: { section: string; items: NavItem[] }[] = [
  {
    section: 'Visão Geral',
    items: [
      { label: 'Dashboard', href: '/cliente/dashboard', icon: LayoutDashboard },
      { label: 'Agenda', href: '/cliente/agenda', icon: CalendarDays },
      { label: 'Inteligência Financeira', href: '/cliente/inteligencia', icon: BrainCircuit },
      { label: 'Relatórios', href: '/cliente/relatorios', icon: BarChart3 },
    ],
  },
  {
    section: 'Financeiro',
    items: [
      { label: 'Extrato', href: '/cliente/extrato', icon: ScrollText },
      { label: 'Lançamentos', href: '/cliente/lancamentos', icon: NotebookPen },
      { label: 'Importar OFX', href: '/cliente/importar-ofx', icon: FolderInput },
      { label: 'Contas via ERP', href: '/cliente/contas-erp', icon: Landmark },
      { label: 'Atas de Atendimento', href: '/cliente/atas', icon: FileText },
      { label: 'Políticas Financeiras', href: '/cliente/politicas', icon: ClipboardList },
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
  const acessoNfse = useAcessoNfse(role === 'cliente');
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

  // Dropdown atualmente fixado aberto por clique no menu superior
  const [openDropdownSection, setOpenDropdownSection] = useState<string | null>(null);

  const sidebarNavRef = useRef<HTMLElement | null>(null);
  const companyDropdownRef = useRef<HTMLDivElement | null>(null);
  const profilePopoverRef = useRef<HTMLDivElement | null>(null);

  // Fecha menus ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (sidebarNavRef.current && !sidebarNavRef.current.contains(target)) {
        setOpenDropdownSection(null);
      }
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(target)) {
        setShowCompanyDropdown(false);
      }
      if (profilePopoverRef.current && !profilePopoverRef.current.contains(target)) {
        setShowProfilePopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Ao mudar de rota, fecha dropdowns abertos
  useEffect(() => {
    setOpenDropdownSection(null);
    setShowCompanyDropdown(false);
    setShowProfilePopover(false);
  }, [pathname]);

  // Só um submenu aberto por vez, e nada fica salvo: um submenu que continua aberto
  // cobre a página e bloqueia os cliques nela.
  const timerFecharMenu = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelarFechamentoMenu = () => {
    if (timerFecharMenu.current) clearTimeout(timerFecharMenu.current);
    timerFecharMenu.current = null;
  };
  useEffect(() => cancelarFechamentoMenu, []);

  const handleSectionClick = (sectionName: string) => {
    cancelarFechamentoMenu();
    setOpenDropdownSection(prev => (prev === sectionName ? null : sectionName));
    setShowCompanyDropdown(false);
    setShowProfilePopover(false);
  };

  // Abrir ao passar o mouse só faz sentido com mouse e na barra horizontal; no toque vale o clique.
  const menuAbrePorHover = (e: React.PointerEvent) =>
    e.pointerType === 'mouse' && window.matchMedia('(min-width: 769px)').matches;

  const handleSectionEnter = (e: React.PointerEvent, sectionName: string) => {
    if (!menuAbrePorHover(e)) return;
    cancelarFechamentoMenu();
    setOpenDropdownSection(sectionName);
  };

  // A pequena espera deixa o mouse atravessar o espaço entre o rótulo e o submenu.
  const handleSectionLeave = (e: React.PointerEvent) => {
    if (!menuAbrePorHover(e)) return;
    cancelarFechamentoMenu();
    timerFecharMenu.current = setTimeout(() => setOpenDropdownSection(null), 180);
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

  const handleEmpresaChange = async (id: string) => {
    setSelectedEmpresa(id);
    sessionStorage.setItem('cf_empresa_sel', id);
    // Fecha antes de buscar os dados: o menu não pode ficar parado esperando o servidor.
    setShowCompanyDropdown(false);
    setSearchEmpresa('');

    // Hidratação de dados ao trocar de empresa
    console.log(`[SIDEBAR] Trocando para empresa ${id}, disparando pull remoto...`);
    await store.pullFromServer(id);

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
  };

  // Outras telas (ex.: emissores da NFS-e) pedem a troca por aqui, para o seletor não ficar defasado.
  useEffect(() => {
    const selecionar = (e: Event) => handleEmpresaChange((e as CustomEvent<string>).detail);
    window.addEventListener('selecionarEmpresa', selecionar);
    return () => window.removeEventListener('selecionarEmpresa', selecionar);
  });

  const handleLogout = () => {
    store.setCurrentUser(null);
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/');
  };

  const getFilteredNav = () => {
    if (role === 'cliente') {
      // Cliente com procuração para o escritório usa só a emissão de notas.
      if (acessoNfse.liberado) {
        return [{ section: 'Notas Fiscais', items: [{ label: 'NFS-e / Emissão', href: '/cliente/nfse', icon: ReceiptText }] }];
      }
      if (acessoNfse.carregando) return [];
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
      // Escolhem a empresa na própria tela: a selecionada no menu não decide se aparecem (ver app/consultor/layout.tsx).
      if (item.href === '/consultor/nfse' || item.href === '/consultor/nfe-destinadas' || item.href === '/consultor/cnd-federal') return true;
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
          cursor: 'pointer',
          padding: '0 16px 0 0',
          flexShrink: 0,
        }}
        onClick={() => router.push(role === 'cliente' ? '/cliente/dashboard' : '/consultor/dashboard')}
      >
        <BrandLogo size={42} />
      </div>

      {isConsultorOrAdmin && selectableEmpresas.length > 0 && (
        <div ref={companyDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
          <div
            onClick={() => setShowCompanyDropdown(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
              padding: '6px 12px', borderRadius: 99, background: '#ffffff',
              border: '1px solid #e5e5e5', maxWidth: 195,
              transition: 'border-color 0.2s',
            }}
            title="Trocar de empresa"
          >
            <Building2 size={13} style={{ flexShrink: 0, color: '#600000' }} />
            <span style={{ fontSize: 12.5, fontWeight: 500, color: '#171717', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeEmpresa?.nomeFantasia || activeEmpresa?.razaoSocial || 'Selecionar empresa'}
            </span>
            <ChevronDown size={13} style={{ flexShrink: 0, color: '#737373', transform: showCompanyDropdown ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </div>

          {showCompanyDropdown && (
            <div
              className="dropdown-anim-up"
              style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 8, width: 290, maxHeight: 420,
                overflowY: 'auto', background: '#ffffff', border: '1px solid #e5e5e5',
                borderRadius: 16, boxShadow: '0 16px 36px rgba(0,0,0,0.08)', zIndex: 1001, padding: 12,
              }}
            >
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  autoFocus
                  placeholder="Buscar empresa..."
                  value={searchEmpresa}
                  onChange={e => setSearchEmpresa(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px 8px 30px', fontSize: 12.5, borderRadius: 10,
                    border: '1px solid #e5e5e5', outline: 'none', color: '#171717',
                  }}
                />
              </div>

              {!searchEmpresa && recentEmpresas.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4, padding: '0 4px' }}>
                    <Clock size={11} /> Recentes
                  </div>
                  {recentEmpresas.map(id => {
                    const e = selectableEmpresas.find(x => x.id === id);
                    if (!e) return null;
                    return (
                      <div key={id} onClick={() => handleEmpresaChange(id)} className="nav-item" style={{ borderRadius: 8, padding: '7px 10px', color: '#171717', fontSize: 12.5, fontWeight: e.id === selectedEmpresa ? 600 : 400, background: e.id === selectedEmpresa ? '#f4f4f5' : 'transparent' }}>
                        {e.nomeFantasia || e.razaoSocial}
                      </div>
                    );
                  })}
                </div>
              )}

              {!searchEmpresa && gruposEconomicos.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4, padding: '0 4px' }}>
                    <Globe size={11} /> Grupos econômicos
                  </div>
                  {gruposEconomicos.map(g => {
                    const id = `grupo:${g}`;
                    return (
                      <div key={id} onClick={() => handleEmpresaChange(id)} className="nav-item" style={{ borderRadius: 8, padding: '7px 10px', color: '#171717', fontSize: 12.5, fontWeight: id === selectedEmpresa ? 600 : 400, background: id === selectedEmpresa ? '#f4f4f5' : 'transparent' }}>
                        Grupo {g}
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4, padding: '0 4px' }}>
                  Todas as empresas ({selectableEmpresas.length})
                </div>
                {selectableEmpresas
                  .filter(e => !searchEmpresa || `${e.nomeFantasia} ${e.razaoSocial}`.toLowerCase().includes(searchEmpresa.toLowerCase()))
                  .map(e => (
                    <div key={e.id} onClick={() => handleEmpresaChange(e.id)} className="nav-item" style={{ borderRadius: 8, padding: '7px 10px', color: '#171717', fontSize: 12.5, fontWeight: e.id === selectedEmpresa ? 600 : 400, background: e.id === selectedEmpresa ? '#f4f4f5' : 'transparent' }}>
                      {e.nomeFantasia || e.razaoSocial}
                    </div>
                  ))}
                {searchEmpresa && selectableEmpresas.filter(e => `${e.nomeFantasia} ${e.razaoSocial}`.toLowerCase().includes(searchEmpresa.toLowerCase())).length === 0 && (
                  <div style={{ fontSize: 12, color: '#737373', padding: '8px 4px' }}>Nenhuma empresa encontrada.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <nav ref={sidebarNavRef} className="sidebar-nav">
        {nav.map(section => {
          const containsActive = section.items.some(item => item.href === pathname);
          const isClickedOpen = openDropdownSection === section.section;
          const isExpanded = isClickedOpen;
          return (
            <div
              key={section.section}
              className={isClickedOpen ? 'expanded open' : ''}
              onPointerEnter={e => handleSectionEnter(e, section.section)}
              onPointerLeave={handleSectionLeave}
            >
              <div
                className="nav-section"
                role="button"
                tabIndex={0}
                aria-expanded={isClickedOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSectionClick(section.section);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSectionClick(section.section); }
                  if (e.key === 'Escape') setOpenDropdownSection(null);
                }}
              >
                <span
                  className="nav-section-label"
                  style={{
                    color: (containsActive || isClickedOpen) ? '#000000' : undefined,
                    fontWeight: (containsActive || isClickedOpen) ? 600 : undefined,
                    background: (containsActive || isClickedOpen) ? '#f4f4f5' : undefined,
                  }}
                >
                  {section.section}
                  <ChevronDown
                    size={13}
                    style={{
                      opacity: 0.5,
                      transition: 'transform .2s',
                      transform: isExpanded ? 'rotate(180deg)' : 'none',
                    }}
                  />
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
                      onClick={e => {
                        e.preventDefault();
                        setOpenDropdownSection(null);
                        router.push(item.href);
                      }}
                    >
                      <span className="nav-icon">
                        <item.icon size={15} strokeWidth={1.9} />
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

      <div className="sidebar-footer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 0, flexShrink: 0 }}>
        {/* Central de Notificações — pendências de conciliação (compacta) */}
        {pendenciasReconciliacao > 0 && (
          <div
            onClick={() => router.push(role === 'cliente' ? '/cliente/extrato' : '/consultor/importar-ofx')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              fontWeight: 600,
              padding: '5px 10px',
              borderRadius: 99,
              background: '#fffbeb',
              color: '#b45309',
              border: '1px solid #fde68a',
              cursor: 'pointer',
            }}
            title={`${pendenciasReconciliacao} conciliações pendentes`}
          >
            <Bell size={13} style={{ flexShrink: 0 }} />
            <span>{pendenciasReconciliacao}</span>
          </div>
        )}

        {/* Indicador discreto de sincronização na nuvem */}
        {syncStatus !== 'idle' && (
          <div
            title={syncStatus === 'synced' ? 'Nuvem atualizada' : syncStatus === 'syncing' ? 'Salvando na nuvem...' : 'Erro ao sincronizar'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: syncStatus === 'synced' ? '6px' : '4px 10px',
              borderRadius: 99,
              background: syncStatus === 'synced' ? 'transparent' : syncStatus === 'syncing' ? '#fffbeb' : '#fef2f2',
              color: syncStatus === 'synced' ? '#16a34a' : syncStatus === 'syncing' ? '#d97706' : '#dc2626',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: syncStatus === 'synced' ? '#16a34a' : syncStatus === 'syncing' ? '#d97706' : '#dc2626',
                display: 'inline-block',
              }}
            />
            {syncStatus !== 'synced' && (syncStatus === 'syncing' ? 'Salvando...' : 'Erro sync')}
          </div>
        )}

        {/* Popover de Perfil Compacto */}
        <div ref={profilePopoverRef} style={{ position: 'relative' }}>
          <div 
            className="user-card" 
            onClick={() => setShowProfilePopover(!showProfilePopover)}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              padding: '4px 10px 4px 5px', 
              background: '#ffffff',
              border: '1px solid #e5e5e5',
              borderRadius: 99,
              transition: 'border-color 0.2s',
              color: '#171717'
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
                width: 26, 
                height: 26, 
                minWidth: 26,
                background: '#171717',
                color: '#fff',
                fontWeight: 600,
                fontSize: 11,
                borderRadius: '50%',
                border: 'none',
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
              <span style={{ fontSize: 12.5, fontWeight: 500, color: '#171717', whiteSpace: 'nowrap', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name?.split(' ')[0] || 'Conta'}
              </span>
            )}
            <ChevronDown size={12} style={{ color: '#737373' }} />
          </div>

          {showProfilePopover && (
            <div
              className="dropdown-anim-up"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                width: 230,
                background: '#ffffff',
                border: '1px solid #e5e5e5',
                borderRadius: 16,
                boxShadow: '0 16px 36px rgba(0,0,0,0.08)',
                padding: 14,
                zIndex: 1001,
                marginTop: 8
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: '#171717', marginBottom: 2 }}>{user?.name}</div>
              <div style={{ fontSize: 11.5, color: '#737373', marginBottom: 8 }}>{user?.email}</div>
              <div style={{ height: 1, background: '#f0f0f0', margin: '8px 0' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                  <span style={{ fontSize: 12, color: '#525252' }}>Tema</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 10px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    onClick={toggleTheme}
                  >
                    {theme === 'dark' ? <><Sun size={12} /> Claro</> : <><Moon size={12} /> Escuro</>}
                  </button>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-start' }}
                  onClick={() => { setShowProfilePopover(false); setShowTwoFactorModal(true); }}
                >
                  <ShieldCheck size={13} /> {user?.twoFactorEnabled ? '2FA Ativo' : 'Verificação em 2 Etapas'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-start', color: '#dc2626' }}
                  onClick={handleLogout}
                >
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
