'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

import { store } from '../lib/store';
import { syncBackupInChunks } from '../lib/sync-helper';
import { SYNC_COLLECTIONS, getCollectionForPath } from '../lib/sync-registry';
import { toast } from 'sonner';

if (typeof window !== 'undefined') {
  window.alert = (msg: string) => {
    toast(msg);
  };
}

// Rastreio DURÁVEL (localStorage, sobrevive a refresh e a fechar a aba) de quais
// coleções têm alterações locais ainda não confirmadas no servidor. Sem isso, um
// refresh no meio de um envio (ex: import de OFX que falhou por payload grande)
// fazia o app "esquecer" que havia dados locais pendentes e sobrescrevê-los com
// a versão antiga do servidor — apagando o que o usuário acabou de inserir.
const PENDING_SYNC_KEY = 'cf_pending_sync_keys';

const readPendingKeys = (): string[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]'); } catch { return []; }
};

const addPendingKeys = (keys: string[]) => {
  if (typeof window === 'undefined') return;
  const current = new Set(readPendingKeys());
  keys.forEach(k => current.add(k));
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(Array.from(current)));
};

const removePendingKeys = (keys: string[]) => {
  if (typeof window === 'undefined') return;
  const current = new Set(readPendingKeys());
  keys.forEach(k => current.delete(k));
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(Array.from(current)));
};

export default function TransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState('fade-in');
  const prevPathnameRef = useRef(pathname);
  const hasPendingChangesRef = useRef(false);
  const socketRef = useRef<any>(null);

  // Restaura o estado "há alterações pendentes" a partir do localStorage ao montar
  // (o ref em memória não sobrevive a um refresh, mas o localStorage sim).
  useEffect(() => {
    hasPendingChangesRef.current = readPendingKeys().length > 0;
  }, []);

  // Armazenamento do navegador cheio: sem este aviso a gravação falhava calada,
  // o usuário seguia trabalhando e só descobria a perda quando o dado não
  // aparecia em outro aparelho. Alerta uma única vez por sessão.
  useEffect(() => {
    let avisado = false;
    const onStorageFull = () => {
      if (avisado) return;
      avisado = true;
      toast.error(
        'O armazenamento do navegador está cheio. As últimas alterações podem não ter sido salvas — '
        + 'sincronize agora e recarregue a página.',
        { duration: 15000 }
      );
    };
    window.addEventListener('cfStorageFull', onStorageFull);
    return () => window.removeEventListener('cfStorageFull', onStorageFull);
  }, []);

  // Envio de última chance ao sair/trocar de app: o auto-salvamento normal espera
  // ~1s (debounce) antes de tentar enviar — se o usuário fechar a aba, trocar de
  // app no celular ou bloquear a tela nesse meio tempo, a alteração fica só local
  // até a próxima sincronização. Aqui, tentamos mandar na hora (best-effort, via
  // sendBeacon — não bloqueia o fechamento da página). Não substitui a rede de
  // segurança principal (as chaves continuam marcadas como pendentes até o
  // servidor confirmar), só reduz a janela em que os dados ficam só no aparelho.
  useEffect(() => {
    const flushOnLeave = () => {
      const pending = readPendingKeys();
      if (pending.length === 0) return;
      if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;
      try {
        const backupData = store.exportPartialBackup(pending);
        const blob = new Blob([backupData], { type: 'application/json' });
        navigator.sendBeacon('/api/migrate-backup', blob);
      } catch {
        // Best-effort apenas — se falhar, a rede de segurança principal
        // (flush ao carregar a próxima sessão) ainda cobre esses dados.
      }
    };

    const handleVisibilityHidden = () => {
      if (document.visibilityState === 'hidden') flushOnLeave();
    };

    window.addEventListener('pagehide', flushOnLeave);
    document.addEventListener('visibilitychange', handleVisibilityHidden);

    return () => {
      window.removeEventListener('pagehide', flushOnLeave);
      document.removeEventListener('visibilitychange', handleVisibilityHidden);
    };
  }, []);

  // Auto-sincronização com o PostgreSQL ao carregar o site
  useEffect(() => {
    const syncDb = async () => {
      if (sessionStorage.getItem('cf_postgres_synced') === 'true') {
        window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'synced' }));
        return;
      }

      // Se ficaram alterações locais não confirmadas no servidor de uma sessão
      // anterior (ex: refresh no meio de um envio), tenta enviá-las ANTES de
      // buscar/sobrescrever com os dados do servidor.
      const leftoverPendingKeys = readPendingKeys();
      let pendingFlushFailed = false;
      if (leftoverPendingKeys.length > 0) {
        console.warn(`⚠️ Encontradas alterações locais não sincronizadas de uma sessão anterior: ${leftoverPendingKeys.join(', ')}. Enviando antes de continuar...`);
        try {
          const backupData = store.exportPartialBackup(leftoverPendingKeys);
          // Não deixa o carregamento da página travar indefinidamente se a rede
          // estiver instável — depois de 10s, desiste por agora e tenta de novo depois.
          const flushTimeout = new Promise<{ success: false; error: string }>((resolve) =>
            setTimeout(() => resolve({ success: false, error: 'timeout' }), 10000)
          );
          const flushResult = await Promise.race([syncBackupInChunks(backupData, undefined, leftoverPendingKeys), flushTimeout]);
          if (flushResult.success) {
            removePendingKeys(leftoverPendingKeys);
            console.log('☁️ Alterações pendentes de sessão anterior enviadas com sucesso.');
          } else {
            pendingFlushFailed = true;
            console.error('❌ Falha ao enviar alterações pendentes:', flushResult.error);
          }
        } catch (e) {
          pendingFlushFailed = true;
          console.error('❌ Erro ao enviar alterações pendentes:', e);
        }
      }

      if (pendingFlushFailed) {
        // Não sobrescreve dados locais enquanto houver alterações não confirmadas
        // no servidor — evita apagar o que o usuário acabou de inserir/importar.
        console.warn('⚠️ Pulando sincronização inicial: existem alterações locais que ainda não foram confirmadas no servidor.');
        sessionStorage.setItem('cf_postgres_synced', 'true');
        window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'error' }));
        return;
      }

      try {
        window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'syncing' }));

        // Timeout de 12s: se o banco demorar mais que isso, libera o sistema com dados locais
        const timeoutPromise = new Promise<null | 'unauthorized'>((resolve) => setTimeout(() => resolve(null), 12000));
        const fetchPromise = fetch('/api/migrate-backup')
          .then(res => {
            if (res.status === 401) return 'unauthorized' as const;
            return res.ok ? res.json() : null;
          })
          .catch(() => null);

        const backup = await Promise.race([fetchPromise, timeoutPromise]);

        if (backup === 'unauthorized') {
          // Sessão ausente/expirada no servidor (ex: cookie venceu, ou é uma
          // aba que ficou logada "visualmente" de antes deste recurso existir)
          // — a tela local achava que estava logada, mas a API já não confia
          // mais nela. Força novo login em vez de deixar tudo em branco.
          console.warn('🔒 Sessão inválida ou expirada — redirecionando para o login.');
          store.setCurrentUser(null);
          window.location.href = '/login';
          return;
        }

        if (backup && backup.data && Array.isArray(backup.data.cf_empresas) && backup.data.cf_empresas.length > 0) {
          store.importBackup(JSON.stringify(backup));
          store.pruneLancamentosAttachmentData();
          store.pruneEmpresasPolicyData();
          console.log('☁️ Sync inicial concluído com dados do banco.');
        } else if (backup === null) {
          // Timeout ou erro — libera o sistema com dados locais e tenta re-sync em background
          console.warn('⚠️ Sync inicial ignorado (timeout ou banco vazio). Usando dados locais.');
          sessionStorage.setItem('cf_postgres_synced', 'true');
          window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'synced' }));

          // Re-tenta em background após 5s sem bloquear a UI
          setTimeout(async () => {
            try {
              const res = await fetch('/api/migrate-backup');
              if (!res.ok) return;
              const retryBackup = await res.json();
              if (retryBackup?.data?.cf_empresas?.length > 0) {
                store.importBackup(JSON.stringify(retryBackup));
                store.pruneLancamentosAttachmentData();
                store.pruneEmpresasPolicyData();
                console.log('☁️ Sync de re-tentativa concluído em background.');
                window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: 'all', source: 'import' } }));
              }
            } catch { /* silencioso */ }
          }, 5000);
          return;
        } else {
          // Banco vazio — inicializa com dados locais
          console.log('☁️ Banco de dados remoto vazio. Inicializando com dados locais...');
          const backupData = store.exportBackup();
          const syncResult = await syncBackupInChunks(backupData);
          if (!syncResult.success) {
            console.error('Erro ao inicializar banco remoto:', syncResult.error);
          }
          store.pruneLancamentosAttachmentData();
          store.pruneEmpresasPolicyData();
        }

        sessionStorage.setItem('cf_postgres_synced', 'true');
        window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'synced' }));
      } catch (e) {
        console.error('Erro na auto-sincronização do banco de dados:', e);
        sessionStorage.setItem('cf_postgres_synced', 'true'); // Libera sempre para não travar
        window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'error' }));
      }
    };
    syncDb();
  }, []);

  // Auto-salvamento automático no PostgreSQL ao fazer alterações no sistema (Debounced em 300ms)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const pendingKeys = new Set<string>();

    const handleDataChange = (event: any) => {
      // Ignora se a sincronização inicial não terminou
      if (sessionStorage.getItem('cf_postgres_synced') !== 'true') return;
      
      // Ignora se for alteração disparada por importação/WebSocket
      if (event?.detail?.source === 'import') return;

      // Ignora chaves temporárias ou não relevantes
      const key = event?.detail?.key;
      if (!key || key === 'cf_current_user' || key === 'cf_postgres_synced' || key === 'cf_sync_in_progress') return;

      // Coleções válidas para sincronização automática — vem do registro único
      // (lib/sync-registry.ts). cf_lancamentos fica de fora aqui de propósito:
      // tem seu próprio caminho de tempo real (autoSync: false no registro).
      const validCollections = SYNC_COLLECTIONS.filter(c => c.autoSync).map(c => c.key);
      if (!validCollections.includes(key)) return;

      // Sinaliza que há modificações locais aguardando envio (em memória E de forma
      // durável em localStorage, para sobreviver a um refresh no meio do envio).
      hasPendingChangesRef.current = true;
      pendingKeys.add(key);
      addPendingKeys([key]);

      clearTimeout(timeoutId);

      const runSync = async () => {
        // Se um sync já está rodando, agenda para tentar novamente em breve
        if (sessionStorage.getItem('cf_sync_in_progress') === 'true') {
          timeoutId = setTimeout(runSync, 500);
          return;
        }

        const keysToSync = Array.from(pendingKeys);
        if (keysToSync.length === 0) return;

        pendingKeys.clear();

        try {
          console.log(`☁️ Auto-salvando ${keysToSync.join(', ')} no PostgreSQL...`);
          window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'syncing' }));
          sessionStorage.setItem('cf_sync_in_progress', 'true');
          const backupData = store.exportPartialBackup(keysToSync);
          const syncResult = await syncBackupInChunks(backupData, undefined, keysToSync);
          sessionStorage.setItem('cf_sync_in_progress', 'false');
          if (syncResult.success) {
            window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'synced' }));
            hasPendingChangesRef.current = false;
            removePendingKeys(keysToSync);

            if (keysToSync.includes('cf_lancamentos')) store.pruneLancamentosAttachmentData();
            if (keysToSync.includes('cf_empresas')) store.pruneEmpresasPolicyData();
            if (keysToSync.includes('cf_atividades_log')) store.pruneAtividadesFotos();
            if (keysToSync.includes('cf_users')) store.pruneUserAvatarData();

            if (socketRef.current) {
              keysToSync.forEach(k => {
                socketRef.current.emit('colecao_atualizada', { collection: k, triggerFetch: true });
              });
            }
          } else {
            keysToSync.forEach(k => pendingKeys.add(k));
            console.error(`Erro ao auto-salvar no banco:`, syncResult.error);
            window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'error' }));
            // Continua tentando mesmo sem novas edições — não depende do usuário mexer de novo.
            timeoutId = setTimeout(runSync, 10000);
          }
        } catch (err) {
          keysToSync.forEach(k => pendingKeys.add(k));
          console.error(`Erro ao auto-salvar no banco:`, err);
          window.dispatchEvent(new CustomEvent('cfSyncStatus', { detail: 'error' }));
          sessionStorage.setItem('cf_sync_in_progress', 'false');
          timeoutId = setTimeout(runSync, 10000);
        }
      };

      timeoutId = setTimeout(runSync, 1000); // increased debounce for performance
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
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Conectado ao servidor WebSocket:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Desconectado do servidor WebSocket');
    });

    // Em celulares, a aba em segundo plano (app trocado / tela bloqueada) pode
    // derrubar a conexão WebSocket. Ao voltar a ficar visível, reconecta na hora
    // em vez de esperar o backoff automático do socket.io (que pode demorar).
    const handleVisibleReconnect = () => {
      if (document.visibilityState === 'visible' && socket && !socket.connected) {
        console.log('🔌 Aba voltou a ficar visível e o socket estava desconectado — reconectando...');
        socket.connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibleReconnect);
    window.addEventListener('focus', handleVisibleReconnect);
    window.addEventListener('pageshow', handleVisibleReconnect);

    // Ouvinte para qualquer atualização de coleção em tempo real
    socket.on('colecao_atualizada', (payload: any) => {
      if (!payload || !payload.collection) return;
      if (sessionStorage.getItem('cf_sync_in_progress') === 'true') return;
      // Ainda temos alterações locais não confirmadas para esta coleção — não
      // sobrescreve com o que veio de fora, para não perder o que está pendente.
      if (readPendingKeys().includes(payload.collection)) return;

      try {
        console.log(`🔌 WebSocket: Coleção ${payload.collection} atualizada via WS, sincronizando...`);
        sessionStorage.setItem('cf_sync_in_progress', 'true');

        if (payload.triggerFetch) {
          fetch(`/api/migrate-backup?collection=${payload.collection}&t=${Date.now()}`, { cache: 'no-store' })
            .then(res => res.ok ? res.json() : null)
            .then(backup => {
              if (backup && backup.data && backup.data[payload.collection]) {
                 store.importBackup(JSON.stringify(backup));
              }
              sessionStorage.setItem('cf_sync_in_progress', 'false');
            }).catch(() => {
              sessionStorage.setItem('cf_sync_in_progress', 'false');
            });
          return;
        }

        if (payload.collection === '__mapa_atividade') {
          localStorage.setItem('cf_atividades_ativas', JSON.stringify(payload.data || []));
          window.dispatchEvent(new Event('cfMapDataReceived'));
          sessionStorage.setItem('cf_sync_in_progress', 'false');
          return;
        }

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

    // Bridge do Map 
    const handleMapBroadcast = (e: any) => {
      if (socketRef.current) {
        socketRef.current.emit('colecao_atualizada', { collection: '__mapa_atividade', data: e.detail });
      }
    };
    window.addEventListener('cfMapBroadcast', handleMapBroadcast as any);

    return () => {
      console.log('🔌 Desconectando e limpando socket...');
      window.removeEventListener('cfMapBroadcast', handleMapBroadcast as any);
      document.removeEventListener('visibilitychange', handleVisibleReconnect);
      window.removeEventListener('focus', handleVisibleReconnect);
      window.removeEventListener('pageshow', handleVisibleReconnect);
      socket.disconnect();
    };
  }, [pathname === '/login']);

  // Mapeia o caminho atual para a coleção correspondente — vem do registro
  // único (lib/sync-registry.ts), então toda coleção com pagePaths definido
  // ganha polling de fallback automaticamente, sem precisar editar aqui.
  const getCollectionFromPath = getCollectionForPath;

  // Polling de fallback em tempo real (a cada 15 segundos) para a coleção ativa
  useEffect(() => {
    if (pathname === '/login') return;

    // Coleção principal ativada pela rota, se houver
    const pageCollection = getCollectionFromPath(pathname);
    
    let lastSyncTimeLancs = '';
    let counter = 0;

    const tick = async (force = false) => {
      if (sessionStorage.getItem('cf_postgres_synced') !== 'true') return;
      if (hasPendingChangesRef.current) return;
      if (sessionStorage.getItem('cf_sync_in_progress') === 'true') return;
      
      counter++;
      
      try {
        // 1. POLLING UNIVERSAL DE LANÇAMENTOS (O Pulso do Sistema)
        // Todos os dashboards e relatórios dependem de Lançamentos. Sincronizamos globalmente.
        const statusRes = await fetch('/api/sync-status?collection=cf_lancamentos', { cache: 'no-store' });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.lastUpdate && statusData.lastUpdate !== lastSyncTimeLancs) {
            console.log('☁️ Polling [TEMPO REAL Global]: Detectada alteração remota em lançamentos! Buscando...');
            lastSyncTimeLancs = statusData.lastUpdate;
            sessionStorage.setItem('cf_last_sync_time', lastSyncTimeLancs);

            const res = await fetch(`/api/lancamentos?since=${encodeURIComponent(lastSyncTimeLancs)}`, { cache: 'no-store' });
            if (res.ok) {
              const lancamentos = await res.json();
              if (Array.isArray(lancamentos) && lancamentos.length > 0) {
                sessionStorage.setItem('cf_sync_in_progress', 'true');
                lancamentos.forEach((l: any) => store.importSingleLancamento(l));
                sessionStorage.setItem('cf_sync_in_progress', 'false');
                console.log(`☁️ Polling: ${lancamentos.length} lançamentos sincronizados da nuvem.`);
              }
            }
          }
        }

        // 2. POLLING ESPECÍFICO ROTA ou DASHBOARD (Agenda, Empresas, etc)
        // Só rodamos a cada ~15s (1 em cada 5 ticks) para poupar o banco, a menos que seja forçado
        if (!force && counter % 5 !== 0) return;

        // Se está no Dashboard (onde pageCollection é null), checamos a Agenda e Empresas
        const collectionsToPoll: string[] = [];
        if (pageCollection) {
          if (pageCollection !== 'cf_lancamentos' && !readPendingKeys().includes(pageCollection)) {
            collectionsToPoll.push(pageCollection);
          }
        } else if (pathname.includes('/dashboard')) {
          if (!readPendingKeys().includes('cf_agenda_semanal')) collectionsToPoll.push('cf_agenda_semanal');
          if (!readPendingKeys().includes('cf_empresas')) collectionsToPoll.push('cf_empresas');
        }

        for (const col of collectionsToPoll) {
          const res = await fetch(`/api/migrate-backup?collection=${col}&t=${Date.now()}`, { cache: 'no-store' });
          if (!res.ok) continue;
          
          const backup = await res.json();
          if (backup && backup.data && backup.data[col]) {
            const localString = store.exportBackup();
            const localParsed = JSON.parse(localString);
            const remoteStr = JSON.stringify(backup.data[col] || []);
            const localStr = JSON.stringify(localParsed.data[col] || []);
            
            if (remoteStr !== localStr) {
               console.log(`☁️ Polling: Sincronizando ${col} remotos...`);
               sessionStorage.setItem('cf_sync_in_progress', 'true');
               store.importBackup(JSON.stringify(backup));
               sessionStorage.setItem('cf_sync_in_progress', 'false');
            }
          }
        }
      } catch (err) {
        console.error('Erro no polling de tempo real:', err);
      }
    };

    const pollInterval = setInterval(() => tick(), 3000);

    // Celulares suspendem a aba (e param os timers) quando o app vai para
    // segundo plano ou a tela bloqueia. Ao voltar, o próximo "tick" do
    // setInterval pode demorar — força uma checagem imediata nesse momento
    // para não parecer que "não atualiza no celular".
    const handleVisible = () => {
      if (document.visibilityState === 'visible') tick(true);
    };
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleVisible);
    window.addEventListener('pageshow', handleVisible);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleVisible);
      window.removeEventListener('pageshow', handleVisible);
    };
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
        transform: transitionStage === 'fade-in' ? 'none' : 'translateY(4px) scale(0.995)',
        width: '100%',
        minHeight: '100vh',
      }}
    >
      {displayChildren}
    </div>
  );
}
