import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppConfig } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [], pageTitle = '', pageUrl = '', pageContext = '', provider = 'auto' } = body;

    if (!message || !String(message).trim()) {
      return NextResponse.json({ success: false, error: 'Mensagem obrigatória' }, { status: 400, headers: CORS_HEADERS });
    }

    const cfg = await getWhatsAppConfig('default').catch(() => null);
    const geminiKey = cfg?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    const claudeKey = cfg?.claude_api_key || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';

    const systemInstruction = `Você é o "Privilege AI Assistant", assistente inteligente incorporado ao site e plataforma da Privilege Contabilidade e Consultoria 360º (Francisco Beltrão - PR e atendimento online em todo o Brasil).
Atuamos nos 6 pilares: Planejamento Estratégico 2027, Contábil/Tributário, Financeiro/BPO, Comercial, Marketing e Gestão de Pessoas/Treinamentos.
${pageTitle || pageUrl ? `Página atual do usuário: ${pageTitle} (${pageUrl})` : ''}
${pageContext ? `Conteúdo visível na página:\n${String(pageContext).slice(0, 2500)}` : ''}

Responda de forma executiva, clara, objetiva e consultiva em português do Brasil (Markdown curto).`;

    const contents = [
      ...history.slice(-8).map((h: any) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(h.text || h.content || '') }],
      })),
      { role: 'user', parts: [{ text: String(message) }] },
    ];

    if ((provider === 'gemini' || provider === 'auto') && geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
          }),
          signal: AbortSignal.timeout(20000),
        }
      );
      if (res.ok) {
        const d = await res.json();
        const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return NextResponse.json({ success: true, reply: text, provider: 'gemini' }, { headers: CORS_HEADERS });
        }
      }
    }

    if (claudeKey) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 1200,
          system: systemInstruction,
          messages: [
            ...history.slice(-8).map((h: any) => ({
              role: h.role === 'user' ? 'user' : 'assistant',
              content: String(h.text || h.content || ''),
            })),
            { role: 'user', content: String(message) },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const d = await res.json();
        const text = d?.content?.[0]?.text;
        if (text) {
          return NextResponse.json({ success: true, reply: text, provider: 'claude' }, { headers: CORS_HEADERS });
        }
      }
    }

    return NextResponse.json(
      { success: false, error: 'Nenhum provedor de IA disponível no momento.' },
      { status: 503, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erro interno' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
