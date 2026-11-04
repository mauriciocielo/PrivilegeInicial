-- CreateTable
CREATE TABLE "CertidaoFiscal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "uf" TEXT,
    "situacao" TEXT NOT NULL,
    "protocolo" TEXT,
    "codigoAutenticidade" TEXT,
    "numeroCertidao" TEXT,
    "emitidoEm" TIMESTAMP(3),
    "validoAte" TIMESTAMP(3),
    "pdfBase64" TEXT,
    "pendencias" JSONB,
    "observacoes" TEXT,
    "criadoAutomaticamente" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertidaoFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertidaoConfig" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "executarUltimoDia" BOOLEAN NOT NULL DEFAULT true,
    "diaDoMes" INTEGER DEFAULT 0,
    "horario" TEXT NOT NULL DEFAULT '23:00',
    "consultarFederal" BOOLEAN NOT NULL DEFAULT true,
    "consultarEstadual" BOOLEAN NOT NULL DEFAULT true,
    "notificarEmail" BOOLEAN NOT NULL DEFAULT true,
    "emailsNotificacao" TEXT,
    "notificarApenasComPendencias" BOOLEAN NOT NULL DEFAULT true,
    "ultimaExecucaoEm" TIMESTAMP(3),
    "statusUltimaExecucao" TEXT,
    "detalhesUltimaExecucao" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertidaoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CertidaoConfig_empresaId_key" ON "CertidaoConfig"("empresaId");

-- CreateIndex
CREATE INDEX "CertidaoFiscal_empresaId_tipo_idx" ON "CertidaoFiscal"("empresaId", "tipo");

-- CreateIndex
CREATE INDEX "CertidaoFiscal_empresaId_createdAt_idx" ON "CertidaoFiscal"("empresaId", "createdAt");

-- AddForeignKey
ALTER TABLE "CertidaoFiscal" ADD CONSTRAINT "CertidaoFiscal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertidaoConfig" ADD CONSTRAINT "CertidaoConfig_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

