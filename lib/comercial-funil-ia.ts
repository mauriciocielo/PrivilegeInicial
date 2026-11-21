import db from './prisma';

export interface ResultadoFunilComercial {
  ehLeadInteressado: boolean;
  novoEstagio?: 'qualificado' | 'proposta';
  horariosLivres: string[];
  contextoPrompt?: string;
}

const RECUSAS = [
  'nao tenho interesse',
  'não tenho interesse',
  'sem interesse',
  'nao quero',
  'não quero',
  'pare de mandar',
  'parar',
  'descadastrar',
  'remover meu numero',
  'remover meu número',
  'bloqueado',
];

const SINAIS_INTERESSE = [
  'tenho interesse',
  'interessado',
  'interessada',
  'pode falar',
  'pode explicar',
  'me explica',
  'como funciona',
  'diagnostico',
  'diagnóstico',
  'consultoria',
  'agendar',
  'reuniao',
  'reunião',
  'horario',
  'horário',
  'proposta',
  'orcamento',
  'orçamento',
  'vamos conversar',
  'pode ligar',
  'pode chamar',
  'quero saber mais',
  'gostaria de saber',
];

const SINAIS_PROPOSTA = [
  'agendar',
  'reuniao',
  'reunião',
  'horario',
  'horário',
  'proposta',
  'orcamento',
  'orçamento',
  'valor',
  'quanto custa',
];

function norm(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function avaliarInteresseComercialLead(texto: string): {
  interessado: boolean;
  querAgendarOuProposta: boolean;
} {
  const n = norm(texto);
  if (!n || n.length < 3) return { interessado: false, querAgendarOuProposta: false };
  if (RECUSAS.some(r => n.includes(norm(r)))) {
    return { interessado: false, querAgendarOuProposta: false };
  }
  const interessado = SINAIS_INTERESSE.some(s => n.includes(norm(s)));
  const querAgendarOuProposta = SINAIS_PROPOSTA.some(s => n.includes(norm(s)));
  return { interessado, querAgendarOuProposta };
}

/**
 * Sugere 3 horários livres nos próximos 3 dias úteis, evitando conflitos com `AgendaTask`.
 */
async function sugerirHorariosLivresAgenda(): Promise<string[]> {
  const candidatos = ['09:30', '10:30', '14:00', '15:30', '16:30'];
  const sugestoes: string[] = [];

  let ocupados = new Set<string>();
  try {
    const hoje = new Date();
    const daqui5Dias = new Date(hoje.getTime() + 5 * 24 * 60 * 60 * 1000);
    const tarefas = await db.agendaTask.findMany({
      where: {
        date: {
          gte: hoje.toISOString().slice(0, 10),
          lte: daqui5Dias.toISOString().slice(0, 10),
        },
        status: { not: 'concluido' },
      },
      select: { date: true, time: true },
      take: 80,
    });
    ocupados = new Set(tarefas.map(t => `${t.date} ${(t.time || '').slice(0, 5)}`));
  } catch {
    // fallback sem agenda do banco
  }

  const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const base = new Date();

  for (let offset = 1; offset <= 6 && sugestoes.length < 3; offset++) {
    const d = new Date(base.getTime() + offset * 24 * 60 * 60 * 1000);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // pula fim de semana
    const iso = d.toISOString().slice(0, 10);
    const labelDia = offset === 1 ? 'amanhã' : `${diasSemana[dow]} (${iso.slice(8, 10)}/${iso.slice(5, 7)})`;

    for (const h of candidatos) {
      if (!ocupados.has(`${iso} ${h}`)) {
        sugestoes.push(`${labelDia} às ${h}`);
        break;
      }
    }
  }

  return sugestoes;
}

/**
 * Conecta respostas de leads prospectados pelo Garimpador B2B / campanhas 24h
 * ao Kanban Comercial (crm_stage), follow-up automático e horários livres da agenda.
 */
export async function processarRespostaLeadComercial(params: {
  chatId: string;
  phone: string;
  contactName?: string;
  texto: string;
  pool: any;
}): Promise<ResultadoFunilComercial> {
  const { interessado, querAgendarOuProposta } = avaliarInteresseComercialLead(params.texto);
  if (!interessado) {
    return { ehLeadInteressado: false, horariosLivres: [] };
  }

  const digits = (params.phone || '').replace(/\D/g, '');
  const last8 = digits.slice(-8);

  // Verifica se veio de campanha/garimpador ou se mencionou consultoria/diagnóstico
  let veioDeProspeccao = false;
  try {
    if (params.pool && last8.length === 8) {
      const campRes = await params.pool.query(
        `SELECT 1 FROM whatsapp_campaign_items
          WHERE RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 8) = $1
          LIMIT 1`,
        [last8]
      );
      if (campRes.rows.length > 0) veioDeProspeccao = true;
    }
  } catch {
    // tabela pode não existir ainda
  }

  const mencaoDireta = /consultoria|diagnostico|diagnóstico|reuniao|reunião|proposta/.test(norm(params.texto));
  if (!veioDeProspeccao && !mencaoDireta) {
    return { ehLeadInteressado: false, horariosLivres: [] };
  }

  const novoEstagio: 'qualificado' | 'proposta' = querAgendarOuProposta ? 'proposta' : 'qualificado';
  const horariosLivres = await sugerirHorariosLivresAgenda();

  // Move no Kanban Comercial e agenda follow-up em 24h (se ainda não houver)
  try {
    if (params.pool) {
      await params.pool.query(
        `UPDATE whatsapp_chats
            SET crm_stage = CASE
                  WHEN crm_stage IN ('novo', 'em_atendimento', 'qualificado') THEN $2
                  ELSE crm_stage
                END,
                followup_date = COALESCE(followup_date, NOW() + INTERVAL '24 hours'),
                followup_note = COALESCE(NULLIF(followup_note, ''), $3),
                followup_status = CASE WHEN followup_status = 'concluido' OR followup_status IS NULL THEN 'pendente' ELSE followup_status END
          WHERE id = $1`,
        [
          params.chatId,
          novoEstagio,
          `Lead comercial (${params.contactName || params.phone}) demonstrou interesse — avançado automaticamente para ${novoEstagio}.`,
        ]
      );
    }
  } catch {
    // não bloqueia atendimento
  }

  const listaHorarios =
    horariosLivres.length > 0
      ? horariosLivres.map(h => `- ${h}`).join('\n')
      : '- amanhã às 10:00\n- amanhã às 15:00';

  const contextoPrompt =
    `\n\n[FUNIL COMERCIAL AUTOMÁTICO — DIAGNÓSTICO 360º PRIVILEGE]\n` +
    `Este contato demonstrou interesse comercial (estágio atualizado para "${novoEstagio}" no Kanban).\n` +
    `Seu objetivo agora é:\n` +
    `1. Acolher com objetividade e fazer até 2 perguntas curtas de qualificação (segmento/porte e principal gargalo atual no financeiro/margem/comercial), caso ele ainda não tenha dito.\n` +
    `2. Oferecer diretamente um Diagnóstico 360º gratuito de 15 a 20 minutos com a equipe da Privilege, sugerindo um destes horários livres reais da agenda:\n` +
    `${listaHorarios}\n` +
    `3. Se o lead confirmar um horário ou pedir contato imediato, confirme o agendamento e finalize com [CHAMAR_EQUIPE].`;

  return {
    ehLeadInteressado: true,
    novoEstagio,
    horariosLivres,
    contextoPrompt,
  };
}
