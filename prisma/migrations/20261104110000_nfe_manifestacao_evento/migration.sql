-- CreateTable
CREATE TABLE "NfeManifestacaoEvento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "chaveAcesso" TEXT NOT NULL,
    "tpEvento" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioEmail" TEXT NOT NULL,
    "cStat" TEXT,
    "xMotivo" TEXT,
    "protocolo" TEXT,
    "registrado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfeManifestacaoEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NfeManifestacaoEvento_empresaId_chaveAcesso_idx" ON "NfeManifestacaoEvento"("empresaId", "chaveAcesso");

-- AddForeignKey
ALTER TABLE "NfeManifestacaoEvento" ADD CONSTRAINT "NfeManifestacaoEvento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
