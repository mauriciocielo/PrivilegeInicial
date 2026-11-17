import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppConfig, updateWhatsAppConfig } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getWhatsAppConfig();
    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    console.error('Erro ao buscar configuração do WhatsApp:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await updateWhatsAppConfig(body);
    return NextResponse.json({ success: true, config: updated });
  } catch (error: any) {
    console.error('Erro ao atualizar configuração do WhatsApp:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
