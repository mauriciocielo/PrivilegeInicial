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
import { resolveWhatsAppOwnerId } from '@/lib/whatsapp-owner';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ownerId = resolveWhatsAppOwnerId(req);
    const config = await getWhatsAppConfig(ownerId);
    if (config.status === 'conectado') {
      return NextResponse.json({
        success: true,
        status: 'conectado',
        phone_number: config.phone_number,
        profile_name: config.profile_name,
        ownerId,
      });
    }

    const liveQR = await getLiveBaileysQR(ownerId);
    return NextResponse.json({
      success: true,
      status: liveQR.status,
      qr_code: liveQR.qr_code || config.qr_code,
      ownerId,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ownerId = resolveWhatsAppOwnerId(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'generate';

    if (action === 'simulate_connect') {
      const config = await simulateConnectWhatsApp(ownerId);
      return NextResponse.json({ success: true, message: 'WhatsApp conectado em modo teste!', config });
    }

    if (action === 'disconnect') {
      await disconnectBaileysSocket(ownerId);
      return NextResponse.json({ success: true, message: 'WhatsApp desconectado com sucesso' });
    }

    await startBaileysSocket(true, ownerId);
    const liveQR = await getLiveBaileysQR(ownerId);

    return NextResponse.json({
      success: true,
      status: liveQR.status,
      qr_code: liveQR.qr_code,
      ownerId,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
