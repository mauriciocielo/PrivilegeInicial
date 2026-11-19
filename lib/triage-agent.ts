import { getEmailDbPool } from './email-db';

export interface TriageState {
  nomeCliente?: string;
  oQueProcura?: string;
  perguntouPreco?: boolean;
  status: 'coletando_nome' | 'coletando_demanda' | 'pronto_para_equipe' | 'atendido';
}

/**
 * Verifica se o nome do contato já é um nome válido (e não apenas dígitos de telefone)
 */
export function isValidContactName(name?: string): boolean {
  if (!name) return false;
  const clean = name.replace(/[0-9+\-\s()]/g, '').trim();
  return clean.length >= 2 && clean.toLowerCase() !== 'cliente' && clean.toLowerCase() !== 'whatsapp';
}

export function getFirstName(name?: string): string {
  if (!name) return '';
  const cleaned = name
    .replace(/^(oi,?\s*|ol[áa],?\s*)?(meu nome [ée]|sou o|sou a|me chamo|aqui [ée] o|aqui [ée] a)\s+/i, '')
    .replace(/[^\p{L}\s]/gu, ' ')
    .trim();
  const first = cleaned.split(/\s+/).find(w => w.length >= 2) || '';
  if (!first) return '';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/**
 * Conduz a triagem do Léo (Privilege Contabilidade e Consultoria)
 * Regras estritas:
 * - Antes de chamar a equipe, perguntar: nome (se ainda não souber pelo contato) e o que procura.
 * - Preço: depende de avaliação. Nunca dar valor. Fazer triagem antes de falar de preço.
 * - Nunca dizer que anotou, registrou, confirmou, agendou ou reservou algo (máximo: "passei para a equipe confirmar").
 * - Nunca prometer tempo de resposta (nunca usar "em instantes", "já te retorno", "só um minutinho").
 * - Mensagens curtas, tom próximo e simpático.
 */
export async function runTriageStep(params: {
  chatId: string;
  phone: string;
  name: string;
  userMessage: string;
  currentData?: any;
}): Promise<{
  handled: boolean;
  reply?: string;
  shouldHandover?: boolean;
  summary?: string;
  updatedState?: TriageState;
}> {
  const pool = getEmailDbPool();
  const text = params.userMessage.trim();
  const lower = text.toLowerCase();

  const isSimpleGreeting = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem', 'opa'].includes(lower);
  const isStaleCompleted =
    params.currentData?.status === 'pronto_para_equipe' ||
    params.currentData?.status === 'atendido' ||
    params.currentData?.status === 'concluido';

  const state: TriageState = isStaleCompleted
    ? {
        nomeCliente: params.currentData?.nomeCliente || (isValidContactName(params.name) ? params.name : undefined),
        oQueProcura: undefined,
        perguntouPreco: false,
        status: params.currentData?.nomeCliente || isValidContactName(params.name) ? 'coletando_demanda' : 'coletando_nome',
      }
    : {
        nomeCliente: params.currentData?.nomeCliente || (isValidContactName(params.name) ? params.name : undefined),
        oQueProcura: params.currentData?.oQueProcura,
        perguntouPreco: params.currentData?.perguntouPreco || false,
        status: params.currentData?.status || 'coletando_nome',
      };

  if (isSimpleGreeting && state.status === 'coletando_nome') {
    state.oQueProcura = undefined;
  }

  // 1. Urgência imediata (prisão em flagrante, emergência) -> Chama a equipe imediatamente
  const isImmediateEmergency =
    lower.includes('prisão') ||
    lower.includes('prisao') ||
    lower.includes('flagrante') ||
    lower.includes('emergência') ||
    lower.includes('emergencia');

  if (isImmediateEmergency) {
    return await transferToTeam(
      pool,
      params.chatId,
      params.phone,
      state,
      `Vou chamar alguém da nossa equipe imediatamente, que te responde por aqui mesmo!`
    );
  }

  // 2. Pergunta sobre identidade (robô / IA)
  if (
    lower.includes('você é robô') ||
    lower.includes('voce e robo') ||
    lower.includes('é um robô') ||
    lower.includes('é ia') ||
    lower.includes('inteligência artificial') ||
    lower.includes('é uma pessoa')
  ) {
    const firstName = getFirstName(state.nomeCliente);
    const reply = `Sou o Léo, assistente virtual de Privilege Contabilidade e Consultoria. 😊 ${
      !firstName
        ? 'Como posso te chamar e o que você procura hoje?'
        : !state.oQueProcura
        ? `Como posso te ajudar hoje, ${firstName}?`
        : 'Vou chamar alguém da nossa equipe, que te responde por aqui mesmo.'
    }`;
    return { handled: true, reply, updatedState: state };
  }

  // 3. Pergunta sobre atender somente financeiro ou áreas separadas
  if (
    (lower.includes('somente') || lower.includes('só') || lower.includes('so') || lower.includes('apenas') || lower.includes('separad')) &&
    (lower.includes('financeiro') || lower.includes('mkt') || lower.includes('marketing') || lower.includes('pessoas') || lower.includes('comercial') || lower.includes('area') || lower.includes('área'))
  ) {
    state.oQueProcura = text;
    const followUpQuestion = !state.nomeCliente
      ? 'Como posso te chamar?'
      : 'Quer que eu chame alguém da nossa equipe para avaliar o seu caso por aqui mesmo?';
    const reply = `Atendemos separadamente também as áreas! Nossa consultoria é completa 360º (Marketing, Pessoas, Financeiro e Comercial), mas você pode contratar apenas a área que precisar. ${followUpQuestion}`;
    await saveTriageState(pool, params.chatId, state);
    return { handled: true, reply, updatedState: state };
  }

  // 4. Pergunta sobre Preço / Valor
  const asksPrice =
    lower.includes('preço') ||
    lower.includes('preco') ||
    lower.includes('valor') ||
    lower.includes('quanto custa') ||
    lower.includes('orçamento') ||
    lower.includes('orcamento') ||
    lower.includes('mensalidade');

  if (asksPrice) {
    state.perguntouPreco = true;
    if (!state.nomeCliente) {
      state.status = 'coletando_nome';
      await saveTriageState(pool, params.chatId, state);
      const reply = `O valor depende de uma avaliação do que a sua empresa precisa. Antes de eu chamar nossa equipe para o próximo passo, como posso te chamar e o que você procura?`;
      return { handled: true, reply, updatedState: state };
    }

    if (!state.oQueProcura) {
      state.status = 'coletando_demanda';
      await saveTriageState(pool, params.chatId, state);
      const firstName = getFirstName(state.nomeCliente);
      const reply = `O valor depende de uma avaliação${firstName ? `, ${firstName}` : ''}. Para avançarmos para o próximo passo com a equipe, o que exatamente você procura hoje (Consultoria 360º, Financeiro, Comercial, Marketing ou Pessoas)?`;
      return { handled: true, reply, updatedState: state };
    }

    return await transferToTeam(
      pool,
      params.chatId,
      params.phone,
      state,
      `O preço depende de uma avaliação personalizada para o seu negócio. Passei para a nossa equipe confirmar e vou chamar alguém da equipe, que te responde por aqui mesmo!`
    );
  }

  // 5. Coleta progressiva de Nome e O que Procura
  if (!isSimpleGreeting) {
    if (!state.nomeCliente && state.status === 'coletando_nome' && text.split(/\s+/).length <= 5) {
      const extracted = text
        .replace(/^(oi,?\s*|ol[áa],?\s*)?(meu nome [ée]|sou o|sou a|me chamo|aqui [ée] o|aqui [ée] a)\s+/i, '')
        .trim();
      state.nomeCliente = getFirstName(extracted) || extracted;
      state.oQueProcura = undefined;
    } else if (!state.oQueProcura && text.length > 3) {
      const firstFromText = getFirstName(text);
      const firstFromState = getFirstName(state.nomeCliente);
      if (!firstFromState || firstFromText.toLowerCase() !== firstFromState.toLowerCase() || text.split(/\s+/).length > 2) {
        state.oQueProcura = text;
      }
    }
  }

  if (!state.nomeCliente) {
    state.status = 'coletando_nome';
    await saveTriageState(pool, params.chatId, state);
    const reply = state.oQueProcura
      ? `Prazer! Sou o Léo, da Privilege Contabilidade e Consultoria. 😊 Antes de eu chamar nossa equipe para te atender sobre isso, como posso te chamar?`
      : `Olá! Tudo bem? Sou o Léo, da Privilege Contabilidade e Consultoria. 😊 Como posso te chamar e o que você procura hoje?`;
    return { handled: true, reply, updatedState: state };
  }

  if (!state.oQueProcura) {
    state.status = 'coletando_demanda';
    await saveTriageState(pool, params.chatId, state);
    const firstName = getFirstName(state.nomeCliente);
    const reply = `Prazer${firstName ? `, ${firstName}` : ''}! Somos um escritório de Consultoria Empresarial 360º (Marketing, Pessoas, Financeiro e Comercial) e também atendemos as áreas separadamente. O que você procura para a sua empresa hoje?`;
    return { handled: true, reply, updatedState: state };
  }

  // 6. Já temos Nome + O que Procura -> Passa para a equipe!
  return await transferToTeam(pool, params.chatId, params.phone, state);
}

/**
 * Usado quando a IA decide que precisa da equipe: marca a conversa como transferida,
 * gera o resumo da triagem e pausa o bot. Não gera mensagem (a IA já respondeu).
 */
export async function handoverToTeam(params: { chatId: string; phone: string; state: TriageState }) {
  const pool = getEmailDbPool();
  return transferToTeam(pool, params.chatId, params.phone, params.state, '');
}

/** Guarda o que o cliente procura sem encerrar a triagem (a IA continua a conversa). */
export async function saveDemandForAi(params: { chatId: string; state: TriageState; text: string }) {
  const pool = getEmailDbPool();
  const state: TriageState = { ...params.state };
  if (!state.oQueProcura && params.text.trim().length > 3) state.oQueProcura = params.text.trim();
  await saveTriageState(pool, params.chatId, state);
  return state;
}

async function saveTriageState(pool: any, chatId: string, state: TriageState) {
  if (!pool || chatId === 'sim_test') return;
  if (state.nomeCliente) {
    await pool.query(
      `UPDATE whatsapp_chats SET triage_data = $1, name = $2 WHERE id = $3`,
      [JSON.stringify(state), state.nomeCliente, chatId]
    );
  } else {
    await pool.query(
      `UPDATE whatsapp_chats SET triage_data = $1 WHERE id = $2`,
      [JSON.stringify(state), chatId]
    );
  }
}

async function transferToTeam(
  pool: any,
  chatId: string,
  phone: string,
  state: TriageState,
  customReply?: string
) {
  state.status = 'pronto_para_equipe';

  const summary = `📋 TRIAGEM CONCLUÍDA PELO LÉO:
• Nome do Cliente: ${state.nomeCliente || 'Contato WhatsApp'} (${phone})
• O que procura: ${state.oQueProcura || 'Consultoria Empresarial'}
• Perguntou preço: ${state.perguntouPreco ? 'Sim (orientado que depende de avaliação)' : 'Não'}
• Status: Passado para a equipe confirmar e responder por aqui.`;

  if (pool && chatId !== 'sim_test') {
    await pool.query(
      `UPDATE whatsapp_chats 
       SET 
         name = COALESCE($1, name),
         triage_status = 'transferido_humano',
         triage_summary = $2,
         triage_data = $3,
         crm_stage = 'em_atendimento',
         bot_paused_until = NOW() + INTERVAL '60 minutes'
       WHERE id = $4`,
      [state.nomeCliente || null, summary, JSON.stringify(state), chatId]
    );
  }

  const firstName = getFirstName(state.nomeCliente);
  const reply =
    customReply ||
    `Perfeito${firstName ? `, ${firstName}` : ''}! Passei para a nossa equipe confirmar sobre "${state.oQueProcura}". Vou chamar alguém da equipe, que te responde por aqui mesmo!`;

  return {
    handled: true,
    reply,
    shouldHandover: true,
    summary,
    updatedState: state,
  };
}
