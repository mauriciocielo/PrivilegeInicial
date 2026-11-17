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
}

export async function askClaude(params: AskClaudeParams): Promise<string | null> {
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.success && data?.text ? String(data.text) : null;
  } catch {
    return null;
  }
}
