-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "empresaIds" TEXT[],
    "avatarData" TEXT,
    "receberEmailDiario" BOOLEAN NOT NULL DEFAULT false,
    "allowedRoutes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phone" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "responsavel" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "atividade" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'empresa',
    "taxaMensalPadrao" DOUBLE PRECISION,
    "fundoReservaPct" DOUBLE PRECISION,
    "dataInicioContrato" TEXT,
    "grupoEconomico" TEXT,
    "receitaMensalEstimada" DOUBLE PRECISION,
    "comprasMensalEstimada" DOUBLE PRECISION,
    "logoData" TEXT,
    "bancoBoleto" TEXT NOT NULL DEFAULT 'nenhum',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allowedRoutes" TEXT[],
    "politicaCobrancaData" TEXT,
    "politicaCobrancaName" TEXT,
    "politicaComprasData" TEXT,
    "politicaComprasName" TEXT,
    "politicaReceberData" TEXT,
    "politicaReceberName" TEXT,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unidade" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "identificacao" TEXT NOT NULL,
    "proprietario" TEXT NOT NULL,
    "proprietarioCpf" TEXT,
    "fracaoIdeal" DOUBLE PRECISION NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "moradorNome" TEXT,
    "moradorCpf" TEXT,
    "moradorEmail" TEXT,
    "moradorTelefone" TEXT,

    CONSTRAINT "Unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanoConta" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "parentId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "empresaId" TEXT NOT NULL,
    "dreCategoria" TEXT,

    CONSTRAINT "PlanoConta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portador" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "saldoInicial" DOUBLE PRECISION NOT NULL,
    "saldoInicialData" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "empresaId" TEXT NOT NULL,

    CONSTRAINT "Portador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endividamento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "conta" TEXT NOT NULL,
    "contrato" TEXT NOT NULL,
    "descricaoContrato" TEXT,
    "taxa" DOUBLE PRECISION NOT NULL,
    "taxaTipo" TEXT,
    "indexador" TEXT NOT NULL,
    "parcela" INTEGER NOT NULL,
    "parcelasFaltantes" INTEGER NOT NULL,
    "valorQuitacao" DOUBLE PRECISION NOT NULL,
    "valorAPagar" DOUBLE PRECISION NOT NULL,
    "garantia" TEXT NOT NULL,
    "pagamentoMes" INTEGER NOT NULL,

    CONSTRAINT "Endividamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagamentoEndividamento" (
    "id" TEXT NOT NULL,
    "endividamentoId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "valorJuros" DOUBLE PRECISION NOT NULL,
    "valorAmortizacao" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PagamentoEndividamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtaAtendimento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "consultorId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "participantes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtaAtendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicadorMensal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "faturamento" DOUBLE PRECISION NOT NULL,
    "compras" DOUBLE PRECISION NOT NULL,
    "inadimplencia" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "IndicadorMensal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrcamentoMensal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,

    CONSTRAINT "OrcamentoMensal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrcamentoValor" (
    "id" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "planoContaId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "OrcamentoValor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaBalanco" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "subgrupo" TEXT,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaBalanco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalancoPatrimonial" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalancoPatrimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalancoValor" (
    "id" TEXT NOT NULL,
    "balancoId" TEXT NOT NULL,
    "contaBalancoId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "BalancoValor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnostico360" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "consultor" TEXT NOT NULL,
    "respondente" JSONB NOT NULL,
    "respostas" JSONB NOT NULL,
    "anotacoes" JSONB NOT NULL,
    "parecer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Diagnostico360_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurvaAbcConfig" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "percentualA" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "percentualB" DOUBLE PRECISION NOT NULL DEFAULT 95,

    CONSTRAINT "CurvaAbcConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurvaAbc" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataImportacao" TEXT NOT NULL,
    "percentualA" DOUBLE PRECISION NOT NULL,
    "percentualB" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurvaAbc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurvaAbcItem" (
    "id" TEXT NOT NULL,
    "curvaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valorFaturado" DOUBLE PRECISION NOT NULL,
    "percentualIndividual" DOUBLE PRECISION NOT NULL,
    "percentualAcumulado" DOUBLE PRECISION NOT NULL,
    "classificacao" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "CurvaAbcItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lancamento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "tipo" TEXT NOT NULL,
    "planoContaId" TEXT NOT NULL,
    "portadorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "numeroDocumento" TEXT,
    "observacao" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "ofxId" TEXT,
    "unidadeId" TEXT,
    "clienteId" TEXT,
    "attachmentName" TEXT,
    "attachmentData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cpfCnpj" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "celular" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "contato" TEXT,
    "observacao" TEXT,
    "limiteCredito" DOUBLE PRECISION,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfsE" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "serie" TEXT NOT NULL DEFAULT '1',
    "codigoVerificacao" TEXT,
    "status" TEXT NOT NULL,
    "motivoCancelamento" TEXT,
    "prestadorCnpj" TEXT NOT NULL,
    "prestadorRazaoSocial" TEXT NOT NULL,
    "prestadorInscricaoMunicipal" TEXT,
    "prestadorEndereco" TEXT,
    "prestadorCidade" TEXT,
    "prestadorUf" TEXT,
    "prestadorCep" TEXT,
    "clienteId" TEXT,
    "tomadorCnpjCpf" TEXT NOT NULL,
    "tomadorRazaoSocial" TEXT NOT NULL,
    "tomadorEmail" TEXT,
    "tomadorEndereco" TEXT,
    "tomadorCidade" TEXT,
    "tomadorUf" TEXT,
    "tomadorCep" TEXT,
    "tomadorInscricaoMunicipal" TEXT,
    "dataEmissao" TEXT NOT NULL,
    "dataCompetencia" TEXT NOT NULL,
    "codigoServico" TEXT NOT NULL,
    "cnae" TEXT,
    "discriminacao" TEXT NOT NULL,
    "municipioPrestacao" TEXT,
    "valorServicos" DOUBLE PRECISION NOT NULL,
    "valorDeducoes" DOUBLE PRECISION NOT NULL,
    "valorPis" DOUBLE PRECISION NOT NULL,
    "valorCofins" DOUBLE PRECISION NOT NULL,
    "valorInss" DOUBLE PRECISION NOT NULL,
    "valorIr" DOUBLE PRECISION NOT NULL,
    "valorCsll" DOUBLE PRECISION NOT NULL,
    "issRetido" BOOLEAN NOT NULL DEFAULT false,
    "valorIss" DOUBLE PRECISION NOT NULL,
    "aliquotaIss" DOUBLE PRECISION NOT NULL,
    "valorBaseCalculo" DOUBLE PRECISION NOT NULL,
    "valorLiquido" DOUBLE PRECISION NOT NULL,
    "lancamentoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "NfsE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionPattern" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "TransactionPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SituacaoFiscal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "dataVerificacao" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "observacoes" TEXT NOT NULL,

    CONSTRAINT "SituacaoFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atividade" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tempoSegundos" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "fotoInicio" TEXT,
    "fotoFim" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Atividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroCusto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CentroCusto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "consultorId" TEXT NOT NULL,
    "horario" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "recurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgendaTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteligenciaDoc" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteligenciaDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_cnpj_key" ON "Empresa"("cnpj");

-- CreateIndex
CREATE INDEX "ContaBalanco_empresaId_idx" ON "ContaBalanco"("empresaId");

-- CreateIndex
CREATE INDEX "BalancoPatrimonial_empresaId_idx" ON "BalancoPatrimonial"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "BalancoPatrimonial_empresaId_competencia_key" ON "BalancoPatrimonial"("empresaId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "BalancoValor_balancoId_contaBalancoId_key" ON "BalancoValor"("balancoId", "contaBalancoId");

-- CreateIndex
CREATE INDEX "Diagnostico360_empresaId_idx" ON "Diagnostico360"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "CurvaAbcConfig_empresaId_key" ON "CurvaAbcConfig"("empresaId");

-- CreateIndex
CREATE INDEX "CurvaAbc_empresaId_idx" ON "CurvaAbc"("empresaId");

-- CreateIndex
CREATE INDEX "CurvaAbcItem_curvaId_idx" ON "CurvaAbcItem"("curvaId");

-- CreateIndex
CREATE INDEX "AuditLog_empresaId_idx" ON "AuditLog"("empresaId");

-- CreateIndex
CREATE INDEX "CentroCusto_empresaId_idx" ON "CentroCusto"("empresaId");

-- CreateIndex
CREATE INDEX "AgendaTask_empresaId_idx" ON "AgendaTask"("empresaId");

-- AddForeignKey
ALTER TABLE "Unidade" ADD CONSTRAINT "Unidade_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoConta" ADD CONSTRAINT "PlanoConta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoConta" ADD CONSTRAINT "PlanoConta_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PlanoConta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portador" ADD CONSTRAINT "Portador_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endividamento" ADD CONSTRAINT "Endividamento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoEndividamento" ADD CONSTRAINT "PagamentoEndividamento_endividamentoId_fkey" FOREIGN KEY ("endividamentoId") REFERENCES "Endividamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtaAtendimento" ADD CONSTRAINT "AtaAtendimento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicadorMensal" ADD CONSTRAINT "IndicadorMensal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrcamentoMensal" ADD CONSTRAINT "OrcamentoMensal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrcamentoValor" ADD CONSTRAINT "OrcamentoValor_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "OrcamentoMensal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaBalanco" ADD CONSTRAINT "ContaBalanco_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalancoPatrimonial" ADD CONSTRAINT "BalancoPatrimonial_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalancoValor" ADD CONSTRAINT "BalancoValor_balancoId_fkey" FOREIGN KEY ("balancoId") REFERENCES "BalancoPatrimonial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalancoValor" ADD CONSTRAINT "BalancoValor_contaBalancoId_fkey" FOREIGN KEY ("contaBalancoId") REFERENCES "ContaBalanco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnostico360" ADD CONSTRAINT "Diagnostico360_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurvaAbcConfig" ADD CONSTRAINT "CurvaAbcConfig_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurvaAbc" ADD CONSTRAINT "CurvaAbc_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurvaAbcItem" ADD CONSTRAINT "CurvaAbcItem_curvaId_fkey" FOREIGN KEY ("curvaId") REFERENCES "CurvaAbc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_planoContaId_fkey" FOREIGN KEY ("planoContaId") REFERENCES "PlanoConta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_portadorId_fkey" FOREIGN KEY ("portadorId") REFERENCES "Portador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfsE" ADD CONSTRAINT "NfsE_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfsE" ADD CONSTRAINT "NfsE_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfsE" ADD CONSTRAINT "NfsE_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionPattern" ADD CONSTRAINT "TransactionPattern_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PlanoConta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionPattern" ADD CONSTRAINT "TransactionPattern_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SituacaoFiscal" ADD CONSTRAINT "SituacaoFiscal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

