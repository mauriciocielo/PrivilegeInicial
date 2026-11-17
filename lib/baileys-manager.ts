import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { getEmailDbPool } from './email-db';
import { processIncomingMessage } from './whatsapp-service';

const g = globalThis as unknown as {
  __baileysSock?: WASocket | null;
  __baileysStarting?: boolean;
  __baileysQR?: string | null;
  __baileysConnected?: boolean;
  __baileysReconnectTimer?: any;
  __sentWaIds?: Set<string>;
};

if (!g.__sentWaIds) {
  g.__sentWaIds = new Set<string>();
}

const AUTH_DIR = path.resolve(process.cwd(), '.baileys_auth');

function getSock(): WASocket | null {
  return g.__baileysSock || null;
}

/**
 * Desembrulha mensagens encapsuladas do WhatsApp (mensagens temporárias, viewOnce, deviceSent, etc.)
 */
function unwrapWhatsAppMessage(message: any): any {
  if (!message) return null;
  if (message.ephemeralMessage?.message) {
    return unwrapWhatsAppMessage(message.ephemeralMessage.message);
  }
  if (message.viewOnceMessage?.message) {
    return unwrapWhatsAppMessage(message.viewOnceMessage.message);
  }
  if (message.viewOnceMessageV2?.message) {
    return unwrapWhatsAppMessage(message.viewOnceMessageV2.message);
  }
  if (message.viewOnceMessageV2Extension?.message) {
    return unwrapWhatsAppMessage(message.viewOnceMessageV2Extension.message);
  }
  if (message.documentWithCaptionMessage?.message) {
    return unwrapWhatsAppMessage(message.documentWithCaptionMessage.message);
  }
  if (message.deviceSentMessage?.message) {
    return unwrapWhatsAppMessage(message.deviceSentMessage.message);
  }
  if (message.editedMessage?.message?.protocolMessage?.editedMessage) {
    return unwrapWhatsAppMessage(message.editedMessage.message.protocolMessage.editedMessage);
  }
  return message;
}

/**
 * Converte JIDs @lid (Linked Identity do WhatsApp) para o número de telefone real usando o mapeamento do Baileys
 */
export function resolvePhoneFromJid(remoteJid: string, msgKey?: any): { phone: string; sendJid: string } {
  // 1. Verifica se o Baileys v7 forneceu remoteJidAlt ou participantAlt com @s.whatsapp.net
  const altJid = msgKey?.remoteJidAlt || msgKey?.participantAlt || '';
  if (altJid && altJid.includes('@s.whatsapp.net')) {
    const clean = altJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    if (clean.length >= 10) {
      return { phone: clean, sendJid: `${clean}@s.whatsapp.net` };
    }
  }

  // 2. Se for @lid, consulta o arquivo lid-mapping-<lid>_reverse.json salvo pelo Baileys
  if (remoteJid.includes('@lid')) {
    const lidId = remoteJid.split('@')[0].split(':')[0];
    const reverseFile = path.join(AUTH_DIR, `lid-mapping-${lidId}_reverse.json`);
    if (fs.existsSync(reverseFile)) {
      try {
        const mappedPhone = JSON.parse(fs.readFileSync(reverseFile, 'utf8'));
        if (mappedPhone && typeof mappedPhone === 'string') {
          const clean = mappedPhone.replace(/[^0-9]/g, '');
          if (clean.length >= 10) {
            return { phone: clean, sendJid: `${clean}@s.whatsapp.net` };
          }
        }
      } catch {}
    }
    return { phone: lidId, sendJid: remoteJid };
  }

  const cleanPhone = remoteJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  return { phone: cleanPhone, sendJid: `${cleanPhone}@s.whatsapp.net` };
}

/**
 * Normaliza números brasileiros e resolve o JID real registrado no WhatsApp
 */
export async function resolveWhatsAppJid(sock: WASocket, phoneOrChatId: string): Promise<string> {
  const pool = getEmailDbPool();

  if (pool) {
    try {
      const cleanDigits = phoneOrChatId.replace(/[^0-9]/g, '');
      const chatId = phoneOrChatId.startsWith('chat_') ? phoneOrChatId : `chat_${cleanDigits}`;
      const res = await pool.query(
        `SELECT remote_jid, phone FROM whatsapp_chats WHERE id = $1 OR phone ILIKE $2 LIMIT 1`,
        [chatId, `%${cleanDigits.slice(-8)}%`]
      );
      if (res.rows[0]?.remote_jid && res.rows[0].remote_jid.includes('@')) {
        return res.rows[0].remote_jid;
      }
    } catch {}
  }

  if (phoneOrChatId.includes('@s.whatsapp.net') || phoneOrChatId.includes('@lid')) {
    return phoneOrChatId;
  }

  let digits = phoneOrChatId.replace(/^chat_/, '').replace(/[^0-9]/g, '');

  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }

  // Verifica se existe mapeamento LID reverso caso digits seja um LID
  const reverseFile = path.join(AUTH_DIR, `lid-mapping-${digits}_reverse.json`);
  if (fs.existsSync(reverseFile)) {
    try {
      const mapped = JSON.parse(fs.readFileSync(reverseFile, 'utf8'));
      if (mapped) digits = String(mapped).replace(/[^0-9]/g, '');
    } catch {}
  }

  try {
    const candidates = [digits];
    if (digits.startsWith('55') && digits.length === 13 && digits[4] === '9') {
      candidates.push(digits.slice(0, 4) + digits.slice(5));
    } else if (digits.startsWith('55') && digits.length === 12) {
      candidates.push(digits.slice(0, 4) + '9' + digits.slice(4));
    }

    for (const num of candidates) {
      const results = await sock.onWhatsApp(num);
      const found = results?.[0];
      if (found && found.exists && found.jid) {
        if (pool) {
          const cid = phoneOrChatId.startsWith('chat_') ? phoneOrChatId : `chat_${digits}`;
          await pool
            .query(`UPDATE whatsapp_chats SET remote_jid = $1 WHERE id = $2`, [found.jid, cid])
            .catch(() => {});
        }
        return found.jid;
      }
    }
  } catch (e) {
    console.warn('[Baileys] Aviso ao consultar onWhatsApp:', e);
  }

  return `${digits}@s.whatsapp.net`;
}

/**
 * Busca a foto de perfil do contato no WhatsApp e salva no banco
 */
export async function syncContactProfilePic(chatId: string, jid: string): Promise<string | null> {
  const sock = getSock();
  if (!sock) return null;

  try {
    const picUrl = await sock.profilePictureUrl(jid, 'image').catch(() => null);
    if (picUrl) {
      const pool = getEmailDbPool();
      if (pool) {
        await pool.query(`UPDATE whatsapp_chats SET profile_pic = $1 WHERE id = $2`, [picUrl, chatId]);
      }
      return picUrl;
    }
  } catch {}
  return null;
}

export async function getLiveBaileysQR(): Promise<{ qr_code: string | null; status: string }> {
  const sock = getSock();
  if (sock && g.__baileysConnected && sock.user) {
    return { qr_code: null, status: 'conectado' };
  }

  if (g.__baileysQR) {
    return { qr_code: g.__baileysQR, status: 'qrcode' };
  }

  startBaileysSocket().catch(err => console.error('[Baileys] Erro ao iniciar socket:', err));

  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (g.__baileysQR) {
      return { qr_code: g.__baileysQR, status: 'qrcode' };
    }
    if (getSock()?.user && g.__baileysConnected) {
      return { qr_code: null, status: 'conectado' };
    }
  }

  return { qr_code: g.__baileysQR || null, status: g.__baileysQR ? 'qrcode' : 'conectando' };
}

/**
 * Garante que o socket Baileys está ativo caso já existam credenciais salvas em disco
 */
export async function ensureBaileysConnected(waitForOpen = true): Promise<WASocket | null> {
  if (g.__baileysSock && g.__baileysConnected) {
    return g.__baileysSock;
  }

  // Se já existe um socket em processo de conexão, apenas aguarda ou retorna
  if (g.__baileysSock || g.__baileysStarting) {
    if (!waitForOpen) return g.__baileysSock || null;
    for (let i = 0; i < 10; i++) {
      if (g.__baileysSock && g.__baileysConnected) {
        return g.__baileysSock;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return g.__baileysSock || null;
  }

  const credsFile = path.join(AUTH_DIR, 'creds.json');
  if (fs.existsSync(credsFile)) {
    if (!waitForOpen) {
      startBaileysSocket(false).catch(err => console.error('[Baileys] Auto-connect erro:', err));
      return g.__baileysSock || null;
    }

    await startBaileysSocket(false);
    for (let i = 0; i < 10; i++) {
      if (g.__baileysSock && g.__baileysConnected) {
        return g.__baileysSock;
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return g.__baileysSock || null;
}

function notifySocketIoClients(chatId: string) {
  try {
    const io = (globalThis as any).io;
    if (io) {
      io.emit('whatsapp_update', { chatId, timestamp: Date.now() });
    }
  } catch {}
}

export async function startBaileysSocket(forceReset = false): Promise<void> {
  if (!forceReset && (g.__baileysStarting || g.__baileysConnected || g.__baileysSock)) {
    return;
  }
  g.__baileysStarting = true;

  if (g.__baileysReconnectTimer) {
    clearTimeout(g.__baileysReconnectTimer);
    g.__baileysReconnectTimer = null;
  }

  try {
    if (g.__baileysSock) {
      try {
        g.__baileysSock.ev.removeAllListeners('connection.update');
        g.__baileysSock.ev.removeAllListeners('messages.upsert');
        g.__baileysSock.ev.removeAllListeners('creds.update');
        g.__baileysSock.end(undefined);
      } catch {}
      g.__baileysSock = null;
    }

    if (forceReset) {
      g.__baileysQR = null;
      g.__baileysConnected = false;
      if (fs.existsSync(AUTH_DIR)) {
        try {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        } catch {}
      }
    }

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({
      version: [2, 3000, 1015901307] as [number, number, number],
    }));

    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: state,
      browser: ['Privilege Contabilidade', 'Chrome', '124.0.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 15000,
      syncFullHistory: false,
    });

    g.__baileysSock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async update => {
      if (g.__baileysSock !== sock) return;
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('[Baileys] Novo QR Code autêntico recebido do WhatsApp!');
        try {
          const qrBase64 = await QRCode.toDataURL(qr, {
            width: 360,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
          });
          g.__baileysQR = qrBase64;
          g.__baileysConnected = false;

          const pool = getEmailDbPool();
          if (pool) {
            await pool.query(
              `UPDATE whatsapp_config SET qr_code = $1, status = 'qrcode' WHERE id = 'default'`,
              [qrBase64]
            );
          }
        } catch (e) {
          console.error('[Baileys] Erro ao converter QR para base64:', e);
        }
      }

      if (connection === 'open') {
        console.log('[Baileys] WhatsApp conectado de forma estável e escutando mensagens ao vivo!');
        g.__baileysQR = null;
        g.__baileysConnected = true;
        g.__baileysStarting = false;
        const phone = sock.user?.id ? sock.user.id.split(':')[0] : 'Conectado';
        const name = sock.user?.name || 'Privilege Contabilidade';

        const pool = getEmailDbPool();
        if (pool) {
          await pool.query(
            `UPDATE whatsapp_config SET status = 'conectado', phone_number = $1, profile_name = $2, qr_code = NULL WHERE id = 'default'`,
            ['+' + phone, name]
          );

          try {
            const chatsRes = await pool.query(`SELECT id, phone, remote_jid FROM whatsapp_chats LIMIT 30`);
            for (const row of chatsRes.rows) {
              const targetJid = row.remote_jid || `${row.phone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
              syncContactProfilePic(row.id, targetJid).catch(() => {});
            }
          } catch {}
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isReplaced = statusCode === DisconnectReason.connectionReplaced;

        g.__baileysConnected = false;
        g.__baileysStarting = false;
        if (g.__baileysSock === sock) {
          g.__baileysSock = null;
        }

        console.log(`[Baileys] Conexão fechada (code=${statusCode}).`);

        if (isLoggedOut) {
          g.__baileysQR = null;
          const pool = getEmailDbPool();
          if (pool) {
            await pool.query(
              `UPDATE whatsapp_config SET status = 'desconectado' WHERE id = 'default'`
            );
          }
        } else if (!isReplaced) {
          if (g.__baileysReconnectTimer) clearTimeout(g.__baileysReconnectTimer);
          g.__baileysReconnectTimer = setTimeout(() => {
            g.__baileysReconnectTimer = null;
            startBaileysSocket(false).catch(console.error);
          }, 4000);
        }
      }
    });

    // Recepção ao vivo de mensagens (notify = novas mensagens, append = enviadas pelo celular / sincronizadas)
    sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
      if (type !== 'notify' && type !== 'append') return;

      for (const m of msgs) {
        if (!m.message) continue;
        const rawJid = m.key.remoteJid || '';
        if (!rawJid || rawJid.includes('@g.us') || rawJid.includes('broadcast') || rawJid.includes('status@')) {
          continue;
        }

        // Ignora mensagens que já foram disparadas pela própria plataforma para não duplicar
        if (m.key.id && g.__sentWaIds?.has(m.key.id)) {
          continue;
        }

        const unwrapped = unwrapWhatsAppMessage(m.message);
        if (!unwrapped) continue;

        const { phone: cleanPhone, sendJid } = resolvePhoneFromJid(rawJid, m.key);
        if (!cleanPhone) continue;

        const chatId = 'chat_' + cleanPhone.replace(/[^0-9]/g, '');
        const senderName = m.pushName || cleanPhone;
        const pool = getEmailDbPool();

        // Trata reação recebida
        if (unwrapped.reactionMessage) {
          const emoji = unwrapped.reactionMessage.text || '';
          const targetWaId = unwrapped.reactionMessage.key?.id;
          if (pool && targetWaId && emoji) {
            await pool
              .query(
                `UPDATE whatsapp_messages 
                 SET reactions = COALESCE(reactions, '[]'::jsonb) || $1::jsonb
                 WHERE chat_id = $2 AND (wa_key->>'id' = $3 OR id = $3)`,
                [JSON.stringify([emoji]), chatId, targetWaId]
              )
              .catch(() => {});
            notifySocketIoClients(chatId);
          }
          continue;
        }

        let text =
          unwrapped.conversation ||
          unwrapped.extendedTextMessage?.text ||
          unwrapped.imageMessage?.caption ||
          unwrapped.videoMessage?.caption ||
          unwrapped.documentMessage?.caption ||
          '';

        let mediaType = 'text';
        let mediaUrl: string | null = null;
        let fileName: string | null = null;

        try {
          if (unwrapped.imageMessage) {
            mediaType = 'image';
            const buf = (await downloadMediaMessage(m, 'buffer', {})) as Buffer;
            const mime = unwrapped.imageMessage.mimetype || 'image/jpeg';
            mediaUrl = `data:${mime};base64,${buf.toString('base64')}`;
            if (!text) text = '📷 Imagem';
          } else if (unwrapped.audioMessage) {
            mediaType = 'audio';
            const buf = (await downloadMediaMessage(m, 'buffer', {})) as Buffer;
            const mime = unwrapped.audioMessage.mimetype || 'audio/ogg; codecs=opus';
            mediaUrl = `data:${mime};base64,${buf.toString('base64')}`;
            if (!text) text = '🎤 Mensagem de áudio';
          } else if (unwrapped.documentMessage) {
            mediaType = 'document';
            fileName = unwrapped.documentMessage.fileName || 'documento.pdf';
            const buf = (await downloadMediaMessage(m, 'buffer', {})) as Buffer;
            const mime = unwrapped.documentMessage.mimetype || 'application/pdf';
            mediaUrl = `data:${mime};base64,${buf.toString('base64')}`;
            if (!text) text = `📄 ${fileName}`;
          }
        } catch (mediaErr) {
          console.warn('[Baileys] Aviso ao baixar mídia:', mediaErr);
        }

        if (!text && !mediaUrl) continue;

        console.log(
          `[Baileys Ao Vivo] Mensagem (${m.key.fromMe ? 'Enviada pelo Celular' : 'Recebida'}) de ${senderName} (${cleanPhone}): "${text.slice(0, 60)}"`
        );

        const profilePic = await sock.profilePictureUrl(sendJid, 'image').catch(() => null);

        // Se a mensagem foi enviada pelo próprio aparelho celular do consultor (fromMe = true)
        if (m.key.fromMe) {
          if (pool) {
            const msgId = 'msg_out_' + (m.key.id || Date.now());
            await pool
              .query(
                `INSERT INTO whatsapp_chats (id, phone, name, profile_pic, remote_jid, last_message, last_message_time, unread_count, bot_enabled, crm_stage)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW(), 0, TRUE, 'em_atendimento')
                 ON CONFLICT (id) DO UPDATE SET
                   profile_pic = COALESCE(EXCLUDED.profile_pic, whatsapp_chats.profile_pic),
                   remote_jid = COALESCE(EXCLUDED.remote_jid, whatsapp_chats.remote_jid),
                   last_message = EXCLUDED.last_message,
                   last_message_time = NOW()`,
                [chatId, cleanPhone, cleanPhone, profilePic, sendJid, text]
              )
              .catch(() => {});

            await pool
              .query(
                `INSERT INTO whatsapp_messages (id, chat_id, from_me, sender_name, text, media_type, media_url, file_name, wa_key, reactions, status, timestamp, sent_by)
                 VALUES ($1, $2, TRUE, 'Consultor (Celular)', $3, $4, $5, $6, $7, '[]'::jsonb, 'enviado', NOW(), 'consultor')
                 ON CONFLICT (id) DO NOTHING`,
                [
                  msgId,
                  chatId,
                  text,
                  mediaType,
                  mediaUrl,
                  fileName,
                  JSON.stringify(m.key),
                ]
              )
              .catch(() => {});
            notifySocketIoClients(chatId);
          }
          continue;
        }

        // Mensagem recebida de um cliente!
        await processIncomingMessage({
          chatId,
          phone: cleanPhone,
          name: senderName,
          text,
          profilePic: profilePic || undefined,
          mediaType,
          mediaUrl: mediaUrl || undefined,
          fileName: fileName || undefined,
          waKey: m.key,
          remoteJid: sendJid,
        });

        notifySocketIoClients(chatId);
      }
    });
  } catch (err) {
    console.error('[Baileys] Falha geral no startBaileysSocket:', err);
  } finally {
    g.__baileysStarting = false;
  }
}

export async function disconnectBaileysSocket(): Promise<void> {
  if (g.__baileysSock) {
    try {
      await g.__baileysSock.logout();
    } catch {}
    g.__baileysSock = null;
  }
  g.__baileysQR = null;
  g.__baileysConnected = false;
  if (fs.existsSync(AUTH_DIR)) {
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    } catch {}
  }

  const pool = getEmailDbPool();
  if (pool) {
    await pool.query(
      `UPDATE whatsapp_config SET status = 'desconectado', phone_number = NULL, qr_code = NULL WHERE id = 'default'`
    );
  }
}

/**
 * Envia mensagem de texto, imagem, áudio ou documento pelo WhatsApp real via Baileys
 */
export async function sendBaileysLiveMessage(
  phoneOrChatId: string,
  text: string,
  options?: {
    mediaType?: 'text' | 'image' | 'audio' | 'document';
    mediaUrl?: string;
    fileName?: string;
    mimeType?: string;
  }
): Promise<{ sent: boolean; waKey?: any; profilePic?: string | null }> {
  const sock = await ensureBaileysConnected(true);
  if (!sock) {
    console.warn('[Baileys] Socket não está conectado no momento do envio.');
    return { sent: false };
  }

  try {
    const jid = await resolveWhatsAppJid(sock, phoneOrChatId);
    let sentMsg: any = null;

    if (options?.mediaUrl && options.mediaType && options.mediaType !== 'text') {
      const base64Data = options.mediaUrl.includes('base64,')
        ? options.mediaUrl.split('base64,')[1]
        : options.mediaUrl;
      const buffer = Buffer.from(base64Data, 'base64');
      const mimeMatch = options.mediaUrl.match(/^data:([^;]+);base64,/);
      const mime = options.mimeType || (mimeMatch ? mimeMatch[1] : 'application/octet-stream');

      if (options.mediaType === 'image') {
        sentMsg = await sock.sendMessage(jid, {
          image: buffer,
          caption: text && text !== '📷 Imagem' ? text : undefined,
          mimetype: mime,
        });
      } else if (options.mediaType === 'audio') {
        sentMsg = await sock.sendMessage(jid, {
          audio: buffer,
          mimetype: mime.includes('ogg') ? mime : 'audio/mp4',
          ptt: true,
        });
      } else if (options.mediaType === 'document') {
        sentMsg = await sock.sendMessage(jid, {
          document: buffer,
          fileName: options.fileName || 'documento.pdf',
          mimetype: mime,
          caption: text && !text.startsWith('📄') ? text : undefined,
        });
      }
    } else {
      sentMsg = await sock.sendMessage(jid, { text });
    }

    if (sentMsg?.key?.id) {
      g.__sentWaIds?.add(sentMsg.key.id);
    }

    const cleanDigits = phoneOrChatId.replace(/[^0-9]/g, '');
    const chatId = phoneOrChatId.startsWith('chat_') ? phoneOrChatId : `chat_${cleanDigits}`;
    const profilePic = await syncContactProfilePic(chatId, jid).catch(() => null);

    notifySocketIoClients(chatId);

    return { sent: true, waKey: sentMsg?.key, profilePic };
  } catch (err) {
    console.error('[Baileys] Erro ao enviar mensagem ao vivo:', err);
    return { sent: false };
  }
}

/**
 * Envia reação (emoji) para uma mensagem específica no WhatsApp
 */
export async function sendBaileysReaction(
  phoneOrChatId: string,
  emoji: string,
  waKey?: any
): Promise<boolean> {
  const sock = await ensureBaileysConnected(true);
  if (!sock) return false;

  try {
    const jid = waKey?.remoteJid || (await resolveWhatsAppJid(sock, phoneOrChatId));
    if (waKey && waKey.id) {
      await sock.sendMessage(jid, {
        react: {
          text: emoji,
          key: waKey,
        },
      });
      return true;
    }
  } catch (err) {
    console.warn('[Baileys] Aviso ao enviar reação no WhatsApp:', err);
  }
  return false;
}
