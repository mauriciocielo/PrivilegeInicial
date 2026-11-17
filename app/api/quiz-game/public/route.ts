import { NextRequest, NextResponse } from 'next/server';
import { getLiveSession, joinLiveSession, submitPlayerAnswer, QuizSession } from '@/lib/quiz-game';

export const dynamic = 'force-dynamic';

function sanitizeSessionForPlayer(session: QuizSession) {
  const hideCorrect = session.status === 'question' || session.status === 'lobby';
  return {
    pin: session.pin,
    title: session.title,
    status: session.status,
    current_question_index: session.current_question_index,
    question_started_at: session.question_started_at,
    total_questions: session.questions.length,
    questions: session.questions.map((q, idx) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      timeLimitSec: q.timeLimitSec,
      correctIndex:
        hideCorrect && idx >= session.current_question_index ? undefined : q.correctIndex,
    })),
    players: session.players
      .map(p => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        score: p.score,
        streak: p.streak,
        lastCorrect: p.lastCorrect,
        lastPoints: p.lastPoints,
        answeredCurrent: session.questions[session.current_question_index]
          ? Boolean(p.answers?.[session.questions[session.current_question_index].id])
          : false,
      }))
      .sort((a, b) => b.score - a.score),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pin = searchParams.get('pin');
    if (!pin) {
      return NextResponse.json({ success: false, error: 'PIN obrigatório' }, { status: 400 });
    }

    const session = await getLiveSession(pin);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Sala não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, session: sanitizeSessionForPlayer(session) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === 'join') {
      const { session, player } = await joinLiveSession({
        pin: body.pin,
        nickname: body.nickname,
        avatar: body.avatar,
        playerId: body.playerId,
      });
      return NextResponse.json({
        success: true,
        player,
        session: sanitizeSessionForPlayer(session),
      });
    }

    if (body.action === 'answer') {
      const result = await submitPlayerAnswer({
        pin: body.pin,
        playerId: body.playerId,
        optionIndex: Number(body.optionIndex),
      });
      return NextResponse.json({
        success: true,
        correct: result.correct,
        points: result.points,
        session: sanitizeSessionForPlayer(result.session),
      });
    }

    return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
