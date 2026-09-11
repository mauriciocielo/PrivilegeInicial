import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';
import { requireAuth } from '../../../lib/api-auth';
import { captureError } from '../../../lib/sentry-helper';

/**
 * Ponte de LEITURA entre o portal e o livro-razão de CP/CR alimentado pela
 * API v1 (integração com o ERP do cliente). Diferente do restante do sistema
 * (local-first, via lib/store.ts), estes dados moram só no Postgres — foram
 * desenhados para chegar exclusivamente pela API do ERP, então esta rota é
 * somente leitura: não existe edição pelo portal, só visualização do que já
 * foi lançado/baixado do lado de fora.
 *
 * GET /api/contas-financeiras?tipo=receber&status=aberto&empresaId=...
 */
export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const { session } = auth;

    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo') === 'pagar' ? 'pagar' : 'receber';
    const statusFiltro = url.searchParams.get('status');
    const empresaIdParam = url.searchParams.get('empresaId');

    // Mesma regra de escopo do resto do sistema: administrador vê tudo,
    // demais papéis só as empresas vinculadas à própria sessão.
    const permitido = session.role === 'administrador'
      ? null
      : session.empresaIds;

    if (permitido && (!empresaIdParam || !permitido.includes(empresaIdParam))) {
      return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
    }

    const empresaId = empresaIdParam || permitido?.[0];
    if (!empresaId) {
      return NextResponse.json({ error: 'Informe empresaId.' }, { status: 400 });
    }

    const where = { empresaId, ...(statusFiltro ? { status: statusFiltro as any } : {}) };

    if (tipo === 'receber') {
      const contas = await db.contaReceber.findMany({
        where,
        orderBy: { dataVencimento: 'asc' },
        include: { baixas: { orderBy: { createdAt: 'asc' } }, sacado: { select: { id: true, nome: true, cpfCnpj: true } } },
      });
      return NextResponse.json({ total: contas.length, contas });
    }

    const contas = await db.contaPagar.findMany({
      where,
      orderBy: { dataVencimento: 'asc' },
      include: { baixas: { orderBy: { createdAt: 'asc' } }, fornecedor: { select: { id: true, nome: true, cpfCnpj: true } } },
    });
    return NextResponse.json({ total: contas.length, contas });
  } catch (error) {
    console.error('Erro em GET /api/contas-financeiras:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao consultar as contas.' }, { status: 500 });
  }
}
