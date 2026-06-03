'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { store } from '../../lib/store';
import Sidebar from '../../components/Sidebar';

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const user = store.getCurrentUser();
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'cliente') { router.replace('/consultor/dashboard'); }
  }, [router]);

  // Fecha o menu lateral automaticamente ao mudar de rota no mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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
      <main className="main-content">{children}</main>
    </div>
  );
}
