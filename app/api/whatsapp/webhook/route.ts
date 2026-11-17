import { NextRequest, NextResponse } from 'next/server';
import { processIncomingMessage } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));

    // Formato 1: Evolution API (messages.upsert)
    if (payload.event === 'messages.upsert' || payload.data?.key) {
      const data = payload.data;
      const key = data?.key || {};

      // Ignora mensagens enviadas por nós mesmos
      if (key.fromMe) {
        return NextResponse.json({ success: true, ignored: true, reason: 'from_me' });
      }

      const remoteJid = key.remoteJid || '';
      // Ignora grupos ou broadcasts
      if (remoteJid.includes('@g.us') || remoteJid.includes('broadcast')) {
        return NextResponse.json({ success: true, ignored: true, reason: 'group_or_broadcast' });
      }

      const phone = remoteJid.replace(/@.*$/, '');
      const chatId = 'chat_' + phone.replace(/[^0-9]/g, '');
      const name = payload.data?.pushName || phone;

      // Extrai texto de diferentes formatos da mensagem Baileys/Evolution
      const msgObj = data.message || {};
      const text =
        msgObj.conversation ||
        msgObj.extendedTextMessage?.text ||
        msgObj.imageMessage?.caption ||
        msgObj.videoMessage?.caption ||
        '';

      if (!text) {
        return NextResponse.json({ success: true, ignored: true, reason: 'no_text_content' });
      }

      const result = await processIncomingMessage({
        chatId,
        phone,
        name,
        text,
      });

      return NextResponse.json({ success: true, parsedAs: 'evolution', result });
    }

    // Formato 2: Z-API ou Webhook genérico { phone, text, name }
    const phone = payload.phone || payload.sender || payload.from || '';
    const text = typeof payload.text === 'string' ? payload.text : payload.text?.message || payload.message || payload.body || '';
    const name = payload.name || payload.senderName || payload.pushName || phone;

    if (!phone || !text) {
      return NextResponse.json({ success: false, error: 'Campos phone e text são necessários' }, { status: 400 });
    }

    const chatId = 'chat_' + String(phone).replace(/[^0-9]/g, '');
    const result = await processIncomingMessage({
      chatId,
      phone: String(phone),
      name: String(name),
      text: String(text),
    });

    return NextResponse.json({ success: true, parsedAs: 'generic', result });
  } catch (error: any) {
    console.error('[WhatsAppWebhook] Erro ao processar:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    endpoint: '/api/whatsapp/webhook',
    compatible_with: ['Evolution API', 'Baileys', 'Z-API', 'Custom JSON'],
  });
}
