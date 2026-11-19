import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getChatMessages, sendMessage, reactToMessage, editMessage, deleteMessage } from '@/lib/whatsapp-service';
import { resolveWhatsAppOwnerId } from '@/lib/whatsapp-owner';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
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
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
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

    if (body.action === 'edit') {
      const { messageId, chatId, text: newText } = body;
      if (!messageId || !newText || !String(newText).trim()) {
        return NextResponse.json({ success: false, error: 'messageId e novo texto são obrigatórios' }, { status: 400 });
      }
      const result = await editMessage({ messageId, chatId: chatId || '', newText: String(newText), ownerId });
      return NextResponse.json({ success: true, ...result });
    }

    if (body.action === 'delete') {
      const { messageId, chatId } = body;
      if (!messageId) {
        return NextResponse.json({ success: false, error: 'messageId é obrigatório' }, { status: 400 });
      }
      const result = await deleteMessage({ messageId, chatId: chatId || '', ownerId });
      return NextResponse.json({ success: true, ...result });
    }

    const { chatId, text, sentBy, senderName, mediaType, mediaUrl, fileName, mimeType, validarNumeroWhatsapp } = body;

    if (!chatId || ((!text || !text.trim()) && !mediaUrl)) {
      return NextResponse.json({ success: false, error: 'chatId e conteúdo são obrigatórios' }, { status: 400 });
    }

    const message = await sendMessage({
      chatId,
      text: (text || '').trim(),
      sentBy: sentBy === 'bot' ? 'bot' : 'consultor',
      senderName: typeof senderName === 'string' && senderName.trim() ? senderName.trim() : undefined,
      mediaType: mediaType || 'text',
      mediaUrl,
      fileName,
      mimeType,
      ownerId,
      validarNumeroWhatsapp: Boolean(validarNumeroWhatsapp),
    });

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
