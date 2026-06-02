import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

let dbInstance: PrismaClient;

if (typeof window === 'undefined') {
  // Rodando no servidor - importa dinamicamente os drivers para evitar erros de compilação no client browser
  const { Pool } = require('pg');
  const { PrismaPg } = require('@prisma/adapter-pg');
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  dbInstance = globalThis.prisma || new PrismaClient({ adapter });
  
  if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = dbInstance;
  }
} else {
  dbInstance = null as any;
}

export const db = dbInstance;
export default db;
