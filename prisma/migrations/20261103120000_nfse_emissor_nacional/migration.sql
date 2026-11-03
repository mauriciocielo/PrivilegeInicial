-- AlterTable
ALTER TABLE "NfsE" ADD COLUMN     "ambiente" TEXT,
ADD COLUMN     "cNbs" TEXT,
ADD COLUMN     "cTribMun" TEXT,
ADD COLUMN     "cancelamentoEmAnalise" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "chaveAcesso" TEXT,
ADD COLUMN     "idDps" TEXT,
ADD COLUMN     "nDps" TEXT,
ADD COLUMN     "tomadorBairro" TEXT,
ADD COLUMN     "tomadorCodigoMunicipio" TEXT,
ADD COLUMN     "tomadorNumero" TEXT,
ADD COLUMN     "ultimoErro" TEXT;

-- CreateTable
CREATE TABLE "NfseDocumento" (
    "nfseId" TEXT NOT NULL,
    "dpsXml" TEXT,
    "nfseXml" TEXT NOT NULL,
    "eventoXml" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfseDocumento_pkey" PRIMARY KEY ("nfseId")
);

-- CreateTable
CREATE TABLE "NfseConfig" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
    "codigoMunicipio" TEXT,
    "inscricaoMunicipal" TEXT,
    "opSimpNac" INTEGER NOT NULL DEFAULT 3,
    "regApTribSN" INTEGER DEFAULT 1,
    "regEspTrib" INTEGER NOT NULL DEFAULT 0,
    "pTotTribSN" DOUBLE PRECISION,
    "piscofinsCst" TEXT NOT NULL DEFAULT '08',
    "tpRetPisCofins" TEXT,
    "pTotTribFed" DOUBLE PRECISION,
    "pTotTribEst" DOUBLE PRECISION,
    "pTotTribMun" DOUBLE PRECISION,
    "convenioAtivo" BOOLEAN NOT NULL DEFAULT true,
    "ibsCbsCIndOp" TEXT,
    "ibsCbsCst" TEXT,
    "ibsCbsCClassTrib" TEXT,
    "ibsCbsIndFinal" TEXT,
    "leiaute" TEXT,
    "serie" TEXT NOT NULL DEFAULT '10',
    "proximoNDpsHomologacao" INTEGER NOT NULL DEFAULT 1,
    "proximoNDpsProducao" INTEGER NOT NULL DEFAULT 1,
    "cTribNacPadrao" TEXT,
    "cTribMunPadrao" TEXT,
    "cNbsPadrao" TEXT,
    "certPfxCifrado" TEXT,
    "certSenhaCifrada" TEXT,
    "certNomeArquivo" TEXT,
    "certTitular" TEXT,
    "certCnpj" TEXT,
    "certValidoAte" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfseConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NfseConfig_empresaId_key" ON "NfseConfig"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "NfsE_chaveAcesso_key" ON "NfsE"("chaveAcesso");

-- AddForeignKey
ALTER TABLE "NfseDocumento" ADD CONSTRAINT "NfseDocumento_nfseId_fkey" FOREIGN KEY ("nfseId") REFERENCES "NfsE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfseConfig" ADD CONSTRAINT "NfseConfig_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

