import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { resolveWhatsAppOwnerId } from '@/lib/whatsapp-owner';
import { createOrSaveProtocol, listProtocols, sendMessage } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  try {
    const ownerId = resolveWhatsAppOwnerId(req);
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId') || undefined;
    const protocols = await listProtocols(ownerId, chatId);
    return NextResponse.json({ success: true, protocols });
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
    const { chatId, subject, summary, status, sendToClient } = body;

    if (!chatId) {
      return NextResponse.json({ success: false, error: 'chatId obrigatório' }, { status: 400 });
    }

    const protocol = await createOrSaveProtocol({
      chatId,
      ownerId,
      subject,
      summary,
      status: status === 'encerrado' ? 'encerrado' : 'aberto',
    });

    if (sendToClient && protocol?.protocol_number) {
      const msg = `🎫 *Protocolo de Atendimento Registrado*\n\n• Número: *${protocol.protocol_number}*\n• Assunto: ${subject || 'Atendimento Privilege'}${summary ? `\n• Resumo: ${summary}` : ''}\n\nGuarde este número para acompanhar o seu atendimento.`;
      await sendMessage({
        chatId,
        text: msg,
        sentBy: 'consultor',
        ownerId,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, protocol });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
