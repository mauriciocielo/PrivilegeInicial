import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { ensureFinancasPessoaisTables } from '../../../../lib/financas-pessoais';
import {
  PLANOS_PF,
  ensureFinancasAssinaturasTable,
  enviarBoasVindasPfWhatsApp,
  normalizarTelefoneBr,
} from '../../../../lib/financas-pessoais-assinaturas';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';

export const dynamic = 'force-dynamic';

async function executarLembretesDiariosPf(appUrl: string) {
  await Promise.all([ensureFinancasPessoaisTables(), ensureFinancasAssinaturasTable()]);

  const ownerId = await encontrarSessaoAdminPorNumero();
  if (!ownerId) {
    return {
      ok: false,
      error: 'Nenhuma sessão WhatsApp conectada no servidor para enviar lembretes.',
      boasVindasReenviadas: 0,
      lembretesEnviados: 0,
      ignoradosAtivos: 0,
    };
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const assinantes = await db.$queryRawUnsafe<any[]>(
    `SELECT * FROM financas_pessoais_assinaturas
     WHERE status IN ('ativo', 'trial')
       AND valido_ate >= $1
       AND COALESCE(phone, '') <> ''
     ORDER BY created_at ASC`,
    hoje
  );

  let boasVindasReenviadas = 0;
  let lembretesEnviados = 0;
  let ignoradosAtivos = 0;

  for (const a of assinantes) {
    const phoneNorm = normalizarTelefoneBr(String(a.phone || ''));
    if (!phoneNorm || phoneNorm.length < 10) continue;

    // 1. Garante que quem se cadastrou quando o WhatsApp estava offline receba as boas-vindas
    if (!a.boas_vindas_enviadas_em) {
      const enviou = await enviarBoasVindasPfWhatsApp({
        nome: String(a.nome || 'Cliente'),
        email: String(a.email || ''),
        phone: phoneNorm,
        planoNome: PLANOS_PF[String(a.plano)]?.nome || String(a.plano || 'Finanças PF'),
        validoAte: String(a.valido_ate || ''),
        appUrl,
      });
      if (enviou) {
        await db.$executeRawUnsafe(
          `UPDATE financas_pessoais_assinaturas SET boas_vindas_enviadas_em = NOW(), ultimo_lembrete_data = $1 WHERE id = $2`,
          hoje,
          String(a.id)
        );
        boasVindasReenviadas++;
      }
      continue;
    }

    // Evita mandar mais de 1 lembrete no mesmo dia
    if (String(a.ultimo_lembrete_data || '') === hoje) {
      ignoradosAtivos++;
      continue;
    }

    // Não cobra lembrete de quem acabou de se cadastrar há menos de 20 horas
    const createdMs = a.created_at ? new Date(a.created_at).getTime() : 0;
    if (createdMs && Date.now() - createdMs < 20 * 60 * 60 * 1000) {
      ignoradosAtivos++;
      continue;
    }

    // 2. Verifica se enviou algum lançamento nas últimas 24 horas
    const ult8 = phoneNorm.slice(-8);
    const keys = [`phone:${ult8}`, `user:${String(a.user_id)}`];
    const recentes = await db.$queryRawUnsafe<Array<{ total: string | number }>>(
      `SELECT COUNT(*)::int AS total
       FROM financas_pessoais_lancamentos
       WHERE owner_key = ANY($1::text[])
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      keys
    );
    const total24h = Number(recentes[0]?.total || 0);
    if (total24h > 0) {
      ignoradosAtivos++;
      continue;
    }

    const primeiroNome = String(a.nome || 'Cliente').trim().split(/\s+/)[0] || 'Cliente';
    const msg = [
      `👋 *Oi, ${primeiroNome}! Passando para lembrar das suas finanças de hoje.*`,
      ``,
      `Faz 1 dia que não recebemos nenhum lançamento seu no *Minhas Finanças PF*.`,
      `Teve algum gasto hoje (mercado, combustível, café, farmácia) ou algum recebimento?`,
      ``,
      `🎙️ É só mandar um *áudio*, *texto* ou *foto/PDF do recibo* aqui mesmo — leva 3 segundos!`,
      `• _"Gastei 45 no almoço no pix"_`,
      `• _"Resumo do mês"_`,
    ].join('\n');

    try {
      const resWa = await sendBaileysLiveMessage(phoneNorm, msg, undefined, ownerId);
      if (resWa?.sent) {
        await db.$executeRawUnsafe(
          `UPDATE financas_pessoais_assinaturas SET ultimo_lembrete_data = $1 WHERE id = $2`,
          hoje,
          String(a.id)
        );
        lembretesEnviados++;
      }
    } catch (err) {
      console.warn('Falha ao enviar lembrete diário PF para', phoneNorm, err);
    }
  }

  return {
    ok: true,
    totalElegiveis: assinantes.length,
    boasVindasReenviadas,
    lembretesEnviados,
    ignoradosAtivos,
  };
}

/**
 * GET /api/cron/financas-pessoais-lembrete
 * Executado automaticamente pelo Vercel Cron todo dia às 20h BRT (23h UTC).
 */
export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization') || '';
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const res = await executarLembretesDiariosPf(new URL(request.url).origin);
    return NextResponse.json(res);
  } catch (error) {
    console.error('Erro em GET /api/cron/financas-pessoais-lembrete:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao executar lembretes PF.' }, { status: 500 });
  }
}

/**
 * POST /api/cron/financas-pessoais-lembrete
 * Disparo manual pelo painel do consultor/admin.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const role = String(auth.session.role || '').toLowerCase();
    if (!['consultor', 'administrador', 'admin', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    const res = await executarLembretesDiariosPf(new URL(request.url).origin);
    if (!res.ok) return NextResponse.json(res, { status: 400 });
    return NextResponse.json(res);
  } catch (error) {
    console.error('Erro em POST /api/cron/financas-pessoais-lembrete:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao disparar lembretes PF.' }, { status: 500 });
  }
}
