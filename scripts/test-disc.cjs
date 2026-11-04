const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const count = await p.perfilDiscAvaliacao.count();
  console.log('Count:', count);
  const empresas = await p.empresa.findMany({ select: { id: true, nomeFantasia: true, razaoSocial: true }, take: 3 });
  console.log('Empresas:', empresas);
}

main().catch(console.error).finally(() => p.$disconnect());

