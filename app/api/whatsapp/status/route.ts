import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppConfig } from '@/lib/whatsapp-service';
import { getEmailDbPool } from '@/lib/email-db';
import { getBaileysSocketForOwner } from '@/lib/baileys-manager';
import { resolveWhatsAppOwnerId } from '@/lib/whatsapp-owner';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ownerId = resolveWhatsAppOwnerId(req);
    const config = await getWhatsAppConfig(ownerId);
    const pool = getEmailDbPool();

    const sock = getBaileysSocketForOwner(ownerId);
    const baileysLive = Boolean(sock?.user?.id);
    const hasExternalApi = Boolean(
      config.api_url && config.api_url.startsWith('http') && !config.api_url.includes('example')
    );
    const statusReal = baileysLive || hasExternalApi ? 'conectado' : 'desconectado';

    let unreadTotal = 0;
    let chatsTotal = 0;

    if (pool) {
      try {
        const stats = await pool.query(`
          SELECT
            COUNT(*)::int as total_chats,
            COALESCE(SUM(unread_count), 0)::int as total_unreads
          FROM whatsapp_chats
        `);
        chatsTotal = stats.rows[0]?.total_chats || 0;
        unreadTotal = stats.rows[0]?.total_unreads || 0;
      } catch {}
    }

    return NextResponse.json({
      success: true,
      status: statusReal,
      baileys_live: baileysLive,
      owner_id: ownerId,
      phone_number: config.phone_number,
      profile_name: config.profile_name,
      bot_enabled: config.bot_enabled,
      bot_mode: config.bot_mode,
      instance_name: config.instance_name,
      total_chats: chatsTotal,
      unread_count: unreadTotal,
      updated_at: config.updated_at,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
