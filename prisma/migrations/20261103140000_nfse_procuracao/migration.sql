-- AlterTable
ALTER TABLE "NfseConfig" ADD COLUMN     "procuracaoMensagem" TEXT,
ADD COLUMN     "procuracaoStatus" TEXT,
ADD COLUMN     "procuracaoVerificadaEm" TIMESTAMP(3),
ADD COLUMN     "usarProcuracao" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "NfseCertificadoEscritorio" (
    "id" TEXT NOT NULL DEFAULT 'padrao',
    "certPfxCifrado" TEXT NOT NULL,
    "certSenhaCifrada" TEXT NOT NULL,
    "nomeArquivo" TEXT,
    "titular" TEXT NOT NULL,
    "documento" TEXT,
    "validoAte" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfseCertificadoEscritorio_pkey" PRIMARY KEY ("id")
);

