import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';

const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
]);

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      '';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave GEMINI_API_KEY não configurada no servidor.' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawModel = typeof body?.model === 'string' && body.model.trim() ? body.model.trim() : 'gemini-2.5-flash';
    const model = ALLOWED_MODELS.has(rawModel) ? rawModel : 'gemini-2.5-flash';

    const payload: Record<string, unknown> = body?.contents
      ? { contents: body.contents }
      : { contents: [{ parts: [{ text: String(body?.prompt || '') }] }] };

    if (body?.generationConfig && typeof body.generationConfig === 'object') {
      payload.generationConfig = body.generationConfig;
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Erro ao consultar IA no servidor.', details: data },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Erro em POST /api/ai/gemini:', error);
    return NextResponse.json({ error: 'Falha interna ao consultar IA.' }, { status: 500 });
  }
}
