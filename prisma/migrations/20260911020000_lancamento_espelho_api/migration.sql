-- Espelho, no Lancamento (fluxo classico local-first), de um titulo lancado
-- via API v1 (ContaReceber/ContaPagar) -- permite dar baixa/conciliar pelo
-- fluxo de sempre (Contas a Receber/Pagar + Importar OFX) mantendo o
-- livro-razao imutavel em sincronia.
ALTER TABLE "Lancamento" ADD COLUMN     "contaPagarId" TEXT,
ADD COLUMN     "contaReceberId" TEXT;
