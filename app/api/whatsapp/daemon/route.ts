import { NextResponse } from 'next/server';
import { bootAllSavedBaileysSessions } from '@/lib/baileys-manager';
import { runWhatsAppBackgroundTick } from '@/lib/whatsapp-service';
import { listCampaigns } from '@/lib/campaign-manager';

export const dynamic = 'force-dynamic';

/**
 * Rota de manutenção em 2º plano acionada pelo server.js no boot e periodicamente.
 * Mantém todas as conexões de WhatsApp de todos os usuários ativas mesmo sem tela aberta,
 * dispara follow-ups agendados e garante que campanhas em andamento continuem rodando.
 */
async function executeDaemonTick() {
  const startedOwners = await bootAllSavedBaileysSessions();
  await runWhatsAppBackgroundTick();
  await listCampaigns().catch(() => []);
  return {
    success: true,
    startedOwners,
    timestamp: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const result = await executeDaemonTick();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await executeDaemonTick();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
