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

/**
 * Lista as lições ensinadas ao assistente
 */
export async function getKnowledgeList(search?: string, topic?: string): Promise<KnowledgeLesson[]> {
  const pool = getEmailDbPool();
  if (!pool) return [];

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
    .slice(0, 15)
    .map((l, i) => `[Lição Ensinada #${i + 1} - ${l.topic}]\nPergunta do Cliente: "${l.question}"\nResposta Oficial da Privilege: "${l.answer}"`)
    .join('\n\n');
}
