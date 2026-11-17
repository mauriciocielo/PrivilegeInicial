import { NextResponse } from 'next/server';
import { getWhatsAppConfig } from '@/lib/whatsapp-service';
import { getEmailDbPool } from '@/lib/email-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getWhatsAppConfig();
    const pool = getEmailDbPool();

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
      status: config.status,
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
