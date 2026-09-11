import { NextResponse } from 'next/server';
import db from '../../../../../../lib/prisma';
import { requireApiKey } from '../../../../../../lib/api-v1-auth';
import { validarValorMonetario, validarDataIso, calcularStatus } from '../../../../../../lib/api-v1-validation';
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

    const conta = await db.contaPagar.findFirst({ where: { id, empresaId }, include: { baixas: true } });
    if (!conta) { status = 404; return NextResponse.json({ error: 'Conta a pagar não encontrada.' }, { status }); }
    if (conta.status === 'cancelado') {
      status = 409;
      return NextResponse.json({ error: 'Conta cancelada — não aceita baixas nem estornos.' }, { status });
    }

    corpo = await request.json().catch(() => null);
    if (!corpo || typeof corpo !== 'object') {
      status = 422;
      return NextResponse.json({ error: 'Payload ausente ou inválido.' }, { status });
    }

    let valor: number;
    let estornoDeId: string | null = null;

    if (corpo.estornoDeId) {
      const original = conta.baixas.find(b => b.id === corpo.estornoDeId);
      if (!original) { status = 422; return NextResponse.json({ error: 'estornoDeId não corresponde a uma baixa desta conta.' }, { status }); }
      if (original.valor < 0) { status = 422; return NextResponse.json({ error: 'Não é possível estornar um estorno.' }, { status }); }
      if (conta.baixas.some(b => b.estornoDeId === original.id)) {
        status = 409;
        return NextResponse.json({ error: 'Esta baixa já foi estornada anteriormente.' }, { status });
      }
      valor = -original.valor;
      estornoDeId = original.id;
    } else {
      const v = validarValorMonetario(corpo.valor);
      if (!v.valido) { status = 422; return NextResponse.json({ error: 'valor inválido.', detalhes: v.erro }, { status }); }
      if (!validarDataIso(corpo.data)) { status = 422; return NextResponse.json({ error: 'data deve estar no formato YYYY-MM-DD.' }, { status }); }
      valor = v.valor;
    }

    const baixa = await db.contaPagarBaixa.create({
      data: {
        contaPagarId: id,
        data: corpo.data || new Date().toISOString().split('T')[0],
        valor,
        formaPagamento: corpo.formaPagamento || null,
        observacao: corpo.observacao || null,
        estornoDeId,
      },
    });

    const totalBaixado = [...conta.baixas, baixa].reduce((s, b) => s + b.valor, 0);
    const novoStatus = calcularStatus({ valorLiquido: conta.valorLiquido, totalBaixado });
    const liquidandoAgora = novoStatus === 'liquidado' && conta.status !== 'liquidado';

    const contaAtualizada = await db.contaPagar.update({
      where: { id },
      data: { status: novoStatus, conciliadoEm: liquidandoAgora ? new Date() : conta.conciliadoEm },
    });

    if (liquidandoAgora) {
      dispararWebhook(empresaId, 'conta_pagar.liquidada', {
        contaPagarId: id, fornecedorId: conta.fornecedorId, valorLiquido: conta.valorLiquido,
        liquidadoEm: contaAtualizada.conciliadoEm,
      }).catch(() => {});
    }

    status = 201;
    return NextResponse.json({
      baixaId: baixa.id, valor: baixa.valor, estorno: Boolean(estornoDeId), statusConta: novoStatus, totalBaixado,
    }, { status });
  } catch (error) {
    console.error('Erro em POST /api/v1/contas-pagar/[id]/baixas:', error);
    captureError(error);
    status = 500;
    return NextResponse.json({ error: 'Erro interno ao registrar a baixa.' }, { status });
  } finally {
    await registrarAuditoriaApi({ request, empresaId, apiKeyId, statusCode: status, payload: corpo });
  }
}
