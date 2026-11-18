import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppConfig } from '@/lib/whatsapp-service';
import { resolveWhatsAppOwnerId } from '@/lib/whatsapp-owner';
import { getEmailDbPool } from '@/lib/email-db';

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
      preferredProvider,
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
      preferredProvider?: 'gemini' | 'claude' | 'ollama' | 'auto';
    };

    const ownerId = resolveWhatsAppOwnerId(req);
    const ownerCfg = await getWhatsAppConfig(ownerId).catch(() => null);
    const defaultCfg = ownerId !== 'default' ? await getWhatsAppConfig('default').catch(() => null) : null;

    let claudeKey = (
      ownerCfg?.claude_api_key ||
      defaultCfg?.claude_api_key ||
      (ownerCfg?.api_key?.startsWith('sk-ant-') ? ownerCfg.api_key : '') ||
      (defaultCfg?.api_key?.startsWith('sk-ant-') ? defaultCfg.api_key : '') ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.CLAUDE_API_KEY ||
      ''
    ).trim();

    let geminiKey = (
      ownerCfg?.gemini_api_key ||
      defaultCfg?.gemini_api_key ||
      (ownerCfg?.api_key?.startsWith('AIza') ? ownerCfg.api_key : '') ||
      (defaultCfg?.api_key?.startsWith('AIza') ? defaultCfg.api_key : '') ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      ''
    ).trim();

    if (!claudeKey && !geminiKey) {
      try {
        const pool = getEmailDbPool();
        if (pool) {
          const r = await pool.query(
            `SELECT gemini_api_key, claude_api_key, api_key FROM whatsapp_config
             WHERE COALESCE(gemini_api_key, '') <> '' OR COALESCE(claude_api_key, '') <> '' OR COALESCE(api_key, '') <> ''
             LIMIT 1`
          );
          const row = r.rows?.[0];
          if (row) {
            if (!geminiKey) {
              geminiKey = String(row.gemini_api_key || (String(row.api_key || '').startsWith('AIza') ? row.api_key : '')).trim();
            }
            if (!claudeKey) {
              claudeKey = String(row.claude_api_key || (String(row.api_key || '').startsWith('sk-ant-') ? row.api_key : '')).trim();
            }
          }
        }
      } catch {}
    }

    const rawMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (Array.isArray(messages) && messages.length > 0) {
      for (const m of messages) {
        const text =
          typeof m.content === 'string'
            ? m.content
            : Array.isArray(m.parts)
            ? m.parts.map((p) => p?.text || '').join('\n')
            : '';
        if (!text.trim()) continue;
        rawMessages.push({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: text,
        });
      }
    } else if (prompt) {
      rawMessages.push({ role: 'user', content: prompt });
    }

    if (rawMessages.length === 0) {
      return NextResponse.json({ success: false, error: 'Prompt ou messages obrigatório' }, { status: 400 });
    }

    // Garante que a primeira mensagem seja 'user' e mescla mensagens consecutivas do mesmo papel
    while (rawMessages.length > 0 && rawMessages[0].role !== 'user') {
      rawMessages.shift();
    }
    const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const msg of rawMessages) {
      const last = anthropicMessages[anthropicMessages.length - 1];
      if (last && last.role === msg.role) {
        last.content = `${last.content}\n\n${msg.content}`;
      } else {
        anthropicMessages.push({ ...msg });
      }
    }

    const sysText = jsonMode
      ? `${systemInstruction ? systemInstruction + '\n\n' : ''}Responda ESTRITAMENTE com JSON válido, sem markdown, sem cercas \`\`\`json e sem texto fora do JSON.`
      : systemInstruction || undefined;

    const preferred =
      preferredProvider === 'gemini' || preferredProvider === 'claude' || preferredProvider === 'ollama'
        ? preferredProvider
        : ownerCfg?.ai_provider || defaultCfg?.ai_provider || (geminiKey ? 'gemini' : claudeKey ? 'claude' : 'ollama');

    let lastClaudeError = '';
    let lastGeminiError = '';
    let lastOllamaError = '';
    const ollamaUrl = (
      ownerCfg?.ollama_base_url ||
      defaultCfg?.ollama_base_url ||
      process.env.OLLAMA_BASE_URL ||
      ''
    )
      .trim()
      .replace(/\/+$/, '');
    const ollamaModel = (
      ownerCfg?.ollama_model ||
      defaultCfg?.ollama_model ||
      process.env.OLLAMA_MODEL ||
      'gemma4:latest'
    ).trim();

    async function callOllama(): Promise<{ text: string; model: string } | null> {
      const defaultFallbackUrl =
        process.env.NODE_ENV === 'production'
          ? 'http://ollama.railway.internal:11434'
          : 'http://127.0.0.1:11434';
      const targetUrl = ollamaUrl || (preferred === 'ollama' ? defaultFallbackUrl : '');
      if (!targetUrl) return null;
      try {
        const res = await fetch(`${targetUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            stream: false,
            ...(jsonMode ? { format: 'json' } : {}),
            messages: [
              ...(sysText ? [{ role: 'system', content: sysText }] : []),
              ...anthropicMessages.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content,
              })),
            ],
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (res.ok) {
          const data = await res.json();
          const rawText = data?.message?.content || '';
          const text = jsonMode ? stripJsonFences(rawText) : rawText;
          if (text) return { text, model: ollamaModel };
        } else {
          lastOllamaError = `${ollamaModel} (${res.status})`;
        }
      } catch (err: any) {
        lastOllamaError = err?.message || 'Ollama inacessível';
      }
      return null;
    }

    async function callClaude(): Promise<{ text: string; model: string } | null> {
      if (!claudeKey) return null;
      const configuredClaude = ownerCfg?.ai_model?.startsWith('claude-')
        ? ownerCfg.ai_model
        : defaultCfg?.ai_model?.startsWith('claude-')
        ? defaultCfg.ai_model
        : '';
      const modelsToTry = Array.from(
        new Set([configuredClaude, 'claude-sonnet-4-20250514', 'claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'].filter(Boolean))
      );

      for (const model of modelsToTry) {
        try {
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
            signal: AbortSignal.timeout(60000),
          });

          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            const rawText = data.content?.[0]?.text || '';
            const text = jsonMode ? stripJsonFences(rawText) : rawText;
            if (text) return { text, model };
          } else {
            lastClaudeError = `${model} (${res.status}): ${data?.error?.message || 'erro'}`;
            console.warn('[Claude API] Erro:', lastClaudeError);
          }
        } catch (err: any) {
          lastClaudeError = err?.message || 'timeout/rede';
          console.warn('[Claude API] Exceção:', err);
        }
      }
      return null;
    }

    async function callGemini(): Promise<{ text: string; model: string } | null> {
      if (!geminiKey) return null;
      const configuredGemini = ownerCfg?.ai_model?.startsWith('gemini-')
        ? ownerCfg.ai_model
        : defaultCfg?.ai_model?.startsWith('gemini-')
        ? defaultCfg.ai_model
        : '';
      const modelsToTry = Array.from(
        new Set([configuredGemini, 'gemini-2.5-flash', 'gemini-2.0-flash'].filter(Boolean))
      );

      const contents = anthropicMessages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      for (const model of modelsToTry) {
        try {
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
              signal: AbortSignal.timeout(60000),
            }
          );
          if (gemRes.ok) {
            const gemData = await gemRes.json();
            const rawText = gemData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const text = jsonMode ? stripJsonFences(rawText) : rawText;
            if (text) return { text, model };
          } else {
            const errJson = await gemRes.json().catch(() => ({}));
            lastGeminiError = `${model} (${gemRes.status}): ${errJson?.error?.message || 'erro'}`;
            console.warn('[Gemini API] Erro:', lastGeminiError);
          }
        } catch (err: any) {
          lastGeminiError = err?.message || 'timeout/rede';
          console.warn('[Gemini API] Exceção:', err);
        }
      }
      return null;
    }

    if (preferred === 'ollama') {
      const ol = await callOllama();
      if (ol) return NextResponse.json({ success: true, text: ol.text, provider: 'ollama', model: ol.model });
      const gem = await callGemini();
      if (gem) return NextResponse.json({ success: true, text: gem.text, provider: 'gemini', model: gem.model });
      const claude = await callClaude();
      if (claude) return NextResponse.json({ success: true, text: claude.text, provider: 'claude', model: claude.model });
    } else if (preferred === 'gemini') {
      const gem = await callGemini();
      if (gem) return NextResponse.json({ success: true, text: gem.text, provider: 'gemini', model: gem.model });
      const claude = await callClaude();
      if (claude) return NextResponse.json({ success: true, text: claude.text, provider: 'claude', model: claude.model });
      const ol = await callOllama();
      if (ol) return NextResponse.json({ success: true, text: ol.text, provider: 'ollama', model: ol.model });
    } else {
      const claude = await callClaude();
      if (claude) return NextResponse.json({ success: true, text: claude.text, provider: 'claude', model: claude.model });
      const gem = await callGemini();
      if (gem) return NextResponse.json({ success: true, text: gem.text, provider: 'gemini', model: gem.model });
      const ol = await callOllama();
      if (ol) return NextResponse.json({ success: true, text: ol.text, provider: 'ollama', model: ol.model });
    }

    const details = [
      !geminiKey && !claudeKey && !ollamaUrl ? 'Nenhuma chave GEMINI_API_KEY, ANTHROPIC_API_KEY ou OLLAMA_BASE_URL configurada.' : '',
      lastGeminiError ? `Gemini: ${lastGeminiError}` : '',
      lastClaudeError ? `Claude: ${lastClaudeError}` : '',
      lastOllamaError ? `Ollama: ${lastOllamaError}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    return NextResponse.json(
      {
        success: false,
        error: details || 'Nenhuma API de IA (Claude ou Gemini) configurada ou disponível no momento.',
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
