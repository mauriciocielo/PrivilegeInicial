'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { store } from '../../lib/store';
import Sidebar from '../../components/Sidebar';

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const user = store.getCurrentUser();
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'cliente') { router.replace('/consultor/dashboard'); }
  }, [router]);

  return (
    <div className="app-layout">
      <Sidebar role="cliente" />
      <main className="main-content">{children}</main>
    </div>
  );
}
