import { NextResponse } from 'next/server';
import db from '../../../../../lib/prisma';
import { requireApiKey } from '../../../../../lib/api-v1-auth';
import { registrarAuditoriaApi } from '../../../../../lib/api-v1-audit';
import { captureError } from '../../../../../lib/sentry-helper';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(request);
  if (auth.error) return auth.error;
  const { id } = await params;

  const conta = await db.contaReceber.findFirst({
    where: { id, empresaId: auth.contexto.empresaId },
    include: { baixas: { orderBy: { createdAt: 'asc' } }, sacado: { select: { id: true, nome: true, cpfCnpj: true } } },
  });
  if (!conta) return NextResponse.json({ error: 'Conta a receber não encontrada.' }, { status: 404 });
  return NextResponse.json(conta);
}

/**
 * Imutabilidade financeira, conforme o escopo: uma vez conciliada (ou
 * atrelada a um fechamento — aqui usamos `conciliadoEm` como esse marco),
 * DELETE é recusado. A única forma de reverter é lançar um estorno
 * (POST .../baixas com valor negativo), que preserva o histórico completo.
 * Enquanto a conta ainda está "aberto" e sem nenhuma baixa, o DELETE físico
 * é permitido — cobre o caso de um lançamento feito por engano pelo ERP,
 * antes de qualquer movimentação real acontecer sobre ele.
 */
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

    const conta = await db.contaReceber.findFirst({ where: { id, empresaId }, include: { baixas: true } });
    if (!conta) { status = 404; return NextResponse.json({ error: 'Conta a receber não encontrada.' }, { status }); }

    if (conta.conciliadoEm || conta.status !== 'aberto' || conta.baixas.length > 0) {
      status = 409;
      return NextResponse.json({
        error: 'Esta conta já foi movimentada ou conciliada — DELETE não é permitido. '
          + 'Lance um estorno em POST /api/v1/contas-receber/{id}/baixas (valor negativo) '
          + 'ou cancele-a com um PATCH de status, se aplicável.',
      }, { status });
    }

    await db.contaReceber.delete({ where: { id } });
    status = 204;
    return new NextResponse(null, { status });
  } catch (error) {
    console.error('Erro em DELETE /api/v1/contas-receber/[id]:', error);
    captureError(error);
    status = 500;
    return NextResponse.json({ error: 'Erro interno ao excluir.' }, { status });
  } finally {
    await registrarAuditoriaApi({ request, empresaId, apiKeyId, statusCode: status });
  }
}
