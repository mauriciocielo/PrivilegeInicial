import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { captureError } from '../../../../lib/sentry-helper';
import {
  criarOuAtivarAssinantePf,
  ensureFinancasAssinaturasTable,
} from '../../../../lib/financas-pessoais-assinaturas';
import { ensureFinancasPixTable } from '../../../../lib/sicoob-pix';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/financas-pessoais
 * Webhook universal para ativação/cancelamento automático de assinantes PF
 * Compatível com Asaas, Kiwify, Hotmart, Mercado Pago, Stripe ou payload customizado:
 *   { evento: 'pago' | 'cancelado', nome, email, phone, plano: 'mensal' | 'anual', gateway, externalId }
 * Segurança: valide via header `x-webhook-secret` ou `?secret=...` comparando com `process.env.PF_WEBHOOK_SECRET`.
 */
export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.PF_WEBHOOK_SECRET;
    if (expectedSecret) {
      const urlSecret = new URL(request.url).searchParams.get('secret') || '';
      const headerSecret = request.headers.get('x-webhook-secret') || request.headers.get('asaas-access-token') || '';
      if (urlSecret !== expectedSecret && headerSecret !== expectedSecret) {
        return NextResponse.json({ error: 'Assinatura de webhook inválida.' }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    await Promise.all([ensureFinancasAssinaturasTable(), ensureFinancasPixTable()]);

    // 0. Formato oficial Webhook Pix BACEN / Sicoob: { pix: [{ txid, valor, horario, endToEndId }] }
    if (Array.isArray(body?.pix) && body.pix.length > 0) {
      let ativados = 0;
      for (const p of body.pix) {
        const txid = String(p?.txid || '').trim();
        if (!txid) continue;
        const rows = await db.$queryRawUnsafe<any[]>(
          `SELECT * FROM financas_pessoais_cobrancas_pix WHERE txid = $1 LIMIT 1`,
          txid
        );
        const reg = rows[0];
        if (!reg || String(reg.status).toUpperCase() === 'CONCLUIDA') continue;

        await db.$executeRawUnsafe(
          `UPDATE financas_pessoais_cobrancas_pix SET status = 'CONCLUIDA', paid_at = NOW() WHERE txid = $1`,
          txid
        );
        await criarOuAtivarAssinantePf({
          nome: String(reg.nome || 'Assinante PF'),
          email: String(reg.email),
          phone: String(reg.phone || ''),
          plano: String(reg.plano) === 'anual' ? 'anual' : 'mensal',
          status: 'ativo',
          origem: 'webhook_sicoob_pix',
          gateway: 'sicoob_pix',
          externalId: txid,
          enviarWhatsapp: true,
          appUrl: new URL(request.url).origin,
        });
        ativados++;
      }
      return NextResponse.json({ ok: true, gateway: 'sicoob_pix', ativados });
    }

    // Normalização multi-gateway (Asaas, Kiwify, Hotmart, Mercado Pago, Custom)
    const rawEvent = String(
      body?.evento || body?.event || body?.order_status || body?.status || ''
    ).toLowerCase();

    const email = String(
      body?.email ||
        body?.Customer?.email ||
        body?.customer?.email ||
        body?.data?.buyer?.email ||
        body?.payment?.customerEmail ||
        ''
    )
      .trim()
      .toLowerCase();

    const nome = String(
      body?.nome ||
        body?.Customer?.full_name ||
        body?.customer?.name ||
        body?.data?.buyer?.name ||
        email.split('@')[0] ||
        'Assinante PF'
    ).trim();

    const phone = String(
      body?.phone ||
        body?.telefone ||
        body?.Customer?.mobile ||
        body?.customer?.phone ||
        body?.data?.buyer?.checkout_phone ||
        ''
    ).trim();

    const externalId = String(
      body?.externalId || body?.order_id || body?.payment?.id || body?.id || ''
    ).trim();

    const gateway = String(body?.gateway || (body?.payment ? 'asaas' : body?.order_id ? 'kiwify' : 'webhook'));

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'E-mail do comprador não encontrado no payload.' }, { status: 400 });
    }

    const ehCancelamento = /(cancel|refund|chargeback|overdue|expired|estorn|suspens)/i.test(rawEvent);
    if (ehCancelamento) {
      await db.$executeRawUnsafe(
        `UPDATE financas_pessoais_assinaturas SET status = 'suspenso', updated_at = NOW() WHERE email = $1`,
        email
      );
      return NextResponse.json({ ok: true, acao: 'suspenso', email });
    }

    const ehPagamento =
      !rawEvent || /(paid|approved|confirmed|received|complete|pago|ativ)/i.test(rawEvent);

    if (ehPagamento) {
      const planoTexto = JSON.stringify(body).toLowerCase();
      const plano =
        body?.plano === 'anual' || /anual|year|12\s*mes/i.test(planoTexto) ? 'anual' : 'mensal';

      const res = await criarOuAtivarAssinantePf({
        nome,
        email,
        phone,
        plano,
        status: 'ativo',
        origem: 'webhook',
        gateway,
        externalId,
        enviarWhatsapp: true,
        appUrl: new URL(request.url).origin,
      });

      return NextResponse.json({
        ok: true,
        acao: 'ativado',
        assinaturaId: res.assinaturaId,
        validoAte: res.validoAte,
        whatsappEnviado: res.whatsappEnviado,
      });
    }

    return NextResponse.json({ ok: true, ignorado: true, rawEvent });
  } catch (error) {
    console.error('Erro em POST /api/webhooks/financas-pessoais:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao processar webhook PF.' }, { status: 500 });
  }
}
