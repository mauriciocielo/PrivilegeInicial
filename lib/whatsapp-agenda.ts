import { db } from './prisma';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function getTodayBrtDateStr(): string {
  const now = new Date();
  const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return `${brt.getFullYear()}-${pad2(brt.getMonth() + 1)}-${pad2(brt.getDate())}`;
}

export function getNextSlotBrtHorario(): string {
  const now = new Date();
  const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const h = brt.getHours();
  if (h < 8) return '09:00';
  if (h >= 17) return '09:00';
  return `${pad2(h + 1)}:00`;
}

export interface CreateAgendaDemandInput {
  title: string;
  clienteParticipante?: string;
  dateStr?: string;
  horario?: string;
  empresaId?: string;
  consultorId?: string;
  location?: string;
}

export async function createAgendaTaskFromDemand(input: CreateAgendaDemandInput) {
  let empresaId = input.empresaId || '';
  if (!empresaId) {
    const emp = await db.empresa.findFirst({ select: { id: true } }).catch(() => null);
    empresaId = emp?.id || 'geral';
  }

  let consultorId = input.consultorId || '';
  if (!consultorId) {
    const usr = await db.user
      .findFirst({
        where: { role: { in: ['administrador', 'consultor'] } },
        select: { id: true },
      })
      .catch(() => null);
    consultorId = usr?.id || 'admin';
  }

  const dateStr =
    input.dateStr && /^\d{4}-\d{2}-\d{2}$/.test(input.dateStr)
      ? input.dateStr
      : getTodayBrtDateStr();
  const horario =
    input.horario && /^\d{2}:\d{2}$/.test(input.horario)
      ? input.horario
      : getNextSlotBrtHorario();

  const task = await db.agendaTask.create({
    data: {
      title: input.title.trim().slice(0, 180),
      empresaId,
      consultorId,
      horario,
      dateStr,
      completed: false,
      recurrent: false,
      clienteParticipante: input.clienteParticipante?.trim() || null,
      consultoresIds: consultorId ? [consultorId] : [],
      location: input.location || 'WhatsApp',
    },
  });

  return task;
}

const DEMAND_REGEX =
  /\b(preciso|gostaria|solicito|enviar|envia|manda|mandar|emitir|emissão|emissao|nota\s*fiscal|nfse|nfs-e|nfe|nf-e|boleto|guia|das|darf|gps|fgts|inss|irpf|imposto|parcelamento|certid[aã]o|cnd|balan[cç]o|balancete|dre|contrato|altera[cç][aã]o|abertura|fechamento|reuni[aã]o|agendar|ligar|retorno|urgente|pend[eê]ncia|regularizar|folha|holerite|admiss[aã]o|rescis[aã]o|f[eé]rias|sped|dctf|procura[cç][aã]o|certificado\s*digital|or[cç]amento|proposta|suporte|problema|erro)\b/i;

export async function detectAndCreateDemandTask(params: {
  clientName: string;
  phone: string;
  messageText: string;
  ownerId?: string;
}) {
  const cleanText = (params.messageText || '').trim();
  if (cleanText.length < 12) return null;
  if (!DEMAND_REGEX.test(cleanText)) return null;

  const participant = params.clientName || params.phone;
  const dateStr = getTodayBrtDateStr();

  // Evita criar múltiplas tarefas para a mesma pessoa no mesmo intervalo de 30 minutos
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
  const existing = await db.agendaTask
    .findFirst({
      where: {
        clienteParticipante: participant,
        location: 'WhatsApp',
        createdAt: { gte: thirtyMinsAgo },
      },
    })
    .catch(() => null);

  if (existing) return null;

  let consultorId: string | undefined;
  if (params.ownerId && params.ownerId.startsWith('user_')) {
    consultorId = params.ownerId.replace(/^user_/, '');
  }

  const snippet = cleanText.replace(/\s+/g, ' ').slice(0, 110);
  const title = `[WhatsApp] ${participant}: ${snippet}${cleanText.length > 110 ? '...' : ''}`;

  return await createAgendaTaskFromDemand({
    title,
    clienteParticipante: participant,
    dateStr,
    horario: getNextSlotBrtHorario(),
    consultorId,
    location: 'WhatsApp',
  });
}
