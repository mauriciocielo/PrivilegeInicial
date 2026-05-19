'use client';
import { useRouter, usePathname } from 'next/navigation';
import { store, User, Empresa } from '../lib/store';
import { useState, useEffect } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const consultorNav: { section: string; items: NavItem[] }[] = [
  {
    section: 'Principal',
    items: [
      { label: 'Dashboard', href: '/consultor/dashboard', icon: '📊' },
      { label: 'Lançamentos', href: '/consultor/lancamentos', icon: '📝' },
      { label: 'Importar OFX', href: '/consultor/importar-ofx', icon: '📂' },
      { label: 'Endividamento', href: '/consultor/endividamento', icon: '⚖️' },
      { label: 'Indicadores', href: '/consultor/indicadores', icon: '🎯' },
      { label: 'Orçamento', href: '/consultor/orcamento', icon: '💰' },
    ],
  },
  {
    section: 'Cadastros',
    items: [
      { label: 'Empresas', href: '/consultor/empresas', icon: '🏢' },
      { label: 'Usuários', href: '/consultor/usuarios', icon: '👥' },
      { label: 'Plano de Contas', href: '/consultor/plano-de-contas', icon: '📋' },
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
    ],
  },
];

export default function Sidebar({ role }: { role: 'consultor' | 'cliente' }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState('e1');

  useEffect(() => {
    const u = store.getCurrentUser();
    setUser(u);
    if (u) {
      const all = store.getEmpresas();
      const filtered = u.role === 'consultor' ? all : all.filter(e => u.empresaIds.includes(e.id));
      setEmpresas(filtered);
      const saved = sessionStorage.getItem('cf_empresa_sel');
      if (saved && filtered.find(e => e.id === saved)) setSelectedEmpresa(saved);
      else if (filtered.length > 0) { setSelectedEmpresa(filtered[0].id); sessionStorage.setItem('cf_empresa_sel', filtered[0].id); }
    }
  }, []);

  const handleEmpresaChange = (id: string) => {
    setSelectedEmpresa(id);
    sessionStorage.setItem('cf_empresa_sel', id);
    window.dispatchEvent(new CustomEvent('empresaChange', { detail: id }));
  };

  const handleLogout = () => {
    store.setCurrentUser(null);
    router.push('/login');
  };

  const nav = role === 'consultor' ? consultorNav : clienteNav;
  const initials = user?.name?.split(' ').map(w => w[0]).slice(0,2).join('') || 'U';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flexShrink: 0 }}>
          <svg viewBox="0 0 100 100" width="36" height="36">
            <circle cx="50" cy="50" r="46" fill="#f8fafc" />
            <rect x="36" y="44" width="8" height="24" rx="1" fill="#600000" />
            <rect x="49" y="33" width="8" height="35" rx="1" fill="#600000" />
            <rect x="62" y="22" width="8" height="46" rx="1" fill="#600000" />
            <path d="M 28 72 L 40 55 L 49 60 L 76 26" fill="none" stroke="#600000" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 66 26 L 76 26 L 76 36" fill="none" stroke="#600000" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="logo-text" style={{ letterSpacing: '2px', fontSize: '13px', fontWeight: 800 }}>PRIVILEGE</div>
          <div className="logo-sub">{role === 'consultor' ? 'Portal do Consultor' : 'Portal do Cliente'}</div>
        </div>
      </div>

      {empresas.length > 0 && (
        <div className="sidebar-empresa">
          <label>Empresa Ativa</label>
          <select value={selectedEmpresa} onChange={e => handleEmpresaChange(e.target.value)}>
            {empresas.map(e => (
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
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{role === 'consultor' ? 'Consultor Privilege' : 'Acesso Cliente'}</div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={handleLogout}>
          🚪 Sair do Sistema
        </button>
      </div>
    </aside>
  );
}
