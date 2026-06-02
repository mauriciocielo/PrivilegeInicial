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

    // Permissão da rota
    if (user.role === 'administrador') {
      setAuthorized(true);
    } else if (user.role === 'consultor') {
      const allowed = user.allowedRoutes || ['/consultor/dashboard'];
      const isOk = pathname === '/consultor/dashboard' || allowed.some(route => pathname.startsWith(route));
      setAuthorized(isOk);
    }
  }, [router, pathname]);

  if (!currentUser) return null;

  return (
    <div className="app-layout">
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
