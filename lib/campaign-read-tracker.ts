import { getEmailDbPool } from './email-db';

export async function updateMessageDeliveryAndReadStatus(
  waMessageId: string,
  newDeliveryStatus: 'entregue' | 'visualizado'
): Promise<void> {
  if (!waMessageId) return;
  const pool = getEmailDbPool();
  if (!pool) return;

  try {
    const dbMsgStatus = newDeliveryStatus === 'visualizado' ? 'lido' : 'entregue';
    await pool
      .query(
        `UPDATE whatsapp_messages
         SET status = CASE
           WHEN status = 'lido' THEN 'lido'
           ELSE $1
         END
         WHERE (wa_key->>'id' = $2 OR id = $2) AND from_me = TRUE`,
        [dbMsgStatus, waMessageId]
      )
      .catch(() => {});

    const campRes = await pool.query(
      `SELECT id, recipients FROM whatsapp_campaigns
       WHERE recipients::text LIKE $1`,
      [`%${waMessageId}%`]
    );

    const nowIso = new Date().toISOString();
    let anyCampaignUpdated = false;

    for (const row of campRes.rows) {
      const recipients: any[] =
        typeof row.recipients === 'string' ? JSON.parse(row.recipients) : row.recipients || [];
      let changed = false;

      for (const r of recipients) {
        if (r.waMessageId === waMessageId) {
          if (newDeliveryStatus === 'visualizado' && r.deliveryStatus !== 'visualizado') {
            r.deliveryStatus = 'visualizado';
            if (!r.deliveredAt) r.deliveredAt = nowIso;
            r.readAt = nowIso;
            changed = true;
          } else if (
            newDeliveryStatus === 'entregue' &&
            r.deliveryStatus !== 'visualizado' &&
            r.deliveryStatus !== 'entregue'
          ) {
            r.deliveryStatus = 'entregue';
            r.deliveredAt = nowIso;
            changed = true;
          }
        }
      }

      if (changed) {
        const readCount = recipients.filter((r) => r.deliveryStatus === 'visualizado').length;
        await pool.query(
          `UPDATE whatsapp_campaigns
           SET recipients = $1, read_count = $2, updated_at = NOW()
           WHERE id = $3`,
          [JSON.stringify(recipients), readCount, row.id]
        );
        anyCampaignUpdated = true;
      }
    }

    const io = (globalThis as any).io;
    if (io) {
      io.emit('whatsapp_update', { timestamp: Date.now() });
      if (anyCampaignUpdated) {
        io.emit('whatsapp_campaign_update', { timestamp: Date.now() });
      }
    }
  } catch (err) {
    console.warn('[CampaignReadTracker] Erro ao atualizar visualização:', err);
  }
}
