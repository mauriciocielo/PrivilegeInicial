import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getWhatsAppConfig, updateWhatsAppConfig } from '@/lib/whatsapp-service';
import { resolveWhatsAppOwnerId } from '@/lib/whatsapp-owner';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  try {
    const ownerId = resolveWhatsAppOwnerId(req);
    const config = await getWhatsAppConfig(ownerId);
    return NextResponse.json({ success: true, config, ownerId });
  } catch (error: any) {
    console.error('Erro ao buscar configuração do WhatsApp:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  try {
    const ownerId = resolveWhatsAppOwnerId(req);
    const body = await req.json();
    const updated = await updateWhatsAppConfig(body, ownerId);
    return NextResponse.json({ success: true, config: updated, ownerId });
  } catch (error: any) {
    console.error('Erro ao atualizar configuração do WhatsApp:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
