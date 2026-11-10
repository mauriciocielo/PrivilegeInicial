const { db } = require('../lib/prisma');
require('dotenv').config();

async function main() {
  const sql = `
    CREATE TABLE IF NOT EXISTS "EmailDisparoLog" (
      "id" TEXT PRIMARY KEY,
      "empresaId" TEXT,
      "tipo" TEXT NOT NULL DEFAULT 'newsletter',
      "assunto" TEXT NOT NULL,
      "destinatarioEmail" TEXT NOT NULL,
      "destinatarioNome" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pendente',
      "erroMensagem" TEXT,
      "enviadoEm" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      "visualizadoEm" TIMESTAMP(3),
      "baixadoEm" TIMESTAMP(3),
      "ipAcesso" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "EmailDisparoLog_empresaId_idx" ON "EmailDisparoLog" ("empresaId");
    CREATE INDEX IF NOT EXISTS "EmailDisparoLog_status_idx" ON "EmailDisparoLog" ("status");
    CREATE INDEX IF NOT EXISTS "EmailDisparoLog_createdAt_idx" ON "EmailDisparoLog" ("createdAt");
  `;
  await db.$executeRawUnsafe(sql);
  console.log('Tabela EmailDisparoLog criada com sucesso no PostgreSQL!');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
