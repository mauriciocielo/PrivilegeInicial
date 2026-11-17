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

interface BaileysSessionState {
  sock: WASocket | null;
  starting: boolean;
  qr: string | null;
  connected: boolean;
  reconnectTimer: any;
  sentWaIds: Set<string>;
}

const g = globalThis as unknown as {
  __baileysSessions?: Map<string, BaileysSessionState>;
  __baileysBooted?: boolean;
};

if (!g.__baileysSessions) {
  g.__baileysSessions = new Map<string, BaileysSessionState>();
}

function getSessionState(ownerId = 'default'): BaileysSessionState {
  const key = ownerId || 'default';
  let st = g.__baileysSessions!.get(key);
  if (!st) {
    st = {
      sock: null,
      starting: false,
      qr: null,
      connected: false,
      reconnectTimer: null,
      sentWaIds: new Set<string>(),
    };
    g.__baileysSessions!.set(key, st);
  }
  return st;
}

// Pasta onde ficam as sessões pareadas. Em produção (Railway) aponte WHATSAPP_AUTH_DIR
// para um volume persistente; sem ela, usa a raiz do projeto, como no ambiente de teste.
function getAuthRoot(): string {
  return path.resolve(process.env.WHATSAPP_AUTH_DIR || process.cwd());
}

function getAuthDir(ownerId = 'default'): string {
  const key = (ownerId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (key === 'default') {
    return path.join(getAuthRoot(), '.baileys_auth');
  }
  return path.join(getAuthRoot(), `.baileys_auth_${key}`);
}

export function buildChatIdForOwner(digits: string, ownerId = 'default'): string {
  const clean = digits.replace(/[^0-9]/g, '');
  if (!ownerId || ownerId === 'default') {
    return `chat_${clean}`;
  }
  return `${ownerId}_chat_${clean}`;
}

function getSock(ownerId = 'default'): WASocket | null {
  return getSessionState(ownerId).sock || null;
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
export function resolvePhoneFromJid(
  remoteJid: string,
  msgKey?: any,
  ownerId = 'default'
): { phone: string; sendJid: string } {
  const authDir = getAuthDir(ownerId);

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
    const reverseFile = path.join(authDir, `lid-mapping-${lidId}_reverse.json`);
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
export async function resolveWhatsAppJid(
  sock: WASocket,
  phoneOrChatId: string,
  ownerId = 'default'
): Promise<string> {
  const pool = getEmailDbPool();
  const authDir = getAuthDir(ownerId);

  if (pool) {
    try {
      const cleanDigits = phoneOrChatId.replace(/^.*_chat_/, '').replace(/^chat_/, '').replace(/[^0-9]/g, '');
      const chatId = phoneOrChatId.includes('chat_')
        ? phoneOrChatId
        : buildChatIdForOwner(cleanDigits, ownerId);
      const res = await pool.query(
        `SELECT remote_jid, phone FROM whatsapp_chats WHERE id = $1 OR (COALESCE(owner_id, 'default') = $2 AND phone ILIKE $3) LIMIT 1`,
        [chatId, ownerId, `%${cleanDigits.slice(-8)}%`]
      );
      if (res.rows[0]?.remote_jid && res.rows[0].remote_jid.includes('@')) {
        return res.rows[0].remote_jid;
      }
    } catch {}
  }

  if (phoneOrChatId.includes('@s.whatsapp.net') || phoneOrChatId.includes('@lid')) {
    return phoneOrChatId;
  }

  let digits = phoneOrChatId.replace(/^.*_chat_/, '').replace(/^chat_/, '').replace(/[^0-9]/g, '');

  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }

  const reverseFile = path.join(authDir, `lid-mapping-${digits}_reverse.json`);
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
          const cid = phoneOrChatId.includes('chat_')
            ? phoneOrChatId
            : buildChatIdForOwner(digits, ownerId);
          await pool
            .query(`UPDATE whatsapp_chats SET remote_jid = $1 WHERE id = $2`, [found.jid, cid])
            .catch(() => {});
        }
        return found.jid;
      }
    }
  } catch (e) {
    console.warn(`[Baileys:${ownerId}] Aviso ao consultar onWhatsApp:`, e);
  }

  return `${digits}@s.whatsapp.net`;
}

/**
 * Busca a foto de perfil do contato no WhatsApp e salva no banco
 */
export async function syncContactProfilePic(
  chatId: string,
  jid: string,
  ownerId = 'default'
): Promise<string | null> {
  const sock = getSock(ownerId);
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

export async function getLiveBaileysQR(
  ownerId = 'default'
): Promise<{ qr_code: string | null; status: string }> {
  const st = getSessionState(ownerId);
  if (st.sock && st.connected && st.sock.user) {
    return { qr_code: null, status: 'conectado' };
  }

  if (st.qr) {
    return { qr_code: st.qr, status: 'qrcode' };
  }

  startBaileysSocket(false, ownerId).catch(err =>
    console.error(`[Baileys:${ownerId}] Erro ao iniciar socket:`, err)
  );

  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (st.qr) {
      return { qr_code: st.qr, status: 'qrcode' };
    }
    if (st.sock?.user && st.connected) {
      return { qr_code: null, status: 'conectado' };
    }
  }

  return { qr_code: st.qr || null, status: st.qr ? 'qrcode' : 'conectando' };
}

/**
 * Garante que o socket Baileys da sessão do usuário está ativo caso já existam credenciais salvas em disco
 */
export async function ensureBaileysConnected(
  waitForOpen = true,
  ownerId = 'default'
): Promise<WASocket | null> {
  const st = getSessionState(ownerId);
  if (st.sock && st.connected) {
    return st.sock;
  }

  if (st.sock || st.starting) {
    if (!waitForOpen) return st.sock || null;
    for (let i = 0; i < 10; i++) {
      if (st.sock && st.connected) {
        return st.sock;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return st.sock || null;
  }

  const credsFile = path.join(getAuthDir(ownerId), 'creds.json');
  if (fs.existsSync(credsFile)) {
    if (!waitForOpen) {
      startBaileysSocket(false, ownerId).catch(err =>
        console.error(`[Baileys:${ownerId}] Auto-connect erro:`, err)
      );
      return st.sock || null;
    }

    await startBaileysSocket(false, ownerId);
    for (let i = 0; i < 10; i++) {
      if (st.sock && st.connected) {
        return st.sock;
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return st.sock || null;
}

/**
 * Inicializa automaticamente todas as sessões Baileys salvas em disco ou no banco
 * para que o sistema funcione em 2º plano mesmo sem nenhuma tela aberta.
 */
export async function bootAllSavedBaileysSessions(): Promise<string[]> {
  const owners = new Set<string>();

  try {
    const rootDir = getAuthRoot();
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '.baileys_auth') {
        if (fs.existsSync(path.join(rootDir, entry.name, 'creds.json'))) {
          owners.add('default');
        }
      } else if (entry.name.startsWith('.baileys_auth_')) {
        if (fs.existsSync(path.join(rootDir, entry.name, 'creds.json'))) {
          owners.add(entry.name.replace('.baileys_auth_', ''));
        }
      }
    }
  } catch {}

  const pool = getEmailDbPool();
  if (pool) {
    try {
      const res = await pool.query(
        `SELECT id FROM whatsapp_config WHERE status = 'conectado'`
      );
      for (const r of res.rows) {
        if (r.id) owners.add(r.id);
      }
    } catch {}
  }

  const started: string[] = [];
  for (const ownerId of owners) {
    const credsFile = path.join(getAuthDir(ownerId), 'creds.json');
    if (fs.existsSync(credsFile)) {
      ensureBaileysConnected(false, ownerId).catch(() => {});
      started.push(ownerId);
    }
  }

  g.__baileysBooted = true;
  return started;
}

function notifySocketIoClients(
  chatId: string,
  ownerId = 'default',
  extra?: Record<string, any>
) {
  try {
    const io = (globalThis as any).io;
    if (io) {
      io.emit('whatsapp_update', {
        chatId,
        ownerId,
        timestamp: Date.now(),
        ...(extra || {}),
      });
    }
  } catch {}
}

export async function startBaileysSocket(
  forceReset = false,
  ownerId = 'default'
): Promise<void> {
  const st = getSessionState(ownerId);
  const authDir = getAuthDir(ownerId);

  if (!forceReset && (st.starting || st.connected || st.sock)) {
    return;
  }
  st.starting = true;

  if (st.reconnectTimer) {
    clearTimeout(st.reconnectTimer);
    st.reconnectTimer = null;
  }

  try {
    if (st.sock) {
      try {
        st.sock.ev.removeAllListeners('connection.update');
        st.sock.ev.removeAllListeners('messages.upsert');
        st.sock.ev.removeAllListeners('creds.update');
        st.sock.end(undefined);
      } catch {}
      st.sock = null;
    }

    if (forceReset) {
      st.qr = null;
      st.connected = false;
      if (fs.existsSync(authDir)) {
        try {
          fs.rmSync(authDir, { recursive: true, force: true });
        } catch {}
      }
    }

    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
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

    st.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async update => {
      if (st.sock !== sock) return;
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`[Baileys:${ownerId}] Novo QR Code autêntico recebido do WhatsApp!`);
        try {
          const qrBase64 = await QRCode.toDataURL(qr, {
            width: 360,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
          });
          st.qr = qrBase64;
          st.connected = false;

          const pool = getEmailDbPool();
          if (pool) {
            await pool.query(
              `INSERT INTO whatsapp_config (id, provider, status, qr_code, updated_at)
               VALUES ($1, 'baileys', 'qrcode', $2, NOW())
               ON CONFLICT (id) DO UPDATE SET qr_code = EXCLUDED.qr_code, status = 'qrcode', updated_at = NOW()`,
              [ownerId, qrBase64]
            );
          }
        } catch (e) {
          console.error(`[Baileys:${ownerId}] Erro ao converter QR para base64:`, e);
        }
      }

      if (connection === 'open') {
        console.log(`[Baileys:${ownerId}] WhatsApp conectado e escutando em segundo plano!`);
        st.qr = null;
        st.connected = true;
        st.starting = false;
        const phone = sock.user?.id ? sock.user.id.split(':')[0] : 'Conectado';
        const name = sock.user?.name || 'Privilege Contabilidade';

        const pool = getEmailDbPool();
        if (pool) {
          await pool.query(
            `INSERT INTO whatsapp_config (id, provider, status, phone_number, profile_name, qr_code, updated_at)
             VALUES ($1, 'baileys', 'conectado', $2, $3, NULL, NOW())
             ON CONFLICT (id) DO UPDATE SET status = 'conectado', phone_number = EXCLUDED.phone_number, profile_name = EXCLUDED.profile_name, qr_code = NULL, updated_at = NOW()`,
            [ownerId, '+' + phone, name]
          );

          try {
            const chatsRes = await pool.query(
              `SELECT id, phone, remote_jid FROM whatsapp_chats WHERE COALESCE(owner_id, 'default') = $1 LIMIT 30`,
              [ownerId]
            );
            for (const row of chatsRes.rows) {
              const targetJid = row.remote_jid || `${row.phone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
              syncContactProfilePic(row.id, targetJid, ownerId).catch(() => {});
            }
          } catch {}
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isReplaced = statusCode === DisconnectReason.connectionReplaced;

        st.connected = false;
        st.starting = false;
        if (st.sock === sock) {
          st.sock = null;
        }

        console.log(`[Baileys:${ownerId}] Conexão fechada (code=${statusCode}).`);

        if (isLoggedOut) {
          st.qr = null;
          const pool = getEmailDbPool();
          if (pool) {
            await pool.query(
              `UPDATE whatsapp_config SET status = 'desconectado' WHERE id = $1`,
              [ownerId]
            );
          }
        } else if (!isReplaced) {
          if (st.reconnectTimer) clearTimeout(st.reconnectTimer);
          st.reconnectTimer = setTimeout(() => {
            st.reconnectTimer = null;
            startBaileysSocket(false, ownerId).catch(console.error);
          }, 4000);
        }
      }
    });

    // Recepção ao vivo de mensagens (funciona mesmo sem a tela aberta)
    sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
      if (type !== 'notify' && type !== 'append') return;

      for (const m of msgs) {
        if (!m.message) continue;
        const rawJid = m.key.remoteJid || '';
        if (!rawJid || rawJid.includes('@g.us') || rawJid.includes('broadcast') || rawJid.includes('status@')) {
          continue;
        }

        if (m.key.id && st.sentWaIds.has(m.key.id)) {
          continue;
        }

        const unwrapped = unwrapWhatsAppMessage(m.message);
        if (!unwrapped) continue;

        const { phone: cleanPhone, sendJid } = resolvePhoneFromJid(rawJid, m.key, ownerId);
        if (!cleanPhone) continue;

        const chatId = buildChatIdForOwner(cleanPhone, ownerId);
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
            notifySocketIoClients(chatId, ownerId);
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
          console.warn(`[Baileys:${ownerId}] Aviso ao baixar mídia:`, mediaErr);
        }

        if (!text && !mediaUrl) continue;

        console.log(
          `[Baileys:${ownerId}] Mensagem (${m.key.fromMe ? 'Enviada pelo Celular' : 'Recebida'}) de ${senderName} (${cleanPhone}): "${text.slice(0, 60)}"`
        );

        const profilePic = await sock.profilePictureUrl(sendJid, 'image').catch(() => null);

        if (m.key.fromMe) {
          if (pool) {
            const msgId = 'msg_out_' + (m.key.id || Date.now());
            await pool
              .query(
                `INSERT INTO whatsapp_chats (id, owner_id, phone, name, profile_pic, remote_jid, last_message, last_message_time, unread_count, bot_enabled, crm_stage)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 0, TRUE, 'em_atendimento')
                 ON CONFLICT (id) DO UPDATE SET
                   profile_pic = COALESCE(EXCLUDED.profile_pic, whatsapp_chats.profile_pic),
                   remote_jid = COALESCE(EXCLUDED.remote_jid, whatsapp_chats.remote_jid),
                   last_message = EXCLUDED.last_message,
                   last_message_time = NOW()`,
                [chatId, ownerId, cleanPhone, cleanPhone, profilePic, sendJid, text]
              )
              .catch(() => {});

            await pool
              .query(
                `INSERT INTO whatsapp_messages (id, owner_id, chat_id, from_me, sender_name, text, media_type, media_url, file_name, wa_key, reactions, status, timestamp, sent_by)
                 VALUES ($1, $2, $3, TRUE, 'Consultor (Celular)', $4, $5, $6, $7, $8, '[]'::jsonb, 'enviado', NOW(), 'consultor')
                 ON CONFLICT (id) DO NOTHING`,
                [
                  msgId,
                  ownerId,
                  chatId,
                  text,
                  mediaType,
                  mediaUrl,
                  fileName,
                  JSON.stringify(m.key),
                ]
              )
              .catch(() => {});
            notifySocketIoClients(chatId, ownerId);
          }
          continue;
        }

        await processIncomingMessage({
          ownerId,
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

        notifySocketIoClients(chatId, ownerId, {
          isNewMessage: true,
          fromMe: false,
          senderName,
          phone: cleanPhone,
          preview: text.slice(0, 140),
          mediaType,
          profilePic: profilePic || undefined,
        });
      }
    });
  } catch (err) {
    console.error(`[Baileys:${ownerId}] Falha geral no startBaileysSocket:`, err);
  } finally {
    st.starting = false;
  }
}

export async function disconnectBaileysSocket(ownerId = 'default'): Promise<void> {
  const st = getSessionState(ownerId);
  const authDir = getAuthDir(ownerId);

  if (st.sock) {
    try {
      await st.sock.logout();
    } catch {}
    st.sock = null;
  }
  st.qr = null;
  st.connected = false;
  if (fs.existsSync(authDir)) {
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
    } catch {}
  }

  const pool = getEmailDbPool();
  if (pool) {
    await pool.query(
      `UPDATE whatsapp_config SET status = 'desconectado', phone_number = NULL, qr_code = NULL WHERE id = $1`,
      [ownerId]
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
  },
  ownerId = 'default'
): Promise<{ sent: boolean; waKey?: any; profilePic?: string | null }> {
  const sock = await ensureBaileysConnected(true, ownerId);
  const st = getSessionState(ownerId);
  if (!sock) {
    console.warn(`[Baileys:${ownerId}] Socket não está conectado no momento do envio.`);
    return { sent: false };
  }

  try {
    const jid = await resolveWhatsAppJid(sock, phoneOrChatId, ownerId);
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
      st.sentWaIds.add(sentMsg.key.id);
    }

    const cleanDigits = phoneOrChatId.replace(/^.*_chat_/, '').replace(/^chat_/, '').replace(/[^0-9]/g, '');
    const chatId = phoneOrChatId.includes('chat_')
      ? phoneOrChatId
      : buildChatIdForOwner(cleanDigits, ownerId);
    const profilePic = await syncContactProfilePic(chatId, jid, ownerId).catch(() => null);

    notifySocketIoClients(chatId, ownerId);

    return { sent: true, waKey: sentMsg?.key, profilePic };
  } catch (err) {
    console.error(`[Baileys:${ownerId}] Erro ao enviar mensagem ao vivo:`, err);
    return { sent: false };
  }
}

/**
 * Envia reação (emoji) para uma mensagem específica no WhatsApp
 */
export async function sendBaileysReaction(
  phoneOrChatId: string,
  emoji: string,
  waKey?: any,
  ownerId = 'default'
): Promise<boolean> {
  const sock = await ensureBaileysConnected(true, ownerId);
  if (!sock) return false;

  try {
    const jid = waKey?.remoteJid || (await resolveWhatsAppJid(sock, phoneOrChatId, ownerId));
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
    console.warn(`[Baileys:${ownerId}] Aviso ao enviar reação no WhatsApp:`, err);
  }
  return false;
}
