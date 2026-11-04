-- CreateTable
CREATE TABLE "NfeDistribuicao" (
    "empresaId" TEXT NOT NULL,
    "ultNsu" TEXT NOT NULL DEFAULT '0',
    "maxNsu" TEXT NOT NULL DEFAULT '0',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaConsultaEm" TIMESTAMP(3),
    "proximaConsultaEm" TIMESTAMP(3),
    "ultimoStatus" TEXT,
    "ultimaMensagem" TEXT,
    "certOrigem" TEXT,
    "totalDocumentos" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfeDistribuicao_pkey" PRIMARY KEY ("empresaId")
);

-- CreateTable
CREATE TABLE "NfeDestinada" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "chaveAcesso" TEXT NOT NULL,
    "nsu" TEXT NOT NULL,
    "numero" TEXT,
    "serie" TEXT,
    "emitenteCnpj" TEXT NOT NULL,
    "emitenteNome" TEXT NOT NULL,
    "emitenteIe" TEXT,
    "dataEmissao" TEXT NOT NULL,
    "tipoOperacao" INTEGER,
    "valorNf" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "situacao" TEXT NOT NULL DEFAULT 'autorizada',
    "protocolo" TEXT,
    "manifestacao" TEXT,
    "possuiXml" BOOLEAN NOT NULL DEFAULT false,
    "xml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfeDestinada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NfeDestinada_empresaId_dataEmissao_idx" ON "NfeDestinada"("empresaId", "dataEmissao");

-- CreateIndex
CREATE UNIQUE INDEX "NfeDestinada_empresaId_chaveAcesso_key" ON "NfeDestinada"("empresaId", "chaveAcesso");

-- AddForeignKey
ALTER TABLE "NfeDistribuicao" ADD CONSTRAINT "NfeDistribuicao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeDestinada" ADD CONSTRAINT "NfeDestinada_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

