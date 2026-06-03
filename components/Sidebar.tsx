'use client';
import { useRouter, usePathname } from 'next/navigation';
import { store, User, Empresa } from '../lib/store';
import { useState, useEffect } from 'react';
import BrandLogo from './BrandLogo';

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
      { label: 'Extrato', href: '/cliente/extrato', icon: '📋' },
      { label: 'Atas de Atendimento', href: '/cliente/atas', icon: '📝' },
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

  const activeEmpresa = empresas.find(e => e.id === selectedEmpresa);

  const isConsultorOrAdmin = role === 'consultor' || role === 'administrador';

  const selectableEmpresas = empresas.filter(e => {
    if (!isConsultorOrAdmin) return true;
    return appMode === 'condominio' ? e.tipo === 'condominio' : e.tipo !== 'condominio';
  });

  useEffect(() => {
    const u = store.getCurrentUser();
    setUser(u);
    if (u) {
      const savedMode = (sessionStorage.getItem('cf_app_mode') || 'empresarial') as 'empresarial' | 'condominio';
      setAppMode(savedMode);
      
      const all = store.getEmpresas();
      const allowed = isConsultorOrAdmin ? all : all.filter(e => u.empresaIds.includes(e.id));
      setEmpresas(allowed);

      const filtered = allowed.filter(e => savedMode === 'condominio' ? e.tipo === 'condominio' : e.tipo !== 'condominio');
      const saved = sessionStorage.getItem('cf_empresa_sel');
      if (saved && filtered.find(e => e.id === saved)) {
        setSelectedEmpresa(saved);
      } else if (filtered.length > 0) {
        setSelectedEmpresa(filtered[0].id);
        sessionStorage.setItem('cf_empresa_sel', filtered[0].id);
      } else {
        setSelectedEmpresa('');
      }
    }
  }, [role]);

  const handleModeChange = (mode: 'empresarial' | 'condominio') => {
    setAppMode(mode);
    sessionStorage.setItem('cf_app_mode', mode);
    
    const all = store.getEmpresas();
    const u = store.getCurrentUser();
    if (u) {
      const allowed = isConsultorOrAdmin ? all : all.filter(e => u.empresaIds.includes(e.id));
      const filtered = allowed.filter(e => mode === 'condominio' ? e.tipo === 'condominio' : e.tipo !== 'condominio');
      
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
    window.dispatchEvent(new CustomEvent('empresaChange', { detail: id }));
  };

  const handleLogout = () => {
    store.setCurrentUser(null);
    router.push('/');
  };

  const getFilteredNav = () => {
    if (role === 'cliente') return clienteNav;
    const baseNav = appMode === 'condominio' ? condominioNav : consultorNav;

    // Filtra rotas com base na configuração da empresa ativa
    const companyAllowed = activeEmpresa?.allowedRoutes || [];
    const filterByCompany = (item: NavItem) => {
      if (item.href === '/consultor/dashboard') return true;
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
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BrandLogo size={36} subtitle={isConsultorOrAdmin ? 'Portal do Consultor' : 'Portal do Cliente'} />
      </div>

      {isConsultorOrAdmin && (
        <div style={{ display: 'flex', background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)', padding: 4, margin: '8px 16px 16px 16px', border: '1px solid var(--border-light)' }}>
          <button 
            onClick={() => handleModeChange('empresarial')}
            style={{ 
              flex: 1, 
              padding: '6px 8px', 
              fontSize: 11, 
              fontWeight: 600, 
              border: 0, 
              borderRadius: 'calc(var(--radius-sm) - 2px)', 
              cursor: 'pointer', 
              background: appMode === 'empresarial' ? 'var(--primary)' : 'transparent',
              color: appMode === 'empresarial' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s'
            }}
          >
            🏢 Empresas
          </button>
          <button 
            onClick={() => handleModeChange('condominio')}
            style={{ 
              flex: 1, 
              padding: '6px 8px', 
              fontSize: 11, 
              fontWeight: 600, 
              border: 0, 
              borderRadius: 'calc(var(--radius-sm) - 2px)', 
              cursor: 'pointer', 
              background: appMode === 'condominio' ? 'var(--primary)' : 'transparent',
              color: appMode === 'condominio' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s'
            }}
          >
            🏘️ Condomínios
          </button>
        </div>
      )}

      {selectableEmpresas.length > 0 && (
        <div className="sidebar-empresa">
          {activeEmpresa?.logoData && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, padding: '6px', background: '#fff', borderRadius: 8, border: '1px solid var(--border-light)' }}>
              <img 
                src={activeEmpresa.logoData} 
                alt="Logo da Empresa" 
                style={{ maxHeight: 36, maxWidth: '100%', objectFit: 'contain' }} 
              />
            </div>
          )}
          <label>{appMode === 'condominio' ? 'Condomínio Ativo' : 'Empresa Ativa'}</label>
          <select value={selectedEmpresa} onChange={e => handleEmpresaChange(e.target.value)}>
            {selectableEmpresas.map(e => (
              <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>
            ))}
          </select>
        </div>
      )}

      <nav className="sidebar-nav">
        {nav.map(section => (
          <div key={section.section}>
            <div className="nav-section">
              <span className="nav-section-label">{section.section}</span>
            </div>
            {section.items.map(item => (
              <a
                key={item.href}
                href={item.href}
                className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                onClick={e => { e.preventDefault(); router.push(item.href); }}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card" style={{ cursor: 'default' }}>
          <div className="user-avatar" style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">
              {role === 'administrador' ? '💎 Administrador' : role === 'consultor' ? '👔 Consultor BPO' : '🏢 Cliente'}
            </div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={handleLogout}>
          🚪 Sair do Sistema
        </button>
      </div>
    </aside>
  );
}
