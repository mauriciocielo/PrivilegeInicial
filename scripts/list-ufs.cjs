require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const empresas = await prisma.empresa.findMany({
    select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, uf: true, cidade: true },
    take: 30,
  });
  console.log('Empresas (UF & Cidade):');
  for (const e of empresas) {
    console.log(`${e.cnpj} | ${e.uf || 'S/UF'} | ${e.cidade || 'S/CIDADE'} | ${e.nomeFantasia || e.razaoSocial}`);
  }
  const ufs = await prisma.empresa.groupBy({
    by: ['uf'],
    _count: true,
  });
  console.log('Distribuição por UF:', ufs);
}

main().catch(console.error).finally(() => { prisma.$disconnect(); pool.end(); });

