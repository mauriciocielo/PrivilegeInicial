// Cache Buster 1234
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

const isProduction = process.env.NODE_ENV === 'production';

let dbInstance: PrismaClient;

if (typeof window === 'undefined') {
  // Rodando no servidor
  if (!globalThis.pgPool) {
    globalThis.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : undefined,
      // server.js roda como processo Node único e persistente (não serverless) — um
      // pool de 10 já estourava ("timeout exceeded when trying to connect") sob carga
      // normal (migração grande + várias abas fazendo polling ao mesmo tempo).
      max: 20,
      idleTimeoutMillis: 10000,     // Encerra clientes inativos rapidamente (10s)
      connectionTimeoutMillis: 15000,
      allowExitOnIdle: true,
    });
  }

  if (!globalThis.prisma) {
    const adapter = new PrismaPg(globalThis.pgPool);
    globalThis.prisma = new PrismaClient({ adapter });
  }

  dbInstance = globalThis.prisma;
} else {
  dbInstance = null as any;
}

export const db = dbInstance;
export default db;

