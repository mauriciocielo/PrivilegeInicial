'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

import { store } from '../lib/store';
import { syncBackupInChunks } from '../lib/sync-helper';
import { toast } from 'sonner';

if (typeof window !== 'undefined') {
  window.alert = (msg: string) => {
    toast(msg);
  };
}

export default function TransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState('fade-in');
  const prevPathnameRef = useRef(pathname);
  const hasPendingChangesRef = useRef(false);

  // Auto-sincronização com o PostgreSQL ao carregar o site
  useEffect(() => {
    const syncDb = async () => {
      if (sessionStorage.getItem('cf_postgres_synced') === 'true') {
        window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'synced' }));
        return;
      }
      try {
        window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'syncing' }));
        const res = await fetch('/api/migrate-backup');
        if (!res.ok) {
          console.error('Erro ao buscar backup inicial: resposta HTTP não-OK');
          sessionStorage.setItem('cf_postgres_synced', 'true'); // Evita travar futuras escritas
          window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'error' }));
          return;
        }
        const backup = await res.json();
        if (backup && backup.data && Array.isArray(backup.data.cf_empresas) && backup.data.cf_empresas.length > 0) {
          store.importBackup(JSON.stringify(backup));
          store.pruneLancamentosAttachmentData();
          store.pruneEmpresasPolicyData();
        } else {
          console.log('☁️ Banco de dados remoto vazio. Inicializando com dados locais...');
          const backupData = store.exportBackup();
          const syncResult = await syncBackupInChunks(backupData);
          if (!syncResult.success) {
            console.error('Erro ao inicializar banco remoto:', syncResult.error);
            sessionStorage.setItem('cf_postgres_synced', 'true'); // Evita travar futuras escritas
            window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'error' }));
            return;
          }
          store.pruneLancamentosAttachmentData();
          store.pruneEmpresasPolicyData();
        }
        sessionStorage.setItem('cf_postgres_synced', 'true');
        window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'synced' }));
      } catch (e) {
        console.error('Erro na auto-sincronização do banco de dados:', e);
        sessionStorage.setItem('cf_postgres_synced', 'true'); // Evita travar futuras escritas
        window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'error' }));
      }
    };
    syncDb();
  }, []);

  // Auto-salvamento automático no PostgreSQL ao fazer alterações no sistema (Debounced em 300ms)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleDataChange = (event: any) => {
      // Ignora se a sincronização inicial não terminou
      if (sessionStorage.getItem('cf_postgres_synced') !== 'true') return;
      
      // Ignora se for alteração disparada por importação/WebSocket
      if (event?.detail?.source === 'import') return;

      // Ignora chaves temporárias ou não relevantes
      const key = event?.detail?.key;
      if (!key || key === 'cf_current_user' || key === 'cf_postgres_synced' || key === 'cf_sync_in_progress' || key === 'cf_audit_logs') return;

      // Lista de coleções válidas para sincronização automática
      const validCollections = [
        'cf_empresas',
        'cf_users',
        'cf_unidades',
        'cf_plano_contas',
        'cf_portadores',
        'cf_clientes',
        'cf_endividamentos',
        'cf_atas',
        'cf_indicadores',
        'cf_orcamentos',
        'cf_nfse',
        'cf_situacao_fiscal',
        'cf_transaction_patterns'
      ];
      if (!validCollections.includes(key)) return;

      // Sinaliza que há modificações locais aguardando envio
      hasPendingChangesRef.current = true;

      clearTimeout(timeoutId);

      const runSync = async () => {
        // Se um sync já está rodando, agenda para tentar novamente em breve
        if (sessionStorage.getItem('cf_sync_in_progress') === 'true') {
          timeoutId = setTimeout(runSync, 500);
          return;
        }

        try {
          console.log(`☁️ Auto-salvando ${key} no PostgreSQL...`);
          window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'syncing' }));
          sessionStorage.setItem('cf_sync_in_progress', 'true');
          const backupData = store.exportPartialBackup([key]);
          const syncResult = await syncBackupInChunks(backupData, undefined, [key]);
          sessionStorage.setItem('cf_sync_in_progress', 'false');
          if (syncResult.success) {
            window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'synced' }));
            hasPendingChangesRef.current = false;
            
            if (key === 'cf_lancamentos') {
              store.pruneLancamentosAttachmentData();
            } else if (key === 'cf_empresas') {
              store.pruneEmpresasPolicyData();
            }
          } else {
            console.error(`Erro ao auto-salvar ${key} no banco:`, syncResult.error);
            window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'error' }));
          }
        } catch (err) {
          console.error(`Erro ao auto-salvar ${key} no banco:`, err);
          window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'error' }));
          sessionStorage.setItem('cf_sync_in_progress', 'false');
        }
      };

      timeoutId = setTimeout(runSync, 300);
    };

    window.addEventListener('cfDataChange', handleDataChange as any);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('cfDataChange', handleDataChange as any);
    };
  }, []);

  // Sincronização em tempo real via WebSockets (Socket.io)
  useEffect(() => {
    if (pathname === '/login') return;

    console.log('🔌 Inicializando conexão WebSocket global...');
    const socket = io();

    socket.on('connect', () => {
      console.log('🔌 Conectado ao servidor WebSocket:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Desconectado do servidor WebSocket');
    });

    // Ouvinte para qualquer atualização de coleção em tempo real
    socket.on('colecao_atualizada', (payload: any) => {
      if (!payload || !payload.collection) return;
      if (sessionStorage.getItem('cf_sync_in_progress') === 'true') return;

      try {
        console.log(`🔌 WebSocket: Coleção ${payload.collection} atualizada via WS.`);
        sessionStorage.setItem('cf_sync_in_progress', 'true');
        
        store.importBackup(JSON.stringify({
          version: '7',
          isPartial: true,
          data: {
            [payload.collection]: payload.data
          }
        }));

        sessionStorage.setItem('cf_sync_in_progress', 'false');
      } catch (err) {
        console.error(`Erro ao processar colecao_atualizada do WebSocket para ${payload.collection}:`, err);
        sessionStorage.setItem('cf_sync_in_progress', 'false');
      }
    });

    socket.on('lancamento_criado', (novo: any) => {
      if (!novo || !novo.id) return;
      if (sessionStorage.getItem('cf_sync_in_progress') === 'true') return;

      try {
        const list = store.getLancamentos();
        const idx = list.findIndex(l => l.id === novo.id);
        if (idx >= 0) {
          const old = list[idx];
          if (JSON.stringify(old) === JSON.stringify(novo)) return;
        }

        console.log('🔌 WebSocket: Lançamento criado:', novo.descricao, novo.valor);
        sessionStorage.setItem('cf_sync_in_progress', 'true');
        store.importSingleLancamento(novo);
        sessionStorage.setItem('cf_sync_in_progress', 'false');
      } catch (err) {
        console.error('Erro ao processar lancamento_criado do WebSocket:', err);
        sessionStorage.setItem('cf_sync_in_progress', 'false');
      }
    });

    socket.on('lancamento_atualizado', (atualizado: any) => {
      if (!atualizado || !atualizado.id) return;
      if (sessionStorage.getItem('cf_sync_in_progress') === 'true') return;

      try {
        const list = store.getLancamentos();
        const idx = list.findIndex(l => l.id === atualizado.id);
        if (idx >= 0) {
          const old = list[idx];
          if (JSON.stringify(old) === JSON.stringify(atualizado)) return;
        }

        console.log('🔌 WebSocket: Lançamento atualizado:', atualizado.descricao, atualizado.valor);
        sessionStorage.setItem('cf_sync_in_progress', 'true');
        store.importSingleLancamento(atualizado);
        sessionStorage.setItem('cf_sync_in_progress', 'false');
      } catch (err) {
        console.error('Erro ao processar lancamento_atualizado do WebSocket:', err);
        sessionStorage.setItem('cf_sync_in_progress', 'false');
      }
    });

    socket.on('lancamento_excluido', (id: string) => {
      if (!id) return;
      if (sessionStorage.getItem('cf_sync_in_progress') === 'true') return;

      try {
        const list = store.getLancamentos();
        const exists = list.some(l => l.id === id);
        if (!exists) return;

        console.log('🔌 WebSocket: Lançamento excluído:', id);
        sessionStorage.setItem('cf_sync_in_progress', 'true');
        store.importDeleteLancamento(id);
        sessionStorage.setItem('cf_sync_in_progress', 'false');
      } catch (err) {
        console.error('Erro ao processar lancamento_excluido do WebSocket:', err);
        sessionStorage.setItem('cf_sync_in_progress', 'false');
      }
    });

    return () => {
      console.log('🔌 Desconectando e limpando socket...');
      socket.disconnect();
    };
  }, [pathname === '/login']);

  // Função auxiliar para mapear o caminho atual para a coleção correspondente
  const getCollectionFromPath = (path: string): string | null => {
    if (path.includes('/lancamentos')) return 'cf_lancamentos';
    if (path.includes('/plano-de-contas')) return 'cf_plano_contas';
    if (path.includes('/portadores')) return 'cf_portadores';
    if (path.includes('/clientes')) return 'cf_clientes';
    if (path.includes('/endividamento')) return 'cf_endividamentos';
    if (path.includes('/atas')) return 'cf_atas';
    if (path.includes('/indicadores')) return 'cf_indicadores';
    if (path.includes('/orcamento')) return 'cf_orcamentos';
    if (path.includes('/empresas')) return 'cf_empresas';
    if (path.includes('/usuarios')) return 'cf_users';
    return null;
  };

  // Polling de fallback em tempo real (a cada 15 segundos) para a coleção ativa da página
  useEffect(() => {
    if (pathname === '/login') return;

    const collection = getCollectionFromPath(pathname);
    if (!collection) return;

    let lastSyncTime = sessionStorage.getItem('cf_last_sync_time') || '';
    
    const pollInterval = setInterval(async () => {
      if (sessionStorage.getItem('cf_postgres_synced') !== 'true') return;
      if (hasPendingChangesRef.current) return;
      if (sessionStorage.getItem('cf_sync_in_progress') === 'true') return;

      try {
        if (collection === 'cf_lancamentos') {
          // Polling Super Rápido (3s) focado apenas na data de atualização
          const statusRes = await fetch('/api/sync-status?collection=cf_lancamentos', { cache: 'no-store' });
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();
          
          if (statusData.lastUpdate && statusData.lastUpdate !== lastSyncTime) {
             console.log('☁️ Polling [TEMPO REAL]: Detectada alteração remota em lançamentos!');
             // Faz fetch apenas dos lançamentos agora
             const res = await fetch('/api/migrate-backup?collection=cf_lancamentos', { cache: 'no-store' });
             if (!res.ok) return;
             const backup = await res.json();
             if (backup && backup.data) {
                sessionStorage.setItem('cf_sync_in_progress', 'true');
                store.importBackup(JSON.stringify(backup));
                sessionStorage.setItem('cf_sync_in_progress', 'false');
                lastSyncTime = statusData.lastUpdate;
                sessionStorage.setItem('cf_last_sync_time', lastSyncTime);
             }
          }
        } else {
          // Polling padrão para as outras tabelas leves (a cada 15s - aqui rodará a cada 3s mas tudo bem, 
          // ou podemos manter o de 15s)
          // Mas para não sobrecarregar, vamos ignorar as outras por enquanto, pois elas
          // não têm a urgência do lancamentos, ou podemos fazer a validação
          // Para simplificar, faremos o pull direto se não for lancamentos, mas com chance reduzida.
          if (Math.random() > 0.2) return; // Roda 1 a cada 5 vezes (aprox 15s)
          
          const res = await fetch(`/api/migrate-backup?collection=${collection}&t=${Date.now()}`, { cache: 'no-store' });
          if (!res.ok) return;
          const backup = await res.json();
          if (backup && backup.data) {
            const localString = store.exportBackup();
            const localParsed = JSON.parse(localString);
            const remoteStr = JSON.stringify(backup.data[collection] || []);
            const localStr = JSON.stringify(localParsed.data[collection] || []);
            
            if (remoteStr !== localStr) {
              console.log(`☁️ Polling: Sincronizando ${collection} remotos...`);
              sessionStorage.setItem('cf_sync_in_progress', 'true');
              store.importBackup(JSON.stringify(backup));
              sessionStorage.setItem('cf_sync_in_progress', 'false');
            }
          }
        }
      } catch (err) {
        console.error('Erro no polling de tempo real:', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [pathname]);

  useEffect(() => {
    // Backup completo de segurança a cada 1 hora
    const hourlyInterval = setInterval(() => {
      console.log('⏰ Executando backup completo de segurança (1 hora)...');
      try {
        const backupStr = store.exportBackup();
        const backupObj = JSON.parse(backupStr);
        fetch('/api/migrate-backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backupObj)
        }).catch(err => console.error('Erro na rede durante o backup completo (1 hora):', err));
      } catch (err) {
        console.error('Erro ao gerar o backup completo (1 hora):', err);
      }
    }, 60 * 60 * 1000); // 1 hora
    return () => clearInterval(hourlyInterval);
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
