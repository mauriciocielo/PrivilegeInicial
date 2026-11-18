/**
 * Cliente central de IA (somente servidor).
 *
 * O Ollama é o motor PADRÃO de todo o sistema. Gemini, Claude e OpenAI
 * ficam apenas como contingência, na ordem abaixo:
 *   1. provedor pedido explicitamente na chamada (ex.: seletor do Copilot)
 *   2. Ollama
 *   3. provedor salvo na configuração (whatsapp_config.ai_provider)
 *   4. Gemini → Claude → OpenAI
 *
 * Onde o Ollama é procurado (primeiro que existir):
 *   1. variável OLLAMA_BASE_URL
 *   2. ollama_base_url salvo no banco (em produção, endereços localhost são ignorados,
 *      pois apontariam para o próprio servidor de hospedagem)
 *   3. padrão: http://127.0.0.1:11434 (dev) ou http://ollama.railway.internal:11434 (produção)
 *
 * Senha: se OLLAMA_API_KEY existir, vai como "Authorization: Bearer ..." (proxy público
 * do ollama-service). Na rede privada do Railway ela não é necessária.
 *
 * Modelo: OLLAMA_MODEL → ollama_model do banco → 'gemma2:2b'. Se o modelo não existir
 * no servidor Ollama, usa automaticamente o primeiro modelo instalado nele.
 */

export type AiProviderName = 'ollama' | 'gemini' | 'claude' | 'openai';

export interface AiConfigSource {
  ai_provider?: string | null;
  ai_model?: string | null;
  api_key?: string | null;
  gemini_api_key?: string | null;
  claude_api_key?: string | null;
  openai_api_key?: string | null;
  ollama_base_url?: string | null;
  ollama_model?: string | null;
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateTextParams {
  prompt?: string;
  messages?: AiChatMessage[];
  system?: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Provedor que deve ser tentado primeiro. 'auto' ou vazio = Ollama primeiro. */
  preferred?: AiProviderName | 'auto' | string | null;
  /** Configurações (dono, padrão etc.), em ordem de prioridade. */
  configs?: Array<AiConfigSource | null | undefined>;
  /** Timeout de cada chamada aos provedores em nuvem. */
  timeoutMs?: number;
  /** Timeout da chamada ao Ollama (modelos locais costumam ser mais lentos). */
  ollamaTimeoutMs?: number;
}

export interface GenerateTextResult {
  text: string | null;
  provider?: AiProviderName;
  model?: string;
  /** Erros por provedor, já formatados para exibição. */
  error?: string;
}

const PROVIDERS: AiProviderName[] = ['ollama', 'gemini', 'claude', 'openai'];
const DEFAULT_OLLAMA_MODEL = 'gemma2:2b';

function first(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    const s = (v || '').trim();
    if (s) return s;
  }
  return '';
}

function isLocalUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(url);
}

function cleanUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) {
    // Endereço digitado sem protocolo: rede privada/local usa http, domínio público usa https.
    const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])|\.railway\.internal(:|$)/i.test(u);
    u = `${local ? 'http' : 'https'}://${u}`;
  }
  return u;
}

export function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

export function resolveOllamaTarget(configs: Array<AiConfigSource | null | undefined> = []): {
  url: string;
  model: string;
} {
  const isProd = process.env.NODE_ENV === 'production';
  const fromDb = configs
    .map(c => cleanUrl(c?.ollama_base_url || ''))
    .filter(u => u && !(isProd && isLocalUrl(u)));

  const url =
    cleanUrl(process.env.OLLAMA_BASE_URL || '') ||
    fromDb[0] ||
    (isProd ? 'http://ollama.railway.internal:11434' : 'http://127.0.0.1:11434');

  const model = first(process.env.OLLAMA_MODEL, ...configs.map(c => c?.ollama_model), DEFAULT_OLLAMA_MODEL);
  return { url, model };
}

function resolveKeys(configs: Array<AiConfigSource | null | undefined>) {
  const apiKeys = configs.map(c => (c?.api_key || '').trim());
  return {
    gemini: first(
      ...configs.map(c => c?.gemini_api_key),
      ...apiKeys.map(k => (k.startsWith('AIza') ? k : '')),
      process.env.GEMINI_API_KEY,
      process.env.NEXT_PUBLIC_GEMINI_API_KEY
    ),
    claude: first(
      ...configs.map(c => c?.claude_api_key),
      ...apiKeys.map(k => (k.startsWith('sk-ant-') ? k : '')),
      process.env.ANTHROPIC_API_KEY,
      process.env.CLAUDE_API_KEY
    ),
    openai: first(
      ...configs.map(c => c?.openai_api_key),
      ...apiKeys.map(k => (k.startsWith('sk-') && !k.startsWith('sk-ant-') ? k : '')),
      process.env.OPENAI_API_KEY
    ),
  };
}

function configuredModel(configs: Array<AiConfigSource | null | undefined>, prefix: string): string {
  for (const c of configs) {
    const m = (c?.ai_model || '').trim();
    if (m.startsWith(prefix)) return m;
  }
  return '';
}

/** Senha do proxy público do Ollama (ollama-service/Caddyfile). Vazia na rede privada. */
function ollamaAuthHeaders(): Record<string, string> {
  const key = (process.env.OLLAMA_API_KEY || '').trim();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

/** Modelo do Ollama que realmente existe no servidor (cache por URL). */
const ollamaModelFallback = new Map<string, string>();

async function pickInstalledOllamaModel(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${url}/api/tags`, { headers: ollamaAuthHeaders(), signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const name = data?.models?.[0]?.name;
    return typeof name === 'string' && name ? name : null;
  } catch {
    return null;
  }
}

export async function generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
  const {
    prompt,
    system,
    jsonMode = false,
    maxTokens = 1600,
    temperature = 0.4,
    preferred,
    configs = [],
    timeoutMs = 60000,
    ollamaTimeoutMs = 90000,
  } = params;

  const messages: AiChatMessage[] = [];
  for (const m of params.messages || []) {
    const content = String(m.content || '');
    if (!content.trim()) continue;
    const last = messages[messages.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n\n${content}`;
    else messages.push({ role: m.role, content });
  }
  if (prompt && prompt.trim()) {
    const last = messages[messages.length - 1];
    if (last && last.role === 'user') last.content = `${last.content}\n\n${prompt}`;
    else messages.push({ role: 'user', content: prompt });
  }
  while (messages.length > 0 && messages[0].role !== 'user') messages.shift();
  if (messages.length === 0) return { text: null, error: 'Prompt vazio.' };

  const sysText = jsonMode
    ? `${system ? system + '\n\n' : ''}Responda ESTRITAMENTE com JSON válido, sem markdown, sem cercas \`\`\`json e sem texto fora do JSON.`
    : system || undefined;

  const keys = resolveKeys(configs);
  const errors: Partial<Record<AiProviderName, string>> = {};
  const finish = (raw: string) => (jsonMode ? stripJsonFences(raw) : raw.trim());

  async function callOllama(): Promise<GenerateTextResult | null> {
    const { url, model: requestedModel } = resolveOllamaTarget(configs);
    const send = (model: string) =>
      fetch(`${url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...ollamaAuthHeaders() },
        body: JSON.stringify({
          model,
          stream: false,
          ...(jsonMode ? { format: 'json' } : {}),
          options: { temperature, num_predict: maxTokens },
          messages: [...(sysText ? [{ role: 'system', content: sysText }] : []), ...messages],
        }),
        signal: AbortSignal.timeout(ollamaTimeoutMs),
      });

    let model = ollamaModelFallback.get(`${url}|${requestedModel}`) || requestedModel;
    try {
      let res = await send(model);
      if (res.status === 404) {
        // Modelo pedido não está instalado: usa o que existir no servidor.
        const installed = await pickInstalledOllamaModel(url);
        if (installed && installed !== model) {
          ollamaModelFallback.set(`${url}|${requestedModel}`, installed);
          model = installed;
          res = await send(model);
        }
      }
      if (res.ok) {
        const data = await res.json();
        const text = finish(String(data?.message?.content || ''));
        if (text) return { text, provider: 'ollama', model };
        errors.ollama = `${model}: resposta vazia`;
      } else {
        const body = await res.text().catch(() => '');
        errors.ollama = `${model} (${res.status})${body ? `: ${body.slice(0, 160)}` : ''} em ${url}`;
      }
    } catch (err: any) {
      errors.ollama = `${err?.message || 'inacessível'} em ${url}`;
    }
    return null;
  }

  async function callGemini(): Promise<GenerateTextResult | null> {
    if (!keys.gemini) return null;
    const models = Array.from(new Set([configuredModel(configs, 'gemini-'), 'gemini-2.5-flash'].filter(Boolean)));
    const contents = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
    for (const model of models) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keys.gemini}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              ...(sysText ? { systemInstruction: { parts: [{ text: sysText }] } } : {}),
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
                ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
              },
            }),
            signal: AbortSignal.timeout(timeoutMs),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const text = finish(String(data?.candidates?.[0]?.content?.parts?.[0]?.text || ''));
          if (text) return { text, provider: 'gemini', model };
        } else {
          errors.gemini = `${model} (${res.status}): ${data?.error?.message || 'erro'}`;
        }
      } catch (err: any) {
        errors.gemini = err?.message || 'timeout/rede';
      }
    }
    return null;
  }

  async function callClaude(): Promise<GenerateTextResult | null> {
    if (!keys.claude) return null;
    const models = Array.from(
      new Set([configuredModel(configs, 'claude-'), 'claude-sonnet-4-20250514', 'claude-3-5-haiku-latest'].filter(Boolean))
    );
    for (const model of models) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': keys.claude,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            ...(sysText ? { system: sysText } : {}),
            messages,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const text = finish(String(data?.content?.[0]?.text || ''));
          if (text) return { text, provider: 'claude', model };
        } else {
          errors.claude = `${model} (${res.status}): ${data?.error?.message || 'erro'}`;
          if (res.status === 401 || res.status === 403) break; // chave inválida: não adianta trocar de modelo
        }
      } catch (err: any) {
        errors.claude = err?.message || 'timeout/rede';
      }
    }
    return null;
  }

  async function callOpenAI(): Promise<GenerateTextResult | null> {
    if (!keys.openai) return null;
    const model = configuredModel(configs, 'gpt-') || 'gpt-4o-mini';
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keys.openai}` },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
          messages: [...(sysText ? [{ role: 'system', content: sysText }] : []), ...messages],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = finish(String(data?.choices?.[0]?.message?.content || ''));
        if (text) return { text, provider: 'openai', model };
      } else {
        errors.openai = `${model} (${res.status}): ${data?.error?.message || 'erro'}`;
      }
    } catch (err: any) {
      errors.openai = err?.message || 'timeout/rede';
    }
    return null;
  }

  const callers: Record<AiProviderName, () => Promise<GenerateTextResult | null>> = {
    ollama: callOllama,
    gemini: callGemini,
    claude: callClaude,
    openai: callOpenAI,
  };

  const asProvider = (p: unknown): AiProviderName | null =>
    PROVIDERS.includes(p as AiProviderName) ? (p as AiProviderName) : null;

  const order = Array.from(
    new Set<AiProviderName>(
      [
        asProvider(preferred),
        'ollama',
        ...configs.map(c => asProvider(c?.ai_provider)),
        'gemini',
        'claude',
        'openai',
      ].filter((p): p is AiProviderName => !!p)
    )
  );

  for (const provider of order) {
    const out = await callers[provider]();
    if (out?.text) return out;
  }

  const labels: Record<AiProviderName, string> = { ollama: 'Ollama', gemini: 'Gemini', claude: 'Claude', openai: 'OpenAI' };
  const error =
    order
      .filter(p => errors[p])
      .map(p => `${labels[p]}: ${errors[p]}`)
      .join(' | ') || 'Nenhum provedor de IA disponível no momento.';

  console.warn('[AI] Todos os provedores falharam:', error);
  return { text: null, error };
}
