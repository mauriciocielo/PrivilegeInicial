-- Reconstrução local desta migration, aplicada originalmente por outra sessão
-- direto no banco (nunca chegou a este repositório). SQL abaixo derivado por
-- introspecção do estado real do banco (prisma db pull) em 2026-09-10 — não é
-- o texto original, mas reproduz a mesma estrutura.

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN "osPlanoContaPadraoId" TEXT,
  ADD COLUMN "osPortadorPadraoId" TEXT,
  ADD COLUMN "osWebhookUrl" TEXT,
  ADD COLUMN "osWebhookSecret" TEXT;

-- AlterTable
ALTER TABLE "Lancamento" ADD COLUMN "osNumero" TEXT,
  ADD COLUMN "osParcela" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Lancamento_empresaId_osNumero_osParcela_key" ON "Lancamento"("empresaId", "osNumero", "osParcela");

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "chaveHash" TEXT NOT NULL,
    "prefixo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoUsoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_chaveHash_key" ON "ApiKey"("chaveHash");

-- CreateIndex
CREATE INDEX "ApiKey_empresaId_idx" ON "ApiKey"("empresaId");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
