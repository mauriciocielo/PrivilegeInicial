import { NextRequest, NextResponse } from 'next/server';
import {
  getWhatsAppConfig,
  simulateConnectWhatsApp,
} from '@/lib/whatsapp-service';
import {
  getLiveBaileysQR,
  startBaileysSocket,
  disconnectBaileysSocket,
} from '@/lib/baileys-manager';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getWhatsAppConfig();
    if (config.status === 'conectado') {
      return NextResponse.json({
        success: true,
        status: 'conectado',
        phone_number: config.phone_number,
        profile_name: config.profile_name,
      });
    }

    // Chama o gerenciador do Baileys para obter o QR Code autêntico gerado diretamente pelo WhatsApp
    const liveQR = await getLiveBaileysQR();
    return NextResponse.json({
      success: true,
      status: liveQR.status,
      qr_code: liveQR.qr_code || config.qr_code,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'generate';

    if (action === 'simulate_connect') {
      const config = await simulateConnectWhatsApp();
      return NextResponse.json({ success: true, message: 'WhatsApp conectado em modo teste!', config });
    }

    if (action === 'disconnect') {
      await disconnectBaileysSocket();
      return NextResponse.json({ success: true, message: 'WhatsApp desconectado com sucesso' });
    }

    // Força reinício do socket para gerar novo QR Code
    await startBaileysSocket(true);
    const liveQR = await getLiveBaileysQR();

    return NextResponse.json({
      success: true,
      status: liveQR.status,
      qr_code: liveQR.qr_code,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
