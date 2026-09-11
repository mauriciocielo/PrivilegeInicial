-- Campo informativo (não baixa nada sozinho) de como um titulo da API sera
-- pago -- ex.: "PIX", "Cartao de credito 3x", "Boleto 30 dias".
ALTER TABLE "ContaPagar" ADD COLUMN     "formaPagamentoPrevista" TEXT;
ALTER TABLE "ContaReceber" ADD COLUMN     "formaPagamentoPrevista" TEXT;
