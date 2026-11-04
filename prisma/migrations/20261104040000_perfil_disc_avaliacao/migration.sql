-- CreateTable
CREATE TABLE "PerfilDiscAvaliacao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tipoRespondente" TEXT NOT NULL DEFAULT 'colaborador',
    "nomeRespondente" TEXT,
    "emailRespondente" TEXT,
    "cargoRespondente" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "versaoQuestionario" INTEGER NOT NULL DEFAULT 1,
    "criadoPorId" TEXT NOT NULL,
    "consentimentoEm" TIMESTAMP(3),
    "iniciadoEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),
    "tempoRespostaSeg" INTEGER,
    "respostas" JSONB,
    "resultado" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerfilDiscAvaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerfilDiscAvaliacao_token_key" ON "PerfilDiscAvaliacao"("token");

-- CreateIndex
CREATE INDEX "PerfilDiscAvaliacao_empresaId_status_idx" ON "PerfilDiscAvaliacao"("empresaId", "status");

-- AddForeignKey
ALTER TABLE "PerfilDiscAvaliacao" ADD CONSTRAINT "PerfilDiscAvaliacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
