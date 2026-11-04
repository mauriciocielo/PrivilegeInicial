require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const configs = await prisma.nfseConfig.findMany({
    select: {
      empresaId: true,
      ambiente: true,
      serie: true,
      proximoNDpsProducao: true,
      proximoNDpsHomologacao: true,
      empresa: { select: { razaoSocial: true, cnpj: true } },
    },
  });
  console.log('Configs NFS-e:');
  for (const c of configs) {
    const maxNota = await prisma.nfsE.findMany({
      where: { empresaId: c.empresaId, status: { in: ['emitida', 'cancelada'] } },
      select: { numero: true, nDps: true, serie: true, dataEmissao: true },
      orderBy: { dataEmissao: 'desc' },
      take: 5,
    });
    console.log(`Empresa: ${c.empresa?.razaoSocial} (${c.empresa?.cnpj})`);
    console.log(`  Config: ambiente=${c.ambiente}, serie=${c.serie}, proxProd=${c.proximoNDpsProducao}, proxHomol=${c.proximoNDpsHomologacao}`);
    console.log(`  Últimas notas no banco:`, maxNota);
  }
}

main().catch(console.error).finally(() => { prisma.$disconnect(); pool.end(); });

