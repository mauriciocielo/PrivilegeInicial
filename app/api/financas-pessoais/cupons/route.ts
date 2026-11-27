import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { ensureFinancasAssinaturasTable } from '../../../../lib/financas-pessoais-assinaturas';

export const dynamic = 'force-dynamic';

function isAdminRole(role?: string): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'consultor' || r === 'admin' || r === 'superadmin';
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (!isAdminRole(auth.session.role)) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    await ensureFinancasAssinaturasTable();
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM financas_pessoais_cupons ORDER BY created_at DESC LIMIT 200`
    );

    const cupons = rows.map((r) => ({
      id: String(r.id),
      codigo: String(r.codigo),
      tipo: r.tipo === 'fixo' ? 'fixo' : 'percentual',
      valor: Number(r.valor || 0),
      diasTrialExtra: Number(r.dias_trial_extra || 0),
      limiteUsos: r.limite_usos !== null && r.limite_usos !== undefined ? Number(r.limite_usos) : null,
      usosAtuais: Number(r.usos_atuais || 0),
      validoAte: r.valido_ate ? String(r.valido_ate) : null,
      ativo: Boolean(r.ativo),
    }));

    return NextResponse.json({ cupons });
  } catch (error) {
    console.error('Erro em GET /api/financas-pessoais/cupons:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar cupons.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (!isAdminRole(auth.session.role)) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    await ensureFinancasAssinaturasTable();
    const body = await request.json().catch(() => ({}));
    const codigo = String(body?.codigo || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const tipo = body?.tipo === 'fixo' ? 'fixo' : 'percentual';
    const valor = Math.max(0, Number(body?.valor || 0));
    const diasTrialExtra = Math.max(0, Math.floor(Number(body?.diasTrialExtra || 0)));
    const limiteUsos =
      body?.limiteUsos !== '' && body?.limiteUsos !== null && body?.limiteUsos !== undefined
        ? Math.max(1, Math.floor(Number(body.limiteUsos)))
        : null;
    const validoAte = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.validoAte || '')) ? String(body.validoAte) : null;

    if (!codigo || codigo.length < 3) {
      return NextResponse.json({ error: 'Informe um código com pelo menos 3 caracteres (ex.: PRIVILEGE20).' }, { status: 400 });
    }
    if (valor <= 0 && diasTrialExtra <= 0) {
      return NextResponse.json({ error: 'Informe o valor do desconto ou dias extras de teste.' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO financas_pessoais_cupons
        (id, codigo, tipo, valor, dias_trial_extra, limite_usos, usos_atuais, valido_ate, ativo, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7, TRUE, NOW())`,
      id,
      codigo,
      tipo,
      valor,
      diasTrialExtra,
      limiteUsos,
      validoAte
    );

    return NextResponse.json({ ok: true, id, codigo });
  } catch (error: any) {
    if (String(error?.message || '').toLowerCase().includes('unique')) {
      return NextResponse.json({ error: 'Já existe um cupom com este código.' }, { status: 409 });
    }
    console.error('Erro em POST /api/financas-pessoais/cupons:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao criar cupom.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (!isAdminRole(auth.session.role)) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    await ensureFinancasAssinaturasTable();
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });

    await db.$executeRawUnsafe(
      `UPDATE financas_pessoais_cupons SET ativo = $1 WHERE id = $2`,
      Boolean(body?.ativo),
      id
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em PATCH /api/financas-pessoais/cupons:', error);
    return NextResponse.json({ error: 'Erro ao atualizar cupom.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (!isAdminRole(auth.session.role)) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    await ensureFinancasAssinaturasTable();
    const id = (new URL(request.url).searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });

    await db.$executeRawUnsafe(`DELETE FROM financas_pessoais_cupons WHERE id = $1`, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em DELETE /api/financas-pessoais/cupons:', error);
    return NextResponse.json({ error: 'Erro ao excluir cupom.' }, { status: 500 });
  }
}
