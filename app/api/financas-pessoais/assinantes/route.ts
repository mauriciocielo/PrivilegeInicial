import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import {
  PLANOS_PF,
  calcularDataValidade,
  criarOuAtivarAssinantePf,
  ensureFinancasAssinaturasTable,
  enviarBoasVindasPfWhatsApp,
} from '../../../../lib/financas-pessoais-assinaturas';

export const dynamic = 'force-dynamic';

function isAdminRole(role?: string): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'consultor' || r === 'administrador' || r === 'admin' || r === 'superadmin';
}

/**
 * GET /api/financas-pessoais/assinantes
 * Lista todos os assinantes do produto Finanças Pessoais (PF) e KPIs (Ativos, Trial, MRR).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (!isAdminRole(auth.session.role)) {
      return NextResponse.json({ error: 'Acesso restrito a consultores/administradores.' }, { status: 403 });
    }

    await ensureFinancasAssinaturasTable();
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM financas_pessoais_assinaturas ORDER BY created_at DESC LIMIT 500`
    );

    const hoje = new Date().toISOString().slice(0, 10);
    const assinantes = rows.map((r) => {
      const validoAte = String(r.valido_ate || '');
      const statusRaw = String(r.status || 'trial');
      const expirado = (statusRaw === 'trial' || statusRaw === 'ativo') && validoAte && validoAte < hoje;
      return {
        id: String(r.id),
        userId: String(r.user_id),
        nome: String(r.nome),
        email: String(r.email),
        phone: String(r.phone || ''),
        plano: String(r.plano || 'trial_7d'),
        planoNome: PLANOS_PF[String(r.plano)]?.nome || String(r.plano),
        valorMensal: Number(r.valor_mensal || 0),
        status: expirado ? 'expirado' : statusRaw,
        validoAte,
        origem: String(r.origem || 'painel'),
        gateway: String(r.gateway || ''),
        createdAt: r.created_at,
      };
    });

    const ativos = assinantes.filter((a) => a.status === 'ativo').length;
    const emTrial = assinantes.filter((a) => a.status === 'trial').length;
    const expirados = assinantes.filter((a) => a.status === 'expirado' || a.status === 'suspenso').length;
    const mrr = Math.round(
      assinantes.filter((a) => a.status === 'ativo').reduce((acc, a) => acc + a.valorMensal, 0) * 100
    ) / 100;

    return NextResponse.json({
      kpis: { total: assinantes.length, ativos, emTrial, expirados, mrr },
      assinantes,
    });
  } catch (error) {
    console.error('Erro em GET /api/financas-pessoais/assinantes:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao listar assinantes PF.' }, { status: 500 });
  }
}

/**
 * POST /api/financas-pessoais/assinantes
 * Cadastro rápido de 1 cliente PF pelo painel + envio automático das credenciais no WhatsApp.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (!isAdminRole(auth.session.role)) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const nome = String(body?.nome || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const phone = String(body?.phone || '').trim();
    const plano = String(body?.plano || 'trial_7d');
    const senha = String(body?.senha || '').trim();
    const enviarWhatsapp = body?.enviarWhatsapp !== false;

    if (!nome || !email || !email.includes('@')) {
      return NextResponse.json({ error: 'Informe nome e um e-mail válido.' }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const res = await criarOuAtivarAssinantePf({
      nome,
      email,
      phone,
      senha: senha || undefined,
      plano,
      origem: 'painel_admin',
      enviarWhatsapp,
      appUrl: origin,
    });

    return NextResponse.json({
      ok: true,
      id: res.assinaturaId,
      userId: res.user.id,
      usuarioNovo: res.usuarioNovo,
      senhaGerada: res.senhaGerada,
      validoAte: res.validoAte,
      whatsappEnviado: res.whatsappEnviado,
    });
  } catch (error) {
    console.error('Erro em POST /api/financas-pessoais/assinantes:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao cadastrar assinante PF.' }, { status: 500 });
  }
}

/**
 * PATCH /api/financas-pessoais/assinantes
 * Atualiza status, renova validade (+30d / +365d) ou reenvia mensagem de acesso no WhatsApp.
 */
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
    const acao = String(body?.acao || '').trim();
    if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM financas_pessoais_assinaturas WHERE id = $1 LIMIT 1`,
      id
    );
    const atual = rows[0];
    if (!atual) return NextResponse.json({ error: 'Assinante não encontrado.' }, { status: 404 });

    if (acao === 'reenviar_whatsapp') {
      const origin = new URL(request.url).origin;
      const ok = await enviarBoasVindasPfWhatsApp({
        nome: String(atual.nome),
        email: String(atual.email),
        phone: String(atual.phone || ''),
        planoNome: PLANOS_PF[String(atual.plano)]?.nome || String(atual.plano),
        validoAte: String(atual.valido_ate || ''),
        appUrl: origin,
      });
      return NextResponse.json({ ok: true, whatsappEnviado: ok });
    }

    if (acao === 'renovar_30d' || acao === 'renovar_365d') {
      const dias = acao === 'renovar_365d' ? 365 : 30;
      const planoNovo = acao === 'renovar_365d' ? 'anual' : 'mensal';
      const valorNovo = PLANOS_PF[planoNovo].valorMensal;
      const novaValidade = calcularDataValidade(dias);
      await db.$executeRawUnsafe(
        `UPDATE financas_pessoais_assinaturas
         SET status = 'ativo', plano = $1, valor_mensal = $2, valido_ate = $3, updated_at = NOW()
         WHERE id = $4`,
        planoNovo,
        valorNovo,
        novaValidade,
        id
      );
      return NextResponse.json({ ok: true, status: 'ativo', validoAte: novaValidade });
    }

    if (body?.status && ['ativo', 'trial', 'suspenso', 'cancelado'].includes(String(body.status))) {
      await db.$executeRawUnsafe(
        `UPDATE financas_pessoais_assinaturas SET status = $1, updated_at = NOW() WHERE id = $2`,
        String(body.status),
        id
      );
      return NextResponse.json({ ok: true, status: String(body.status) });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    console.error('Erro em PATCH /api/financas-pessoais/assinantes:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao atualizar assinante PF.' }, { status: 500 });
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

    await db.$executeRawUnsafe(`DELETE FROM financas_pessoais_assinaturas WHERE id = $1`, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em DELETE /api/financas-pessoais/assinantes:', error);
    return NextResponse.json({ error: 'Erro ao excluir assinante.' }, { status: 500 });
  }
}
