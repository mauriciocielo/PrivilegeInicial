import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateText, IA_NAO_CONFIGURADA } from './ai-provider';

const CHAVES = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'NEXT_PUBLIC_GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'OPENAI_API_KEY', 'OLLAMA_BASE_URL'];
const salvas: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of CHAVES) { salvas[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  for (const k of CHAVES) { if (salvas[k] === undefined) delete process.env[k]; else process.env[k] = salvas[k]; }
  vi.unstubAllGlobals();
});

const pergunta = { messages: [{ role: 'user' as const, content: 'Qual o saldo?' }] };

describe('generateText', () => {
  it('explica como configurar quando não há nenhuma chave', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const r = await generateText(pergunta);
    expect(r.text).toBeNull();
    expect(r.error).toBe(IA_NAO_CONFIGURADA);
    expect(fetch).not.toHaveBeenCalled();
  });

  describe('Claude', () => {
    it('lê só os blocos de texto, ignorando o raciocínio que vem antes', async () => {
      const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        stop_reason: 'end_turn',
        content: [
          { type: 'thinking', thinking: '' },
          { type: 'text', text: 'Saldo de ' },
          { type: 'text', text: 'R$ 10,00.' },
        ],
      }), { status: 200 }));
      vi.stubGlobal('fetch', fetch);

      const r = await generateText({ ...pergunta, preferred: 'claude', configs: [{ claude_api_key: 'sk-ant-teste' }] });

      expect(r).toMatchObject({ text: 'Saldo de R$ 10,00.', provider: 'claude', model: 'claude-opus-5-5' });
    });

    it('usa um modelo atual, sem temperature e com espaço para o raciocínio', async () => {
      const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }), { status: 200 }));
      vi.stubGlobal('fetch', fetch);

      await generateText({ ...pergunta, maxTokens: 1500, preferred: 'claude', configs: [{ claude_api_key: 'sk-ant-teste' }] });

      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      const corpo = JSON.parse(init.body);
      expect(corpo.model).toBe('claude-opus-5-5');
      expect(corpo).not.toHaveProperty('temperature');
      expect(corpo.max_tokens).toBeGreaterThanOrEqual(8000);
      expect(corpo.output_config).toEqual({ effort: 'low' });
    });

    it('cai para o modelo atual quando o configurado foi aposentado', async () => {
      const fetch = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text: 'oi' }] }), { status: 200 }));
      vi.stubGlobal('fetch', fetch);

      const r = await generateText({ ...pergunta, preferred: 'claude', configs: [{ claude_api_key: 'sk-ant-teste', ai_model: 'claude-3-5-haiku-latest' }] });

      expect(JSON.parse(fetch.mock.calls[0][1].body).model).toBe('claude-3-5-haiku-latest');
      expect(r).toMatchObject({ text: 'oi', model: 'claude-opus-5-5' });
    });

    it('informa quando a IA recusa responder', async () => {
      const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ stop_reason: 'refusal', content: [] }), { status: 200 }));
      vi.stubGlobal('fetch', fetch);

      const r = await generateText({ ...pergunta, preferred: 'claude', configs: [{ claude_api_key: 'sk-ant-teste' }] });

      expect(r.text).toBeNull();
      expect(r.error).toContain('recusou');
    });
  });
});
