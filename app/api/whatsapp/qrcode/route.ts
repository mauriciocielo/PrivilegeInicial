import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import {
  getWhatsAppConfig,
  simulateConnectWhatsApp,
} from '@/lib/whatsapp-service';
import {
  getLiveBaileysQR,
  startBaileysSocket,
  disconnectBaileysSocket,
  ensureBaileysConnected,
} from '@/lib/baileys-manager';
import { resolveWhatsAppOwnerId } from '@/lib/whatsapp-owner';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  try {
    const ownerId = resolveWhatsAppOwnerId(req);
    const config = await getWhatsAppConfig(ownerId);
    const liveSock = await ensureBaileysConnected(false, ownerId).catch(() => null);
    if (config.status === 'conectado' && liveSock?.user) {
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
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
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

    startBaileysSocket(true, ownerId).catch(console.error);
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
