import db from './prisma';
import { encontrarSessaoAdminPorNumero } from './nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from './baileys-manager';

let tabelasGarantidas = false;

export async function ensureAgendaGruposTables() {
  if (tabelasGarantidas) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS empresa_whatsapp_grupos (
      empresa_id TEXT PRIMARY KEY,
      group_jid TEXT NOT NULL,
      group_name TEXT,
      notificar_agenda BOOLEAN DEFAULT TRUE,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS agenda_lembretes_enviados (
      task_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      alvo_chave TEXT NOT NULL,
      enviado_em TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (task_id, tipo, alvo_chave)
    )
  `);
  tabelasGarantidas = true;
}

export async function buscarGrupoWhatsAppEmpresa(empresaId: string): Promise<{
  empresaId: string;
  groupJid: string;
  groupName: string;
  notificarAgenda: boolean;
} | null> {
  if (!empresaId) return null;
  await ensureAgendaGruposTables();
  const rows = await db.$queryRawUnsafe<
    Array<{ empresa_id: string; group_jid: string; group_name: string | null; notificar_agenda: boolean }>
  >(
    `SELECT empresa_id, group_jid, group_name, notificar_agenda
       FROM empresa_whatsapp_grupos
      WHERE empresa_id = $1
      LIMIT 1`,
    empresaId
  );
  const r = rows[0];
  if (!r || !r.group_jid) return null;
  return {
    empresaId: r.empresa_id,
    groupJid: r.group_jid,
    groupName: r.group_name || r.group_jid,
    notificarAgenda: r.notificar_agenda !== false,
  };
}

/**
 * Converte data YYYY-MM-DD + horário HH:MM (horário de Brasília -03:00) em timestamp UTC (ms).
 */
function timestampBrasiliaMs(dateStr: string, horario: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const hm = (horario || '09:00').trim().match(/^(\d{1,2}):(\d{2})/);
  const hh = hm ? hm[1].padStart(2, '0') : '09';
  const mm = hm ? hm[2].padStart(2, '0') : '00';
  const d = new Date(`${dateStr}T${hh}:${mm}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function formatarDataBr(dateStr: string): string {
  const p = dateStr.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dateStr;
}

/**
 * Executado periodicamente pelo daemon 24h no servidor (`app/api/whatsapp/daemon`).
 * Envia confirmações automáticas no grupo do cliente:
 *  - 1 dia antes (janela 23h..25h antes do horário)
 *  - 1 hora antes (janela 45min..70min antes do horário)
 */
export async function processarLembretesAgenda24h(): Promise<{ enviados24h: number; enviados1h: number }> {
  let enviados24h = 0;
  let enviados1h = 0;

  try {
    await ensureAgendaGruposTables();

    const grupos = await db.$queryRawUnsafe<
      Array<{ empresa_id: string; group_jid: string; group_name: string | null }>
    >(
      `SELECT empresa_id, group_jid, group_name
         FROM empresa_whatsapp_grupos
        WHERE notificar_agenda = TRUE AND group_jid IS NOT NULL AND group_jid <> ''`
    );

    if (grupos.length === 0) return { enviados24h, enviados1h };

    const grupoPorEmpresa = new Map(grupos.map(g => [g.empresa_id, g]));
    const empresaIds = Array.from(grupoPorEmpresa.keys());

    const agoraMs = Date.now();
    const hojeIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(agoraMs));
    const em2DiasIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
      new Date(agoraMs + 2 * 24 * 60 * 60 * 1000)
    );

    const [tarefas, empresasRows] = await Promise.all([
      db.agendaTask.findMany({
        where: {
          empresaId: { in: empresaIds },
          completed: false,
          dateStr: { gte: hojeIso, lte: em2DiasIso },
        },
        select: {
          id: true,
          empresaId: true,
          title: true,
          dateStr: true,
          horario: true,
          location: true,
          clienteParticipante: true,
        },
      }),
      db.empresa.findMany({
        where: { id: { in: empresaIds } },
        select: { id: true, nomeFantasia: true, razaoSocial: true },
      }),
    ]);

    const empresaPorId = new Map(empresasRows.map(e => [e.id, e]));

    if (tarefas.length === 0) return { enviados24h, enviados1h };

    let ownerId: string | null = null;

    for (const t of tarefas) {
      const alvoMs = timestampBrasiliaMs(t.dateStr, t.horario);
      if (!alvoMs) continue;
      const diffMin = (alvoMs - agoraMs) / 60_000;

      let tipo: '24h' | '1h' | null = null;
      if (diffMin >= 23 * 60 && diffMin <= 25 * 60) {
        tipo = '24h';
      } else if (diffMin >= 45 && diffMin <= 70) {
        tipo = '1h';
      }
      if (!tipo) continue;

      const grupo = grupoPorEmpresa.get(t.empresaId);
      if (!grupo) continue;

      const alvoChave = `${t.dateStr}_${(t.horario || '').slice(0, 5)}`;

      // Verifica idempotência antes de enviar
      const jaEnviado = await db.$queryRawUnsafe<Array<{ task_id: string }>>(
        `SELECT task_id FROM agenda_lembretes_enviados WHERE task_id = $1 AND tipo = $2 AND alvo_chave = $3 LIMIT 1`,
        t.id,
        tipo,
        alvoChave
      );
      if (jaEnviado.length > 0) continue;

      if (!ownerId) {
        ownerId = await encontrarSessaoAdminPorNumero('46999800010');
        if (!ownerId) break; // WhatsApp desconectado no momento; tenta no próximo tick
      }

      const emp = empresaPorId.get(t.empresaId);
      const empNome = emp?.nomeFantasia || emp?.razaoSocial || 'Cliente';
      const dataBr = formatarDataBr(t.dateStr);
      const local = t.location || `Sede - ${empNome}`;

      const texto =
        tipo === '24h'
          ? [
              `📅 *Confirmação de Agenda — Amanhã!*`,
              ``,
              `Olá, pessoal da *${empNome}*! Passando para confirmar nosso compromisso de amanhã:`,
              ``,
              `• *Assunto:* ${t.title}`,
              `• *Data:* ${dataBr}`,
              `• *Horário:* ${t.horario}`,
              `• *Local:* ${local}`,
              ...(t.clienteParticipante ? [`• *Participantes:* ${t.clienteParticipante}`] : []),
              ``,
              `Podemos manter confirmado? Qualquer ajuste, é só nos avisar por aqui! ✅`,
            ].join('\n')
          : [
              `⏰ *Lembrete de Agenda — Daqui a 1 hora!*`,
              ``,
              `Olá, pessoal da *${empNome}*! Lembrando do nosso compromisso de hoje:`,
              ``,
              `• *Assunto:* ${t.title}`,
              `• *Horário:* ${t.horario}`,
              `• *Local:* ${local}`,
              ...(t.clienteParticipante ? [`• *Participantes:* ${t.clienteParticipante}`] : []),
              ``,
              `Nos vemos em breve! 👋`,
            ].join('\n');

      const res = await sendBaileysLiveMessage(grupo.group_jid, texto, undefined, ownerId);
      if (res?.sent) {
        await db.$executeRawUnsafe(
          `INSERT INTO agenda_lembretes_enviados (task_id, tipo, alvo_chave)
           VALUES ($1, $2, $3)
           ON CONFLICT (task_id, tipo, alvo_chave) DO NOTHING`,
          t.id,
          tipo,
          alvoChave
        );
        if (tipo === '24h') enviados24h++;
        else enviados1h++;
      }
    }
  } catch (err) {
    console.warn('[Agenda 24h] Erro ao processar lembretes de grupos:', err);
  }

  return { enviados24h, enviados1h };
}
