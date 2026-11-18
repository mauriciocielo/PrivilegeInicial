import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppConfig } from '@/lib/whatsapp-service';
import { resolveWhatsAppOwnerId } from '@/lib/whatsapp-owner';
import { getEmailDbPool } from '@/lib/email-db';
import { generateText, type AiConfigSource } from '@/lib/ai-provider';

export const dynamic = 'force-dynamic';

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
      preferredProvider?: 'groq' | 'gemini' | 'claude' | 'ollama' | 'auto';
    };

    const ownerId = resolveWhatsAppOwnerId(req);
    const ownerCfg = await getWhatsAppConfig(ownerId).catch(() => null);
    const defaultCfg = ownerId !== 'default' ? await getWhatsAppConfig('default').catch(() => null) : null;
    const configs: Array<AiConfigSource | null> = [ownerCfg, defaultCfg];

    // Contingência: se nenhuma configuração tiver chave de nuvem, procura em qualquer linha do banco.
    const hasCloudKey = configs.some(c => c?.gemini_api_key || c?.claude_api_key || c?.api_key);
    if (!hasCloudKey) {
      try {
        const pool = getEmailDbPool();
        if (pool) {
          const r = await pool.query(
            `SELECT gemini_api_key, claude_api_key, api_key FROM whatsapp_config
             WHERE COALESCE(gemini_api_key, '') <> '' OR COALESCE(claude_api_key, '') <> '' OR COALESCE(api_key, '') <> ''
             LIMIT 1`
          );
          if (r.rows?.[0]) configs.push(r.rows[0]);
        }
      } catch {}
    }

    const chat: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (Array.isArray(messages) && messages.length > 0) {
      for (const m of messages) {
        const text =
          typeof m.content === 'string'
            ? m.content
            : Array.isArray(m.parts)
            ? m.parts.map(p => p?.text || '').join('\n')
            : '';
        if (!text.trim()) continue;
        chat.push({ role: m.role === 'user' ? 'user' : 'assistant', content: text });
      }
    } else if (prompt) {
      chat.push({ role: 'user', content: prompt });
    }

    if (chat.length === 0) {
      return NextResponse.json({ success: false, error: 'Prompt ou messages obrigatório' }, { status: 400 });
    }

    const result = await generateText({
      messages: chat,
      system: systemInstruction,
      jsonMode,
      maxTokens,
      temperature,
      preferred: preferredProvider,
      configs,
    });

    if (result.text) {
      return NextResponse.json({ success: true, text: result.text, provider: result.provider, model: result.model });
    }

    return NextResponse.json({ success: false, error: result.error }, { status: 503 });
  } catch (error: any) {
    console.error('[AI Route] Falha:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao consultar IA' },
      { status: 500 }
    );
  }
}
