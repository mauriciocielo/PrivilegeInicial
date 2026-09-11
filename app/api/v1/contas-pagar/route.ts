import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireApiKey } from '../../../../lib/api-v1-auth';
import { validarPayloadContaFinanceira } from '../../../../lib/api-v1-validation';
import { registrarAuditoriaApi } from '../../../../lib/api-v1-audit';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { captureError } from '../../../../lib/sentry-helper';

/** POST /api/v1/contas-pagar — espelho de contas-receber, do lado do fornecedor. */
export async function POST(request: Request) {
  let empresaId: string | undefined;
  let apiKeyId: string | undefined;
  let status = 500;
  let corpo: any;

  try {
    const auth = await requireApiKey(request);
    if (auth.error) return auth.error;
    empresaId = auth.contexto.empresaId;
    apiKeyId = auth.contexto.apiKeyId;

    const rate = checkRateLimit(`api-v1-cp:${empresaId}`, 120, 60 * 1000);
    if (!rate.allowed) {
      status = 429;
      return NextResponse.json(
        { error: `Limite de requisições excedido. Tente novamente em ${rate.retryAfterSeconds}s.` },
        { status }
      );
    }

    corpo = await request.json().catch(() => null);
    const payloadNormalizado = corpo && { ...corpo, sacadoId: corpo.sacadoId || corpo.fornecedorId };
    const { erros, valorLiquido } = validarPayloadContaFinanceira(payloadNormalizado);
    if (erros.length > 0) {
      status = 422;
      return NextResponse.json({ error: 'Payload inválido.', detalhes: erros }, { status });
    }

    const fornecedor = await db.cliente.findFirst({ where: { id: corpo.fornecedorId, empresaId } });
    if (!fornecedor) {
      status = 422;
      return NextResponse.json(
        { error: 'fornecedorId não encontrado para esta empresa. Cadastre-o antes em POST /api/v1/sacados.' },
        { status }
      );
    }

    if (corpo.planoContaId) {
      const pc = await db.planoConta.findFirst({ where: { id: corpo.planoContaId, empresaId } });
      if (!pc) { status = 422; return NextResponse.json({ error: 'planoContaId não pertence a esta empresa.' }, { status }); }
    }
    if (corpo.centroCustoId) {
      const cc = await db.centroCusto.findFirst({ where: { id: corpo.centroCustoId, empresaId } });
      if (!cc) { status = 422; return NextResponse.json({ error: 'centroCustoId não pertence a esta empresa.' }, { status }); }
    }

    const conta = await db.contaPagar.create({
      data: {
        empresaId,
        fornecedorId: corpo.fornecedorId,
        planoContaId: corpo.planoContaId || null,
        centroCustoId: corpo.centroCustoId || null,
        numeroDocumento: corpo.numeroDocumento || null,
        descricao: corpo.descricao || null,
        dataEmissao: corpo.dataEmissao,
        dataVencimento: corpo.dataVencimento,
        valorOriginal: corpo.valorOriginal,
        acrescimos: corpo.acrescimos ?? 0,
        descontos: corpo.descontos ?? 0,
        valorLiquido: valorLiquido!,
        origemApiKeyId: apiKeyId,
      },
    });

    status = 201;
    return NextResponse.json({
      id: conta.id, status: conta.status, valorLiquido: conta.valorLiquido, dataVencimento: conta.dataVencimento,
    }, { status });
  } catch (error) {
    console.error('Erro em POST /api/v1/contas-pagar:', error);
    captureError(error);
    status = 500;
    return NextResponse.json({ error: 'Erro interno ao lançar a conta a pagar.' }, { status });
  } finally {
    await registrarAuditoriaApi({ request, empresaId, apiKeyId, statusCode: status, payload: corpo });
  }
}

/** GET /api/v1/contas-pagar?status=aberto&fornecedorId=... */
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (auth.error) return auth.error;
  const { empresaId } = auth.contexto;

  const rate = checkRateLimit(`api-v1-cp-get:${empresaId}`, 60, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Limite de requisições excedido. Tente novamente em ${rate.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  const url = new URL(request.url);
  const statusFiltro = url.searchParams.get('status');
  const fornecedorId = url.searchParams.get('fornecedorId');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);

  const contas = await db.contaPagar.findMany({
    where: {
      empresaId,
      ...(statusFiltro ? { status: statusFiltro as any } : {}),
      ...(fornecedorId ? { fornecedorId } : {}),
    },
    orderBy: { dataVencimento: 'asc' },
    take: limit,
    include: { baixas: true },
  });

  return NextResponse.json({ total: contas.length, contas });
}
