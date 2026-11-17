import { Pool } from 'pg';

let pool: Pool | null = null;

export function getEmailDbPool(): Pool | null {
  if (pool) return pool;

  const connStr = process.env.DATABASE_URL;
  if (!connStr) return null;

  try {
    pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      max: 6,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
      allowExitOnIdle: true,
    });
  } catch (err) {
    console.error('[EmailDB] Erro ao instanciar Pool PostgreSQL:', err);
    return null;
  }

  return pool;
}

