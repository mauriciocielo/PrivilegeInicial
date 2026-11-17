import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { resolveWhatsAppOwnerId } from '@/lib/whatsapp-owner';
import {
  listCampaigns,
  createCampaign,
  updateCampaignStatus,
  deleteCampaign,
} from '@/lib/campaign-manager';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  try {
    const ownerId = resolveWhatsAppOwnerId(req);
    const campaigns = await listCampaigns(ownerId);
    return NextResponse.json({ success: true, campaigns, ownerId });
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
    const { action } = body;

    if (action === 'create') {
      if (!body.name || !body.message_template || !Array.isArray(body.recipients) || body.recipients.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Informe nome da campanha, mensagem e pelo menos 1 contato.' },
          { status: 400 }
        );
      }

      const campaign = await createCampaign({
        ownerId,
        name: body.name,
        message_template: body.message_template,
        media_type: body.media_type || 'text',
        media_url: body.media_url || null,
        file_name: body.file_name || null,
        mime_type: body.mime_type || null,
        anti_ban_config: body.anti_ban_config || {
          minDelaySec: 15,
          maxDelaySec: 35,
          batchSize: 20,
          batchCooldownSec: 120,
          simulateTyping: true,
          personalizeGreeting: true,
          closeTicketAfterSend: true,
        },
        recipients: body.recipients,
        startImmediately: body.startImmediately !== false,
        skipAlreadySent: body.skipAlreadySent !== false,
      });

      return NextResponse.json({
        success: true,
        campaign,
        skipped_duplicates_count: campaign.skipped_duplicates_count || 0,
      });
    }

    if (action === 'start' || action === 'resume') {
      await updateCampaignStatus(body.campaignId, 'em_andamento');
      return NextResponse.json({ success: true });
    }

    if (action === 'pause') {
      await updateCampaignStatus(body.campaignId, 'pausada');
      return NextResponse.json({ success: true });
    }

    if (action === 'cancel') {
      await updateCampaignStatus(body.campaignId, 'cancelada');
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      await deleteCampaign(body.campaignId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
