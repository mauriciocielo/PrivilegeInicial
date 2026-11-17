import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppConfig } from '@/lib/whatsapp-service';
import { resolveWhatsAppOwnerId } from '@/lib/whatsapp-owner';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// Modelo padrão. Os modelos Claude 3.x foram aposentados: um ai_model antigo salvo na
// configuração do WhatsApp é ignorado para não derrubar as telas de IA.
const MODELO_PADRAO = 'claude-opus-5-5';
const modeloValido = (m?: string | null) => !!m && m.startsWith('claude-') && !m.startsWith('claude-3');

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

export async function POST(req: NextRequest) {
  // Só as telas logadas usam esta rota; sem isso, qualquer pessoa gastaria a chave da API.
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
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

    if (claudeKey) {
      const model = modeloValido(ownerCfg?.ai_model)
        ? ownerCfg!.ai_model
        : modeloValido(defaultCfg?.ai_model)
        ? defaultCfg!.ai_model
        : MODELO_PADRAO;

      // Modelos atuais: sem temperature (recusado com 400) e com raciocínio sempre ligado,
      // por isso o esforço fica em "low" (respostas curtas de tela) e o max_tokens tem piso.
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'server-side-fallback-2026-07-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: Math.max(Number(maxTokens) || 0, 4000),
          output_config: { effort: 'low' },
          // Se o modelo recusar por política, a própria API refaz o pedido em outro modelo.
          fallbacks: 'default',
          ...(sysText ? { system: sysText } : {}),
          messages: anthropicMessages,
        }),
        signal: AbortSignal.timeout(25000),
      });

      const data = await res.json();
      if (res.ok && data.stop_reason !== 'refusal') {
        // A resposta pode trazer blocos de raciocínio (thinking) e de fallback antes do texto.
        const rawText = (Array.isArray(data.content) ? data.content : [])
          .filter((b: { type?: string }) => b?.type === 'text')
          .map((b: { text?: string }) => b.text || '')
          .join('');
        if (rawText.trim()) {
          const text = jsonMode ? stripJsonFences(rawText) : rawText;
          return NextResponse.json({ success: true, text, provider: 'claude', model: data.model || model });
        }
      }
      console.warn('[Claude API] Erro:', data?.error?.message || data?.stop_reason || res.status);
    }

    // Fallback seguro caso a chave Claude ainda não esteja configurada
    const geminiKey =
      ownerCfg?.gemini_api_key ||
      defaultCfg?.gemini_api_key ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      '';

    if (geminiKey) {
      const contents = anthropicMessages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
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
        return NextResponse.json({ success: true, text, provider: 'gemini-fallback' });
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Chave da API Claude (Anthropic) não configurada ou indisponível.',
      },
      { status: 503 }
    );
  } catch (error: any) {
    console.error('[Claude API] Falha:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao consultar Claude' },
      { status: 500 }
    );
  }
}
