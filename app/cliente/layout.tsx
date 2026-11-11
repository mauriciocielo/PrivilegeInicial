'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { store, User } from '../../lib/store';
import Sidebar from '../../components/Sidebar';
import FloatingCopilot from '../../components/FloatingCopilot';
import { useAcessoNfse } from '../../lib/nfse/use-acesso-nfse';

const ROTA_NFSE = '/cliente/nfse';

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const acessoNfse = useAcessoNfse(true);

  useEffect(() => {
    const user = store.getCurrentUser();
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'cliente') { router.replace('/consultor/dashboard'); return; }

    // Trava estrita de segurança: garante que o cliente SEMPRE acesse apenas sua empresa autorizada
    const allowedEmpresas = Array.isArray(user.empresaIds) ? user.empresaIds : [];
    const currentSaved = sessionStorage.getItem('cf_empresa_sel');
    if (!currentSaved || currentSaved.startsWith('grupo:') || !allowedEmpresas.includes(currentSaved)) {
      const defaultEmp = allowedEmpresas[0] || '';
      if (defaultEmp) {
        sessionStorage.setItem('cf_empresa_sel', defaultEmp);
        window.dispatchEvent(new CustomEvent('empresaChange', { detail: defaultEmp }));
      }
    }

    if (acessoNfse.carregando) { setAuthorized(false); return; }

    const isDashboard2 = pathname.startsWith('/cliente/dashboard2');
    const isDashboard = pathname === '/cliente/dashboard';
    const isComparadorSped = pathname.startsWith('/cliente/comparador-sped');

    // Cliente com procuração para o escritório: permite acesso tanto à NFS-e quanto aos Dashboards e Comparador SPED
    if (acessoNfse.liberado) {
      if (pathname === ROTA_NFSE || isDashboard2 || isDashboard || isComparadorSped) {
        setAuthorized(true);
        return;
      }
    }
    if (pathname === ROTA_NFSE && !acessoNfse.liberado) {
      setAuthorized(false);
      router.replace(isDashboard2 ? '/cliente/dashboard2' : '/cliente/dashboard');
      return;
    }

    const allowed = user.allowedRoutes || [];
    if (allowed.length === 0) {
      // Compatibility
      setAuthorized(true);
    } else {
      const isOk = isDashboard || isDashboard2 || isComparadorSped || allowed.some(route => pathname.startsWith(route));
      setAuthorized(isOk);
    }
  }, [router, pathname, acessoNfse.carregando, acessoNfse.liberado]);

  // Fecha o menu lateral automaticamente ao mudar de rota no mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Intercepta qualquer tentativa de trocar para empresa não permitida
  useEffect(() => {
    const handleEmpresaChange = (e: Event) => {
      const u = store.getCurrentUser();
      if (!u || u.role !== 'cliente') return;
      const target = (e as CustomEvent).detail;
      const allowed = Array.isArray(u.empresaIds) ? u.empresaIds : [];
      if (target && (target.startsWith('grupo:') || !allowed.includes(target))) {
        const safe = allowed[0] || '';
        sessionStorage.setItem('cf_empresa_sel', safe);
        window.dispatchEvent(new CustomEvent('empresaChange', { detail: safe }));
      }
    };
    window.addEventListener('empresaChange', handleEmpresaChange);
    return () => window.removeEventListener('empresaChange', handleEmpresaChange);
  }, []);

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
          display: 'none',
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
            display: 'none'
          }}
        />
      )}

      <Sidebar role="cliente" />
      <main className="main-content">
        {acessoNfse.carregando || (acessoNfse.liberado && !authorized) || (!acessoNfse.liberado && pathname === ROTA_NFSE) ? (
          <div className="page-body" style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-muted)' }}>⏳ Carregando...</div>
        ) : authorized ? (
          children
        ) : (
          <div className="page-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🚫</div>
            <h1 className="page-title" style={{ color: 'var(--red)', marginBottom: 12 }}>Acesso Restrito</h1>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 24px auto', fontSize: 15 }}>
              Desculpe, o seu usuário não possui permissão para acessar este módulo. Entre em contato com a equipe.
            </p>
            <button className="btn btn-primary" onClick={() => {
              store.setCurrentUser(null);
              router.push('/login');
            }}>
              Ir para o Login
            </button>
          </div>
        )}
      </main>
      {!acessoNfse.liberado && !acessoNfse.carregando && <FloatingCopilot />}
    </div>
  );
}
