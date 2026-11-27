import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import {
  ensureFinancasPessoaisTables,
  resolverChavesFinancasUsuario,
} from '../../../../lib/financas-pessoais';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financas-pessoais/metas
 * Define ou atualiza o limite mensal de uma categoria de gastos pessoais.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasPessoaisTables();
    const { primaryKey } = await resolverChavesFinancasUsuario(auth.session.userId);
    const body = await request.json().catch(() => ({}));
    const categoria = String(body?.categoria || '').trim();
    const limiteMensal = Math.round((Number(body?.limiteMensal) || 0) * 100) / 100;

    if (!categoria || limiteMensal <= 0) {
      return NextResponse.json({ error: 'Informe a categoria e o limite mensal.' }, { status: 400 });
    }

    await db.$executeRawUnsafe(
      `INSERT INTO financas_pessoais_metas (id, owner_key, categoria, limite_mensal, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (owner_key, categoria) DO UPDATE SET limite_mensal = EXCLUDED.limite_mensal, updated_at = NOW()`,
      crypto.randomUUID(),
      primaryKey,
      categoria,
      limiteMensal
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em POST /api/financas-pessoais/metas:', error);
    return NextResponse.json({ error: 'Erro ao salvar meta.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasPessoaisTables();
    const { allKeys } = await resolverChavesFinancasUsuario(auth.session.userId);
    const url = new URL(request.url);
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });

    await db.$executeRawUnsafe(
      `DELETE FROM financas_pessoais_metas WHERE id = $1 AND owner_key = ANY($2::text[])`,
      id,
      allKeys
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em DELETE /api/financas-pessoais/metas:', error);
    return NextResponse.json({ error: 'Erro ao remover meta.' }, { status: 500 });
  }
}
