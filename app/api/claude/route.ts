import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppConfig } from '@/lib/whatsapp-service';
import { resolveWhatsAppOwnerId } from '@/lib/whatsapp-owner';

export const dynamic = 'force-dynamic';

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      messages,
      systemInstruction,
      maxTokens = 1600,
      temperature = 0.4,
      jsonMode = false,
    } = body as {
      prompt?: string;
      messages?: Array<{
        role: string;
        content?: string;
        parts?: Array<{ text?: string }>;
      }>;
      systemInstruction?: string;
      maxTokens?: number;
      temperature?: number;
      jsonMode?: boolean;
    };

    const ownerId = resolveWhatsAppOwnerId(req);
    const ownerCfg = await getWhatsAppConfig(ownerId).catch(() => null);
    const defaultCfg = ownerId !== 'default' ? await getWhatsAppConfig('default').catch(() => null) : null;

    const claudeKey =
      ownerCfg?.claude_api_key ||
      defaultCfg?.claude_api_key ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.CLAUDE_API_KEY ||
      '';

    const geminiKey =
      ownerCfg?.gemini_api_key ||
      defaultCfg?.gemini_api_key ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      '';

    const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (Array.isArray(messages) && messages.length > 0) {
      for (const m of messages) {
        const text =
          typeof m.content === 'string'
            ? m.content
            : Array.isArray(m.parts)
            ? m.parts.map((p) => p?.text || '').join('\n')
            : '';
        if (!text.trim()) continue;
        anthropicMessages.push({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: text,
        });
      }
    } else if (prompt) {
      anthropicMessages.push({ role: 'user', content: prompt });
    }

    if (anthropicMessages.length === 0) {
      return NextResponse.json({ success: false, error: 'Prompt ou messages obrigatório' }, { status: 400 });
    }

    // Garante que a primeira mensagem seja 'user' (requisito da API Anthropic)
    while (anthropicMessages.length > 0 && anthropicMessages[0].role !== 'user') {
      anthropicMessages.shift();
    }

    const sysText = jsonMode
      ? `${systemInstruction ? systemInstruction + '\n\n' : ''}Responda ESTRITAMENTE com JSON válido, sem markdown, sem cercas \`\`\`json e sem texto fora do JSON.`
      : systemInstruction || undefined;

    const preferred = ownerCfg?.ai_provider || defaultCfg?.ai_provider || 'claude';

    async function callClaude(): Promise<{ text: string; model: string } | null> {
      if (!claudeKey) return null;
      try {
        const model =
          ownerCfg?.ai_model?.startsWith('claude-')
            ? ownerCfg.ai_model
            : defaultCfg?.ai_model?.startsWith('claude-')
            ? defaultCfg.ai_model
            : 'claude-3-5-sonnet-latest';

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            ...(sysText ? { system: sysText } : {}),
            messages: anthropicMessages,
          }),
          signal: AbortSignal.timeout(25000),
        });

        const data = await res.json();
        if (res.ok) {
          const rawText = data.content?.[0]?.text || '';
          const text = jsonMode ? stripJsonFences(rawText) : rawText;
          if (text) return { text, model };
        } else {
          console.warn('[Claude API] Erro:', data?.error?.message || res.status);
        }
      } catch (err) {
        console.warn('[Claude API] Exceção:', err);
      }
      return null;
    }

    async function callGemini(): Promise<{ text: string; model: string } | null> {
      if (!geminiKey) return null;
      try {
        const model =
          ownerCfg?.ai_model?.startsWith('gemini-')
            ? ownerCfg.ai_model
            : defaultCfg?.ai_model?.startsWith('gemini-')
            ? defaultCfg.ai_model
            : 'gemini-2.5-flash';

        const contents = anthropicMessages.map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));
        const gemRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              ...(sysText ? { systemInstruction: { parts: [{ text: sysText }] } } : {}),
              ...(jsonMode ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
            }),
            signal: AbortSignal.timeout(25000),
          }
        );
        if (gemRes.ok) {
          const gemData = await gemRes.json();
          const rawText = gemData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const text = jsonMode ? stripJsonFences(rawText) : rawText;
          if (text) return { text, model };
        }
      } catch (err) {
        console.warn('[Gemini API] Exceção:', err);
      }
      return null;
    }

    if (preferred === 'gemini') {
      const gem = await callGemini();
      if (gem) return NextResponse.json({ success: true, text: gem.text, provider: 'gemini', model: gem.model });
      const claude = await callClaude();
      if (claude) return NextResponse.json({ success: true, text: claude.text, provider: 'claude', model: claude.model });
    } else {
      const claude = await callClaude();
      if (claude) return NextResponse.json({ success: true, text: claude.text, provider: 'claude', model: claude.model });
      const gem = await callGemini();
      if (gem) return NextResponse.json({ success: true, text: gem.text, provider: 'gemini', model: gem.model });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Nenhuma API de IA (Claude ou Gemini) configurada ou disponível no momento.',
      },
      { status: 503 }
    );
  } catch (error: any) {
    console.error('[AI Route] Falha:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao consultar IA' },
      { status: 500 }
    );
  }
}
