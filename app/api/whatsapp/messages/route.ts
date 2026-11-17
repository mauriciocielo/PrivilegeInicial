import { NextRequest, NextResponse } from 'next/server';
import { getChatMessages, sendMessage, reactToMessage } from '@/lib/whatsapp-service';
import { resolveWhatsAppOwnerId } from '@/lib/whatsapp-owner';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ success: false, error: 'chatId obrigatório' }, { status: 400 });
    }

    const messages = await getChatMessages(chatId);
    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ownerId = resolveWhatsAppOwnerId(req);
    const body = await req.json();

    if (body.action === 'react') {
      const { messageId, chatId, emoji } = body;
      if (!messageId || !emoji) {
        return NextResponse.json({ success: false, error: 'messageId e emoji são obrigatórios' }, { status: 400 });
      }
      const reactions = await reactToMessage({ messageId, chatId: chatId || '', emoji, ownerId });
      return NextResponse.json({ success: true, reactions });
    }

    const { chatId, text, sentBy, mediaType, mediaUrl, fileName, mimeType } = body;

    if (!chatId || ((!text || !text.trim()) && !mediaUrl)) {
      return NextResponse.json({ success: false, error: 'chatId e conteúdo são obrigatórios' }, { status: 400 });
    }

    const message = await sendMessage({
      chatId,
      text: (text || '').trim(),
      sentBy: sentBy === 'bot' ? 'bot' : 'consultor',
      mediaType: mediaType || 'text',
      mediaUrl,
      fileName,
      mimeType,
      ownerId,
    });

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
