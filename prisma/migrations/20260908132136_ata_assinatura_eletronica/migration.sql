-- AlterTable
ALTER TABLE "AtaAtendimento" ADD COLUMN     "assinaturaEnviadaEm" TIMESTAMP(3),
ADD COLUMN     "assinaturaId" TEXT;

-- CreateTable
CREATE TABLE "HistoricoSaldoEndividamento" (
    "id" TEXT NOT NULL,
    "endividamentoId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "saldoDevedor" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoSaldoEndividamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Imobilizado" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataAquisicao" TEXT NOT NULL,
    "valorAquisicao" DOUBLE PRECISION NOT NULL,
    "taxaDepreciacao" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Imobilizado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Imobilizado_empresaId_idx" ON "Imobilizado"("empresaId");

-- AddForeignKey
ALTER TABLE "HistoricoSaldoEndividamento" ADD CONSTRAINT "HistoricoSaldoEndividamento_endividamentoId_fkey" FOREIGN KEY ("endividamentoId") REFERENCES "Endividamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Imobilizado" ADD CONSTRAINT "Imobilizado_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
