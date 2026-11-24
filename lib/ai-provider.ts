/**
 * Cliente central de IA (somente servidor).
 *
 * A Groq (cota gratuita, GROQ_API_KEY) é o motor PADRÃO de todo o sistema.
 * Ordem de tentativa:
 *   1. provedor pedido explicitamente na chamada (ex.: seletor do Copilot)
 *   2. Groq — passa para o próximo modelo quando um atinge o limite gratuito
 *   3. Ollama, só se houver endereço configurado (OLLAMA_BASE_URL ou banco)
 *   4. provedor salvo na configuração (whatsapp_config.ai_provider)
 *   5. Gemini → Claude → OpenAI
 *
 * Modelos da Groq: GROQ_MODEL (se definido) → openai/gpt-oss-120b → qwen/qwen3.8-27b → openai/gpt-oss-20b.
 *
 * Onde o Ollama é procurado (primeiro que existir):
 *   1. variável OLLAMA_BASE_URL
 *   2. ollama_base_url salvo no banco (em produção, endereços localhost são ignorados,
 *      pois apontariam para o próprio servidor de hospedagem)
 *   3. sem nenhum dos dois, o Ollama é pulado — exceto se pedido explicitamente,
 *      quando usa http://127.0.0.1:11434 (dev) ou http://ollama.railway.internal:11434 (produção)
 *
 * Senha: se OLLAMA_API_KEY existir, vai como "Authorization: Bearer ..." (proxy público
 * do ollama-service). Na rede privada do Railway ela não é necessária.
 *
 * Modelo: OLLAMA_MODEL → ollama_model do banco → 'gemma2:2b'. Se o modelo não existir
 * no servidor Ollama, usa automaticamente o primeiro modelo instalado nele.
 */

export type AiProviderName = 'groq' | 'ollama' | 'gemini' | 'claude' | 'openai';

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

const PROVIDERS: AiProviderName[] = ['groq', 'ollama', 'gemini', 'claude', 'openai'];
const GROQ_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
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

/** Recorta o JSON de uma resposta que veio com texto antes ou depois (modelos sem modo JSON). */
function extractJson(raw: string): string {
  const text = stripJsonFences(raw);
  try {
    JSON.parse(text);
    return text;
  } catch {}
  const start = text.search(/[{[]/);
  if (start < 0) return text;
  const close = text[start] === '{' ? '}' : ']';
  const end = text.lastIndexOf(close);
  if (end <= start) return text;
  const candidate = text.slice(start, end + 1);
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return text;
  }
}

/** O Ollama Cloud (ollama.com) não aceita a opção "format". */
function isOllamaCloud(url: string): boolean {
  return /^https?:\/\/(www\.)?ollama\.com(\/|:|$)/i.test(url);
}

export function resolveOllamaTarget(configs: Array<AiConfigSource | null | undefined> = []): {
  url: string;
  model: string;
  /** true quando o endereço veio de OLLAMA_BASE_URL ou do banco (não do padrão). */
  explicit: boolean;
} {
  const isProd = process.env.NODE_ENV === 'production';
  const fromDb = configs
    .map(c => cleanUrl(c?.ollama_base_url || ''))
    .filter(u => u && !(isProd && isLocalUrl(u)));

  const configured = cleanUrl(process.env.OLLAMA_BASE_URL || '') || fromDb[0] || '';
  const url = configured || (isProd ? 'http://ollama.railway.internal:11434' : 'http://127.0.0.1:11434');

  const model = first(process.env.OLLAMA_MODEL, ...configs.map(c => c?.ollama_model), DEFAULT_OLLAMA_MODEL);
  return { url, model, explicit: !!configured };
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
    groq: first(process.env.GROQ_API_KEY, ...apiKeys.map(k => (k.startsWith('gsk_') ? k : ''))),
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

/** Nenhuma chave em lugar nenhum (variáveis de ambiente nem configuração do WhatsApp). */
export const IA_NAO_CONFIGURADA =
  'A IA ainda não está configurada. Cadastre uma chave (Groq, Gemini, Claude ou OpenAI) em WhatsApp → Configurações da IA.';

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
  const finish = (raw: string) => (jsonMode ? extractJson(raw) : raw.trim());

  async function callGroq(): Promise<GenerateTextResult | null> {
    if (!keys.groq) return null;
    const models = Array.from(new Set([(process.env.GROQ_MODEL || '').trim(), ...GROQ_MODELS].filter(Boolean)));
    for (const model of models) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keys.groq}` },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            ...(model.startsWith('openai/') ? { reasoning_effort: 'low' } : {}),
            ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
            messages: [...(sysText ? [{ role: 'system', content: sysText }] : []), ...messages],
          }),
          signal: AbortSignal.timeout(Math.min(timeoutMs, 25000)),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const text = finish(String(data?.choices?.[0]?.message?.content || ''));
          if (text) return { text, provider: 'groq', model };
          errors.groq = `${model}: resposta vazia`;
        } else {
          errors.groq = `${model} (${res.status}): ${data?.error?.message || 'erro'}`;
          if (res.status === 401 || res.status === 403) break; // chave inválida
          // 429 (limite gratuito), 413 (texto grande demais) ou 5xx: tenta o próximo modelo
        }
      } catch (err: any) {
        errors.groq = `${model}: ${err?.message || 'timeout/rede'}`;
      }
    }
    return null;
  }

  async function callOllama(): Promise<GenerateTextResult | null> {
    const { url, model: requestedModel, explicit } = resolveOllamaTarget(configs);
    if (!explicit && preferred !== 'ollama') return null; // sem Ollama configurado: não espera por um servidor inexistente
    const send = (model: string) =>
      fetch(`${url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...ollamaAuthHeaders() },
        body: JSON.stringify({
          model,
          stream: false,
          ...(jsonMode && !isOllamaCloud(url) ? { format: 'json' } : {}),
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
    // Os modelos antigos (claude-sonnet-4-20250514, claude-3-5-haiku-latest) foram aposentados.
    const models = Array.from(new Set([configuredModel(configs, 'claude-'), 'claude-opus-5-5'].filter(Boolean)));
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
            // Os modelos atuais raciocinam antes de responder (thinking sempre ativo) e esse
            // raciocínio conta no limite: com o teto antigo a resposta saía cortada ou vazia.
            // Eles também recusam `temperature` (400); a profundidade vem de `effort`.
            max_tokens: Math.max(maxTokens * 4, 8000),
            output_config: { effort: 'low' },
            ...(sysText ? { system: sysText } : {}),
            messages,
          }),
          signal: AbortSignal.timeout(Math.max(timeoutMs, 90000)),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          // O primeiro bloco pode ser de raciocínio (type "thinking"): junta só os blocos de texto.
          const blocos: Array<{ type?: string; text?: string }> = Array.isArray(data?.content) ? data.content : [];
          const text = finish(blocos.filter(b => b?.type === 'text').map(b => b.text || '').join(''));
          if (text) return { text, provider: 'claude', model };
          errors.claude = data?.stop_reason === 'refusal'
            ? `${model}: a IA recusou responder a esta pergunta`
            : `${model}: resposta vazia (${data?.stop_reason || 'sem motivo'})`;
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
    groq: callGroq,
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
        'groq',
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

  const labels: Record<AiProviderName, string> = { groq: 'Groq', ollama: 'Ollama', gemini: 'Gemini', claude: 'Claude', openai: 'OpenAI' };
  const error =
    order
      .filter(p => errors[p])
      .map(p => `${labels[p]}: ${errors[p]}`)
      .join(' | ') || IA_NAO_CONFIGURADA;

  console.warn('[AI] Todos os provedores falharam:', error);
  return { text: null, error };
}
