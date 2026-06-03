'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

import { store } from '../lib/store';

export default function TransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState('fade-in');
  const prevPathnameRef = useRef(pathname);

  // Auto-sincronização com o PostgreSQL ao carregar o site
  useEffect(() => {
    const syncDb = async () => {
      if (sessionStorage.getItem('cf_postgres_synced') === 'true') return;
      try {
        const res = await fetch('/api/migrate-backup');
        if (!res.ok) return;
        const backup = await res.json();
        if (backup && backup.data && Array.isArray(backup.data.cf_empresas) && backup.data.cf_empresas.length > 0) {
          store.importBackup(JSON.stringify(backup));
        } else {
          console.log('☁️ Banco de dados remoto vazio. Inicializando com dados locais...');
          const backupData = store.exportBackup();
          await fetch('/api/migrate-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: backupData
          });
        }
        sessionStorage.setItem('cf_postgres_synced', 'true');
      } catch (e) {
        console.error('Erro na auto-sincronização do banco de dados:', e);
        sessionStorage.setItem('cf_postgres_synced', 'true'); // Evita travar futuras escritas
      }
    };
    syncDb();
  }, []);

  // Auto-salvamento automático no PostgreSQL ao fazer alterações no sistema (Debounced em 3s)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleDataChange = (event: any) => {
      // Ignora se for a sincronização inicial
      if (sessionStorage.getItem('cf_postgres_synced') !== 'true') return;
      
      // Ignora chaves temporárias ou não relevantes
      const key = event?.detail?.key;
      if (key === 'cf_current_user' || key === 'cf_postgres_synced') return;

      clearTimeout(timeoutId);

      timeoutId = setTimeout(async () => {
        try {
          console.log('☁️ Auto-salvando dados no PostgreSQL...');
          const backupData = store.exportBackup();
          await fetch('/api/migrate-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: backupData
          });
        } catch (err) {
          console.error('Erro ao auto-salvar no banco:', err);
        }
      }, 3000);
    };

    window.addEventListener('cfDataChange', handleDataChange as any);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('cfDataChange', handleDataChange as any);
    };
  }, []);

  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      setTransitionStage('fade-out');
    }
  }, [pathname]);

  useEffect(() => {
    if (transitionStage === 'fade-out') {
      const timer = setTimeout(() => {
        setDisplayChildren(children);
        setTransitionStage('fade-in');
      }, 200); // Duration matches CSS transition
      return () => clearTimeout(timer);
    } else {
      setDisplayChildren(children);
    }
  }, [transitionStage, children]);

  return (
    <div
      style={{
        transition: 'opacity 0.2s ease-in-out, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: transitionStage === 'fade-in' ? 1 : 0,
        transform: transitionStage === 'fade-in' ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.995)',
        width: '100%',
        minHeight: '100vh',
      }}
    >
      {displayChildren}
    </div>
  );
}
