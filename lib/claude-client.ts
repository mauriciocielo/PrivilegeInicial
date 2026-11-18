'use client';

export interface AskClaudeParams {
  prompt?: string;
  messages?: Array<{
    role: 'user' | 'assistant' | 'model';
    content?: string;
    parts?: Array<{ text?: string }>;
  }>;
  systemInstruction?: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  preferredProvider?: 'groq' | 'gemini' | 'claude' | 'ollama' | 'auto';
}

export async function askClaudeDetailed(
  params: AskClaudeParams
): Promise<{ text: string | null; error?: string }> {
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success || !data?.text) {
      return {
        text: null,
        error: data?.error || `Erro HTTP ${res.status} ao consultar a IA.`,
      };
    }
    return { text: String(data.text) };
  } catch (err: any) {
    return { text: null, error: err?.message || 'Falha de conexão com a IA.' };
  }
}

export async function askClaude(params: AskClaudeParams): Promise<string | null> {
  const res = await askClaudeDetailed(params);
  return res.text;
}
