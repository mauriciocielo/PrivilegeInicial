import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/api-auth';
import { registrarBaixaContaFinanceira } from '../../../../../lib/contas-financeiras-baixa';
import { dispararWebhook } from '../../../../../lib/webhook-dispatch';
import { captureError } from '../../../../../lib/sentry-helper';

/**
 * POST /api/contas-financeiras/{id}/baixas?tipo=receber|pagar
 *
 * Versão autenticada por sessão (não por API key) da mesma baixa exposta em
 * /api/v1/contas-{receber,pagar}/{id}/baixas — usada pelo próprio portal,
 * hoje pela ponte de conciliação OFX↔CP/CR (app/consultor/importar-ofx):
 * quando uma transação bancária importada bate com um título aberto vindo
 * da API do ERP, o consultor pode dar baixa nele direto da tela, sem
 * precisar de uma chave de API.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const { session } = auth;

    const { id } = await params;
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo') === 'pagar' ? 'pagar' : 'receber';

    const modeloConta = tipo === 'receber' ? db.contaReceber : db.contaPagar;
    const contaExistente = await (modeloConta as any).findUnique({ where: { id }, select: { empresaId: true } });
    if (!contaExistente) {
      return NextResponse.json({ error: `Conta a ${tipo} não encontrada.` }, { status: 404 });
    }

    const permitido = session.role === 'administrador' ? null : session.empresaIds;
    if (permitido && !permitido.includes(contaExistente.empresaId)) {
      return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
    }

    const corpo = await request.json().catch(() => null);
    const r = await registrarBaixaContaFinanceira(db, tipo, id, contaExistente.empresaId, corpo);
    if (!r.ok) return NextResponse.json({ error: r.error, ...(r.detalhes ? { detalhes: r.detalhes } : {}) }, { status: r.status });

    if (r.liquidandoAgora) {
      dispararWebhook(contaExistente.empresaId, tipo === 'receber' ? 'conta_receber.liquidada' : 'conta_pagar.liquidada', {
        [tipo === 'receber' ? 'contaReceberId' : 'contaPagarId']: id,
        [tipo === 'receber' ? 'sacadoId' : 'fornecedorId']: r.sacadoOuFornecedorId,
        valorLiquido: r.valorLiquido,
        liquidadoEm: r.conciliadoEm,
      }).catch(() => {});
    }

    return NextResponse.json(r.data, { status: r.status });
  } catch (error) {
    console.error('Erro em POST /api/contas-financeiras/[id]/baixas:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro interno ao registrar a baixa.' }, { status: 500 });
  }
}
