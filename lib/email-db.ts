import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

let pool: Pool | null = null;

export function getEmailDbPool(): Pool | null {
  if (pool) return pool;

  let connStr = process.env.DATABASE_URL;
  if (!connStr) {
    const paths = [
      path.resolve(process.cwd(), '.env.local'),
      path.resolve(process.cwd(), '.env'),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        try {
          const parsed = dotenv.parse(fs.readFileSync(p, 'utf8'));
          if (parsed.DATABASE_URL) {
            connStr = parsed.DATABASE_URL;
            break;
          }
        } catch {}
      }
    }
  }

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

