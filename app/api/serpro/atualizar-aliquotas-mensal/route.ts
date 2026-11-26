import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import {
  atualizarAliquotasSimplesEmLote,
  cicloAtualSimples,
} from '../../../../lib/serpro/atualizacao-mensal-simples';

export const dynamic = 'force-dynamic';

/** GET /api/serpro/atualizar-aliquotas-mensal — status do ciclo atual de atualização mensal do Simples. */
export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  if (auth.session.role !== 'administrador') {
    return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  }

  const ciclo = cicloAtualSimples();
  const rows = await db.$queryRawUnsafe<Array<{ status: string; total: number }>>(
    `SELECT status, COUNT(*)::int AS total FROM cf_serpro_aliquota_sync WHERE ciclo = $1 GROUP BY status`,
    ciclo
  ).catch(() => []);

  return NextResponse.json({
    ciclo,
    resumo: rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = Number(r.total || 0);
      return acc;
    }, {}),
  });
}

/** POST /api/serpro/atualizar-aliquotas-mensal — dispara atualização em lote das alíquotas do Simples via SERPRO. */
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  if (auth.session.role !== 'administrador') {
    return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const resultado = await atualizarAliquotasSimplesEmLote({
    forcar: Boolean(body?.forcar),
    limite: Number(body?.limite) || 50,
  });

  return NextResponse.json({ ok: true, ...resultado });
}
