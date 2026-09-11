import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireApiKey } from '../../../../../lib/api-v1-auth';
import { registrarAuditoriaApi } from '../../../../../lib/api-v1-audit';
import { captureError } from '../../../../../lib/sentry-helper';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(request);
  if (auth.error) return auth.error;
  const { id } = await params;

  const conta = await db.contaPagar.findFirst({
    where: { id, empresaId: auth.contexto.empresaId },
    include: { baixas: { orderBy: { createdAt: 'asc' } }, fornecedor: { select: { id: true, nome: true, cpfCnpj: true } } },
  });
  if (!conta) return NextResponse.json({ error: 'Conta a pagar não encontrada.' }, { status: 404 });
  return NextResponse.json(conta);
}

/** Mesma regra de imutabilidade de contas-receber/[id] — ver comentário lá. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let empresaId: string | undefined;
  let apiKeyId: string | undefined;
  let status = 500;

  try {
    const auth = await requireApiKey(request);
    if (auth.error) return auth.error;
    empresaId = auth.contexto.empresaId;
    apiKeyId = auth.contexto.apiKeyId;
    const { id } = await params;

    const conta = await db.contaPagar.findFirst({ where: { id, empresaId }, include: { baixas: true } });
    if (!conta) { status = 404; return NextResponse.json({ error: 'Conta a pagar não encontrada.' }, { status }); }

    if (conta.conciliadoEm || conta.status !== 'aberto' || conta.baixas.length > 0) {
      status = 409;
      return NextResponse.json({
        error: 'Esta conta já foi movimentada ou conciliada — DELETE não é permitido. '
          + 'Lance um estorno em POST /api/v1/contas-pagar/{id}/baixas (valor negativo).',
      }, { status });
    }

    await db.contaPagar.delete({ where: { id } });
    status = 204;
    return new NextResponse(null, { status });
  } catch (error) {
    console.error('Erro em DELETE /api/v1/contas-pagar/[id]:', error);
    captureError(error);
    status = 500;
    return NextResponse.json({ error: 'Erro interno ao excluir.' }, { status });
  } finally {
    await registrarAuditoriaApi({ request, empresaId, apiKeyId, statusCode: status });
  }
}
