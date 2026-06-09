'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { store, User } from '../../lib/store';
import Sidebar from '../../components/Sidebar';

export default function ConsultorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSelectedEmpresaId(sessionStorage.getItem('cf_empresa_sel') || '');
    }

    const handleEmpresaChange = (e: any) => {
      setSelectedEmpresaId(e.detail || '');
    };

    const handleDataChange = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || '';
      setSelectedEmpresaId(current);
      window.dispatchEvent(new CustomEvent('empresaChange', { detail: current }));
    };

    window.addEventListener('empresaChange', handleEmpresaChange);
    window.addEventListener('cfDataChange', handleDataChange);

    return () => {
      window.removeEventListener('empresaChange', handleEmpresaChange);
      window.removeEventListener('cfDataChange', handleDataChange);
    };
  }, []);

  useEffect(() => {
    const user = store.getCurrentUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'consultor' && user.role !== 'administrador') {
      router.replace('/cliente/dashboard');
      return;
    }
    setCurrentUser(user);

    // Permissão da rota com base na empresa ativa
    let companyOk = true;
    if (selectedEmpresaId) {
      const activeEmpresa = store.getEmpresas().find(e => e.id === selectedEmpresaId);
      if (activeEmpresa && activeEmpresa.allowedRoutes && activeEmpresa.allowedRoutes.length > 0) {
        companyOk = pathname === '/consultor/dashboard' || activeEmpresa.allowedRoutes.some(route => pathname.startsWith(route));
      }
    }

    // Permissão final
    if (user.role === 'administrador') {
      setAuthorized(true);
    } else if (user.role === 'consultor') {
      const allowed = user.allowedRoutes || ['/consultor/dashboard'];
      const userOk = pathname === '/consultor/dashboard' || allowed.some(route => pathname.startsWith(route));
      
      const isGroup = selectedEmpresaId.startsWith('grupo:');
      let hasCompanyAccess = false;
      if (isGroup) {
        const groupName = selectedEmpresaId.split(':')[1];
        const companiesInGroup = store.getEmpresas().filter(e => e.grupoEconomico === groupName);
        hasCompanyAccess = companiesInGroup.some(e => user.empresaIds && user.empresaIds.includes(e.id));
      } else {
        hasCompanyAccess = !selectedEmpresaId || (user.empresaIds && user.empresaIds.includes(selectedEmpresaId));
      }
      
      setAuthorized(userOk && companyOk && hasCompanyAccess);
    }
  }, [router, pathname, selectedEmpresaId]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCompact, setIsSidebarCompact] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSidebarCompact(localStorage.getItem('cf_sidebar_compact') === 'true');
    }
    const handleCompactChange = (e: Event) => {
      setIsSidebarCompact((e as CustomEvent).detail);
    };
    window.addEventListener('cfSidebarCompactChange', handleCompactChange);
    return () => {
      window.removeEventListener('cfSidebarCompactChange', handleCompactChange);
    };
  }, []);

  // Fecha o menu lateral automaticamente ao mudar de rota no mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!currentUser) return null;

  return (
    <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : ''} ${isSidebarCompact ? 'sidebar-compact' : ''}`}>
      {/* Botão flutuante para toggle do menu no mobile */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 1000,
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 40,
          height: 40,
          display: 'none', // Controlado via globals.css
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          cursor: 'pointer'
        }}
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Overlay de fundo no mobile */}
      {sidebarOpen && (
        <div 
          className="mobile-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 99,
            display: 'none' // Controlado via globals.css
          }}
        />
      )}

      <Sidebar role={currentUser.role as any} />
      <main className="main-content">
        {authorized ? (
          children
        ) : (
          <div className="page-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🚫</div>
            <h1 className="page-title" style={{ color: 'var(--red)', marginBottom: 12 }}>Acesso Restrito</h1>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 24px auto', fontSize: 15 }}>
              Desculpe, seu usuário de <strong>Consultor</strong> não possui permissão para acessar esta tela. Entre em contato com o Administrador para solicitar acesso.
            </p>
            <button className="btn btn-primary" onClick={() => router.push('/consultor/dashboard')}>
              Voltar ao Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
