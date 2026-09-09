-- CreateTable
CREATE TABLE "PoliticaGlobal" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoliticaGlobal_pkey" PRIMARY KEY ("id")
);
