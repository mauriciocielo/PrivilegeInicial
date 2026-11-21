import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { apenasDigitos } from '../../../../lib/nfse/dps';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const telefoneRaw = typeof body?.telefone === 'string' ? body.telefone.trim() : '';
    const mensagem = typeof body?.mensagem === 'string' ? body.mensagem.trim() : '';

    const digits = apenasDigitos(telefoneRaw);
    if (digits.length < 10) {
      return NextResponse.json({ error: 'Informe um WhatsApp válido com DDD (ex.: 46999016003).' }, { status: 400 });
    }
    if (!mensagem) {
      return NextResponse.json({ error: 'Mensagem da agenda vazia.' }, { status: 400 });
    }

    const telefone = digits.startsWith('55') ? digits : `55${digits}`;
    const ownerId = await encontrarSessaoAdminPorNumero('46999800010');
    if (!ownerId) {
      return NextResponse.json(
        { error: 'WhatsApp (46) 99980-0010 não está conectado no servidor no momento.' },
        { status: 422 }
      );
    }

    const res = await sendBaileysLiveMessage(telefone, mensagem, undefined, ownerId);
    if (!res?.sent) {
      return NextResponse.json({ error: 'Não foi possível entregar a mensagem no WhatsApp.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, telefone, ownerId });
  } catch (error) {
    console.error('Erro em POST /api/agenda/enviar-whatsapp:', error);
    return NextResponse.json({ error: 'Erro interno ao enviar agenda no WhatsApp.' }, { status: 500 });
  }
}
