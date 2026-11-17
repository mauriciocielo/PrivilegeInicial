import { getEmailDbPool } from './email-db';
import { sendMessage, getWhatsAppConfig } from './whatsapp-service';
import {
  getBaileysSocketForOwner,
  buildChatIdForOwner,
  ensureBaileysConnected,
} from './baileys-manager';

export interface AntiBanConfig {
  minDelaySec: number;
  maxDelaySec: number;
  batchSize: number;
  batchCooldownSec: number;
  simulateTyping: boolean;
  personalizeGreeting: boolean;
  closeTicketAfterSend: boolean;
  aiRewritePerLead?: boolean;
}

export interface CampaignRecipient {
  id: string;
  chatId: string;
  name: string;
  phone: string;
  status: 'pendente' | 'enviado' | 'falha';
  deliveryStatus?: 'pendente' | 'enviado' | 'entregue' | 'visualizado' | 'falha';
  waMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  error?: string;
}

export interface WhatsAppCampaign {
  id: string;
  owner_id?: string;
  name: string;
  message_template: string;
  media_type?: 'text' | 'image' | 'audio' | 'document';
  media_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  status: 'rascunho' | 'em_andamento' | 'pausada' | 'concluida' | 'cancelada';
  anti_ban_config: AntiBanConfig;
  recipients: CampaignRecipient[];
  total_count: number;
  sent_count: number;
  read_count?: number;
  failed_count: number;
  current_action?: string | null;
  next_send_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

const g = globalThis as unknown as {
  __waCampaignWorkerRunning?: boolean;
  __baileysSock?: any;
  io?: any;
};

let __tableEnsured = false;

export async function ensureCampaignsTable() {
  if (__tableEnsured) return;
  const pool = getEmailDbPool();
  if (!pool) return;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        message_template TEXT NOT NULL,
        media_type TEXT DEFAULT 'text',
        media_url TEXT,
        file_name TEXT,
        mime_type TEXT,
        status TEXT DEFAULT 'rascunho',
        anti_ban_config JSONB DEFAULT '{}'::jsonb,
        recipients JSONB DEFAULT '[]'::jsonb,
        total_count INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        read_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        owner_id TEXT DEFAULT 'default',
        current_action TEXT,
        next_send_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE whatsapp_campaigns
        ADD COLUMN IF NOT EXISTS owner_id TEXT DEFAULT 'default',
        ADD COLUMN IF NOT EXISTS read_count INTEGER DEFAULT 0;
    `);
    __tableEnsured = true;
  } catch (err) {
    console.warn('[CampaignManager] Erro ao criar tabela whatsapp_campaigns:', err);
  }
}

function emitCampaignUpdate() {
  try {
    if (g.io) {
      g.io.emit('whatsapp_campaign_update', { timestamp: Date.now() });
      g.io.emit('whatsapp_update', { timestamp: Date.now() });
    }
  } catch {}
}

/**
 * Resolve saudação dinâmica de acordo com o fuso de Brasília (BRT)
 */
function getGreetingBRT(): string {
  const now = new Date();
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  if (brHour >= 5 && brHour < 12) return 'Bom dia';
  if (brHour >= 12 && brHour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Processa variáveis {nome}, {primeiro_nome}, {saudacao}, {telefone} e Spintax {op1|op2|op3}
 */
export function buildPersonalizedMessage(
  template: string,
  recipient: { name: string; phone: string },
  personalizeGreeting = true
): string {
  const fullName = (recipient.name || '').trim() || 'Cliente';
  const firstName = fullName.split(/\s+/)[0] || fullName;
  const greeting = getGreetingBRT();

  let msg = template
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{nome\}/gi, fullName)
    .replace(/\{saudacao\}/gi, greeting)
    .replace(/\{telefone\}/gi, recipient.phone || '');

  // Resolve Spintax do tipo {Olá|Oi|Tudo bem}
  msg = msg.replace(/\{([^{}|]+\|[^{}]+)\}/g, (_match, group) => {
    const choices = String(group)
      .split('|')
      .map(s => s.trim())
      .filter(Boolean);
    if (choices.length === 0) return '';
    return choices[Math.floor(Math.random() * choices.length)];
  });

  if (personalizeGreeting) {
    // Adiciona código invisível de espaço de largura zero variável no final para tornar o hash de cada mensagem único no WhatsApp
    const zwspCount = (Math.floor(Math.random() * 5) + 1);
    msg = msg + '\u200B'.repeat(zwspCount);
  }

  return msg;
}

/**
 * Reescreve uma mensagem de prospecção fria de forma única via Gemini/Claude (Anti-Spam)
 */
async function rewriteColdMessageWithAI(
  baseMessage: string,
  recipientName: string,
  ownerId: string
): Promise<string> {
  try {
    const cfg = await getWhatsAppConfig(ownerId);
    const geminiKey =
      cfg.gemini_api_key ||
      (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 30 ? process.env.GEMINI_API_KEY : '') ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      '';
    const claudeKey = cfg.claude_api_key || process.env.ANTHROPIC_API_KEY || '';
    const firstName = (recipientName || '').trim().split(/\s+/)[0] || '';

    const instruction = `Reescreva a mensagem de prospecção abaixo para o WhatsApp mantendo EXATAMENTE a mesma ideia, tom próximo e executivo, no máximo 2 parágrafos curtos (até 3 linhas), SEM links, chamando o contato apenas pelo primeiro nome (${firstName || 'não cite nome'}), variando saudação, sinônimos e ordem das frases para ser 100% única (anti-spam). Retorne APENAS o texto final da mensagem, sem aspas nem explicações.\n\nMensagem base:\n${baseMessage}`;

    if (geminiKey && geminiKey.length >= 25) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: instruction }] }],
            generationConfig: { temperature: 0.85, maxOutputTokens: 260 },
          }),
          signal: AbortSignal.timeout(6000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (txt && txt.length >= 25) return txt;
      }
    }

    if (claudeKey && claudeKey.length >= 20) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 260,
          temperature: 0.85,
          messages: [{ role: 'user', content: instruction }],
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json();
        const txt = data?.content?.[0]?.text?.trim();
        if (txt && txt.length >= 25) return txt;
      }
    }
  } catch {}
  return baseMessage;
}

/**
 * Simula presença "Digitando..." no WhatsApp antes do envio para comportamento humano
 */
async function simulateHumanTyping(phone: string, durationMs: number, ownerId = 'default') {
  const sock = getBaileysSocketForOwner(ownerId);
  if (!sock) {
    await new Promise(r => setTimeout(r, durationMs));
    return;
  }

  let digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }
  const jid = `${digits}@s.whatsapp.net`;

  try {
    await sock.sendPresenceUpdate('composing', jid);
  } catch {}

  await new Promise(r => setTimeout(r, durationMs));

  try {
    await sock.sendPresenceUpdate('paused', jid);
  } catch {}
}

function mapRowToCampaign(r: any): WhatsAppCampaign {
  const recipients: CampaignRecipient[] =
    typeof r.recipients === 'string' ? JSON.parse(r.recipients) : r.recipients || [];
  return {
    id: r.id,
    owner_id: r.owner_id || 'default',
    name: r.name,
    message_template: r.message_template,
    media_type: r.media_type || 'text',
    media_url: r.media_url || null,
    file_name: r.file_name || null,
    mime_type: r.mime_type || null,
    status: r.status || 'rascunho',
    anti_ban_config:
      typeof r.anti_ban_config === 'string'
        ? JSON.parse(r.anti_ban_config)
        : r.anti_ban_config || {
            minDelaySec: 15,
            maxDelaySec: 35,
            batchSize: 20,
            batchCooldownSec: 120,
            simulateTyping: true,
            personalizeGreeting: true,
            closeTicketAfterSend: true,
          },
    recipients,
    total_count: Number(r.total_count || 0),
    sent_count: Number(r.sent_count || 0),
    read_count: Number(
      r.read_count ?? recipients.filter((rec) => rec.deliveryStatus === 'visualizado').length
    ),
    failed_count: Number(r.failed_count || 0),
    current_action: r.current_action || null,
    next_send_at: r.next_send_at || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function listCampaigns(ownerId?: string): Promise<WhatsAppCampaign[]> {
  await ensureCampaignsTable();
  const pool = getEmailDbPool();
  if (!pool) return [];

  try {
    const res = ownerId
      ? await pool.query(
          `SELECT * FROM whatsapp_campaigns WHERE COALESCE(owner_id, 'default') = $1 ORDER BY created_at DESC LIMIT 50`,
          [ownerId]
        )
      : await pool.query(
          `SELECT * FROM whatsapp_campaigns ORDER BY created_at DESC LIMIT 50`
        );
    const list = res.rows.map(mapRowToCampaign);
    // Se houver alguma campanha em andamento e o worker não estiver rodando, aciona
    if (list.some(c => c.status === 'em_andamento') && !g.__waCampaignWorkerRunning) {
      startCampaignWorker().catch(() => {});
    }
    return list;
  } catch (err) {
    console.error('[CampaignManager] Erro ao listar campanhas:', err);
    return [];
  }
}

export function normalizeCampaignPhoneDigits(raw: string): string {
  let digits = (raw || '').replace(/[^0-9]/g, '');
  if (!digits || digits.length < 10) return '';
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }
  return digits;
}

function getPhoneVariants(digits: string): string[] {
  const variants = new Set<string>([digits]);
  if (digits.startsWith('55') && digits.length === 13 && digits[4] === '9') {
    variants.add(digits.slice(0, 4) + digits.slice(5));
  } else if (digits.startsWith('55') && digits.length === 12) {
    variants.add(digits.slice(0, 4) + '9' + digits.slice(4));
  }
  return Array.from(variants);
}

export async function getAlreadySentPhones(ownerId = 'default'): Promise<Set<string>> {
  await ensureCampaignsTable();
  const pool = getEmailDbPool();
  const sent = new Set<string>();
  if (!pool) return sent;

  try {
    const res = await pool.query(
      `SELECT recipients FROM whatsapp_campaigns WHERE COALESCE(owner_id, 'default') = $1`,
      [ownerId]
    );
    for (const row of res.rows) {
      const recs: CampaignRecipient[] =
        typeof row.recipients === 'string' ? JSON.parse(row.recipients) : row.recipients || [];
      for (const rec of recs) {
        if (rec.status === 'enviado' && rec.phone) {
          const norm = normalizeCampaignPhoneDigits(rec.phone);
          if (norm) {
            for (const v of getPhoneVariants(norm)) sent.add(v);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[CampaignManager] Erro ao verificar números já enviados:', err);
  }
  return sent;
}

export async function createCampaign(params: {
  ownerId?: string;
  name: string;
  message_template: string;
  media_type?: 'text' | 'image' | 'audio' | 'document';
  media_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  anti_ban_config: AntiBanConfig;
  recipients: Array<{ name: string; phone: string; chatId?: string }>;
  startImmediately?: boolean;
  skipAlreadySent?: boolean;
}): Promise<WhatsAppCampaign & { skipped_duplicates_count?: number }> {
  await ensureCampaignsTable();
  const pool = getEmailDbPool();
  if (!pool) throw new Error('Banco de dados indisponível');

  const ownerId = params.ownerId || 'default';
  const id = 'camp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const skipAlreadySent = params.skipAlreadySent !== false;
  const alreadySentPhones = skipAlreadySent ? await getAlreadySentPhones(ownerId) : new Set<string>();

  // Higieniza, remove números duplicados na própria lista e pula números já enviados em campanhas anteriores
  const seenPhones = new Set<string>();
  const cleanRecipients: CampaignRecipient[] = [];
  const skippedDuplicates: Array<{ name: string; phone: string }> = [];

  for (const item of params.recipients) {
    const digits = normalizeCampaignPhoneDigits(item.phone || '');
    if (!digits) continue;
    if (seenPhones.has(digits)) continue;
    seenPhones.add(digits);

    if (skipAlreadySent && getPhoneVariants(digits).some(v => alreadySentPhones.has(v))) {
      skippedDuplicates.push({ name: (item.name || digits).trim(), phone: digits });
      continue;
    }

    cleanRecipients.push({
      id: 'rec_' + digits,
      chatId: item.chatId || buildChatIdForOwner(digits, ownerId),
      name: (item.name || digits).trim(),
      phone: digits,
      status: 'pendente',
      deliveryStatus: 'pendente',
    });
  }

  if (cleanRecipients.length === 0) {
    if (skippedDuplicates.length > 0) {
      throw new Error(
        `Todos os ${skippedDuplicates.length} número(s) informado(s) já receberam envio em campanhas anteriores. Nenhum envio duplicado foi criado.`
      );
    }
    throw new Error('Nenhum número de telefone válido foi encontrado na lista informada.');
  }

  const initialStatus = params.startImmediately ? 'em_andamento' : 'rascunho';
  const initialAction = params.startImmediately
    ? 'Iniciando fila de transmissão segura...'
    : 'Aguardando início';

  const res = await pool.query(
    `INSERT INTO whatsapp_campaigns (
      id, owner_id, name, message_template, media_type, media_url, file_name, mime_type,
      status, anti_ban_config, recipients, total_count, sent_count, read_count, failed_count, current_action
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, 0, 0, $13)
    RETURNING *`,
    [
      id,
      ownerId,
      params.name.trim(),
      params.message_template,
      params.media_type || 'text',
      params.media_url || null,
      params.file_name || null,
      params.mime_type || null,
      initialStatus,
      JSON.stringify(params.anti_ban_config),
      JSON.stringify(cleanRecipients),
      cleanRecipients.length,
      initialAction,
    ]
  );

  const created = mapRowToCampaign(res.rows[0]);

  if (params.startImmediately) {
    startCampaignWorker().catch(() => {});
  }

  return {
    ...created,
    skipped_duplicates_count: skippedDuplicates.length,
  };
}

export async function updateCampaignStatus(
  campaignId: string,
  newStatus: 'em_andamento' | 'pausada' | 'cancelada'
): Promise<boolean> {
  await ensureCampaignsTable();
  const pool = getEmailDbPool();
  if (!pool) return false;

  const actionText =
    newStatus === 'pausada'
      ? '⏸️ Campanha pausada pelo usuário'
      : newStatus === 'cancelada'
      ? '⏹️ Campanha cancelada'
      : '▶️ Retomando envios com proteção Anti-Ban...';

  await pool.query(
    `UPDATE whatsapp_campaigns
     SET status = $1, current_action = $2, next_send_at = NULL, updated_at = NOW()
     WHERE id = $3`,
    [newStatus, actionText, campaignId]
  );

  emitCampaignUpdate();

  if (newStatus === 'em_andamento') {
    startCampaignWorker().catch(() => {});
  }

  return true;
}

export async function deleteCampaign(campaignId: string): Promise<boolean> {
  await ensureCampaignsTable();
  const pool = getEmailDbPool();
  if (!pool) return false;

  await pool.query(`DELETE FROM whatsapp_campaigns WHERE id = $1`, [campaignId]);
  emitCampaignUpdate();
  return true;
}

/**
 * Worker em Background com Cadência Anti-Banimento (Jitter randômico + Simulação de digitação + Pausa por Lote)
 */
export async function startCampaignWorker(): Promise<void> {
  if (g.__waCampaignWorkerRunning) return;
  g.__waCampaignWorkerRunning = true;

  const pool = getEmailDbPool();
  if (!pool) {
    g.__waCampaignWorkerRunning = false;
    return;
  }

  try {
    while (true) {
      const res = await pool.query(
        `SELECT * FROM whatsapp_campaigns WHERE status = 'em_andamento' ORDER BY created_at ASC LIMIT 1`
      );

      if (res.rows.length === 0) {
        break;
      }

      const camp = mapRowToCampaign(res.rows[0]);
      const nextIdx = camp.recipients.findIndex(r => r.status === 'pendente');

      if (nextIdx === -1) {
        await pool.query(
          `UPDATE whatsapp_campaigns
           SET status = 'concluida',
               current_action = '✅ Transmissão concluída com sucesso!',
               next_send_at = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [camp.id]
        );
        emitCampaignUpdate();
        continue;
      }

      const recipient = camp.recipients[nextIdx];
      const cfg = camp.anti_ban_config;
      const ownerId = camp.owner_id || 'default';
      const targetChatId = recipient.chatId?.includes('chat_')
        ? recipient.chatId
        : buildChatIdForOwner(recipient.phone, ownerId);

      // Garante sessão Baileys ativa para o usuário dono da campanha
      await ensureBaileysConnected(false, ownerId).catch(() => null);

      // 1. Garante que o contato exista em whatsapp_chats
      const ticketStatus = cfg.closeTicketAfterSend ? 'encerrado' : 'aberto';
      await pool
        .query(
          `INSERT INTO whatsapp_chats (id, owner_id, phone, name, last_message, last_message_time, unread_count, bot_enabled, crm_stage, ticket_status)
           VALUES ($1, $2, $3, $4, 'Campanha de transmissão', NOW(), 0, TRUE, 'lead', $5)
           ON CONFLICT (id) DO NOTHING`,
          [targetChatId, ownerId, recipient.phone, recipient.name, ticketStatus]
        )
        .catch(() => {});

      // 2. Simula digitação humana (2.5s a 4.5s) se ativado
      if (cfg.simulateTyping) {
        const typingMs = Math.floor(Math.random() * 2000) + 2500;
        await pool.query(
          `UPDATE whatsapp_campaigns
           SET current_action = $1, updated_at = NOW()
           WHERE id = $2`,
          [`✍️ Simulando digitação para ${recipient.name} (${recipient.phone})...`, camp.id]
        );
        emitCampaignUpdate();
        await simulateHumanTyping(recipient.phone, typingMs, ownerId);
      }

      // Revalida se a campanha não foi pausada/cancelada durante a digitação
      const checkRes = await pool.query(
        `SELECT status FROM whatsapp_campaigns WHERE id = $1`,
        [camp.id]
      );
      if (!checkRes.rows[0] || checkRes.rows[0].status !== 'em_andamento') {
        continue;
      }

      // 3. Monta mensagem personalizada (com reescrita única por IA para leads frios se ativado) e dispara no WhatsApp real via Baileys
      let finalMsg = buildPersonalizedMessage(
        camp.message_template,
        recipient,
        cfg.personalizeGreeting
      );
      if (cfg.aiRewritePerLead) {
        finalMsg = await rewriteColdMessageWithAI(finalMsg, recipient.name, ownerId);
      }

      let sentOk = false;
      let errMsg = '';
      let waMessageId: string | undefined;
      try {
        const ownerCfg = await getWhatsAppConfig(ownerId);
        const hasExternalApi =
          ownerCfg.api_url &&
          ownerCfg.api_url.startsWith('http') &&
          !ownerCfg.api_url.includes('example');

        const sentMsg = await sendMessage({
          chatId: targetChatId,
          text: finalMsg,
          sentBy: 'consultor',
          senderName: `Campanha: ${camp.name}`,
          mediaType: camp.media_type || 'text',
          mediaUrl: camp.media_url || undefined,
          fileName: camp.file_name || undefined,
          mimeType: camp.mime_type || undefined,
          ownerId,
        });

        waMessageId = sentMsg?.wa_key?.id;
        if (!waMessageId && !hasExternalApi) {
          throw new Error('WhatsApp desconectado. Conecte o QR Code para disparar.');
        }
        sentOk = true;

        // Se configurado para manter a fila de chamados limpa após envio da campanha
        if (cfg.closeTicketAfterSend) {
          await pool
            .query(
              `UPDATE whatsapp_chats SET ticket_status = 'encerrado', unread_count = 0 WHERE id = $1`,
              [targetChatId]
            )
            .catch(() => {});
        }
      } catch (err: any) {
        errMsg = err?.message || 'Erro ao enviar';
      }

      // 4. Atualiza destinatário e contadores
      camp.recipients[nextIdx] = {
        ...recipient,
        chatId: targetChatId,
        status: sentOk ? 'enviado' : 'falha',
        deliveryStatus: sentOk ? 'enviado' : 'falha',
        waMessageId,
        sentAt: new Date().toISOString(),
        error: errMsg || undefined,
      };

      const newSentCount = camp.recipients.filter(r => r.status === 'enviado').length;
      const newFailedCount = camp.recipients.filter(r => r.status === 'falha').length;
      const hasMorePending = camp.recipients.some(r => r.status === 'pendente');

      if (!hasMorePending) {
        await pool.query(
          `UPDATE whatsapp_campaigns
           SET recipients = $1,
               sent_count = $2,
               failed_count = $3,
               status = 'concluida',
               current_action = '✅ Todos os contatos receberam a campanha!',
               next_send_at = NULL,
               updated_at = NOW()
           WHERE id = $4`,
          [JSON.stringify(camp.recipients), newSentCount, newFailedCount, camp.id]
        );
        emitCampaignUpdate();
        continue;
      }

      // 5. Calcula tempo de espera Anti-Banimento antes do próximo envio
      const minSec = Math.max(3, Number(cfg.minDelaySec || 15));
      const maxSec = Math.max(minSec, Number(cfg.maxDelaySec || 35));
      const batchSize = Math.max(1, Number(cfg.batchSize || 20));
      const batchCooldownSec = Math.max(10, Number(cfg.batchCooldownSec || 120));

      const processedSoFar = newSentCount + newFailedCount;
      const isBatchBoundary = processedSoFar > 0 && processedSoFar % batchSize === 0;

      const waitSeconds = isBatchBoundary
        ? batchCooldownSec
        : Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;

      const nextRecipient = camp.recipients.find(r => r.status === 'pendente');
      const nextSendTime = new Date(Date.now() + waitSeconds * 1000).toISOString();
      const waitDesc = isBatchBoundary
        ? `🛡️ Pausa de segurança de lote (${waitSeconds}s após ${processedSoFar} envios) antes de ${nextRecipient?.name}...`
        : `⏳ Proteção Anti-Ban: aguardando ${waitSeconds}s antes de enviar para ${nextRecipient?.name}...`;

      await pool.query(
        `UPDATE whatsapp_campaigns
         SET recipients = $1,
             sent_count = $2,
             failed_count = $3,
             current_action = $4,
             next_send_at = $5,
             updated_at = NOW()
         WHERE id = $6`,
        [
          JSON.stringify(camp.recipients),
          newSentCount,
          newFailedCount,
          waitDesc,
          nextSendTime,
          camp.id,
        ]
      );
      emitCampaignUpdate();

      // Aguarda segundo a segundo verificando se a campanha foi pausada/cancelada
      for (let s = 0; s < waitSeconds; s++) {
        await new Promise(r => setTimeout(r, 1000));
        if (s % 3 === 0) {
          const st = await pool.query(
            `SELECT status FROM whatsapp_campaigns WHERE id = $1`,
            [camp.id]
          );
          if (!st.rows[0] || st.rows[0].status !== 'em_andamento') {
            break;
          }
        }
      }
    }
  } catch (err) {
    console.error('[CampaignManager] Erro no worker de campanha:', err);
  } finally {
    g.__waCampaignWorkerRunning = false;
  }
}
