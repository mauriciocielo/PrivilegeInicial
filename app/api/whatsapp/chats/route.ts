import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { listChats, updateChatCrm, sendMessage } from '@/lib/whatsapp-service';
import { syncContactProfilePic, buildChatIdForOwner, verificarNumeroNoWhatsApp, ensureBaileysConnected } from '@/lib/baileys-manager';
import { getEmailDbPool } from '@/lib/email-db';
import { resolveWhatsAppOwnerId } from '@/lib/whatsapp-owner';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  try {
    const ownerId = resolveWhatsAppOwnerId(req);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const stage = searchParams.get('stage') || undefined;
    const chats = await listChats(search, stage, ownerId);
    return NextResponse.json({ success: true, chats, ownerId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  try {
    const ownerId = resolveWhatsAppOwnerId(req);
    const pool = getEmailDbPool();
    if (!pool) throw new Error('Banco de dados indisponível');

    const body = await req.json();
    const { action, chatId } = body;

    if (!chatId && action !== 'create_chat' && action !== 'close_all_tickets' && action !== 'sync_chats') {
      return NextResponse.json({ success: false, error: 'chatId obrigatório' }, { status: 400 });
    }

    if (action === 'sync_chats') {
      // 1. Garante conexão ativa do Baileys
      const sock = await ensureBaileysConnected(true, ownerId).catch(() => null);

      // 2. Mescla automaticamente conversas duplicadas (ex: 12 vs 13 dígitos no Brasil) do mesmo owner_id
      const allRes = await pool.query(
        `SELECT id, phone, name, remote_jid, profile_pic, last_message, last_message_time, unread_count
         FROM whatsapp_chats
         WHERE COALESCE(owner_id, 'default') = $1
         ORDER BY last_message_time DESC NULLS LAST`,
        [ownerId]
      );

      const grupos = new Map<string, any[]>();
      for (const row of allRes.rows) {
        if (String(row.remote_jid || '').endsWith('@g.us') || String(row.id || '').includes('g_us')) continue;
        const digits = String(row.phone || row.id || '').replace(/[^0-9]/g, '');
        if (digits.length < 10) continue;
        const last8 = digits.slice(-8);
        const ddd = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2, 4) : digits.slice(0, 2);
        const key = `${ddd}_${last8}`;
        const list = grupos.get(key) || [];
        list.push(row);
        grupos.set(key, list);
      }

      let mergedCount = 0;
      for (const [, list] of grupos.entries()) {
        if (list.length < 2) continue;
        // Prefere o chat que tem remote_jid preenchido (ou o mais recente)
        const sorted = [...list].sort((a, b) => {
          const aHasJid = a.remote_jid ? 1 : 0;
          const bHasJid = b.remote_jid ? 1 : 0;
          if (aHasJid !== bHasJid) return bHasJid - aHasJid;
          return new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime();
        });
        const principal = sorted[0];
        for (const dup of sorted.slice(1)) {
          await pool.query(`UPDATE whatsapp_messages SET chat_id = $1 WHERE chat_id = $2`, [principal.id, dup.id]);
          await pool.query(
            `UPDATE whatsapp_chats
             SET profile_pic = COALESCE(profile_pic, $1),
                 remote_jid = COALESCE(remote_jid, $2),
                 unread_count = COALESCE(unread_count, 0) + COALESCE($3, 0)
             WHERE id = $4`,
            [dup.profile_pic, dup.remote_jid, dup.unread_count || 0, principal.id]
          );
          await pool.query(`DELETE FROM whatsapp_chats WHERE id = $1`, [dup.id]);
          mergedCount++;
        }
        // Atualiza last_message do principal com a última mensagem real
        const lastMsgRes = await pool.query(
          `SELECT text, timestamp FROM whatsapp_messages WHERE chat_id = $1 ORDER BY timestamp DESC LIMIT 1`,
          [principal.id]
        );
        if (lastMsgRes.rows[0]) {
          await pool.query(
            `UPDATE whatsapp_chats SET last_message = $1, last_message_time = $2 WHERE id = $3`,
            [lastMsgRes.rows[0].text, lastMsgRes.rows[0].timestamp, principal.id]
          );
        }
      }

      return NextResponse.json({
        success: true,
        connected: !!sock,
        mergedCount,
      });
    }

    if (action === 'update_crm') {
      await updateChatCrm(chatId, {
        crm_stage: body.crm_stage,
        crm_value: body.crm_value !== undefined ? Number(body.crm_value) : undefined,
        assigned_to: body.assigned_to,
        followup_date: body.followup_date,
        followup_note: body.followup_note,
        followup_status: body.followup_status,
        followup_message: body.followup_message,
        followup_auto_send: body.followup_auto_send,
        ticket_status: body.ticket_status,
        closed_reason: body.closed_reason,
        internal_notes: body.internal_notes,
        tags: body.tags,
      });
      return NextResponse.json({ success: true, message: 'CRM atualizado com sucesso' });
    }

    if (action === 'close_ticket') {
      const reason = body.closed_reason || 'Atendimento concluído';
      await pool.query(
        `UPDATE whatsapp_chats
         SET ticket_status = 'encerrado',
             crm_stage = 'fechado',
             closed_at = NOW(),
             closed_reason = $1,
             unread_count = 0,
             bot_paused_until = NULL,
             triage_status = 'concluido',
             triage_data = NULL
         WHERE id = $2`,
        [reason, chatId]
      );

      if (body.followup_date) {
        await updateChatCrm(chatId, {
          followup_date: body.followup_date,
          followup_note: body.followup_note || reason,
          followup_message: body.followup_message || null,
          followup_auto_send: !!body.followup_auto_send,
          followup_status: 'pendente',
        });
      }

      return NextResponse.json({ success: true, ticket_status: 'encerrado', crm_stage: 'fechado' });
    }

    if (action === 'reopen_ticket') {
      await pool.query(
        `UPDATE whatsapp_chats
         SET ticket_status = 'aberto',
             crm_stage = CASE WHEN crm_stage = 'fechado' THEN 'em_atendimento' ELSE crm_stage END,
             closed_at = NULL
         WHERE id = $1`,
        [chatId]
      );
      return NextResponse.json({ success: true, ticket_status: 'aberto' });
    }

    if (action === 'close_all_tickets') {
      const chatIds: string[] | undefined = body.chatIds;
      if (Array.isArray(chatIds) && chatIds.length > 0) {
        await pool.query(
          `UPDATE whatsapp_chats
           SET ticket_status = 'encerrado',
               crm_stage = 'fechado',
               closed_at = NOW(),
               closed_reason = 'Limpeza de fila em lote',
               unread_count = 0,
               bot_paused_until = NULL
           WHERE id = ANY($1::text[])`,
          [chatIds]
        );
      } else {
        await pool.query(
          `UPDATE whatsapp_chats
           SET ticket_status = 'encerrado',
               crm_stage = 'fechado',
               closed_at = NOW(),
               closed_reason = 'Limpeza de fila em lote',
               unread_count = 0,
               bot_paused_until = NULL
           WHERE COALESCE(ticket_status, 'aberto') = 'aberto'
             AND COALESCE(owner_id, 'default') = $1`,
          [ownerId]
        );
      }
      return NextResponse.json({ success: true, message: 'Chamados encerrados com sucesso' });
    }

    if (action === 'send_followup_now') {
      const chatRes = await pool.query(`SELECT name, followup_note, followup_message FROM whatsapp_chats WHERE id = $1`, [chatId]);
      const row = chatRes.rows[0] || {};
      const textToSend =
        (body.text || row.followup_message || '').trim() ||
        `Olá, ${row.name || 'tudo bem'}! 😊 Passando para acompanhar nosso atendimento aqui na Privilege Contabilidade e Consultoria${row.followup_note ? ` (${row.followup_note})` : ''}. Como podemos te ajudar a avançar?`;

      const sentMsg = await sendMessage({
        chatId,
        text: textToSend,
        sentBy: 'consultor',
        senderName: 'Consultor Privilege (Follow-up)',
        ownerId,
      });

      await pool.query(
        `UPDATE whatsapp_chats SET followup_status = 'enviado', ticket_status = 'aberto' WHERE id = $1`,
        [chatId]
      );

      return NextResponse.json({ success: true, message: sentMsg });
    }

    if (action === 'complete_followup') {
      await pool.query(
        `UPDATE whatsapp_chats SET followup_status = 'concluido' WHERE id = $1`,
        [chatId]
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'toggle_bot') {
      const enabled = body.bot_enabled !== false;
      await pool.query(`UPDATE whatsapp_chats SET bot_enabled = $1 WHERE id = $2`, [enabled, chatId]);
      return NextResponse.json({ success: true, bot_enabled: enabled });
    }

    if (action === 'pause_bot') {
      const minutes = Number(body.minutes || 30);
      await pool.query(
        `UPDATE whatsapp_chats SET bot_paused_until = NOW() + INTERVAL '${minutes} minutes' WHERE id = $1`,
        [chatId]
      );
      return NextResponse.json({ success: true, paused_minutes: minutes });
    }

    if (action === 'resume_bot') {
      await pool.query(
        `UPDATE whatsapp_chats SET bot_paused_until = NULL, bot_enabled = TRUE WHERE id = $1`,
        [chatId]
      );
      return NextResponse.json({ success: true, message: 'Bot reativado com sucesso' });
    }

    if (action === 'mark_read') {
      await pool.query(`UPDATE whatsapp_chats SET unread_count = 0 WHERE id = $1`, [chatId]);
      return NextResponse.json({ success: true });
    }

    if (action === 'create_chat') {
      const phone = (body.phone || '').trim();
      const name = (body.name || phone).trim();
      if (!phone) {
        return NextResponse.json({ success: false, error: 'Telefone é obrigatório' }, { status: 400 });
      }
      let digits = phone.replace(/[^0-9]/g, '');
      if (digits.length === 10 || digits.length === 11) {
        digits = '55' + digits;
      }

      // 1. Consulta o JID oficial no WhatsApp (resolve divergência de 9º dígito 12 vs 13 dígitos no Brasil)
      const check = await verificarNumeroNoWhatsApp(digits, ownerId).catch(() => ({ conectado: false, existe: false, jid: undefined as string | undefined }));
      const remoteJid = check.jid || `${digits}@s.whatsapp.net`;
      const jidDigits = check.jid ? check.jid.split('@')[0].replace(/[^0-9]/g, '') : digits;
      const canonicalDigits = jidDigits.length >= 10 ? jidDigits : digits;

      // 2. Evita duplicar chat se já existir conversa com os mesmos DDD + 8 últimos dígitos
      let id = buildChatIdForOwner(canonicalDigits, ownerId);
      const last8 = canonicalDigits.slice(-8);
      const ddd = canonicalDigits.startsWith('55') && canonicalDigits.length >= 12 ? canonicalDigits.slice(2, 4) : '';
      if (last8.length === 8) {
        const existing = await pool.query(
          `SELECT id, remote_jid FROM whatsapp_chats
           WHERE COALESCE(owner_id, 'default') = $1
             AND (
               id = $2
               OR remote_jid = $3
               OR (
                 RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 8) = $4
                 AND ($5 = '' OR regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE $6)
               )
             )
           ORDER BY last_message_time DESC NULLS LAST
           LIMIT 1`,
          [ownerId, id, remoteJid, last8, ddd, `%${ddd}%${last8}`]
        );
        if (existing.rows[0]?.id) {
          id = existing.rows[0].id;
        }
      }

      await pool.query(
        `INSERT INTO whatsapp_chats (id, owner_id, phone, name, remote_jid, last_message, last_message_time, unread_count, bot_enabled, crm_stage, crm_value, assigned_to)
         VALUES ($1, $2, $3, $4, $5, 'Conversa iniciada', NOW(), 0, TRUE, 'em_atendimento', 0, 'Maurício Cielo')
         ON CONFLICT (id) DO UPDATE SET
           name = COALESCE(NULLIF(whatsapp_chats.name, ''), EXCLUDED.name),
           remote_jid = COALESCE(EXCLUDED.remote_jid, whatsapp_chats.remote_jid)`,
        [id, ownerId, canonicalDigits, name, remoteJid]
      );
      const picUrl = await syncContactProfilePic(id, remoteJid, ownerId).catch(() => null);
      return NextResponse.json({
        success: true,
        chat: { id, phone: canonicalDigits, name, profile_pic: picUrl },
      });
    }

    return NextResponse.json({ success: false, error: 'Ação não reconhecida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
