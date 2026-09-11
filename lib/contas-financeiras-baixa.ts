// ============================================================
// LÓGICA DE BAIXA/ESTORNO — CONTAS A RECEBER/PAGAR
// ============================================================
// Extraído das rotas app/api/v1/contas-{receber,pagar}/[id]/baixas — eram
// duas cópias quase idênticas. Agora também é usado pela rota interna
// (app/api/contas-financeiras/[id]/baixas), que permite ao consultor dar
// baixa pelo portal (ex.: ao conciliar um extrato OFX com um título vindo
// da API do ERP) sem precisar de uma chave de API.
//
// Cada baixa é um registro aditivo (nunca editado/apagado). O status da
// conta (aberto/parcial/liquidado) é recalculado a partir da SOMA de todas
// as baixas — inclusive as de estorno, que entram negativas na soma.

import type { PrismaClient } from '@prisma/client';
import { validarValorMonetario, validarDataIso, calcularStatus } from './api-v1-validation';

export interface PayloadBaixa {
  valor?: unknown;
  data?: unknown;
  formaPagamento?: unknown;
  observacao?: unknown;
  estornoDeId?: unknown;
}

export type ResultadoBaixa =
  | { ok: true; status: 201; data: { baixaId: string; valor: number; estorno: boolean; statusConta: string; totalBaixado: number }; liquidandoAgora: boolean; empresaId: string; sacadoOuFornecedorId: string | null; valorLiquido: number; conciliadoEm: Date | null }
  | { ok: false; status: number; error: string; detalhes?: string };

/** `tipo` decide se opera sobre contaReceber/contaReceberBaixa ou contaPagar/contaPagarBaixa. */
export async function registrarBaixaContaFinanceira(
  db: PrismaClient,
  tipo: 'receber' | 'pagar',
  id: string,
  empresaId: string,
  corpo: PayloadBaixa | null
): Promise<ResultadoBaixa> {
  const modeloConta = tipo === 'receber' ? db.contaReceber : db.contaPagar;
  const modeloBaixa = tipo === 'receber' ? db.contaReceberBaixa : db.contaPagarBaixa;
  const campoFk = tipo === 'receber' ? 'contaReceberId' : 'contaPagarId';
  const campoPessoa = tipo === 'receber' ? 'sacadoId' : 'fornecedorId';

  const conta = await (modeloConta as any).findFirst({ where: { id, empresaId }, include: { baixas: true } });
  if (!conta) return { ok: false, status: 404, error: `Conta a ${tipo} não encontrada.` };
  if (conta.status === 'cancelado') {
    return { ok: false, status: 409, error: 'Conta cancelada — não aceita baixas nem estornos.' };
  }

  if (!corpo || typeof corpo !== 'object') {
    return { ok: false, status: 422, error: 'Payload ausente ou inválido.' };
  }

  let valor: number;
  let estornoDeId: string | null = null;

  if (corpo.estornoDeId) {
    const original = conta.baixas.find((b: any) => b.id === corpo.estornoDeId);
    if (!original) return { ok: false, status: 422, error: 'estornoDeId não corresponde a uma baixa desta conta.' };
    if (original.valor < 0) return { ok: false, status: 422, error: 'Não é possível estornar um estorno.' };
    const jaEstornada = conta.baixas.some((b: any) => b.estornoDeId === original.id);
    if (jaEstornada) return { ok: false, status: 409, error: 'Esta baixa já foi estornada anteriormente.' };
    valor = -original.valor;
    estornoDeId = original.id;
  } else {
    const v = validarValorMonetario(corpo.valor);
    if (!v.valido) return { ok: false, status: 422, error: 'valor inválido.', detalhes: v.erro };
    if (!validarDataIso(corpo.data)) return { ok: false, status: 422, error: 'data deve estar no formato YYYY-MM-DD.' };
    valor = v.valor;
  }

  const baixa = await (modeloBaixa as any).create({
    data: {
      [campoFk]: id,
      data: (typeof corpo.data === 'string' && corpo.data) || new Date().toISOString().split('T')[0],
      valor,
      formaPagamento: typeof corpo.formaPagamento === 'string' ? corpo.formaPagamento : null,
      observacao: typeof corpo.observacao === 'string' ? corpo.observacao : null,
      estornoDeId,
    },
  });

  const totalBaixado = [...conta.baixas, baixa].reduce((s: number, b: any) => s + b.valor, 0);
  const novoStatus = calcularStatus({ valorLiquido: conta.valorLiquido, totalBaixado });
  const liquidandoAgora = novoStatus === 'liquidado' && conta.status !== 'liquidado';

  const contaAtualizada = await (modeloConta as any).update({
    where: { id },
    data: { status: novoStatus, conciliadoEm: liquidandoAgora ? new Date() : conta.conciliadoEm },
  });

  return {
    ok: true,
    status: 201,
    data: { baixaId: baixa.id, valor: baixa.valor, estorno: Boolean(estornoDeId), statusConta: novoStatus, totalBaixado },
    liquidandoAgora,
    empresaId,
    sacadoOuFornecedorId: conta[campoPessoa] ?? null,
    valorLiquido: conta.valorLiquido,
    conciliadoEm: contaAtualizada.conciliadoEm,
  };
}
