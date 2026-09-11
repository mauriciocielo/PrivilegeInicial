import { NextResponse } from 'next/server';
import db from '../../../../../../lib/prisma';
import { requireApiKey } from '../../../../../../lib/api-v1-auth';
import { registrarBaixaContaFinanceira } from '../../../../../../lib/contas-financeiras-baixa';
import { sincronizarLancamentoEspelhoNaBaixa } from '../../../../../../lib/lancamento-espelho-api';
import { registrarAuditoriaApi } from '../../../../../../lib/api-v1-audit';
import { dispararWebhook } from '../../../../../../lib/webhook-dispatch';
import { captureError } from '../../../../../../lib/sentry-helper';

/** Espelho de contas-receber/[id]/baixas — ver comentário lá para o desenho de estorno. */
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

    const r = await registrarBaixaContaFinanceira(db, 'pagar', id, empresaId, corpo);
    status = r.status;
    if (!r.ok) return NextResponse.json({ error: r.error, ...(r.detalhes ? { detalhes: r.detalhes } : {}) }, { status });

    if (r.liquidandoAgora) {
      await sincronizarLancamentoEspelhoNaBaixa(db, 'pagar', id);
      dispararWebhook(empresaId, 'conta_pagar.liquidada', {
        contaPagarId: id, fornecedorId: r.sacadoOuFornecedorId, valorLiquido: r.valorLiquido,
        liquidadoEm: r.conciliadoEm,
      }).catch(() => {});
    }

    return NextResponse.json(r.data, { status });
  } catch (error) {
    console.error('Erro em POST /api/v1/contas-pagar/[id]/baixas:', error);
    captureError(error);
    status = 500;
    return NextResponse.json({ error: 'Erro interno ao registrar a baixa.' }, { status });
  } finally {
    await registrarAuditoriaApi({ request, empresaId, apiKeyId, statusCode: status, payload: corpo });
  }
}
