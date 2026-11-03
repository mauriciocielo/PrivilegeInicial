-- AlterTable
ALTER TABLE "NfsE" ADD COLUMN     "gerarContaReceber" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "planoContaId" TEXT,
ADD COLUMN     "portadorId" TEXT,
ADD COLUMN     "vencimento" TEXT;
