import { getEmailDbPool } from './email-db';

export interface KnowledgeLesson {
  id: string;
  topic: string;
  question: string;
  answer: string;
  keywords: string[];
  learned_from: 'manual' | 'correcao_chat' | 'documento';
  usage_count: number;
  created_at?: string;
  updated_at?: string;
}

let __kbEnsured = false;
let __kbSeeded = false;

const DEFAULT_PRIVILEGE_LESSONS: Array<{
  topic: string;
  question: string;
  answer: string;
  keywords: string[];
}> = [
  {
    topic: 'Consultoria 360º',
    question: 'Como funciona a consultoria empresarial 360 da Privilege?',
    answer:
      'Nossa Consultoria 360º integra 4 pilares essenciais da sua empresa: Financeiro, Comercial, Marketing e Pessoas. Você pode contratar o pacote completo ou apenas a área que mais precisa no momento. Me conta qual é o maior desafio da sua empresa hoje para eu direcionar nossa equipe!',
    keywords: ['consultoria', '360', 'pilares', 'areas', 'separado', 'marketing', 'comercial'],
  },
  {
    topic: 'BPO Financeiro',
    question: 'Vocês fazem BPO financeiro e controle de contas a pagar e receber?',
    answer:
      'Sim! No BPO Financeiro da Privilege assumimos sua rotina de contas a pagar e receber, conciliação bancária diária, projeção de fluxo de caixa e relatórios gerenciais para você focar no crescimento do negócio. Quer que eu chame um especialista da equipe para avaliar sua operação?',
    keywords: ['bpo', 'financeiro', 'contas', 'pagar', 'receber', 'conciliacao', 'fluxo', 'caixa'],
  },
  {
    topic: 'Abertura de Empresa',
    question: 'Quero abrir uma empresa ou CNPJ, como funciona e quanto tempo leva?',
    answer:
      'Cuidamos de todo o processo de abertura do seu CNPJ: estudo do melhor regime tributário, contrato social, registros na Junta Comercial, Receita Federal, Prefeitura e alvarás. Se quiser, me diga qual será a atividade e a cidade para eu chamar nossa equipe te orientar por aqui mesmo!',
    keywords: ['abrir', 'abertura', 'empresa', 'cnpj', 'contrato', 'social', 'mei', 'alvara'],
  },
  {
    topic: 'Troca de Contabilidade',
    question: 'Quero trocar de contador e trazer minha empresa para a Privilege',
    answer:
      'Fazemos toda a transição da sua contabilidade de forma segura e sem dor de cabeça, cuidando da comunicação e da conferência fiscal/contábil com o escritório anterior. Me informe o nome da sua empresa ou CNPJ para eu chamar nossa equipe e cuidar disso com você!',
    keywords: ['trocar', 'contador', 'contabilidade', 'migrar', 'mudar', 'transferir'],
  },
  {
    topic: 'Tributário',
    question: 'Como saber se minha empresa está pagando imposto a mais ou no regime errado?',
    answer:
      'Fazemos um Diagnóstico Tributário comparando Simples Nacional, Lucro Presumido e Lucro Real com base no seu faturamento e folha. O valor e a economia dependem dessa avaliação. Quer que eu passe seu contato para nossa equipe analisar o seu caso?',
    keywords: ['imposto', 'tributario', 'simples', 'nacional', 'lucro', 'presumido', 'real', 'planejamento'],
  },
  {
    topic: 'Notas Fiscais',
    question: 'Preciso de ajuda para emitir nota fiscal NFS-e ou NF-e',
    answer:
      'Ajudamos tanto na parametrização quanto na emissão de NFS-e e NF-e, conferindo alíquotas, retenções e códigos de serviço para evitar multas. Me diga qual é a dúvida ou o número da nota/empresa para nossa equipe te ajudar por aqui!',
    keywords: ['nota', 'fiscal', 'nfse', 'nfe', 'emitir', 'emissao', 'retencao', 'iss'],
  },
  {
    topic: 'Guias e Impostos',
    question: 'Preciso da segunda via da guia de imposto DAS, DARF, FGTS ou INSS',
    answer:
      'Claro! Para agilizar o envio da guia atualizada, me informe o nome da empresa e qual imposto ou mês você precisa (ex: DAS, DARF, FGTS ou INSS), que já passo para nossa equipe verificar e te enviar por aqui mesmo.',
    keywords: ['guia', 'das', 'darf', 'fgts', 'inss', 'boleto', 'vencida', 'recalcular'],
  },
  {
    topic: 'Certidões (CND)',
    question: 'Preciso tirar certidão negativa CND Federal, Estadual ou Municipal',
    answer:
      'Nós consultamos a situação fiscal e emitimos as certidões (Receita Federal/PGFN, Estadual, Municipal e FGTS), além de identificar eventuais pendências que estejam travando a CND. Me informe o CNPJ ou nome da empresa para nossa equipe conferir!',
    keywords: ['certidao', 'cnd', 'negativa', 'regularidade', 'sitfis', 'pendencia', 'receita'],
  },
  {
    topic: 'Departamento Pessoal',
    question: 'Vocês cuidam de folha de pagamento, admissão, férias e rescisão?',
    answer:
      'Sim! Nosso Departamento Pessoal cuida da folha mensal, admissões, férias, 13º salário, rescisões, eSocial e obrigações trabalhistas. Me diga o que você precisa no DP hoje para eu direcionar ao nosso time!',
    keywords: ['folha', 'pagamento', 'funcionario', 'admissao', 'rescisao', 'ferias', 'esocial', 'holerite'],
  },
  {
    topic: 'Regularização Fiscal',
    question: 'Minha empresa está com débitos, dívida ativa ou precisa de parcelamento',
    answer:
      'Ajudamos a levantar todos os débitos na Receita Federal, PGFN, Estado e Prefeitura para montar a melhor estratégia de parcelamento e regularização. Se puder, me diga qual é a empresa para eu chamar nossa equipe te atender por aqui.',
    keywords: ['parcelamento', 'debito', 'divida', 'ativa', 'malha', 'regularizar', 'pgfn'],
  },
  {
    topic: 'Reunião e Diagnóstico',
    question: 'Gostaria de agendar uma reunião ou diagnóstico para minha empresa',
    answer:
      'Será um prazer conversar com você! Me diga qual assunto você quer tratar na reunião e os dias/horários que prefere, que já passo para a nossa equipe confirmar o melhor horário com você.',
    keywords: ['reuniao', 'agendar', 'conversa', 'chamada', 'diagnostico', 'horario', 'visita'],
  },
  {
    topic: 'Documentos',
    question: 'Onde posso enviar os extratos bancários, XMLs ou documentos do mês?',
    answer:
      'Pode enviar os documentos, extratos ou XMLs diretamente por aqui mesmo no WhatsApp! Assim que você mandar, nossa equipe já recebe e dá andamento.',
    keywords: ['documento', 'extrato', 'xml', 'ofx', 'comprovante', 'enviar', 'mandar', 'arquivo'],
  },
  {
    topic: 'Condomínios',
    question: 'Vocês fazem administração financeira e contabilidade para condomínios?',
    answer:
      'Sim! Temos um núcleo especializado em gestão financeira e contábil para condomínios, com emissão de boletos, controle de inadimplência, prestação de contas transparente para síndicos e atas. Quer conversar com nossa equipe sobre o seu condomínio?',
    keywords: ['condominio', 'sindico', 'taxa', 'condominial', 'inadimplencia', 'prestacao', 'contas'],
  },
  {
    topic: 'Comercial',
    question: 'Como a Privilege pode ajudar minha empresa a crescer e organizar o comercial?',
    answer:
      'Além da contabilidade e do financeiro, atuamos na estruturação Comercial e de Marketing: metas, funil de vendas, precificação correta e indicadores para aumentar lucro com previsibilidade. Me conta um pouco do seu negócio para eu chamar nossa equipe!',
    keywords: ['crescer', 'vendas', 'lucro', 'precificacao', 'estruturar', 'comercial', 'proposta'],
  },
  {
    topic: 'Contabilidade Atual',
    question: 'Já tenho contador, posso contratar só a consultoria ou o planejamento 2027?',
    answer:
      'Com certeza! Nossa Consultoria Empresarial 360º, o BPO Financeiro, o Planejamento Estratégico 2027 e os Treinamentos funcionam de forma totalmente independente da contabilidade tradicional, sem você precisar trocar de contador se não quiser.',
    keywords: ['ja tenho contador', 'outro contador', 'sem trocar', 'independente', 'planejamento 2027'],
  },
  {
    topic: 'Planejamento 2027',
    question: 'Como funciona o Planejamento Estratégico e Orçamentário 2027?',
    answer:
      'Entrar em 2027 sem orçamento e metas claras faz a empresa trabalhar muito e ver pouco dinheiro sobrar. No Planejamento 2027, fechamos a análise de 2026, desenhamos metas de faturamento e lucro mês a mês, orçamento de custos, plano de ação 5W2H e alinhamento tributário e de caixa.',
    keywords: ['planejamento', '2027', 'orcamento', 'metas', 'dre projetado', '5w2h'],
  },
  {
    topic: 'MEI e Preços',
    question: 'Quanto custa a consultoria, o planejamento 2027 ou os planos MEI?',
    answer:
      'Para consultorias, treinamentos e empresas no Simples, Presumido ou Real, o projeto é desenhado sob medida após uma Sessão de Diagnóstico Estratégico (30 min, sem custo inicial) com nossos especialistas Mauricio Cielo ou Marcos Cancelier. Para MEI com contabilidade mensal, temos os planos Essencial (R$ 100/mês), Plus (R$ 150/mês) e Premium (R$ 200/mês).',
    keywords: ['quanto custa', 'preco', 'valor', 'mensalidade', 'mei', 'plano'],
  },
  {
    topic: 'Treinamentos',
    question: 'Vocês fazem treinamentos corporativos e palestras in-company para equipes?',
    answer:
      'Sim! Realizamos treinamentos práticos (presenciais em Francisco Beltrão e região ou online ao vivo) nas trilhas Financeira, Comercial (Vendas Consultivas e WhatsApp), Liderança/Pessoas e Reforma Tributária na Prática para empresas, associações e cooperativas.',
    keywords: ['treinamento', 'palestra', 'in-company', 'capacitacao', 'equipe', 'lideranca'],
  },
  {
    topic: 'Diagnóstico e Endereço',
    question: 'Onde fica o escritório da Privilege e como funciona a reunião de diagnóstico?',
    answer:
      'Nosso escritório fica na Rua Pará, 127, Sala 103/3, Centro, em Francisco Beltrão - PR (e atendemos online em todo o Brasil). A Sessão de Diagnóstico Estratégico dura cerca de 30 minutos com Mauricio Cielo ou Marcos Cancelier — você prefere presencial ou por vídeo chamada, e no turno da manhã ou tarde?',
    keywords: ['endereco', 'onde fica', 'beltrao', 'reuniao', 'diagnostico', 'mauricio', 'marcos'],
  },
];

async function seedDefaultPrivilegeLessons(pool: any) {
  if (__kbSeeded) return;
  __kbSeeded = true;
  try {
    const existingRes = await pool.query(`SELECT question FROM whatsapp_knowledge_base`);
    const existingNorms = new Set<string>(
      (existingRes.rows || []).map((r: any) => normalizeText(String(r.question || ''))).filter(Boolean)
    );

    for (const item of DEFAULT_PRIVILEGE_LESSONS) {
      const norm = normalizeText(item.question);
      if (existingNorms.has(norm)) continue;
      const id = 'kb_seed_' + Math.random().toString(36).substring(2, 10);
      await pool
        .query(
          `INSERT INTO whatsapp_knowledge_base (id, topic, question, answer, keywords, learned_from, usage_count, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'manual', 0, NOW(), NOW())`,
          [id, item.topic, item.question, item.answer, JSON.stringify(item.keywords)]
        )
        .catch(() => {});
      existingNorms.add(norm);
    }
  } catch (err) {
    console.warn('[KnowledgeService] Aviso ao semear lições padrão:', err);
  }
}

async function ensureKnowledgeTable(pool: any) {
  if (__kbEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_knowledge_base (
        id TEXT PRIMARY KEY,
        topic TEXT DEFAULT 'Geral',
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        keywords JSONB DEFAULT '[]'::jsonb,
        learned_from TEXT DEFAULT 'manual',
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    __kbEnsured = true;
    await seedDefaultPrivilegeLessons(pool);
  } catch (err) {
    console.warn('[KnowledgeService] Aviso ao garantir tabela whatsapp_knowledge_base:', err);
  }
}

/**
 * Lista as lições ensinadas ao assistente
 */
export async function getKnowledgeList(search?: string, topic?: string): Promise<KnowledgeLesson[]> {
  const pool = getEmailDbPool();
  if (!pool) return [];
  await ensureKnowledgeTable(pool);

  try {
    let query = `SELECT * FROM whatsapp_knowledge_base`;
    const params: any[] = [];
    const where: string[] = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      where.push(`(question ILIKE $${params.length} OR answer ILIKE $${params.length})`);
    }

    if (topic && topic !== 'todos') {
      params.push(topic);
      where.push(`topic = $${params.length}`);
    }

    if (where.length > 0) {
      query += ` WHERE ` + where.join(' AND ');
    }

    query += ` ORDER BY usage_count DESC, created_at DESC LIMIT 200`;

    const res = await pool.query(query, params);
    return res.rows.map(r => ({
      id: r.id,
      topic: r.topic || 'Geral',
      question: r.question,
      answer: r.answer,
      keywords: typeof r.keywords === 'string' ? JSON.parse(r.keywords) : (r.keywords || []),
      learned_from: r.learned_from || 'manual',
      usage_count: r.usage_count || 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  } catch (err) {
    console.error('[KnowledgeService] Erro ao listar ensinamentos:', err);
    return [];
  }
}

/**
 * Ensina uma nova lição ou resposta ao assistente
 */
export async function teachAssistant(data: {
  topic: string;
  question: string;
  answer: string;
  keywords?: string[];
  learned_from?: 'manual' | 'correcao_chat' | 'documento';
}): Promise<KnowledgeLesson> {
  const pool = getEmailDbPool();
  if (!pool) throw new Error('Banco de dados indisponível');
  await ensureKnowledgeTable(pool);

  const id = 'kb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const keywords = data.keywords && data.keywords.length > 0
    ? data.keywords
    : data.question
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúãõâêîôûç\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);

  const sql = `
    INSERT INTO whatsapp_knowledge_base (id, topic, question, answer, keywords, learned_from, usage_count, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, 0, NOW(), NOW())
    RETURNING *;
  `;

  const res = await pool.query(sql, [
    id,
    data.topic || 'Geral',
    data.question.trim(),
    data.answer.trim(),
    JSON.stringify(keywords),
    data.learned_from || 'manual',
  ]);

  const r = res.rows[0];
  return {
    id: r.id,
    topic: r.topic,
    question: r.question,
    answer: r.answer,
    keywords: typeof r.keywords === 'string' ? JSON.parse(r.keywords) : r.keywords,
    learned_from: r.learned_from,
    usage_count: r.usage_count,
    created_at: r.created_at,
  };
}

/**
 * Atualiza um ensinamento existente
 */
export async function updateLesson(
  id: string,
  data: Partial<{ topic: string; question: string; answer: string; keywords: string[] }>
): Promise<boolean> {
  const pool = getEmailDbPool();
  if (!pool) return false;

  const sets: string[] = ['updated_at = NOW()'];
  const params: any[] = [];

  if (data.topic !== undefined) {
    params.push(data.topic);
    sets.push(`topic = $${params.length}`);
  }
  if (data.question !== undefined) {
    params.push(data.question);
    sets.push(`question = $${params.length}`);
  }
  if (data.answer !== undefined) {
    params.push(data.answer);
    sets.push(`answer = $${params.length}`);
  }
  if (data.keywords !== undefined) {
    params.push(JSON.stringify(data.keywords));
    sets.push(`keywords = $${params.length}`);
  }

  params.push(id);
  const sql = `UPDATE whatsapp_knowledge_base SET ${sets.join(', ')} WHERE id = $${params.length}`;

  await pool.query(sql, params);
  return true;
}

/**
 * Exclui uma lição ensinada
 */
export async function deleteLesson(id: string): Promise<boolean> {
  const pool = getEmailDbPool();
  if (!pool) return false;
  await pool.query(`DELETE FROM whatsapp_knowledge_base WHERE id = $1`, [id]);
  return true;
}

function normalizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/decimo terceiro/g, '13')
    .replace(/segunda via/g, '2 via')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

/**
 * Busca por similaridade semântica / palavras-chave no que foi ensinado ao assistente
 */
export async function findTaughtAnswer(userQuestion: string): Promise<{ lesson: KnowledgeLesson; score: number } | null> {
  const pool = getEmailDbPool();
  if (!pool) return null;

  const normalizedUser = normalizeText(userQuestion);
  if (!normalizedUser) return null;

  const userTokens = normalizedUser.split(/\s+/).filter(w => w.length >= 2);
  if (userTokens.length === 0) return null;

  const allLessons = (await getKnowledgeList()).filter(
    l => l.topic !== 'Site / Documento' && l.learned_from !== 'documento'
  );
  if (allLessons.length === 0) return null;

  let bestLesson: KnowledgeLesson | null = null;
  let highestScore = 0;

  for (const lesson of allLessons) {
    const qNorm = normalizeText(lesson.question);
    const keywordsNorm = lesson.keywords.map(k => normalizeText(k));

    let matchCount = 0;

    // Correspondência direta ou frase contida (mínimo 6 caracteres)
    if (normalizedUser.length >= 6 && (qNorm.includes(normalizedUser) || normalizedUser.includes(qNorm))) {
      matchCount += 4;
    }

    // Correspondência por tokens
    for (const token of userTokens) {
      if (token.length < 3 && token !== '13') continue;
      if (qNorm.split(/\s+/).includes(token)) matchCount += 1.5;
      if (keywordsNorm.some(k => k === token || (token.length >= 4 && k.includes(token)))) matchCount += 2;
    }

    const score = matchCount / Math.max(userTokens.length, 1);

    if (score > highestScore) {
      highestScore = score;
      bestLesson = lesson;
    }
  }

  // Se o score atingir o patamar de relevância (>= 1.2), retorna a resposta aprendida
  if (bestLesson && highestScore >= 1.2) {
    pool.query(`UPDATE whatsapp_knowledge_base SET usage_count = usage_count + 1 WHERE id = $1`, [bestLesson.id]).catch(() => {});
    return { lesson: bestLesson, score: highestScore };
  }

  return null;
}

/**
 * Monta contexto com os ensinamentos para injetar no prompt da IA
 */
export async function getTaughtLessonsContext(): Promise<string> {
  const lessons = await getKnowledgeList();
  if (lessons.length === 0) return '';

  return lessons
    .slice(0, 40)
    .map((l, i) => `[Lição Ensinada #${i + 1} - ${l.topic}]\nPergunta do Cliente: "${l.question}"\nResposta Oficial da Privilege: "${l.answer}"`)
    .join('\n\n');
}

/**
 * Aprende automaticamente quando um consultor humano responde a uma dúvida real de um cliente
 */
export async function autoLearnFromConsultantReply(params: {
  chatId: string;
  consultantReply: string;
}): Promise<void> {
  const pool = getEmailDbPool();
  if (!pool) return;
  const answer = (params.consultantReply || '').trim();
  if (answer.length < 22) return;
  if (answer.includes('Protocolo de Atendimento Registrado') || answer.startsWith('🎫')) return;

  await ensureKnowledgeTable(pool);

  const lastClientRes = await pool
    .query(
      `SELECT text, timestamp FROM whatsapp_messages
       WHERE chat_id = $1 AND from_me = FALSE AND media_type = 'text'
       ORDER BY timestamp DESC LIMIT 1`,
      [params.chatId]
    )
    .catch(() => null);

  const question = (lastClientRes?.rows?.[0]?.text || '').trim();
  if (question.length < 15) return;

  const ignoreGreetings = /^(oi|olá|ola|bom dia|boa tarde|boa noite|ok|obrigad[oa]|valeu|certo|blz|sim|não|nao|show)[\s!?.]*$/i;
  if (ignoreGreetings.test(question) || ignoreGreetings.test(answer)) return;

  const normQ = normalizeText(question);
  if (!normQ || normQ.length < 12) return;

  // Evita duplicar lições já existentes com pergunta parecida
  const existing = await getKnowledgeList();
  const duplicate = existing.some(l => {
    const lNorm = normalizeText(l.question);
    return lNorm === normQ || (lNorm.length > 15 && normQ.includes(lNorm)) || (normQ.length > 15 && lNorm.includes(normQ));
  });
  if (duplicate) return;

  await teachAssistant({
    topic: 'Aprendizado Automático',
    question: question.slice(0, 300),
    answer: answer.slice(0, 1200),
    learned_from: 'correcao_chat',
  }).catch(() => {});
}

/**
 * Processa TODAS as mensagens históricas do banco para extrair inteligência automaticamente
 */
export async function learnFromAllHistoricalMessages(): Promise<{
  scannedMessages: number;
  learnedCount: number;
  totalLessons: number;
}> {
  const pool = getEmailDbPool();
  if (!pool) return { scannedMessages: 0, learnedCount: 0, totalLessons: 0 };
  await ensureKnowledgeTable(pool);

  const msgsRes = await pool
    .query(
      `SELECT chat_id, from_me, sent_by, text, media_type, timestamp
       FROM whatsapp_messages
       WHERE media_type = 'text' AND text IS NOT NULL
       ORDER BY chat_id ASC, timestamp ASC
       LIMIT 3000`
    )
    .catch(() => null);

  const rows = msgsRes?.rows || [];
  if (rows.length === 0) {
    const cur = await getKnowledgeList();
    return { scannedMessages: 0, learnedCount: 0, totalLessons: cur.length };
  }

  const existing = await getKnowledgeList();
  const knownNorms = new Set<string>(existing.map(l => normalizeText(l.question)).filter(Boolean));
  const ignoreGreetings = /^(oi|olá|ola|bom dia|boa tarde|boa noite|ok|obrigad[oa]|valeu|certo|blz|sim|não|nao|show)[\s!?.]*$/i;

  let learnedCount = 0;
  let lastClientQuestionByChat: Record<string, string> = {};

  for (const r of rows) {
    const txt = String(r.text || '').trim();
    if (!txt) continue;

    if (!r.from_me) {
      if (txt.length >= 15 && !ignoreGreetings.test(txt)) {
        lastClientQuestionByChat[r.chat_id] = txt;
      }
      continue;
    }

    if (r.sent_by === 'consultor' && txt.length >= 22 && !ignoreGreetings.test(txt) && !txt.startsWith('🎫')) {
      const q = lastClientQuestionByChat[r.chat_id];
      if (!q) continue;
      delete lastClientQuestionByChat[r.chat_id];

      const normQ = normalizeText(q);
      if (!normQ || normQ.length < 12) continue;

      let isDup = false;
      for (const k of knownNorms) {
        if (k === normQ || (k.length > 15 && normQ.includes(k)) || (normQ.length > 15 && k.includes(normQ))) {
          isDup = true;
          break;
        }
      }
      if (isDup) continue;

      knownNorms.add(normQ);
      await teachAssistant({
        topic: 'Aprendizado Automático',
        question: q.slice(0, 300),
        answer: txt.slice(0, 1200),
        learned_from: 'correcao_chat',
      }).catch(() => {});
      learnedCount++;
    }
  }

  const finalList = await getKnowledgeList();
  return {
    scannedMessages: rows.length,
    learnedCount,
    totalLessons: finalList.length,
  };
}
