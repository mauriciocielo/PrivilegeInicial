-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "contratoDiaVencimento" INTEGER,
ADD COLUMN     "contratoDuracaoMeses" INTEGER,
ADD COLUMN     "contratoHorasSemanais" INTEGER,
ADD COLUMN     "contratoInicioServicos" TEXT,
ADD COLUMN     "contratoParcelas" INTEGER,
ADD COLUMN     "contratoPrimeiroVencimento" TEXT,
ADD COLUMN     "contratoValorEntrada" DOUBLE PRECISION,
ADD COLUMN     "contratoValorTotal" DOUBLE PRECISION,
ADD COLUMN     "endereco" TEXT,
ADD COLUMN     "uf" TEXT;
