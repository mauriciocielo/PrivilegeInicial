import { NextResponse } from 'next/server';
import db from '../../../../../../lib/prisma';
import { requireApiKey } from '../../../../../../lib/api-v1-auth';
import { registrarBaixaContaFinanceira } from '../../../../../../lib/contas-financeiras-baixa';
import { sincronizarLancamentoEspelhoNaBaixa } from '../../../../../../lib/lancamento-espelho-api';
import { registrarAuditoriaApi } from '../../../../../../lib/api-v1-audit';
import { dispararWebhook } from '../../../../../../lib/webhook-dispatch';
import { captureError } from '../../../../../../lib/sentry-helper';

/**
 * POST /api/v1/contas-receber/{id}/baixas
 *
 * Duas formas de uso:
 *  - Baixa normal:  { "valor": 500.00, "data": "2026-09-10", "formaPagamento": "PIX" }
 *  - Estorno:       { "estornoDeId": "<id de uma baixa anterior>", "observacao": "motivo" }
 *    O valor do estorno é sempre o negativo exato da baixa original — o
 *    cliente da API não escolhe o valor, evitando estorno parcial por engano.
 *
 * A regra de negócio (validação, recálculo de status) mora em
 * lib/contas-financeiras-baixa.ts, compartilhada com contas-pagar/baixas e
 * com a rota interna usada pelo portal (app/api/contas-financeiras).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let empresaId: string | undefined;
  let apiKeyId: string | undefined;
  let status = 500;
  let corpo: any;

  try {
    const auth = await requireApiKey(request);
    if (auth.error) return auth.error;
    empresaId = auth.contexto.empresaId;
    apiKeyId = auth.contexto.apiKeyId;
    const { id } = await params;

    corpo = await request.json().catch(() => null);

    const r = await registrarBaixaContaFinanceira(db, 'receber', id, empresaId, corpo);
    status = r.status;
    if (!r.ok) return NextResponse.json({ error: r.error, ...(r.detalhes ? { detalhes: r.detalhes } : {}) }, { status });

    if (r.liquidandoAgora) {
      await sincronizarLancamentoEspelhoNaBaixa(db, 'receber', id);
      dispararWebhook(empresaId, 'conta_receber.liquidada', {
        contaReceberId: id, sacadoId: r.sacadoOuFornecedorId, valorLiquido: r.valorLiquido,
        liquidadoEm: r.conciliadoEm,
      }).catch(() => {});
    }

    return NextResponse.json(r.data, { status });
  } catch (error) {
    console.error('Erro em POST /api/v1/contas-receber/[id]/baixas:', error);
    captureError(error);
    status = 500;
    return NextResponse.json({ error: 'Erro interno ao registrar a baixa.' }, { status });
  } finally {
    await registrarAuditoriaApi({ request, empresaId, apiKeyId, statusCode: status, payload: corpo });
  }
}
