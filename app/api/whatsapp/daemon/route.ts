import { NextResponse } from 'next/server';
import { bootAllSavedBaileysSessions } from '@/lib/baileys-manager';
import { runWhatsAppBackgroundTick } from '@/lib/whatsapp-service';
import { listCampaigns, startCampaignWorker } from '@/lib/campaign-manager';
import { iniciarWorkerFilaEmail } from '@/lib/email-queue';
import { processarLembretesAgenda24h } from '@/lib/agenda-lembretes';

export const dynamic = 'force-dynamic';

/**
 * Rota de manutenção em 2º plano acionada pelo server.js no boot e periodicamente (a cada 30s).
 * Mantém todas as conexões de WhatsApp de todos os usuários ativas 24h mesmo com o navegador fechado,
 * dispara follow-ups agendados, garante que campanhas em lote continuem rodando e mantém a fila de e-mails ativa.
 */
async function executeDaemonTick() {
  const startedOwners = await bootAllSavedBaileysSessions();
  await runWhatsAppBackgroundTick();
  const campaigns = await listCampaigns().catch(() => []);
  const hasRunningCampaign = campaigns.some(c => c.status === 'em_andamento');
  if (hasRunningCampaign) {
    startCampaignWorker().catch(() => { });
  }
  iniciarWorkerFilaEmail();
  const lembretesAgenda = await processarLembretesAgenda24h().catch(() => ({ enviados24h: 0, enviados1h: 0 }));
  return {
    success: true,
    startedOwners,
    hasRunningCampaign,
    lembretesAgenda,
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
