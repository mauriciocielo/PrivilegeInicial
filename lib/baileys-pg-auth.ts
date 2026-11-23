import {
  AuthenticationCreds,
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
  SignalDataTypeMap,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { getEmailDbPool } from './email-db';

let tabelaGarantida = false;

async function ensureAuthTable() {
  const pool = getEmailDbPool();
  if (!pool || tabelaGarantida) return pool;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS baileys_auth_kv (
      owner_id TEXT NOT NULL,
      key_id TEXT NOT NULL,
      value_json TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (owner_id, key_id)
    )
  `);
  tabelaGarantida = true;
  return pool;
}

export async function hasPostgresAuthCreds(ownerId = 'default'): Promise<boolean> {
  try {
    const pool = await ensureAuthTable();
    if (!pool) return false;
    const res = await pool.query(
      `SELECT 1 FROM baileys_auth_kv WHERE owner_id = $1 AND key_id = 'creds' LIMIT 1`,
      [ownerId || 'default']
    );
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

export async function listPostgresAuthOwners(): Promise<string[]> {
  try {
    const pool = await ensureAuthTable();
    if (!pool) return [];
    const res = await pool.query(
      `SELECT DISTINCT owner_id FROM baileys_auth_kv WHERE key_id = 'creds' AND owner_id IS NOT NULL`
    );
    return res.rows.map((r: any) => String(r.owner_id)).filter(Boolean);
  } catch {
    return [];
  }
}

export async function clearPostgresAuthState(ownerId = 'default'): Promise<void> {
  try {
    const pool = await ensureAuthTable();
    if (!pool) return;
    await pool.query(`DELETE FROM baileys_auth_kv WHERE owner_id = $1`, [ownerId || 'default']);
  } catch {
    // ignora
  }
}

/**
 * AuthState persistente no PostgreSQL (sobrevive a deploys e restarts no Railway sem precisar
 * de volume em disco nem escanear QR Code de novo). Se houver um `creds.json` local antigo
 * no `fallbackDir` e ainda não existir no PostgreSQL, migra automaticamente na primeira carga.
 */
export async function usePostgresAuthState(
  ownerId = 'default',
  fallbackDir?: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const owner = ownerId || 'default';
  const pool = await ensureAuthTable().catch(() => null);

  if (!pool) {
    return useMultiFileAuthState(fallbackDir || path.join(process.cwd(), '.baileys_auth'));
  }

  const writeData = async (keyId: string, data: any) => {
    const serialized = JSON.stringify(data, BufferJSON.replacer);
    await pool.query(
      `INSERT INTO baileys_auth_kv (owner_id, key_id, value_json, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (owner_id, key_id) DO UPDATE SET
         value_json = EXCLUDED.value_json,
         updated_at = NOW()`,
      [owner, keyId, serialized]
    );
  };

  const readData = async (keyId: string): Promise<any | null> => {
    const res = await pool.query(
      `SELECT value_json FROM baileys_auth_kv WHERE owner_id = $1 AND key_id = $2 LIMIT 1`,
      [owner, keyId]
    );
    if (!res.rows[0]?.value_json) return null;
    try {
      return JSON.parse(res.rows[0].value_json, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const removeData = async (keyId: string) => {
    await pool.query(
      `DELETE FROM baileys_auth_kv WHERE owner_id = $1 AND key_id = $2`,
      [owner, keyId]
    );
  };

  let creds: AuthenticationCreds | null = await readData('creds');

  // Migração suave: se não há creds no Postgres mas existe creds.json no disco, importa tudo uma vez
  if (!creds && fallbackDir && fs.existsSync(path.join(fallbackDir, 'creds.json'))) {
    try {
      const files = fs.readdirSync(fallbackDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(fallbackDir, file), 'utf8');
          const keyId = file.replace(/\.json$/, '');
          await pool.query(
            `INSERT INTO baileys_auth_kv (owner_id, key_id, value_json, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (owner_id, key_id) DO NOTHING`,
            [owner, keyId, raw]
          );
        } catch {
          // ignora arquivo corrompido
        }
      }
      creds = await readData('creds');
    } catch {
      // ignora
    }
  }

  if (!creds) {
    creds = initAuthCreds();
  }

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const data: { [id: string]: SignalDataTypeMap[T] } = {};
        if (ids.length === 0) return data;

        const keyIds = ids.map(id => `${type}-${id}`);
        const res = await pool.query(
          `SELECT key_id, value_json FROM baileys_auth_kv WHERE owner_id = $1 AND key_id = ANY($2::text[])`,
          [owner, keyIds]
        );
        const byKey = new Map<string, string>();
        for (const row of res.rows) {
          byKey.set(row.key_id, row.value_json);
        }

        for (const id of ids) {
          const raw = byKey.get(`${type}-${id}`);
          if (!raw) continue;
          try {
            let value = JSON.parse(raw, BufferJSON.reviver);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          } catch {
            // ignora
          }
        }
        return data;
      },
      set: async (data: any) => {
        const tasks: Promise<void>[] = [];
        for (const category in data) {
          for (const id in data[category]) {
            const value = data[category][id];
            const keyId = `${category}-${id}`;
            tasks.push(value ? writeData(keyId, value) : removeData(keyId));
          }
        }
        await Promise.all(tasks);
      },
    },
  };

  return {
    state,
    saveCreds: async () => {
      await writeData('creds', state.creds);
    },
  };
}
