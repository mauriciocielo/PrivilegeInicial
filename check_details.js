const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Connected successfully!');

    const targetCompanyId = 'mpxje0rcfahl2q21iw'; // VH TINTAS ID

    // Check company info
    const comp = await prisma.empresa.findUnique({
      where: { id: targetCompanyId }
    });
    console.log('Company:', comp);

    // Check count of PlanoConta
    const planoCount = await prisma.planoConta.count({
      where: { empresaId: targetCompanyId }
    });
    console.log(`Company VH TINTAS has ${planoCount} PlanoConta entries.`);

    // Check count of Portador
    const portadorCount = await prisma.portador.count({
      where: { empresaId: targetCompanyId }
    });
    console.log(`Company VH TINTAS has ${portadorCount} Portador entries.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
