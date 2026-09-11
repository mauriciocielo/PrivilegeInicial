import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireApiKey } from '../../../../lib/api-v1-auth';
import { validarPayloadContaFinanceira } from '../../../../lib/api-v1-validation';
import { registrarAuditoriaApi } from '../../../../lib/api-v1-audit';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { captureError } from '../../../../lib/sentry-helper';
import { criarLancamentoEspelho } from '../../../../lib/lancamento-espelho-api';

/**
 * POST /api/v1/contas-receber — lança um título a receber vindo do ERP do
 * cliente. `sacadoId` deve ser um id já retornado por POST /api/v1/sacados.
 */
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

    const rate = checkRateLimit(`api-v1-cr:${empresaId}`, 120, 60 * 1000);
    if (!rate.allowed) {
      status = 429;
      return NextResponse.json(
        { error: `Limite de requisições excedido. Tente novamente em ${rate.retryAfterSeconds}s.` },
        { status }
      );
    }

    corpo = await request.json().catch(() => null);
    const { erros, valorLiquido } = validarPayloadContaFinanceira(corpo);
    if (erros.length > 0) {
      status = 422;
      return NextResponse.json({ error: 'Payload inválido.', detalhes: erros }, { status });
    }

    const sacado = await db.cliente.findFirst({ where: { id: corpo.sacadoId, empresaId } });
    if (!sacado) {
      status = 422;
      return NextResponse.json(
        { error: 'sacadoId não encontrado para esta empresa. Cadastre-o antes em POST /api/v1/sacados.' },
        { status }
      );
    }

    if (corpo.planoContaId) {
      const pc = await db.planoConta.findFirst({ where: { id: corpo.planoContaId, empresaId } });
      if (!pc) {
        status = 422;
        return NextResponse.json({ error: 'planoContaId informado não pertence a esta empresa.' }, { status });
      }
    }

    const conta = await db.contaReceber.create({
      data: {
        empresaId,
        sacadoId: corpo.sacadoId,
        planoContaId: corpo.planoContaId || null,
        numeroDocumento: corpo.numeroDocumento || null,
        descricao: corpo.descricao || null,
        documentoFiscalUrl: corpo.documentoFiscalUrl || null,
        dataEmissao: corpo.dataEmissao,
        dataVencimento: corpo.dataVencimento,
        dataCompetencia: corpo.dataCompetencia || corpo.dataEmissao,
        valorOriginal: corpo.valorOriginal,
        acrescimos: corpo.acrescimos ?? 0,
        descontos: corpo.descontos ?? 0,
        valorLiquido: valorLiquido!,
        origemApiKeyId: apiKeyId,
      },
    });

    const espelho = await criarLancamentoEspelho(db, {
      empresaId, tipo: 'receita', clienteId: corpo.sacadoId,
      valor: valorLiquido!, data: conta.dataVencimento,
      descricao: corpo.descricao || `Título ${corpo.numeroDocumento || conta.id}`,
      numeroDocumento: corpo.numeroDocumento || null,
      planoContaIdSugerido: corpo.planoContaId || null,
      contaReceberId: conta.id,
    });

    status = 201;
    return NextResponse.json({
      id: conta.id, status: conta.status, valorLiquido: conta.valorLiquido,
      dataVencimento: conta.dataVencimento,
      ...(espelho.criado ? {} : { avisoConfiguracao: espelho.motivo }),
    }, { status });
  } catch (error) {
    console.error('Erro em POST /api/v1/contas-receber:', error);
    captureError(error);
    status = 500;
    return NextResponse.json({ error: 'Erro interno ao lançar a conta a receber.' }, { status });
  } finally {
    await registrarAuditoriaApi({ request, empresaId, apiKeyId, statusCode: status, payload: corpo });
  }
}

/** GET /api/v1/contas-receber?status=aberto&sacadoId=... — consulta o próprio livro-razão. */
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (auth.error) return auth.error;
  const { empresaId } = auth.contexto;

  const rate = checkRateLimit(`api-v1-cr-get:${empresaId}`, 60, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Limite de requisições excedido. Tente novamente em ${rate.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  const url = new URL(request.url);
  const statusFiltro = url.searchParams.get('status');
  const sacadoId = url.searchParams.get('sacadoId');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);

  const contas = await db.contaReceber.findMany({
    where: {
      empresaId,
      ...(statusFiltro ? { status: statusFiltro as any } : {}),
      ...(sacadoId ? { sacadoId } : {}),
    },
    orderBy: { dataVencimento: 'asc' },
    take: limit,
    include: { baixas: true },
  });

  return NextResponse.json({ total: contas.length, contas });
}
