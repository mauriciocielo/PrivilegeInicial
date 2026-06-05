// ============================================================
// IndexedDB wrapper — substitui localStorage para cf_lancamentos
// Suporta 100MB+ sem quota error
// ============================================================

const DB_NAME = 'cashflow_db';
const DB_VERSION = 1;
const STORE_LANCAMENTOS = 'lancamentos';

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_LANCAMENTOS)) {
        db.createObjectStore(STORE_LANCAMENTOS, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = (e) => {
      reject((e.target as IDBOpenDBRequest).error);
    };
  });
}

export async function idbGetAllLancamentos(): Promise<any[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LANCAMENTOS, 'readonly');
      const req = tx.objectStore(STORE_LANCAMENTOS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback: tentar migrar do localStorage
    try {
      const raw = localStorage.getItem('cf_lancamentos');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export async function idbSaveAllLancamentos(lancamentos: any[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LANCAMENTOS, 'readwrite');
      const store = tx.objectStore(STORE_LANCAMENTOS);
      
      // Limpa e regrava tudo
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        let pending = lancamentos.length;
        if (pending === 0) { resolve(); return; }
        for (const l of lancamentos) {
          const putReq = store.put(l);
          putReq.onsuccess = () => { if (--pending === 0) resolve(); };
          putReq.onerror = () => reject(putReq.error);
        }
      };
      clearReq.onerror = () => reject(clearReq.error);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // Fallback para localStorage com aviso
    console.warn('[IDB] Fallback to localStorage for lancamentos:', err);
    try {
      localStorage.setItem('cf_lancamentos', JSON.stringify(lancamentos));
    } catch (lsErr) {
      console.error('[IDB] localStorage also failed:', lsErr);
      throw lsErr;
    }
  }
}

export async function idbPutLancamento(lancamento: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LANCAMENTOS, 'readwrite');
      const req = tx.objectStore(STORE_LANCAMENTOS).put(lancamento);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback silencioso – cache em memória já está atualizado
  }
}

export async function idbDeleteLancamento(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LANCAMENTOS, 'readwrite');
      const req = tx.objectStore(STORE_LANCAMENTOS).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback silencioso
  }
}

/**
 * Migra dados de cf_lancamentos do localStorage para o IndexedDB.
 * Chamado uma única vez na inicialização do app.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  try {
    const db = await openDB();

    // Verifica se já tem dados no IDB
    const countReq = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_LANCAMENTOS, 'readonly');
      const req = tx.objectStore(STORE_LANCAMENTOS).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (countReq > 0) {
      // IDB já tem dados — limpa localStorage para liberar espaço
      localStorage.removeItem('cf_lancamentos');
      return;
    }

    // Migra do localStorage para o IDB
    const raw = localStorage.getItem('cf_lancamentos');
    if (!raw) return;

    const lancamentos = JSON.parse(raw);
    if (Array.isArray(lancamentos) && lancamentos.length > 0) {
      await idbSaveAllLancamentos(lancamentos);
      localStorage.removeItem('cf_lancamentos');
      console.log(`[IDB] Migrated ${lancamentos.length} lancamentos from localStorage to IndexedDB`);
    }
  } catch (err) {
    console.warn('[IDB] Migration failed, will use localStorage as fallback:', err);
  }
}
