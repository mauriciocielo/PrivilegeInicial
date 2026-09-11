-- CreateEnum
CREATE TYPE "StatusContaFinanceira" AS ENUM ('aberto', 'parcial', 'liquidado', 'cancelado');

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "regimeTributario" TEXT;

-- CreateTable
CREATE TABLE "ProjecaoFaturamento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "faturamento" DOUBLE PRECISION NOT NULL,
    "despesas" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjecaoFaturamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiAuditLog" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT,
    "keyId" TEXT,
    "metodo" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "ip" TEXT,
    "statusCode" INTEGER NOT NULL,
    "payload" TEXT,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaReceber" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sacadoId" TEXT NOT NULL,
    "planoContaId" TEXT,
    "numeroDocumento" TEXT,
    "descricao" TEXT,
    "documentoFiscalUrl" TEXT,
    "dataEmissao" TEXT NOT NULL,
    "dataVencimento" TEXT NOT NULL,
    "dataCompetencia" TEXT NOT NULL,
    "valorOriginal" DOUBLE PRECISION NOT NULL,
    "acrescimos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descontos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorLiquido" DOUBLE PRECISION NOT NULL,
    "status" "StatusContaFinanceira" NOT NULL DEFAULT 'aberto',
    "origemApiKeyId" TEXT,
    "conciliadoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaReceber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaReceberBaixa" (
    "id" TEXT NOT NULL,
    "contaReceberId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "formaPagamento" TEXT,
    "observacao" TEXT,
    "estornoDeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaReceberBaixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaPagar" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "planoContaId" TEXT,
    "centroCustoId" TEXT,
    "numeroDocumento" TEXT,
    "descricao" TEXT,
    "dataEmissao" TEXT NOT NULL,
    "dataVencimento" TEXT NOT NULL,
    "valorOriginal" DOUBLE PRECISION NOT NULL,
    "acrescimos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descontos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorLiquido" DOUBLE PRECISION NOT NULL,
    "status" "StatusContaFinanceira" NOT NULL DEFAULT 'aberto',
    "origemApiKeyId" TEXT,
    "conciliadoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaPagar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaPagarBaixa" (
    "id" TEXT NOT NULL,
    "contaPagarId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "formaPagamento" TEXT,
    "observacao" TEXT,
    "estornoDeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaPagarBaixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookSubscription" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "eventos" TEXT[],
    "segredo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "statusCode" INTEGER,
    "sucesso" BOOLEAN NOT NULL DEFAULT false,
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjecaoFaturamento_empresaId_idx" ON "ProjecaoFaturamento"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjecaoFaturamento_empresaId_competencia_key" ON "ProjecaoFaturamento"("empresaId", "competencia");

-- CreateIndex
CREATE INDEX "ApiAuditLog_empresaId_idx" ON "ApiAuditLog"("empresaId");

-- CreateIndex
CREATE INDEX "ApiAuditLog_criadoEm_idx" ON "ApiAuditLog"("criadoEm");

-- CreateIndex
CREATE INDEX "ContaReceber_empresaId_idx" ON "ContaReceber"("empresaId");

-- CreateIndex
CREATE INDEX "ContaReceber_sacadoId_idx" ON "ContaReceber"("sacadoId");

-- CreateIndex
CREATE INDEX "ContaReceber_status_idx" ON "ContaReceber"("status");

-- CreateIndex
CREATE INDEX "ContaReceberBaixa_contaReceberId_idx" ON "ContaReceberBaixa"("contaReceberId");

-- CreateIndex
CREATE INDEX "ContaPagar_empresaId_idx" ON "ContaPagar"("empresaId");

-- CreateIndex
CREATE INDEX "ContaPagar_fornecedorId_idx" ON "ContaPagar"("fornecedorId");

-- CreateIndex
CREATE INDEX "ContaPagar_status_idx" ON "ContaPagar"("status");

-- CreateIndex
CREATE INDEX "ContaPagarBaixa_contaPagarId_idx" ON "ContaPagarBaixa"("contaPagarId");

-- CreateIndex
CREATE INDEX "WebhookSubscription_empresaId_idx" ON "WebhookSubscription"("empresaId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_subscriptionId_idx" ON "WebhookDelivery"("subscriptionId");

-- AddForeignKey
ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_sacadoId_fkey" FOREIGN KEY ("sacadoId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaReceberBaixa" ADD CONSTRAINT "ContaReceberBaixa_contaReceberId_fkey" FOREIGN KEY ("contaReceberId") REFERENCES "ContaReceber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagarBaixa" ADD CONSTRAINT "ContaPagarBaixa_contaPagarId_fkey" FOREIGN KEY ("contaPagarId") REFERENCES "ContaPagar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

