import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { requireAuth } from '@/lib/api-auth';
import {
  listQuizzes,
  saveQuiz,
  deleteQuiz,
  createLiveSession,
  getLiveSession,
  advanceLiveSession,
  generateQuizQuestionsWithAI,
} from '@/lib/quiz-game';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const pin = searchParams.get('pin');

    if (pin) {
      const session = await getLiveSession(pin);
      if (!session) {
        return NextResponse.json({ success: false, error: 'Sala não encontrada' }, { status: 404 });
      }
      return NextResponse.json({ success: true, session });
    }

    const ownerId = auth.session.role === 'administrador' ? 'default' : auth.session.userId;
    const quizzes = await listQuizzes(ownerId);
    return NextResponse.json({ success: true, quizzes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const ownerId = auth.session.role === 'administrador' ? 'default' : auth.session.userId;

    if (body.action === 'save_quiz') {
      if (!body.title || !Array.isArray(body.questions) || body.questions.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Informe título e pelo menos 1 pergunta.' },
          { status: 400 }
        );
      }
      const quiz = await saveQuiz({
        id: body.id,
        ownerId,
        title: body.title,
        description: body.description,
        questions: body.questions,
      });
      return NextResponse.json({ success: true, quiz });
    }

    if (body.action === 'delete_quiz') {
      await deleteQuiz(body.id);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'generate_ai') {
      const questions = await generateQuizQuestionsWithAI(body.topic || 'Gestão Empresarial', body.count || 5);
      return NextResponse.json({ success: true, questions });
    }

    if (body.action === 'create_session') {
      const session = await createLiveSession(body.gameId, ownerId, {
        questionLimit: body.questionLimit ? Number(body.questionLimit) : undefined,
        timeLimitOverrideSec:
          body.timeLimitOverrideSec !== undefined && body.timeLimitOverrideSec !== null
            ? Number(body.timeLimitOverrideSec)
            : undefined,
      });
      const origin = req.headers.get('origin') || new URL(req.url).origin;
      const joinUrl = `${origin}/quiz?pin=${session.pin}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#3b0000', light: '#ffffff' },
      });
      return NextResponse.json({ success: true, session, joinUrl, qrDataUrl });
    }

    if (body.action === 'advance_session') {
      const session = await advanceLiveSession(body.pin, body.step);
      return NextResponse.json({ success: true, session });
    }

    return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
