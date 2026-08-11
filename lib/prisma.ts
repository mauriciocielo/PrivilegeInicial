// Cache Buster 1234
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

let dbInstance: PrismaClient;

if (typeof window === 'undefined') {
  // Rodando no servidor
  const isProduction = process.env.NODE_ENV === 'production';
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  });
  const adapter = new PrismaPg(pool);
  dbInstance = globalThis.prisma || new PrismaClient({ adapter });
  
  if (!isProduction) {
    globalThis.prisma = dbInstance;
  }
} else {
  dbInstance = null as any;
}

export const db = dbInstance;
export default db;
