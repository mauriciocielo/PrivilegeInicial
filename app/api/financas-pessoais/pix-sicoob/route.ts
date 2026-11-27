import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import {
  consultarCobrancaPixSicoob,
  criarCobrancaPixSicoob,
  ensureFinancasPixTable,
} from '../../../../lib/sicoob-pix';
import {
  criarOuAtivarAssinantePf,
  ensureFinancasAssinaturasTable,
} from '../../../../lib/financas-pessoais-assinaturas';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';
import { apenasDigitos } from '../../../../lib/nfse/dps';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financas-pessoais/pix-sicoob
 * Gera uma cobrança Pix imediata direto na API do Sicoob para o cliente PF logado
 * (Mensal R$ 29,90 ou Anual R$ 297,00) e opcionalmente envia o Copia e Cola no WhatsApp.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await Promise.all([ensureFinancasPixTable(), ensureFinancasAssinaturasTable()]);
    const body = await request.json().catch(() => ({}));
    const plano = body?.plano === 'anual' ? 'anual' : 'mensal';
    const enviarWhatsapp = Boolean(body?.enviarWhatsapp);

    const [user, assinRows] = await Promise.all([
      db.user.findUnique({ where: { id: auth.session.userId } }),
      db.$queryRawUnsafe<Array<{ valor_renovacao: number; cupom_codigo: string }>>(
        `SELECT valor_renovacao, cupom_codigo FROM financas_pessoais_assinaturas WHERE user_id = $1 LIMIT 1`,
        auth.session.userId
      ),
    ]);
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

    const valorMensalCliente =
      assinRows[0]?.valor_renovacao && Number(assinRows[0].valor_renovacao) > 0
        ? Math.round(Number(assinRows[0].valor_renovacao) * 100) / 100
        : 29.9;
    const valor = plano === 'anual' ? Math.round(valorMensalCliente * 10 * 100) / 100 : valorMensalCliente;

    const descricao =
      plano === 'anual'
        ? `Privilege Finanças PF — Plano Anual (${user.email})`
        : `Privilege Finanças PF — Mensalidade R$ ${valor.toFixed(2).replace('.', ',')} (${user.email})`;

    const cob = await criarCobrancaPixSicoob({
      valor,
      descricao,
      pagadorNome: user.name,
      expiracaoSegundos: 86400,
    });

    await db.$executeRawUnsafe(
      `INSERT INTO financas_pessoais_cobrancas_pix
        (txid, user_id, email, nome, phone, plano, valor, brcode, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ATIVA', NOW())`,
      cob.txid,
      user.id,
      user.email,
      user.name,
      user.phone || '',
      plano,
      valor,
      cob.brcode
    );

    if (enviarWhatsapp && user.phone) {
      const dig = apenasDigitos(user.phone);
      if (dig.length >= 10) {
        const ownerId = await encontrarSessaoAdminPorNumero();
        if (ownerId) {
          const destino = dig.startsWith('55') ? dig : `55${dig}`;
          await sendBaileysLiveMessage(
            destino,
            `💳 *Pix gerado — Privilege Finanças PF*\n\nValor: *R$ ${valor.toFixed(2).replace('.', ',')}* (${plano === 'anual' ? 'Plano Anual' : 'Plano Mensal'})\n\nCopie o código abaixo no app do seu banco para liberar seu acesso automaticamente:\n\n${cob.brcode}`,
            undefined,
            ownerId
          ).catch(() => {});
        }
      }
    }

    return NextResponse.json({
      ok: true,
      txid: cob.txid,
      plano,
      valor,
      brcode: cob.brcode,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(cob.brcode)}`,
      status: cob.status,
    });
  } catch (error) {
    console.error('Erro em POST /api/financas-pessoais/pix-sicoob:', error);
    captureError(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar cobrança Pix no Sicoob.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/financas-pessoais/pix-sicoob?txid=...
 * Consulta o status real do Pix na API do Sicoob. Se estiver CONCLUIDA, ativa/renova a assinatura na hora!
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasPixTable();
    const txid = (new URL(request.url).searchParams.get('txid') || '').trim();
    if (!txid) return NextResponse.json({ error: 'txid obrigatório.' }, { status: 400 });

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM financas_pessoais_cobrancas_pix WHERE txid = $1 AND user_id = $2 LIMIT 1`,
      txid,
      auth.session.userId
    );
    const reg = rows[0];
    if (!reg) return NextResponse.json({ error: 'Cobrança Pix não encontrada.' }, { status: 404 });

    if (String(reg.status).toUpperCase() === 'CONCLUIDA') {
      return NextResponse.json({ ok: true, txid, pago: true, status: 'CONCLUIDA' });
    }

    const consulta = await consultarCobrancaPixSicoob(txid);

    if (consulta.pago) {
      await db.$executeRawUnsafe(
        `UPDATE financas_pessoais_cobrancas_pix SET status = 'CONCLUIDA', paid_at = NOW() WHERE txid = $1`,
        txid
      );

      const resAtiv = await criarOuAtivarAssinantePf({
        nome: String(reg.nome || 'Cliente PF'),
        email: String(reg.email),
        phone: String(reg.phone || ''),
        plano: String(reg.plano) === 'anual' ? 'anual' : 'mensal',
        status: 'ativo',
        origem: 'pix_sicoob',
        gateway: 'sicoob_pix',
        externalId: txid,
        enviarWhatsapp: true,
        appUrl: new URL(request.url).origin,
      });

      return NextResponse.json({
        ok: true,
        txid,
        pago: true,
        status: 'CONCLUIDA',
        validoAte: resAtiv.validoAte,
      });
    }

    return NextResponse.json({
      ok: true,
      txid,
      pago: false,
      status: consulta.status,
    });
  } catch (error) {
    console.error('Erro em GET /api/financas-pessoais/pix-sicoob:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao consultar status do Pix Sicoob.' }, { status: 500 });
  }
}
