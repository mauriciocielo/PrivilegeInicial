import { getEmailDbPool } from './email-db';
import { generateText } from './ai-provider';

export interface QuizQuestion {
  id: string;
  category?: string;
  prompt: string;
  options: string[];
  correctIndex: 0 | 1 | 2 | 3;
  timeLimitSec: number;
  points?: number;
}

export interface QuizGame {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  created_at?: string;
  updated_at?: string;
}

export interface QuizPlayerAnswer {
  optionIndex: number;
  timeMs: number;
  correct: boolean;
  points: number;
}

export interface QuizPlayer {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  streak: number;
  lastCorrect: boolean | null;
  lastPoints: number;
  answers: Record<string, QuizPlayerAnswer>;
}

export type QuizSessionStatus = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'finished';

export interface QuizSession {
  pin: string;
  game_id: string;
  owner_id: string;
  title: string;
  status: QuizSessionStatus;
  current_question_index: number;
  question_started_at: string | null;
  questions: QuizQuestion[];
  players: QuizPlayer[];
  created_at?: string;
  updated_at?: string;
}

const g = globalThis as unknown as { io?: any };

let __quizTablesEnsured = false;

export const DEFAULT_QUIZ_TEMPLATES: Array<Omit<QuizGame, 'owner_id'>> = [
  {
    id: 'quiz_tpl_gestao_2027',
    title: 'Desafio Gestão & Fluxo de Caixa 2027',
    description: 'Quiz interativo sobre margem de lucro, capital de giro, DRE e planejamento empresarial.',
    questions: [
      {
        id: 'q1',
        prompt: 'Qual indicador mostra exatamente o quanto precisa vender para pagar todos os custos sem ter prejuízo?',
        options: ['Ticket Médio', 'Ponto de Equilíbrio', 'EBITDA', 'ROI'],
        correctIndex: 1,
        timeLimitSec: 20,
        points: 1000,
      },
      {
        id: 'q2',
        prompt: 'Uma empresa vende R$ 100 mil no mês e tem lucro líquido de R$ 15 mil. Qual é a sua Margem Líquida?',
        options: ['10%', '15%', '25%', '85%'],
        correctIndex: 1,
        timeLimitSec: 20,
        points: 1000,
      },
      {
        id: 'q3',
        prompt: 'Por que o lucro no DRE pode ser positivo mesmo com o caixa da empresa no vermelho?',
        options: [
          'Porque vendas a prazo entram no DRE antes do dinheiro cair no banco',
          'Porque o DRE não considera impostos',
          'Porque o banco bloqueia o lucro líquido',
          'Não é possível, lucro e caixa são sempre iguais',
        ],
        correctIndex: 0,
        timeLimitSec: 25,
        points: 1000,
      },
      {
        id: 'q4',
        prompt: 'Qual a regra de ouro para evitar que a empresa quebre por falta de capital de giro?',
        options: [
          'Parcelar todas as compras no cartão corporativo',
          'Misturar conta pessoal dos sócios com a conta da empresa',
          'Casar prazos de recebimento de clientes com prazos de pagamento a fornecedores',
          'Aumentar o estoque ao máximo possível',
        ],
        correctIndex: 2,
        timeLimitSec: 25,
        points: 1000,
      },
      {
        id: 'q5',
        prompt: 'Na Reforma Tributária (IBS e CBS), o que muda na prática para o planejamento das empresas?',
        options: [
          'Todos os impostos serão extintos em 2027',
          'Haverá transição gradual com impacto direto em créditos fiscais e precificação',
          'Apenas MEIs serão afetados',
          'Não há impacto no fluxo de caixa',
        ],
        correctIndex: 1,
        timeLimitSec: 25,
        points: 1000,
      },
    ],
  },
  {
    id: 'quiz_tpl_cultura_equipe',
    title: 'Cultura, Liderança & Alta Performance',
    description: 'Dinâmica rápida para treinamentos In-Company, integração de equipes e convenções.',
    questions: [
      {
        id: 'c1',
        prompt: 'Qual é o principal pilar de uma equipe de alta performance segundo a gestão moderna?',
        options: [
          'Metas claras com autonomia e responsabilidade',
          'Microgerenciamento de todas as tarefas',
          'Comunicação apenas por e-mails formais',
          'Evitar feedbacks negativos a qualquer custo',
        ],
        correctIndex: 0,
        timeLimitSec: 20,
        points: 1000,
      },
      {
        id: 'c2',
        prompt: 'Em um atendimento consultivo ao cliente, o que gera mais confiança nos primeiros 2 minutos?',
        options: [
          'Enviar uma tabela de preços imediatamente',
          'Falar apenas sobre a história da empresa',
          'Escuta ativa e perguntas estratégicas sobre a dor do cliente',
          'Prometer desconto antes de entender o problema',
        ],
        correctIndex: 2,
        timeLimitSec: 20,
        points: 1000,
      },
      {
        id: 'c3',
        prompt: 'Na metodologia 5W2H para planos de ação, o que nunca pode faltar em uma tarefa?',
        options: [
          'Um código secreto',
          'Responsável definido, prazo claro e o que será entregue',
          'Apenas a data de início',
          'Um relatório de 20 páginas',
        ],
        correctIndex: 1,
        timeLimitSec: 20,
        points: 1000,
      },
    ],
  },
];

function emitQuizUpdate(pin: string, eventType = 'update') {
  try {
    if (g.io) {
      g.io.emit(`quiz_update_${pin}`, { pin, eventType, timestamp: Date.now() });
    }
  } catch {}
}

export async function ensureQuizTables() {
  const pool = getEmailDbPool();
  if (!pool) return null;

  if (!__quizTablesEnsured) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quiz_games (
        id TEXT PRIMARY KEY,
        owner_id TEXT DEFAULT 'default',
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        questions JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS quiz_sessions (
        pin TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        owner_id TEXT DEFAULT 'default',
        title TEXT NOT NULL,
        status TEXT DEFAULT 'lobby',
        current_question_index INTEGER DEFAULT 0,
        question_started_at TIMESTAMPTZ,
        questions JSONB DEFAULT '[]'::jsonb,
        players JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    for (const tpl of DEFAULT_QUIZ_TEMPLATES) {
      await pool
        .query(
          `INSERT INTO quiz_games (id, owner_id, title, description, questions)
           VALUES ($1, 'default', $2, $3, $4::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [tpl.id, tpl.title, tpl.description, JSON.stringify(tpl.questions)]
        )
        .catch(() => {});
    }

    __quizTablesEnsured = true;
  }

  return pool;
}

function mapGameRow(r: any): QuizGame {
  return {
    id: r.id,
    owner_id: r.owner_id || 'default',
    title: r.title,
    description: r.description || '',
    questions: typeof r.questions === 'string' ? JSON.parse(r.questions) : r.questions || [],
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function mapSessionRow(r: any): QuizSession {
  return {
    pin: r.pin,
    game_id: r.game_id,
    owner_id: r.owner_id || 'default',
    title: r.title,
    status: (r.status || 'lobby') as QuizSessionStatus,
    current_question_index: Number(r.current_question_index || 0),
    question_started_at: r.question_started_at ? new Date(r.question_started_at).toISOString() : null,
    questions: typeof r.questions === 'string' ? JSON.parse(r.questions) : r.questions || [],
    players: typeof r.players === 'string' ? JSON.parse(r.players) : r.players || [],
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function listQuizzes(ownerId = 'default'): Promise<QuizGame[]> {
  const pool = await ensureQuizTables();
  if (!pool) return [];
  const res = await pool.query(
    `SELECT * FROM quiz_games WHERE COALESCE(owner_id, 'default') IN ($1, 'default') ORDER BY updated_at DESC`,
    [ownerId]
  );
  return res.rows.map(mapGameRow);
}

export async function saveQuiz(params: {
  id?: string;
  ownerId?: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
}): Promise<QuizGame> {
  const pool = await ensureQuizTables();
  if (!pool) throw new Error('Banco de dados indisponível');

  const ownerId = params.ownerId || 'default';
  const id = params.id || `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const res = await pool.query(
    `INSERT INTO quiz_games (id, owner_id, title, description, questions, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       questions = EXCLUDED.questions,
       updated_at = NOW()
     RETURNING *`,
    [id, ownerId, params.title.trim(), (params.description || '').trim(), JSON.stringify(params.questions)]
  );
  return mapGameRow(res.rows[0]);
}

export async function deleteQuiz(id: string): Promise<void> {
  const pool = await ensureQuizTables();
  if (!pool) return;
  await pool.query(`DELETE FROM quiz_games WHERE id = $1`, [id]);
}

export async function createLiveSession(
  gameId: string,
  ownerId = 'default',
  options?: { questionLimit?: number; timeLimitOverrideSec?: number | null }
): Promise<QuizSession> {
  const pool = await ensureQuizTables();
  if (!pool) throw new Error('Banco de dados indisponível');

  const gameRes = await pool.query(`SELECT * FROM quiz_games WHERE id = $1`, [gameId]);
  if (gameRes.rows.length === 0) throw new Error('Quiz não encontrado');
  const game = mapGameRow(gameRes.rows[0]);
  if (!game.questions || game.questions.length === 0) {
    throw new Error('Adicione pelo menos 1 pergunta ao quiz antes de iniciar.');
  }

  let sessionQuestions = [...game.questions];
  if (options?.questionLimit && options.questionLimit > 0 && options.questionLimit < sessionQuestions.length) {
    sessionQuestions = sessionQuestions.slice(0, options.questionLimit);
  }
  if (options?.timeLimitOverrideSec !== undefined && options.timeLimitOverrideSec !== null) {
    sessionQuestions = sessionQuestions.map(q => ({
      ...q,
      timeLimitSec: Number(options.timeLimitOverrideSec),
    }));
  }

  let pin = String(Math.floor(100000 + Math.random() * 900000));
  for (let i = 0; i < 5; i++) {
    const exists = await pool.query(`SELECT pin FROM quiz_sessions WHERE pin = $1`, [pin]);
    if (exists.rows.length === 0) break;
    pin = String(Math.floor(100000 + Math.random() * 900000));
  }

  const res = await pool.query(
    `INSERT INTO quiz_sessions (pin, game_id, owner_id, title, status, current_question_index, questions, players)
     VALUES ($1, $2, $3, $4, 'lobby', 0, $5::jsonb, '[]'::jsonb)
     RETURNING *`,
    [pin, game.id, ownerId, game.title, JSON.stringify(sessionQuestions)]
  );
  return mapSessionRow(res.rows[0]);
}

export async function getLiveSession(pin: string): Promise<QuizSession | null> {
  const pool = await ensureQuizTables();
  if (!pool) return null;
  const cleanPin = String(pin || '').replace(/\D/g, '');
  if (!cleanPin) return null;
  const res = await pool.query(`SELECT * FROM quiz_sessions WHERE pin = $1`, [cleanPin]);
  if (res.rows.length === 0) return null;
  return mapSessionRow(res.rows[0]);
}

export async function joinLiveSession(params: {
  pin: string;
  nickname: string;
  avatar?: string;
  playerId?: string;
}): Promise<{ session: QuizSession; player: QuizPlayer }> {
  const pool = await ensureQuizTables();
  if (!pool) throw new Error('Banco de dados indisponível');

  const cleanPin = String(params.pin || '').replace(/\D/g, '');
  const session = await getLiveSession(cleanPin);
  if (!session) throw new Error('Sala não encontrada. Confira o PIN digitado.');
  if (session.status === 'finished') throw new Error('Esta partida já foi encerrada.');

  const nick = params.nickname.trim().slice(0, 24);
  if (!nick) throw new Error('Informe seu apelido para entrar.');

  const players = [...session.players];
  let player = params.playerId
    ? players.find(p => p.id === params.playerId)
    : players.find(p => p.nickname.toLowerCase() === nick.toLowerCase());

  if (!player) {
    player = {
      id: params.playerId || `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      nickname: nick,
      avatar: params.avatar || '🚀',
      score: 0,
      streak: 0,
      lastCorrect: null,
      lastPoints: 0,
      answers: {},
    };
    players.push(player);
  } else {
    player.nickname = nick;
    if (params.avatar) player.avatar = params.avatar;
  }

  const res = await pool.query(
    `UPDATE quiz_sessions SET players = $1::jsonb, updated_at = NOW() WHERE pin = $2 RETURNING *`,
    [JSON.stringify(players), cleanPin]
  );
  const updated = mapSessionRow(res.rows[0]);
  emitQuizUpdate(cleanPin, 'player_joined');
  return { session: updated, player };
}

export async function advanceLiveSession(
  pin: string,
  action: 'start' | 'reveal' | 'leaderboard' | 'next' | 'finish' | 'restart'
): Promise<QuizSession> {
  const pool = await ensureQuizTables();
  if (!pool) throw new Error('Banco de dados indisponível');

  const session = await getLiveSession(pin);
  if (!session) throw new Error('Sessão não encontrada.');

  let nextStatus: QuizSessionStatus = session.status;
  let nextIdx = session.current_question_index;
  let startedAt = session.question_started_at;
  let players = [...session.players];

  if (action === 'start') {
    nextStatus = 'question';
    nextIdx = 0;
    startedAt = new Date().toISOString();
    players = players.map(p => ({ ...p, lastCorrect: null, lastPoints: 0 }));
  } else if (action === 'reveal') {
    nextStatus = 'reveal';
    const currentQ = session.questions[session.current_question_index];
    if (currentQ) {
      players = players.map(p => {
        if (!p.answers[currentQ.id]) {
          return { ...p, streak: 0, lastCorrect: false, lastPoints: 0 };
        }
        return p;
      });
    }
  } else if (action === 'leaderboard') {
    nextStatus = 'leaderboard';
  } else if (action === 'next') {
    if (session.current_question_index + 1 >= session.questions.length) {
      nextStatus = 'finished';
    } else {
      nextIdx = session.current_question_index + 1;
      nextStatus = 'question';
      startedAt = new Date().toISOString();
      players = players.map(p => ({ ...p, lastCorrect: null, lastPoints: 0 }));
    }
  } else if (action === 'finish') {
    nextStatus = 'finished';
  } else if (action === 'restart') {
    nextStatus = 'lobby';
    nextIdx = 0;
    startedAt = null;
    players = players.map(p => ({
      ...p,
      score: 0,
      streak: 0,
      lastCorrect: null,
      lastPoints: 0,
      answers: {},
    }));
  }

  const res = await pool.query(
    `UPDATE quiz_sessions
     SET status = $1, current_question_index = $2, question_started_at = $3, players = $4::jsonb, updated_at = NOW()
     WHERE pin = $5
     RETURNING *`,
    [nextStatus, nextIdx, startedAt, JSON.stringify(players), session.pin]
  );

  const updated = mapSessionRow(res.rows[0]);
  emitQuizUpdate(session.pin, action);
  return updated;
}

export async function submitPlayerAnswer(params: {
  pin: string;
  playerId: string;
  optionIndex: number;
}): Promise<{ session: QuizSession; correct: boolean; points: number }> {
  const pool = await ensureQuizTables();
  if (!pool) throw new Error('Banco de dados indisponível');

  const session = await getLiveSession(params.pin);
  if (!session) throw new Error('Sala não encontrada.');
  if (session.status !== 'question') {
    throw new Error('O tempo para responder esta pergunta já encerrou.');
  }

  const q = session.questions[session.current_question_index];
  if (!q) throw new Error('Pergunta não encontrada.');

  const players = [...session.players];
  const idx = players.findIndex(p => p.id === params.playerId);
  if (idx === -1) throw new Error('Jogador não encontrado na sala.');

  const player = { ...players[idx], answers: { ...players[idx].answers } };
  if (player.answers[q.id]) {
    return {
      session,
      correct: player.answers[q.id].correct,
      points: player.answers[q.id].points,
    };
  }

  const startedMs = session.question_started_at ? new Date(session.question_started_at).getTime() : Date.now();
  const timeMs = Math.max(200, Date.now() - startedMs);
  const hasLimit = Number(q.timeLimitSec) > 0;
  const limitMs = hasLimit ? Math.max(5000, Number(q.timeLimitSec) * 1000) : 60000;
  const ratioLeft = hasLimit ? Math.max(0, 1 - timeMs / limitMs) : Math.max(0.2, 1 - timeMs / 60000);

  const correct = Number(params.optionIndex) === Number(q.correctIndex);
  const basePoints = q.points || 1000;
  let earned = 0;

  if (correct) {
    const speedPoints = Math.round(basePoints * (0.5 + 0.5 * ratioLeft));
    const streakBonus = Math.min(player.streak, 4) * 100;
    earned = speedPoints + streakBonus;
    player.score += earned;
    player.streak += 1;
    player.lastCorrect = true;
    player.lastPoints = earned;
  } else {
    player.streak = 0;
    player.lastCorrect = false;
    player.lastPoints = 0;
  }

  player.answers[q.id] = {
    optionIndex: Number(params.optionIndex),
    timeMs,
    correct,
    points: earned,
  };

  players[idx] = player;

  // Se todos os jogadores já responderam, avança automaticamente para 'reveal'
  const allAnswered = players.length > 0 && players.every(p => Boolean(p.answers[q.id]));
  const nextStatus: QuizSessionStatus = allAnswered ? 'reveal' : 'question';

  const res = await pool.query(
    `UPDATE quiz_sessions SET players = $1::jsonb, status = $2, updated_at = NOW() WHERE pin = $3 RETURNING *`,
    [JSON.stringify(players), nextStatus, session.pin]
  );

  const updated = mapSessionRow(res.rows[0]);
  emitQuizUpdate(session.pin, allAnswered ? 'reveal' : 'answer');
  return { session: updated, correct, points: earned };
}

export async function generateQuizQuestionsWithAI(topic: string, count = 5): Promise<QuizQuestion[]> {
  const safeCount = Math.min(10, Math.max(2, Number(count) || 5));
  const prompt = `Crie exatamente ${safeCount} perguntas estilo Kahoot em português do Brasil sobre o tema: "${topic}".
Retorne APENAS um JSON válido (sem markdown \`\`\`json) com este formato exato:
{
  "perguntas": [
    {
      "prompt": "Texto claro da pergunta (máximo 140 caracteres)",
      "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
      "correctIndex": 0,
      "timeLimitSec": 20
    }
  ]
}
Regras:
- Cada pergunta deve ter exatamente 4 opções curtas e objetivas.
- correctIndex deve ser 0, 1, 2 ou 3.
- Varie a posição de correctIndex entre as perguntas.`;

  const ai = await generateText({
    prompt,
    jsonMode: true,
    maxTokens: 2048,
    temperature: 0.7,
    timeoutMs: 20000,
  });

  if (!ai.text) {
    throw new Error(`Falha ao consultar a IA para gerar perguntas. ${ai.error || ''}`.trim());
  }

  const json = JSON.parse(ai.text);
  const parsed = Array.isArray(json) ? json : json?.perguntas || json?.questions;
  if (!Array.isArray(parsed)) throw new Error('Resposta inválida da IA.');

  return parsed.slice(0, safeCount).map((q: any, i: number) => ({
    id: `q_ai_${Date.now()}_${i}`,
    prompt: String(q.prompt || `Pergunta ${i + 1}`).slice(0, 220),
    options: [
      String(q.options?.[0] || 'Opção 1'),
      String(q.options?.[1] || 'Opção 2'),
      String(q.options?.[2] || 'Opção 3'),
      String(q.options?.[3] || 'Opção 4'),
    ],
    correctIndex: ([0, 1, 2, 3].includes(Number(q.correctIndex)) ? Number(q.correctIndex) : 0) as 0 | 1 | 2 | 3,
    timeLimitSec: Number(q.timeLimitSec) || 20,
    points: 1000,
  }));
}
