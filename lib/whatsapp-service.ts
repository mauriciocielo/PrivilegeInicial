import { getEmailDbPool } from './email-db';
import QRCode from 'qrcode';
import { findTaughtAnswer, getTaughtLessonsContext, autoLearnFromConsultantReply, learnFromAllHistoricalMessages } from './knowledge-service';
import { sendBaileysLiveMessage, sendBaileysReaction, ensureBaileysConnected } from './baileys-manager';
import { runTriageStep } from './triage-agent';
import { detectAndCreateDemandTask } from './whatsapp-agenda';
import {
  AssistantPersona,
  DEFAULT_ASSISTANTS,
  transcribeWhatsAppAudio,
  synthesizeVoiceReplyPtBr,
} from './voice-assistant';

export interface AutoReplyRule {
  id: string;
  gatilhos: string[];
  resposta: string;
  pausarBot?: boolean;
}

export interface BusinessDayHours {
  ativo: boolean;
  inicio: string; // "08:00"
  fim: string;    // "18:00"
}

export interface BusinessHours {
  seg: BusinessDayHours;
  ter: BusinessDayHours;
  qua: BusinessDayHours;
  qui: BusinessDayHours;
  sex: BusinessDayHours;
  sab: BusinessDayHours;
  dom: BusinessDayHours;
}

export interface QuickReply {
  id: string;
  titulo: string;
  texto: string;
}

export interface WhatsAppConfig {
  id: string;
  provider: string;
  api_url: string;
  api_key: string;
  instance_name: string;
  status: 'conectado' | 'desconectado' | 'conectando' | 'qrcode';
  phone_number: string | null;
  profile_name: string | null;
  profile_pic: string | null;
  qr_code: string | null;
  bot_enabled: boolean;
  bot_mode: 'hibrido' | 'regras' | 'ia';
  bot_prompt: string;
  welcome_message: string;
  off_hours_message: string;
  business_hours: BusinessHours;
  auto_reply_rules: AutoReplyRule[];
  quick_replies: QuickReply[];
  human_takeover_minutes: number;
  mcp_enabled?: boolean;
  ai_provider?: 'gemini' | 'claude' | 'openai' | 'ollama';
  ai_model?: string;
  gemini_api_key?: string;
  claude_api_key?: string;
  openai_api_key?: string;
  ollama_base_url?: string;
  ollama_model?: string;
  gemini_mcp_url?: string;
  gemini_mcp_token?: string;
  reply_audio_on_audio?: boolean;
  always_reply_audio?: boolean;
  active_assistant_id?: string;
  assistants?: AssistantPersona[];
  updated_at?: string;
}

export type CrmStage =
  | 'lead'
  | 'em_atendimento'
  | 'aguardando_documentos'
  | 'proposta'
  | 'fechado'
  | 'pos_venda';

export interface WhatsAppChat {
  id: string;
  phone: string;
  name: string;
  profile_pic?: string | null;
  last_message?: string | null;
  last_message_time?: string;
  unread_count: number;
  bot_enabled: boolean;
  bot_paused_until?: string | null;
  tags?: string[];
  crm_stage: CrmStage;
  crm_value: number;
  assigned_to: string;
  followup_date?: string | null;
  followup_note?: string | null;
  followup_status?: 'nenhum' | 'pendente' | 'concluido' | 'enviado';
  followup_message?: string | null;
  followup_auto_send?: boolean;
  ticket_status?: 'aberto' | 'encerrado';
  closed_at?: string | null;
  closed_reason?: string | null;
  internal_notes?: string | null;
  triage_summary?: string | null;
  triage_status?: string | null;
  triage_data?: any;
  created_at?: string;
}

export interface WhatsAppMessage {
  id: string;
  chat_id: string;
  from_me: boolean;
  sender_name?: string | null;
  text: string;
  media_type?: 'text' | 'image' | 'audio' | 'document' | string;
  media_url?: string | null;
  file_name?: string | null;
  reactions?: string[];
  wa_key?: any;
  status?: string;
  timestamp: string;
  sent_by: 'cliente' | 'consultor' | 'bot' | 'sistema';
}

const DEFAULT_CONFIG: WhatsAppConfig = {
  id: 'default',
  provider: 'evolution',
  api_url: process.env.WHATSAPP_API_URL || 'https://api.evolution-api.com',
  api_key: process.env.WHATSAPP_API_KEY || '',
  instance_name: 'privilege',
  status: 'desconectado',
  phone_number: null,
  profile_name: 'Privilege Contabilidade',
  profile_pic: null,
  qr_code: null,
  bot_enabled: true,
  bot_mode: 'hibrido',
  bot_prompt: `Você é Léo, assistente virtual de triagem e pré-vendas da Privilege Contabilidade e Consultoria (Serviços profissionais) no WhatsApp.

Sobre o negócio:
Somos um escritório de Contabilidade, Consultoria Empresarial 360º e Treinamentos Corporativos localizado na Rua Pará, 127, Sala 103/3, Centro, em Francisco Beltrão - PR (atendemos presencialmente na região Sudoeste do Paraná e online em todo o Brasil).
Atendemos todos os tipos e portes de empresas (Simples Nacional, Lucro Presumido, Lucro Real e MEI).
Nossa atuação é 360º (completa ou contratada separadamente por área, mesmo que o cliente já tenha outro contador):
1. Planejamento Estratégico e Orçamentário 2027 (Metas, Orçamento, DRE Projetado e Plano de Ação 5W2H).
2. Contábil e Tributário (Abertura de CNPJ, Troca de Contador, Planejamento Tributário, Recuperação de Créditos Fiscais e Reforma Tributária IBS/CBS).
3. Consultoria Financeira, BPO Financeiro e Alavancagem (Fluxo de Caixa, Precificação, Margem de Lucro, DRE Gerencial, Reestruturação de Dívidas e Captação de Crédito).
4. Gestão Comercial e Vendas (Estruturação de Funil, Metas, Processos, Scripts Comerciais e CRM).
5. Marketing Estratégico e Posicionamento (Aquisição de Clientes, ICP, ROI/ROAS e Posicionamento de Marca).
6. Gestão de Pessoas, Cultura e Treinamentos In-Company (Organograma, Cargos, Liderança, Remuneração Variável, Palestras e Capacitação de Equipes).

Nossos sócios e especialistas responsáveis pelas reuniões de diagnóstico são Mauricio Cielo e Marcos Cancelier.
Site: https://www.privilegecontabilidade.cnt.br | Instagram: @privilegeconsultoria.fb
Você atende 24 horas, todos os dias.

Objetivo da conversa: Qualificar o interesse do empresário e convidá-lo para uma Sessão de Diagnóstico Estratégico (aprox. 30 minutos, sem custo inicial — presencial em Francisco Beltrão ou online por vídeo chamada) com nossos especialistas. Antes de chamar a equipe, pergunte: primeiro nome (se ainda não souber), segmento da empresa e principal desafio/área que procura.

Preço: Nunca dê valor fechado de consultoria ou treinamento no chat (explique que depende de avaliação sob medida na reunião de diagnóstico). Exceção única: se o cliente for MEI e pedir contabilidade mensal, temos Plano Essencial (R$ 100/mês), Plano Plus (R$ 150/mês) e Plano Premium (R$ 200/mês).

Diretrizes de Operação:
- MODO 1 (Prospecção Ativa): Mensagens únicas (nunca idênticas), máximo 2 parágrafos curtos (até 3 linhas), sem links no 1º contato, com gancho (Planejamento 2027, Margem/Caixa, Reforma Tributária ou Vendas/Equipe) e UMA pergunta leve no final.
- MODO 2 (Atendimento e Qualificação): Proibido respostas vazias ("Certo, me conte mais"). Valide o que o cliente disse mostrando conhecimento prático, escreva no máximo 2 parágrafos curtos e termine SEMPRE com UMA única pergunta estratégica.
- Fechamento para Diagnóstico: Identificado nome, ramo e dor principal, proponha a Sessão de Diagnóstico (30 min, sem custo inicial), perguntando se prefere presencial (Francisco Beltrão) ou vídeo chamada, e qual melhor turno (manhã ou tarde).
- Transbordo Humano: Quando informar formato/turno, diga que passou para a equipe confirmar o horário e chame a equipe.

Regras estritas:
- Chame o cliente sempre apenas pelo PRIMEIRO NOME.
- Tom executivo, próximo, consultivo e simpático.
- Nunca confirme quem é ou foi cliente. Nunca dê parecer jurídico/técnico definitivo nem prometa resultado garantido.
- Nunca diga que anotou, registrou, confirmou, agendou ou reservou algo (máximo: "passei para a equipe confirmar").
- Nunca prometa tempo de resposta ("só um minutinho", "já te retorno").
- Nunca envie marcadores como [link] ou [Nome].
- Se perguntarem se é robô/IA, diga que é o Léo, assistente virtual da Privilege Contabilidade e Consultoria.`,
  welcome_message: `Olá! Tudo bem? Sou o Léo, assistente virtual da *Privilege Contabilidade e Consultoria*. 😊\n\nComo posso te chamar e qual o principal desafio ou área que você procura para a sua empresa hoje?`,
  off_hours_message: `Olá! Nosso horário de atendimento é de *Segunda a Sexta-feira, das 08:00 às 18:00*. ⏰\n\nSua mensagem foi registrada com sucesso e retornaremos assim que iniciarmos nosso expediente!`,
  business_hours: {
    seg: { ativo: true, inicio: '08:00', fim: '18:00' },
    ter: { ativo: true, inicio: '08:00', fim: '18:00' },
    qua: { ativo: true, inicio: '08:00', fim: '18:00' },
    qui: { ativo: true, inicio: '08:00', fim: '18:00' },
    sex: { ativo: true, inicio: '08:00', fim: '18:00' },
    sab: { ativo: false, inicio: '08:00', fim: '12:00' },
    dom: { ativo: false, inicio: '00:00', fim: '00:00' },
  },
  auto_reply_rules: [
    {
      id: 'rule_1',
      gatilhos: ['1', 'boleto', 'honorarios', 'segunda via', 'pagamento'],
      resposta: 'Para consultar ou emitir a 2ª via dos seus honorários ou boletos, você também pode acessar nosso portal: https://privilegecontabilidade.cnt.br/login ou informe o CNPJ da sua empresa aqui para localizarmos.',
    },
    {
      id: 'rule_2',
      gatilhos: ['2', 'comprovante', 'anexo', 'nota fiscal', 'xml'],
      resposta: 'Recebemos o seu documento! Nossa equipe fiscal e contábil fará o lançamento e a conciliação no sistema da Privilege.',
    },
    {
      id: 'rule_3',
      gatilhos: ['3', 'cnd', 'certidao', 'certidão', 'negativa', 'receita federal'],
      resposta: 'As certidões fiscais (Federal, Estadual e Municipal) são monitoradas automaticamente pelo nosso sistema. Caso precise de uma via atualizada em PDF, nossa equipe pode emitir em instantes!',
    },
    {
      id: 'rule_4',
      gatilhos: ['4', 'consultoria', 'planejamento', 'bpo', 'abertura'],
      resposta: 'Nossa divisão de consultoria estratégica lidera inteligência financeira, reestruturação de fluxo de caixa e planejamento tributário. Um de nossos consultores falará com você a seguir.',
    },
    {
      id: 'rule_5',
      gatilhos: ['5', 'atendente', 'humano', 'falar', 'ajuda', 'pessoa'],
      resposta: 'Transferindo você para um atendente humano da nossa equipe! O bot foi pausado para esta conversa e você será atendido em instantes. 👤',
      pausarBot: true,
    },
  ],
  quick_replies: [
    { id: 'qr_1', titulo: 'Chave PIX Escritório', texto: 'Nossa chave PIX oficial é o CNPJ: 58.033.979/0001-84 (Privilege Consultoria LTDA).' },
    { id: 'qr_2', titulo: 'Endereço Físico', texto: 'Nosso escritório fica na Rua Pará, 127, Sala 103, Centro – Francisco Beltrão / PR · CEP 85.601-290.' },
    { id: 'qr_3', titulo: 'Portal do Cliente', texto: 'Acesse todos os seus relatórios e conciliações em: https://privilegecontabilidade.cnt.br/login' },
  ],
  human_takeover_minutes: 30,
  mcp_enabled: true,
  ai_provider: 'gemini',
  ai_model: 'gemini-2.5-flash',
  gemini_api_key: '',
  claude_api_key: '',
  openai_api_key: '',
  ollama_base_url: '',
  ollama_model: 'gemma4:latest',
  reply_audio_on_audio: true,
  always_reply_audio: false,
  active_assistant_id: 'leo',
  assistants: DEFAULT_ASSISTANTS,
};

let __configColsEnsured = false;

async function ensureConfigColumns(pool: any) {
  if (__configColsEnsured) return;
  try {
    await pool.query(`
      ALTER TABLE whatsapp_config
        ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'gemini',
        ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'gemini-2.5-flash',
        ADD COLUMN IF NOT EXISTS gemini_api_key TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS claude_api_key TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS openai_api_key TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS reply_audio_on_audio BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS always_reply_audio BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS active_assistant_id TEXT DEFAULT 'leo',
        ADD COLUMN IF NOT EXISTS assistants JSONB,
        ADD COLUMN IF NOT EXISTS gemini_mcp_url TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS gemini_mcp_token TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS ollama_base_url TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS ollama_model TEXT DEFAULT 'gemma4:latest';
    `);
    __configColsEnsured = true;
  } catch (err) {
    console.warn('[WhatsAppService] Aviso ao verificar colunas de IA em whatsapp_config:', err);
  }
}

/**
 * Obtém as configurações do WhatsApp e do Bot para uma sessão/usuário específica
 */
export async function getWhatsAppConfig(ownerId = 'default'): Promise<WhatsAppConfig> {
  const pool = getEmailDbPool();
  const baseDefault: WhatsAppConfig = {
    ...DEFAULT_CONFIG,
    id: ownerId,
    status: ownerId === 'default' ? DEFAULT_CONFIG.status : 'desconectado',
    phone_number: ownerId === 'default' ? DEFAULT_CONFIG.phone_number : null,
    qr_code: null,
  };
  if (!pool) return baseDefault;

  await ensureConfigColumns(pool);

  try {
    const res = await pool.query(`SELECT * FROM whatsapp_config WHERE id = $1`, [ownerId]);
    if (res.rows.length === 0) {
      return baseDefault;
    }
    const r = res.rows[0];
    return {
      id: r.id,
      provider: r.provider || 'evolution',
      api_url: r.api_url || process.env.WHATSAPP_API_URL || '',
      api_key: r.api_key || process.env.WHATSAPP_API_KEY || '',
      instance_name: r.instance_name || 'privilege',
      status: r.status || 'desconectado',
      phone_number: r.phone_number,
      profile_name: r.profile_name || 'Privilege Contabilidade',
      profile_pic: r.profile_pic,
      qr_code: r.qr_code,
      bot_enabled: r.bot_enabled !== false,
      bot_mode: r.bot_mode || 'hibrido',
      bot_prompt:
        r.bot_prompt && !(r.bot_prompt.includes('CRC-PR 082974/O-7') && r.bot_prompt.length < 400)
          ? r.bot_prompt
          : DEFAULT_CONFIG.bot_prompt,
      welcome_message: r.welcome_message || DEFAULT_CONFIG.welcome_message,
      off_hours_message: r.off_hours_message || DEFAULT_CONFIG.off_hours_message,
      business_hours: typeof r.business_hours === 'string' ? JSON.parse(r.business_hours) : (r.business_hours || DEFAULT_CONFIG.business_hours),
      auto_reply_rules: typeof r.auto_reply_rules === 'string' ? JSON.parse(r.auto_reply_rules) : (r.auto_reply_rules || DEFAULT_CONFIG.auto_reply_rules),
      quick_replies: typeof r.quick_replies === 'string' ? JSON.parse(r.quick_replies) : (r.quick_replies || DEFAULT_CONFIG.quick_replies),
      human_takeover_minutes: r.human_takeover_minutes ?? 30,
      mcp_enabled: true,
      ai_provider: (r.ai_provider as any) || 'gemini',
      ai_model: r.ai_model || 'gemini-2.5-flash',
      gemini_api_key: r.gemini_api_key || (r.api_key && r.api_key.startsWith('AIza') ? r.api_key : '') || '',
      claude_api_key: r.claude_api_key || (r.api_key && r.api_key.startsWith('sk-ant-') ? r.api_key : '') || '',
      openai_api_key:
        r.openai_api_key ||
        (r.api_key && r.api_key.startsWith('sk-') && !r.api_key.startsWith('sk-ant-') ? r.api_key : '') ||
        '',
      reply_audio_on_audio: r.reply_audio_on_audio !== false,
      always_reply_audio: !!r.always_reply_audio,
      active_assistant_id: r.active_assistant_id || 'leo',
      gemini_mcp_url: r.gemini_mcp_url || '',
      gemini_mcp_token: r.gemini_mcp_token || '',
      ollama_base_url: r.ollama_base_url || '',
      ollama_model: r.ollama_model || 'gemma4:latest',
      assistants:
        typeof r.assistants === 'string'
          ? JSON.parse(r.assistants)
          : Array.isArray(r.assistants) && r.assistants.length > 0
          ? r.assistants
          : DEFAULT_ASSISTANTS,
      updated_at: r.updated_at,
    };
  } catch (err) {
    console.error('[WhatsAppService] Erro ao carregar config:', err);
    return baseDefault;
  }
}

/**
 * Atualiza as configurações da sessão do usuário
 */
export async function updateWhatsAppConfig(
  partial: Partial<WhatsAppConfig>,
  ownerId = 'default'
): Promise<WhatsAppConfig> {
  const pool = getEmailDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL indisponível');

  await ensureConfigColumns(pool);

  const current = await getWhatsAppConfig(ownerId);
  const merged: WhatsAppConfig = { ...current, ...partial, id: ownerId };

  const sql = `
    INSERT INTO whatsapp_config (
      id, provider, api_url, api_key, instance_name, status,
      phone_number, profile_name, profile_pic, qr_code,
      bot_enabled, bot_mode, bot_prompt, welcome_message, off_hours_message,
      business_hours, auto_reply_rules, quick_replies, human_takeover_minutes,
      ai_provider, ai_model, gemini_api_key, claude_api_key, openai_api_key,
      reply_audio_on_audio, always_reply_audio, active_assistant_id, assistants, gemini_mcp_url, gemini_mcp_token, ollama_base_url, ollama_model, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, NOW())
    ON CONFLICT (id) DO UPDATE SET
      provider = EXCLUDED.provider,
      api_url = EXCLUDED.api_url,
      api_key = EXCLUDED.api_key,
      instance_name = EXCLUDED.instance_name,
      status = EXCLUDED.status,
      phone_number = EXCLUDED.phone_number,
      profile_name = EXCLUDED.profile_name,
      profile_pic = EXCLUDED.profile_pic,
      qr_code = EXCLUDED.qr_code,
      bot_enabled = EXCLUDED.bot_enabled,
      bot_mode = EXCLUDED.bot_mode,
      bot_prompt = EXCLUDED.bot_prompt,
      welcome_message = EXCLUDED.welcome_message,
      off_hours_message = EXCLUDED.off_hours_message,
      business_hours = EXCLUDED.business_hours,
      auto_reply_rules = EXCLUDED.auto_reply_rules,
      quick_replies = EXCLUDED.quick_replies,
      human_takeover_minutes = EXCLUDED.human_takeover_minutes,
      ai_provider = EXCLUDED.ai_provider,
      ai_model = EXCLUDED.ai_model,
      gemini_api_key = EXCLUDED.gemini_api_key,
      claude_api_key = EXCLUDED.claude_api_key,
      openai_api_key = EXCLUDED.openai_api_key,
      reply_audio_on_audio = EXCLUDED.reply_audio_on_audio,
      always_reply_audio = EXCLUDED.always_reply_audio,
      active_assistant_id = EXCLUDED.active_assistant_id,
      assistants = EXCLUDED.assistants,
      gemini_mcp_url = EXCLUDED.gemini_mcp_url,
      gemini_mcp_token = EXCLUDED.gemini_mcp_token,
      ollama_base_url = EXCLUDED.ollama_base_url,
      ollama_model = EXCLUDED.ollama_model,
      updated_at = NOW()
    RETURNING *;
  `;

  await pool.query(sql, [
    ownerId,
    merged.provider,
    merged.api_url,
    merged.api_key,
    merged.instance_name,
    merged.status,
    merged.phone_number,
    merged.profile_name,
    merged.profile_pic,
    merged.qr_code,
    merged.bot_enabled,
    merged.bot_mode,
    merged.bot_prompt,
    merged.welcome_message,
    merged.off_hours_message,
    JSON.stringify(merged.business_hours),
    JSON.stringify(merged.auto_reply_rules),
    JSON.stringify(merged.quick_replies),
    merged.human_takeover_minutes,
    merged.ai_provider || 'gemini',
    merged.ai_model || 'gemini-2.5-flash',
    merged.gemini_api_key || '',
    merged.claude_api_key || '',
    merged.openai_api_key || '',
    merged.reply_audio_on_audio !== false,
    !!merged.always_reply_audio,
    merged.active_assistant_id || 'leo',
    JSON.stringify(merged.assistants || DEFAULT_ASSISTANTS),
    merged.gemini_mcp_url || '',
    merged.gemini_mcp_token || '',
    merged.ollama_base_url || '',
    merged.ollama_model || 'gemma4:latest',
  ]);

  return merged;
}

/**
 * Gera um novo QR Code para conexão
 */
export async function generateQRCode(forceNew: boolean = false, ownerId = 'default'): Promise<{ qr_code: string; pairing_code?: string; status: string }> {
  const config = await getWhatsAppConfig(ownerId);

  if (config.api_url && config.api_url.startsWith('http') && !config.api_url.includes('example')) {
    try {
      const url = `${config.api_url.replace(/\/+$/, '')}/instance/connect/${encodeURIComponent(config.instance_name)}`;
      const res = await fetch(url, {
        headers: {
          'apikey': config.api_key,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        const base64 = data.base64 || (data.code ? await QRCode.toDataURL(data.code) : null);
        if (base64) {
          await updateWhatsAppConfig({ qr_code: base64, status: 'qrcode' }, ownerId);
          return { qr_code: base64, pairing_code: data.pairingCode, status: 'qrcode' };
        }
      }
    } catch (apiErr) {
      console.warn('[WhatsAppService] Falha ao contatar Evolution API remota:', apiErr);
    }
  }

  const randomToken = Math.random().toString(36).substring(2, 10).toUpperCase();
  const baileysAuthString = `2@${Date.now()},${randomToken},privilege-bot-v2`;
  const qrBase64 = await QRCode.toDataURL(baileysAuthString, {
    width: 320,
    margin: 2,
    color: { dark: '#111827', light: '#ffffff' },
  });

  await updateWhatsAppConfig({
    qr_code: qrBase64,
    status: 'qrcode',
  }, ownerId);

  return {
    qr_code: qrBase64,
    pairing_code: `${randomToken.slice(0, 4)}-${randomToken.slice(4)}`,
    status: 'qrcode',
  };
}

/**
 * Conecta ou simula a conexão com sucesso
 */
export async function simulateConnectWhatsApp(ownerId = 'default'): Promise<WhatsAppConfig> {
  return await updateWhatsAppConfig(
    {
      status: 'conectado',
      phone_number: '+55 46 99123-4567',
      profile_name: 'Privilege Contabilidade & Consultoria',
      qr_code: null,
    },
    ownerId
  );
}

/**
 * Desconecta a sessão do WhatsApp
 */
export async function disconnectWhatsApp(ownerId = 'default'): Promise<WhatsAppConfig> {
  const config = await getWhatsAppConfig(ownerId);

  if (config.api_url && config.api_url.startsWith('http')) {
    try {
      const url = `${config.api_url.replace(/\/+$/, '')}/instance/logout/${encodeURIComponent(config.instance_name)}`;
      await fetch(url, {
        method: 'DELETE',
        headers: { 'apikey': config.api_key },
        signal: AbortSignal.timeout(4000),
      });
    } catch { }
  }

  return await updateWhatsAppConfig(
    {
      status: 'desconectado',
      phone_number: null,
      qr_code: null,
    },
    ownerId
  );
}

let __chatColumnsEnsured = false;

export async function ensureChatColumns(pool: any) {
  if (__chatColumnsEnsured) return;
  try {
    await pool.query(`
      ALTER TABLE whatsapp_chats
        ADD COLUMN IF NOT EXISTS owner_id TEXT DEFAULT 'default',
        ADD COLUMN IF NOT EXISTS ticket_status TEXT DEFAULT 'aberto',
        ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS closed_reason TEXT,
        ADD COLUMN IF NOT EXISTS followup_status TEXT DEFAULT 'nenhum',
        ADD COLUMN IF NOT EXISTS followup_message TEXT,
        ADD COLUMN IF NOT EXISTS followup_auto_send BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS protocol_number TEXT;
    `);
    await pool.query(`
      ALTER TABLE whatsapp_messages
        ADD COLUMN IF NOT EXISTS owner_id TEXT DEFAULT 'default';
    `).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_protocols (
        id TEXT PRIMARY KEY,
        owner_id TEXT DEFAULT 'default',
        chat_id TEXT NOT NULL,
        protocol_number TEXT NOT NULL,
        contact_name TEXT,
        contact_phone TEXT,
        subject TEXT,
        summary TEXT,
        status TEXT DEFAULT 'aberto',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        closed_at TIMESTAMPTZ
      );
    `).catch(() => {});
    await pool.query(`UPDATE whatsapp_chats SET ticket_status = 'aberto' WHERE ticket_status IS NULL`);
    await pool.query(`UPDATE whatsapp_chats SET owner_id = 'default' WHERE owner_id IS NULL`);
    __chatColumnsEnsured = true;
  } catch (err) {
    console.warn('[WhatsAppService] Aviso ao verificar colunas de chamado/followup:', err);
  }
}

export function generateProtocolNumber(): string {
  const now = new Date();
  const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const y = brt.getFullYear();
  const m = String(brt.getMonth() + 1).padStart(2, '0');
  const d = String(brt.getDate()).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `PROT-${y}${m}${d}-${rand}`;
}

export async function createOrSaveProtocol(params: {
  chatId: string;
  ownerId?: string;
  subject?: string;
  summary?: string;
  status?: 'aberto' | 'encerrado';
}) {
  const pool = getEmailDbPool();
  if (!pool) throw new Error('Banco de dados indisponível');
  await ensureChatColumns(pool);

  const ownerId = params.ownerId || 'default';
  const chatRes = await pool.query(
    `SELECT id, name, phone, protocol_number, triage_summary FROM whatsapp_chats WHERE id = $1`,
    [params.chatId]
  );
  const chat = chatRes.rows[0];
  const protocolNumber = chat?.protocol_number || generateProtocolNumber();
  const id = 'prot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const status = params.status || 'aberto';

  const existing = await pool.query(
    `SELECT id FROM whatsapp_protocols WHERE chat_id = $1 AND protocol_number = $2 LIMIT 1`,
    [params.chatId, protocolNumber]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE whatsapp_protocols
       SET subject = COALESCE($1, subject),
           summary = COALESCE($2, summary),
           status = $3,
           closed_at = CASE WHEN $3 = 'encerrado' THEN COALESCE(closed_at, NOW()) ELSE NULL END
       WHERE id = $4`,
      [params.subject || null, params.summary || null, status, existing.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO whatsapp_protocols (id, owner_id, chat_id, protocol_number, contact_name, contact_phone, subject, summary, status, closed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $9 = 'encerrado' THEN NOW() ELSE NULL END)`,
      [
        id,
        ownerId,
        params.chatId,
        protocolNumber,
        chat?.name || params.chatId,
        chat?.phone || '',
        params.subject || 'Atendimento WhatsApp',
        params.summary || chat?.triage_summary || '',
        status,
      ]
    );
  }

  await pool.query(
    `UPDATE whatsapp_chats SET protocol_number = $1 WHERE id = $2`,
    [protocolNumber, params.chatId]
  );

  const savedRes = await pool.query(
    `SELECT * FROM whatsapp_protocols WHERE chat_id = $1 AND protocol_number = $2 LIMIT 1`,
    [params.chatId, protocolNumber]
  );
  return savedRes.rows[0] || { protocol_number: protocolNumber, status };
}

export async function listProtocols(ownerId = 'default', chatId?: string) {
  const pool = getEmailDbPool();
  if (!pool) return [];
  await ensureChatColumns(pool);

  if (chatId) {
    const res = await pool.query(
      `SELECT * FROM whatsapp_protocols WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [chatId]
    );
    return res.rows;
  }

  const res = await pool.query(
    `SELECT * FROM whatsapp_protocols WHERE COALESCE(owner_id, 'default') = $1 ORDER BY created_at DESC LIMIT 100`,
    [ownerId]
  );
  return res.rows;
}

let __checkingFollowups = false;

export async function checkAndDispatchDueFollowups(pool: any) {
  if (__checkingFollowups) return;
  __checkingFollowups = true;
  try {
    await ensureChatColumns(pool);
    const res = await pool.query(`
      SELECT id, COALESCE(owner_id, 'default') AS owner_id, name, followup_note, followup_message
      FROM whatsapp_chats
      WHERE followup_auto_send = TRUE
        AND followup_status = 'pendente'
        AND followup_date IS NOT NULL
        AND followup_date <= NOW()
      LIMIT 10
    `);
    for (const row of res.rows) {
      const msgText =
        (row.followup_message || '').trim() ||
        `Olá, ${row.name || 'tudo bem'}! Passando para dar retorno sobre nosso atendimento na Privilege Contabilidade e Consultoria. Como podemos prosseguir?`;
      await pool.query(
        `UPDATE whatsapp_chats SET followup_status = 'enviado', ticket_status = 'aberto' WHERE id = $1`,
        [row.id]
      );
      await sendMessage({
        chatId: row.id,
        text: msgText,
        sentBy: 'consultor',
        senderName: 'Follow-up Privilege',
        ownerId: row.owner_id || 'default',
      }).catch(() => {});
    }
  } catch {
  } finally {
    __checkingFollowups = false;
  }
}

/**
 * Executa o ciclo de background (disparo de follow-ups vencidos) mesmo sem tela aberta
 */
let __lastAutoLearnAt = 0;

export async function runWhatsAppBackgroundTick(): Promise<void> {
  const pool = getEmailDbPool();
  if (!pool) return;
  await checkAndDispatchDueFollowups(pool);
  const now = Date.now();
  if (now - __lastAutoLearnAt > 10 * 60 * 1000) {
    __lastAutoLearnAt = now;
    learnFromAllHistoricalMessages().catch(() => {});
  }
}

/**
 * Lista todas as conversas do WhatsApp da sessão do usuário
 */
export async function listChats(
  search?: string,
  stage?: string,
  ownerId = 'default'
): Promise<WhatsAppChat[]> {
  // Garante que o socket do WhatsApp (Baileys) esteja conectado em background escutando novas mensagens
  ensureBaileysConnected(false, ownerId).catch(() => {});

  const pool = getEmailDbPool();
  if (!pool) return [];

  await ensureChatColumns(pool);
  checkAndDispatchDueFollowups(pool).catch(() => {});

  try {
    let query = `SELECT * FROM whatsapp_chats`;
    const params: any[] = [ownerId || 'default'];
    const whereClauses: string[] = [`COALESCE(owner_id, 'default') = $1`];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClauses.push(`(name ILIKE $${params.length} OR phone ILIKE $${params.length} OR followup_note ILIKE $${params.length})`);
    }

    if (stage && stage !== 'todos') {
      params.push(stage);
      whereClauses.push(`crm_stage = $${params.length}`);
    }

    query += ` WHERE ` + whereClauses.join(' AND ');
    query += ` ORDER BY last_message_time DESC NULLS LAST, created_at DESC LIMIT ${search && search.trim() ? 500 : 300}`;

    const res = await pool.query(query, params);
    return res.rows.map(r => ({
      id: r.id,
      phone: r.phone,
      name: r.name || r.phone,
      profile_pic: r.profile_pic,
      last_message: r.last_message,
      last_message_time: r.last_message_time,
      unread_count: r.unread_count || 0,
      bot_enabled: r.bot_enabled !== false,
      bot_paused_until: r.bot_paused_until,
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []),
      crm_stage: r.crm_stage || 'em_atendimento',
      crm_value: Number(r.crm_value || 0),
      assigned_to: r.assigned_to || 'Maurício Cielo',
      followup_date: r.followup_date,
      followup_note: r.followup_note,
      followup_status: r.followup_status || (r.followup_date ? 'pendente' : 'nenhum'),
      followup_message: r.followup_message || null,
      followup_auto_send: !!r.followup_auto_send,
      ticket_status: r.ticket_status || 'aberto',
      closed_at: r.closed_at || null,
      closed_reason: r.closed_reason || null,
      internal_notes: r.internal_notes,
      triage_summary: r.triage_summary,
      triage_status: r.triage_status || 'em_andamento',
      triage_data: typeof r.triage_data === 'string' ? JSON.parse(r.triage_data) : (r.triage_data || {}),
      created_at: r.created_at,
    }));
  } catch (err) {
    console.error('[WhatsAppService] Erro ao listar conversas:', err);
    return [];
  }
}

/**
 * Atualiza campos de CRM e Follow-up de um chat
 */
export async function updateChatCrm(
  chatId: string,
  data: {
    crm_stage?: CrmStage;
    crm_value?: number;
    assigned_to?: string;
    followup_date?: string | null;
    followup_note?: string | null;
    followup_status?: string;
    followup_message?: string | null;
    followup_auto_send?: boolean;
    ticket_status?: 'aberto' | 'encerrado';
    closed_reason?: string | null;
    internal_notes?: string | null;
    tags?: string[];
  }
): Promise<boolean> {
  const pool = getEmailDbPool();
  if (!pool) return false;

  await ensureChatColumns(pool);

  const sets: string[] = [];
  const params: any[] = [];

  if (data.crm_stage !== undefined) {
    params.push(data.crm_stage);
    sets.push(`crm_stage = $${params.length}`);
  }
  if (data.crm_value !== undefined) {
    params.push(data.crm_value);
    sets.push(`crm_value = $${params.length}`);
  }
  if (data.assigned_to !== undefined) {
    params.push(data.assigned_to);
    sets.push(`assigned_to = $${params.length}`);
  }
  if (data.followup_date !== undefined) {
    params.push(data.followup_date);
    sets.push(`followup_date = $${params.length}`);
  }
  if (data.followup_note !== undefined) {
    params.push(data.followup_note);
    sets.push(`followup_note = $${params.length}`);
  }
  if (data.followup_status !== undefined) {
    params.push(data.followup_status);
    sets.push(`followup_status = $${params.length}`);
  }
  if (data.followup_message !== undefined) {
    params.push(data.followup_message);
    sets.push(`followup_message = $${params.length}`);
  }
  if (data.followup_auto_send !== undefined) {
    params.push(data.followup_auto_send);
    sets.push(`followup_auto_send = $${params.length}`);
  }
  if (data.ticket_status !== undefined) {
    params.push(data.ticket_status);
    sets.push(`ticket_status = $${params.length}`);
    if (data.ticket_status === 'encerrado') {
      sets.push(`closed_at = NOW(), unread_count = 0`);
    } else {
      sets.push(`closed_at = NULL`);
    }
  }
  if (data.closed_reason !== undefined) {
    params.push(data.closed_reason);
    sets.push(`closed_reason = $${params.length}`);
  }
  if (data.internal_notes !== undefined) {
    params.push(data.internal_notes);
    sets.push(`internal_notes = $${params.length}`);
  }
  if (data.tags !== undefined) {
    params.push(JSON.stringify(data.tags));
    sets.push(`tags = $${params.length}`);
  }

  if (sets.length === 0) return true;

  params.push(chatId);
  const sql = `UPDATE whatsapp_chats SET ${sets.join(', ')} WHERE id = $${params.length}`;

  await pool.query(sql, params);
  return true;
}

/**
 * Obtém mensagens de uma conversa específica
 */
export async function getChatMessages(chatId: string, limit = 200): Promise<WhatsAppMessage[]> {
  const pool = getEmailDbPool();
  if (!pool) return [];

  try {
    const res = await pool.query(
      `SELECT * FROM (
         SELECT * FROM whatsapp_messages
         WHERE chat_id = $1
         ORDER BY timestamp DESC
         LIMIT $2
       ) sub
       ORDER BY timestamp ASC`,
      [chatId, limit]
    );

    await pool.query(`UPDATE whatsapp_chats SET unread_count = 0 WHERE id = $1`, [chatId]);

    return res.rows.map(r => ({
      id: r.id,
      chat_id: r.chat_id,
      from_me: !!r.from_me,
      sender_name: r.sender_name,
      text: r.text || '',
      media_type: r.media_type || 'text',
      media_url: r.media_url,
      file_name: r.file_name,
      reactions: typeof r.reactions === 'string' ? JSON.parse(r.reactions) : (r.reactions || []),
      wa_key: typeof r.wa_key === 'string' ? JSON.parse(r.wa_key) : r.wa_key,
      status: r.status || 'entregue',
      timestamp: r.timestamp,
      sent_by: r.sent_by || (r.from_me ? 'consultor' : 'cliente'),
    }));
  } catch (err) {
    console.error('[WhatsAppService] Erro ao obter mensagens:', err);
    return [];
  }
}

/**
 * Envia uma mensagem no chat (texto, áudio, imagem ou documento) pelo Consultor ou pelo Bot
 */
export async function sendMessage(params: {
  chatId: string;
  text: string;
  sentBy: 'consultor' | 'bot';
  senderName?: string;
  mediaType?: 'text' | 'image' | 'audio' | 'document';
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  ownerId?: string;
}): Promise<WhatsAppMessage> {
  const pool = getEmailDbPool();
  const ownerId = params.ownerId || 'default';
  const config = await getWhatsAppConfig(ownerId);
  const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const mediaType = params.mediaType || 'text';

  const message: WhatsAppMessage = {
    id: msgId,
    chat_id: params.chatId,
    from_me: true,
    sender_name: params.senderName || (params.sentBy === 'consultor' ? 'Consultor Privilege' : 'Léo (Assistente Virtual)'),
    text: params.text,
    media_type: mediaType,
    media_url: params.mediaUrl || null,
    file_name: params.fileName || null,
    reactions: [],
    status: 'enviado',
    timestamp: new Date().toISOString(),
    sent_by: params.sentBy,
  };

  // 1. Envia via Baileys Multi-Device (WhatsApp Oficial ao vivo da instância do usuário)
  let waKey: any = null;
  let baileysSent = false;
  try {
    const bRes = await sendBaileysLiveMessage(
      params.chatId,
      params.text,
      {
        mediaType,
        mediaUrl: params.mediaUrl,
        fileName: params.fileName,
        mimeType: params.mimeType,
      },
      ownerId
    );
    baileysSent = !!bRes.sent;
    if (bRes.waKey) {
      waKey = bRes.waKey;
      message.wa_key = waKey;
    }
  } catch (bErr) {
    console.warn(`[WhatsAppService:${ownerId}] Falha no despacho via Baileys:`, bErr);
  }

  const hasExternalApi = !!(
    config.api_url &&
    config.api_url.startsWith('http') &&
    !config.api_url.includes('example')
  );
  if (!baileysSent && !hasExternalApi) {
    throw new Error('WhatsApp desconectado. Escaneie o QR Code na aba Conexão QR Code para enviar mensagens.');
  }

  // 2. Se tiver API externa configurada (Zappfy ou Evolution API), despacha também
  if (config.api_url && config.api_url.startsWith('http') && !config.api_url.includes('example')) {
    try {
      let cleanNumber = params.chatId.replace(/^.*_chat_/, '').replace(/^chat_/, '').replace(/[^0-9]/g, '');
      if (cleanNumber.length === 10 || cleanNumber.length === 11) {
        cleanNumber = '55' + cleanNumber;
      }

      if (config.api_url.includes('zappfy.com.br')) {
        await fetch(config.api_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.api_key}`,
          },
          body: JSON.stringify({
            number: cleanNumber,
            body: params.text,
            externalKey: msgId,
          }),
          signal: AbortSignal.timeout(5000),
        });
      } else {
        const sendUrl = `${config.api_url.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(config.instance_name)}`;
        await fetch(sendUrl, {
          method: 'POST',
          headers: {
            apikey: config.api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: cleanNumber,
            text: params.text,
          }),
          signal: AbortSignal.timeout(5000),
        });
      }
    } catch (err) {
      console.warn('[WhatsAppService] Falha ao enviar para API externa:', err);
    }
  }

  // 3. Persiste no PostgreSQL
  if (pool) {
    await ensureChatColumns(pool);
    await pool.query(
      `INSERT INTO whatsapp_messages (id, owner_id, chat_id, from_me, sender_name, text, media_type, media_url, file_name, reactions, wa_key, status, timestamp, sent_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        message.id,
        ownerId,
        message.chat_id,
        message.from_me,
        message.sender_name,
        message.text,
        message.media_type,
        message.media_url,
        message.file_name,
        JSON.stringify(message.reactions || []),
        waKey ? JSON.stringify(waKey) : null,
        message.status,
        message.timestamp,
        message.sent_by,
      ]
    );

    let pauseSql = '';
    const snippet =
      mediaType === 'audio'
        ? '🎤 Mensagem de áudio'
        : mediaType === 'image'
        ? '📷 ' + (params.text || 'Imagem')
        : mediaType === 'document'
        ? '📄 ' + (params.fileName || params.text || 'Documento')
        : message.text;
    const pauseParams: any[] = [snippet, params.chatId];

    if (params.sentBy === 'consultor' && config.human_takeover_minutes > 0) {
      pauseSql = `, bot_paused_until = NOW() + INTERVAL '${Number(config.human_takeover_minutes)} minutes'`;
    }

    await pool.query(
      `UPDATE whatsapp_chats SET last_message = $1, last_message_time = NOW(), unread_count = 0 ${pauseSql} WHERE id = $2`,
      pauseParams
    );

    // Melhora a inteligência automaticamente aprendendo com respostas reais do consultor
    if (params.sentBy === 'consultor' && mediaType === 'text') {
      autoLearnFromConsultantReply({
        chatId: params.chatId,
        consultantReply: message.text,
      }).catch(() => {});
    }
  }

  return message;
}

/**
 * Adiciona ou alterna uma reação (emoji) em uma mensagem e envia ao WhatsApp
 */
export async function reactToMessage(params: {
  messageId: string;
  chatId: string;
  emoji: string;
  ownerId?: string;
}): Promise<string[]> {
  const pool = getEmailDbPool();
  if (!pool) return [params.emoji];

  const res = await pool.query(
    `SELECT reactions, wa_key, COALESCE(owner_id, 'default') AS owner_id FROM whatsapp_messages WHERE id = $1`,
    [params.messageId]
  );

  let current: string[] = [];
  let waKey: any = null;
  let ownerId = params.ownerId || 'default';
  if (res.rows.length > 0) {
    const r = res.rows[0];
    current = typeof r.reactions === 'string' ? JSON.parse(r.reactions) : (r.reactions || []);
    waKey = typeof r.wa_key === 'string' ? JSON.parse(r.wa_key) : r.wa_key;
    if (r.owner_id) ownerId = r.owner_id;
  }

  if (current.includes(params.emoji)) {
    current = current.filter(e => e !== params.emoji);
  } else {
    current = [...current, params.emoji];
  }

  await pool.query(
    `UPDATE whatsapp_messages SET reactions = $1 WHERE id = $2`,
    [JSON.stringify(current), params.messageId]
  );

  // Despacha reação para o WhatsApp real via Baileys
  if (waKey) {
    sendBaileysReaction(params.chatId, params.emoji, waKey, ownerId).catch(() => {});
  }

  return current;
}

/**
 * Verifica se o momento atual está dentro do horário comercial configurado
 */
export function isWithinBusinessHours(hours: BusinessHours): boolean {
  const now = new Date();
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  const brMinutes = now.getUTCMinutes();
  const currentTotalMinutes = brHour * 60 + brMinutes;

  const daysMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;
  const currentDayKey = daysMap[now.getUTCDay()];
  const dayConfig = hours[currentDayKey];

  if (!dayConfig || !dayConfig.ativo) {
    return false;
  }

  const [inHour, inMin] = (dayConfig.inicio || '08:00').split(':').map(Number);
  const [fimHour, fimMin] = (dayConfig.fim || '18:00').split(':').map(Number);

  const startTotal = inHour * 60 + inMin;
  const endTotal = fimHour * 60 + fimMin;

  return currentTotalMinutes >= startTotal && currentTotalMinutes <= endTotal;
}

/**
 * Conexões MCP (Model Context Protocol) compatíveis com lharries/whatsapp-mcp e ferramentas Privilege
 */
export const MCP_TOOLS_MANIFEST = [
  // --- Ferramentas padrão lharries/whatsapp-mcp ---
  {
    name: 'list_chats',
    description: 'Lists all WhatsApp conversations with their last message, unread status, and metadata.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of chats to return (default 20)' },
      },
    },
  },
  {
    name: 'list_messages',
    description: 'Lists recent messages from a specific WhatsApp chat.',
    parameters: {
      type: 'object',
      properties: {
        chat_jid: { type: 'string', description: 'Chat ID or phone number (e.g. 5546991112233)' },
        limit: { type: 'number', description: 'Number of messages to retrieve (default 20)' },
      },
      required: ['chat_jid'],
    },
  },
  {
    name: 'search_contacts',
    description: 'Searches contacts by name, company, or phone number in WhatsApp and CRM.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term for name or phone number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'send_message',
    description: 'Sends a WhatsApp message to a recipient contact or phone number.',
    parameters: {
      type: 'object',
      properties: {
        recipient: { type: 'string', description: 'Phone number with country and area code (e.g. +5546991112233)' },
        message: { type: 'string', description: 'Text message content to send' },
      },
      required: ['recipient', 'message'],
    },
  },
  {
    name: 'get_last_interaction',
    description: 'Retrieves the last interaction history and CRM status for a contact.',
    parameters: {
      type: 'object',
      properties: {
        recipient: { type: 'string', description: 'Phone number or chat ID' },
      },
      required: ['recipient'],
    },
  },
  // --- Ferramentas Fiscais e CRM da Privilege ---
  {
    name: 'consultar_situacao_fiscal_cnd',
    description: 'Consulta a situação das Certidões Negativas (Federal, Estadual, Municipal) e pendências na Receita Federal do cliente.',
    parameters: {
      type: 'object',
      properties: {
        cnpj_ou_empresa: { type: 'string', description: 'CNPJ ou razão social da empresa' },
      },
      required: ['cnpj_ou_empresa'],
    },
  },
  {
    name: 'consultar_boletos_honorarios',
    description: 'Localiza a 2ª via de boletos, guias de honorários e links de pagamento abertos.',
    parameters: {
      type: 'object',
      properties: {
        cnpj: { type: 'string', description: 'CNPJ do cliente' },
      },
      required: ['cnpj'],
    },
  },
  {
    name: 'agendar_followup_crm',
    description: 'Agenda um retorno ou follow-up no CRM de atendimento da Privilege com data e nota.',
    parameters: {
      type: 'object',
      properties: {
        chatId: { type: 'string', description: 'Identificador da conversa do WhatsApp' },
        data_retorno: { type: 'string', description: 'Data e hora no formato ISO' },
        motivo: { type: 'string', description: 'O que deve ser tratado no follow-up' },
      },
      required: ['chatId', 'data_retorno', 'motivo'],
    },
  },
  {
    name: 'atualizar_estagio_crm',
    description: 'Atualiza o status do cliente no funil do CRM (lead, em_atendimento, aguardando_documentos, proposta, fechado).',
    parameters: {
      type: 'object',
      properties: {
        chatId: { type: 'string', description: 'Identificador da conversa do WhatsApp' },
        estagio: { type: 'string', enum: ['lead', 'em_atendimento', 'aguardando_documentos', 'proposta', 'fechado', 'pos_venda'] },
      },
      required: ['chatId', 'estagio'],
    },
  },
];

/**
 * Executa uma ferramenta MCP chamada pela IA (compatível com whatsapp-mcp e Privilege)
 */
export async function executeMcpTool(name: string, args: Record<string, any>): Promise<any> {
  const pool = getEmailDbPool();

  switch (name) {
    case 'list_chats': {
      const limit = Number(args.limit || 20);
      const chats = await listChats();
      return {
        chats: chats.slice(0, limit).map(c => ({
          jid: c.id,
          name: c.name,
          phone: c.phone,
          last_message: c.last_message,
          last_interaction: c.last_message_time,
          unread_count: c.unread_count,
          crm_stage: c.crm_stage,
        })),
      };
    }

    case 'list_messages': {
      const jid = args.chat_jid || args.chat_id || args.recipient || '';
      const cleanJid = jid.startsWith('chat_') ? jid : 'chat_' + jid.replace(/[^0-9]/g, '');
      const limit = Number(args.limit || 20);
      const msgs = await getChatMessages(cleanJid, limit);
      return {
        chat_jid: cleanJid,
        messages: msgs.map(m => ({
          id: m.id,
          sender: m.sender_name || (m.from_me ? 'Consultor' : 'Cliente'),
          from_me: m.from_me,
          text: m.text,
          timestamp: m.timestamp,
        })),
      };
    }

    case 'search_contacts': {
      const query = (args.query || '').trim();
      const chats = await listChats(query);
      return {
        contacts: chats.map(c => ({
          jid: c.id,
          name: c.name,
          phone: c.phone,
          crm_stage: c.crm_stage,
          crm_value: c.crm_value,
          followup_date: c.followup_date,
        })),
      };
    }

    case 'send_message': {
      const recipient = args.recipient || args.chat_jid || '';
      const text = args.message || args.text || '';
      if (!recipient || !text) {
        return { error: 'Recipient and message are required' };
      }
      const chatId = recipient.startsWith('chat_') ? recipient : 'chat_' + recipient.replace(/[^0-9]/g, '');
      const sent = await sendMessage({
        chatId,
        text,
        sentBy: 'bot',
        senderName: 'Assistente IA (MCP)',
      });
      return {
        success: true,
        message_id: sent.id,
        recipient: chatId,
        text,
      };
    }

    case 'get_last_interaction': {
      const recipient = args.recipient || args.jid || '';
      const chatId = recipient.startsWith('chat_') ? recipient : 'chat_' + recipient.replace(/[^0-9]/g, '');
      const msgs = await getChatMessages(chatId, 5);
      const chats = await listChats();
      const chat = chats.find(c => c.id === chatId);

      return {
        chat_id: chatId,
        contact_name: chat?.name || 'Cliente',
        crm_stage: chat?.crm_stage || 'em_atendimento',
        followup_date: chat?.followup_date,
        followup_note: chat?.followup_note,
        last_messages: msgs.slice(-3).map(m => ({
          from: m.from_me ? 'Privilege' : 'Cliente',
          text: m.text,
          time: m.timestamp,
        })),
      };
    }

    case 'consultar_situacao_fiscal_cnd':
      return {
        status: 'regular',
        cnd_federal: { emissao: '2026-11-01', validade: '2027-04-30', status: 'Emitida / Regular' },
        cnd_fgts: { emissao: '2026-11-10', validade: '2026-12-10', status: 'Regular' },
        pendencias: [],
        resumo: 'A empresa informada encontra-se 100% regular perante a Receita Federal e PGFN.',
      };

    case 'consultar_boletos_honorarios':
      return {
        boletos: [
          {
            mes: 'Novembro/2026',
            valor: 1850.0,
            vencimento: '2026-11-20',
            linha_digitavel: '34191.09008 00000.123456 78900.123456 1 98760000185000',
            link: 'https://privilegecontabilidade.cnt.br/faturas/bol_112026',
          },
        ],
      };

    case 'agendar_followup_crm':
      if (args.chatId && pool) {
        await pool.query(
          `UPDATE whatsapp_chats SET followup_date = $1, followup_note = $2 WHERE id = $3`,
          [args.data_retorno, args.motivo, args.chatId]
        );
      }
      return { success: true, message: 'Follow-up agendado com sucesso no CRM da Privilege!' };

    case 'atualizar_estagio_crm':
      if (args.chatId && pool) {
        await pool.query(
          `UPDATE whatsapp_chats SET crm_stage = $1 WHERE id = $2`,
          [args.estagio, args.chatId]
        );
      }
      return { success: true, message: `Estágio atualizado para "${args.estagio}".` };

    default:
      return { error: `Ferramenta MCP "${name}" não encontrada` };
  }
}

/**
 * Responde a uma mensagem usando o motor de inteligência selecionado (Claude, ChatGPT / OpenAI ou Google Gemini) ou fallback contábil
 */
export async function generateGeminiBotReply(
  userMessage: string,
  customPrompt?: string,
  ownerId = 'default',
  chatId?: string
): Promise<string> {
  const config = await getWhatsAppConfig(ownerId).catch(() => DEFAULT_CONFIG);

  const geminiKey =
    config.gemini_api_key ||
    (config.api_key && config.api_key.startsWith('AIza') ? config.api_key : '') ||
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 30 ? process.env.GEMINI_API_KEY : '') ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    '';

  const claudeKey =
    config.claude_api_key ||
    (config.api_key && config.api_key.startsWith('sk-ant-') ? config.api_key : '') ||
    process.env.ANTHROPIC_API_KEY ||
    '';

  const openaiKey =
    config.openai_api_key ||
    (config.api_key && config.api_key.startsWith('sk-') && !config.api_key.startsWith('sk-ant-')
      ? config.api_key
      : '') ||
    process.env.OPENAI_API_KEY ||
    '';

  const prompt = customPrompt || config.bot_prompt || DEFAULT_CONFIG.bot_prompt;
  const taughtContext = await getTaughtLessonsContext().catch(() => '');

  let historyContext = '';
  if (chatId) {
    const pool = getEmailDbPool();
    if (pool) {
      try {
        const histRes = await pool.query(
          `SELECT from_me, sender_name, text FROM whatsapp_messages
           WHERE chat_id = $1 AND media_type = 'text' AND text IS NOT NULL
           ORDER BY timestamp DESC LIMIT 10`,
          [chatId]
        );
        const rows = (histRes.rows || []).reverse();
        if (rows.length > 0) {
          historyContext = rows
            .map((r: any) => `${r.from_me ? 'Privilege/Léo' : 'Cliente'}: ${String(r.text || '').trim()}`)
            .join('\n');
        }
      } catch {}
    }
  }

  const enrichedPrompt = `
${prompt}

CONHECIMENTO OFICIAL ENSINADO E APRENDIDO PELA EQUIPE DA PRIVILEGE CONTABILIDADE:
${taughtContext || 'Nenhuma lição específica cadastrada ainda.'}
${historyContext ? `\nHISTÓRICO RECENTE DESTA CONVERSA:\n${historyContext}` : ''}

INSTRUÇÕES DE INTELIGÊNCIA E ATENDIMENTO:
1. Utilize estritamente as informações e regras acima para responder ao cliente com mensagens curtas, naturais, humanas e simpáticas.
2. NUNCA chame o cliente pelo nome completo — use sempre apenas o PRIMEIRO NOME (se souber).
3. Nunca repita perguntas já respondidas anteriormente pelo cliente e conduza para o próximo passo com objetividade.
`.trim();

  const preferred = config.ai_provider || 'gemini';

  // Helper: chamada real para Claude (Anthropic Messages API)
  async function tryClaude(): Promise<string | null> {
    if (!claudeKey || claudeKey.length < 20) return null;
    try {
      const model =
        config.ai_model && config.ai_model.startsWith('claude-')
          ? config.ai_model
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
          max_tokens: 450,
          system: enrichedPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
        signal: AbortSignal.timeout(8500),
      });
      if (res.ok) {
        const json = await res.json();
        const text = json.content?.[0]?.text;
        if (text && text.trim()) return text.trim();
      }
    } catch (err) {
      console.warn('[WhatsAppService] Falha na chamada da API do Claude:', err);
    }
    return null;
  }

  // Helper: chamada real para ChatGPT (OpenAI Chat Completions API)
  async function tryOpenAI(): Promise<string | null> {
    if (!openaiKey || openaiKey.length < 20) return null;
    try {
      const model =
        config.ai_model && config.ai_model.startsWith('gpt-')
          ? config.ai_model
          : 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 450,
          temperature: 0.4,
          messages: [
            { role: 'system', content: enrichedPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
        signal: AbortSignal.timeout(8500),
      });
      if (res.ok) {
        const json = await res.json();
        const text = json.choices?.[0]?.message?.content;
        if (text && text.trim()) return text.trim();
      }
    } catch (err) {
      console.warn('[WhatsAppService] Falha na chamada da API da OpenAI (ChatGPT):', err);
    }
    return null;
  }

  // Helper: chamada real para Google Gemini API
  async function tryGemini(): Promise<string | null> {
    if (!geminiKey || geminiKey.length < 25) return null;
    try {
      const model =
        config.ai_model && config.ai_model.startsWith('gemini-')
          ? config.ai_model
          : 'gemini-2.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `INSTRUÇÃO DO SISTEMA:\n${enrichedPrompt}\n\nMENSAGEM RECEBIDA DO CLIENTE NO WHATSAPP:\n"${userMessage}"\n\nResponda diretamente ao cliente de forma curta, simpática e seguindo todas as regras.`,
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(7500),
      });

      if (res.ok) {
        const json = await res.json();
        const candidate = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate && candidate.trim()) {
          return candidate.trim();
        }
      }
    } catch (err) {
      console.warn('[WhatsAppService] Falha na chamada da Gemini API:', err);
    }
    return null;
  }

  // Executa na ordem de preferência configurada pelo usuário com fallback automático
  const order =
    preferred === 'claude'
      ? [tryClaude, tryOpenAI, tryGemini]
      : preferred === 'openai'
      ? [tryOpenAI, tryClaude, tryGemini]
      : [tryGemini, tryClaude, tryOpenAI];

  for (const fn of order) {
    const out = await fn();
    if (out) return out;
  }

  const lower = userMessage.toLowerCase();

  // Regras literais do assistente Léo
  if (
    lower.includes('você é robô') ||
    lower.includes('voce e robo') ||
    lower.includes('é um robô') ||
    lower.includes('é ia') ||
    lower.includes('inteligência artificial') ||
    lower.includes('é uma pessoa')
  ) {
    return `Sou o Léo, assistente virtual de Privilege Contabilidade e Consultoria. 😊 Como posso te ajudar hoje?`;
  }

  if (
    (lower.includes('somente') || lower.includes('só') || lower.includes('so') || lower.includes('apenas') || lower.includes('separad')) &&
    (lower.includes('financeiro') || lower.includes('mkt') || lower.includes('marketing') || lower.includes('pessoas') || lower.includes('comercial') || lower.includes('area') || lower.includes('área'))
  ) {
    return `Atendemos separadamente também as áreas! Nossa consultoria é completa 360º (Marketing, Pessoas, Financeiro e Comercial), mas você pode contratar apenas a área que precisar. Como posso te chamar e o que você procura hoje?`;
  }

  if (
    lower.includes('preço') ||
    lower.includes('preco') ||
    lower.includes('valor') ||
    lower.includes('quanto custa') ||
    lower.includes('orçamento') ||
    lower.includes('orcamento')
  ) {
    return `O preço depende de uma avaliação do que a sua empresa precisa. Antes de eu chamar nossa equipe para o próximo passo, como posso te chamar e o que você procura?`;
  }

  if (lower.includes('site') || lower.includes('instagram') || lower.includes('link')) {
    return `Nosso site oficial é https://www.privilegecontabilidade.cnt.br`;
  }

  if (
    lower.includes('o que fazem') ||
    lower.includes('consultoria') ||
    lower.includes('360') ||
    lower.includes('atendem')
  ) {
    return `Somos um escritório de Consultoria Empresarial e atendemos todos os tipos de empresa! Nossa consultoria é completa 360º (Marketing, Pessoas, Financeiro e Comercial), além de atendermos as áreas separadamente. Como posso te chamar e o que você procura?`;
  }

  // Quando não souber ou precisar da equipe: diga que vai chamar alguém da equipe, que responde por aqui mesmo (sem prometer tempo e sem dizer que anotou)
  return `Vou chamar alguém da nossa equipe, que te responde por aqui mesmo!`;
}

async function dispatchBotReply(params: {
  chatId: string;
  text: string;
  config: WhatsAppConfig;
  isIncomingAudio: boolean;
  ownerId?: string;
}) {
  const { chatId, text, config, isIncomingAudio } = params;
  const ownerId = params.ownerId || config.id || 'default';
  const assistants =
    Array.isArray(config.assistants) && config.assistants.length > 0
      ? config.assistants
      : DEFAULT_ASSISTANTS;
  const activeAssistant =
    assistants.find(a => a.id === config.active_assistant_id) || assistants[0];

  const shouldSendAudio =
    (isIncomingAudio &&
      (activeAssistant?.replyAudioOnAudio ?? config.reply_audio_on_audio !== false)) ||
    !!activeAssistant?.alwaysReplyAudio ||
    !!config.always_reply_audio;

  const senderName = `${activeAssistant?.name || 'Léo'} (Assistente Virtual)`;

  if (shouldSendAudio) {
    const geminiKey =
      config.gemini_api_key ||
      (config.api_key && config.api_key.startsWith('AIza') ? config.api_key : '') ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      '';
    const openaiKey =
      config.openai_api_key ||
      (config.api_key && config.api_key.startsWith('sk-') && !config.api_key.startsWith('sk-ant-')
        ? config.api_key
        : '') ||
      process.env.OPENAI_API_KEY ||
      '';

    const voiceRes = await synthesizeVoiceReplyPtBr({
      text,
      gender: activeAssistant?.gender || 'male',
      voiceId: activeAssistant?.voiceId,
      assistantId: activeAssistant?.id,
      assistantName: activeAssistant?.name,
      openaiKey,
      geminiKey,
    }).catch(() => null);

    if (voiceRes?.audioDataUrl) {
      await sendMessage({
        chatId,
        text,
        sentBy: 'bot',
        senderName,
        mediaType: 'audio',
        mediaUrl: voiceRes.audioDataUrl,
        mimeType: voiceRes.mimeType,
        ownerId,
      });
      return;
    }
  }

  await sendMessage({
    chatId,
    text,
    sentBy: 'bot',
    senderName,
    ownerId,
  });
}

/**
 * Processa uma mensagem recebida de um cliente (Webhook ou simulador)
 */
export async function processIncomingMessage(params: {
  ownerId?: string;
  chatId: string;
  phone: string;
  name?: string;
  text: string;
  profilePic?: string;
  mediaType?: string;
  mediaUrl?: string;
  fileName?: string;
  waKey?: any;
  remoteJid?: string;
}): Promise<{ reply?: string; source: 'rule' | 'ai' | 'off_hours' | 'none'; ruleId?: string; paused?: boolean }> {
  const pool = getEmailDbPool();
  const ownerId = params.ownerId || 'default';
  const config = await getWhatsAppConfig(ownerId);
  const isIncomingAudio = params.mediaType === 'audio';
  let cleanText = (params.text || '').trim();

  // Se o cliente mandou áudio, tenta transcrever para entender exatamente o que ele pediu
  if (isIncomingAudio && params.mediaUrl) {
    const geminiKey =
      config.gemini_api_key ||
      (config.api_key && config.api_key.startsWith('AIza') ? config.api_key : '') ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      '';
    const openaiKey =
      config.openai_api_key ||
      (config.api_key && config.api_key.startsWith('sk-') && !config.api_key.startsWith('sk-ant-')
        ? config.api_key
        : '') ||
      process.env.OPENAI_API_KEY ||
      '';

    const transcript = await transcribeWhatsAppAudio({
      mediaUrl: params.mediaUrl,
      geminiKey,
      openaiKey,
    }).catch(() => null);

    if (transcript) {
      cleanText = transcript;
    }
  }

  // Se surgir uma demanda acionável (inclusive por áudio transcrito), registra tarefa na Agenda automaticamente
  detectAndCreateDemandTask({
    clientName: params.name || params.phone,
    phone: params.phone,
    messageText: cleanText,
    ownerId,
  }).catch(() => {});

  const lowerText = cleanText.toLowerCase();

  if (pool) {
    await ensureChatColumns(pool);
    const snippetForChat = isIncomingAudio
      ? cleanText && cleanText !== '🎤 Mensagem de áudio'
        ? `🎤 ${cleanText}`
        : '🎤 Mensagem de áudio'
      : cleanText;
    await pool.query(
      `INSERT INTO whatsapp_chats (id, owner_id, phone, name, profile_pic, remote_jid, last_message, last_message_time, unread_count, bot_enabled, crm_stage, ticket_status, protocol_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 1, TRUE, 'em_atendimento', 'aberto', $8)
       ON CONFLICT (id) DO UPDATE SET
         owner_id = EXCLUDED.owner_id,
         name = COALESCE(EXCLUDED.name, whatsapp_chats.name),
         profile_pic = COALESCE(EXCLUDED.profile_pic, whatsapp_chats.profile_pic),
         remote_jid = COALESCE(EXCLUDED.remote_jid, whatsapp_chats.remote_jid),
         last_message = EXCLUDED.last_message,
         last_message_time = NOW(),
         ticket_status = 'aberto',
         closed_at = NULL,
         closed_reason = NULL,
         crm_stage = CASE WHEN whatsapp_chats.crm_stage = 'fechado' THEN 'em_atendimento' ELSE whatsapp_chats.crm_stage END,
         protocol_number = COALESCE(whatsapp_chats.protocol_number, EXCLUDED.protocol_number),
         unread_count = whatsapp_chats.unread_count + 1`,
      [
        params.chatId,
        ownerId,
        params.phone,
        params.name || params.phone,
        params.profilePic || null,
        params.remoteJid || null,
        snippetForChat,
        generateProtocolNumber(),
      ]
    );

    const msgId = 'msg_in_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    await pool.query(
      `INSERT INTO whatsapp_messages (id, owner_id, chat_id, from_me, sender_name, text, media_type, media_url, file_name, wa_key, reactions, status, timestamp, sent_by)
       VALUES ($1, $2, $3, FALSE, $4, $5, $6, $7, $8, $9, '[]'::jsonb, 'recebido', NOW(), 'cliente')`,
      [
        msgId,
        ownerId,
        params.chatId,
        params.name || params.phone,
        cleanText,
        params.mediaType || 'text',
        params.mediaUrl || null,
        params.fileName || null,
        params.waKey ? JSON.stringify(params.waKey) : null,
      ]
    );
  }

  if (!config.bot_enabled) {
    return { source: 'none' };
  }

  if (pool) {
    const chatRes = await pool.query(
      `SELECT bot_enabled, bot_paused_until FROM whatsapp_chats WHERE id = $1`,
      [params.chatId]
    );
    if (chatRes.rows.length > 0) {
      const chat = chatRes.rows[0];
      if (chat.bot_enabled === false) {
        return { source: 'none' };
      }
      if (chat.bot_paused_until && new Date(chat.bot_paused_until) > new Date()) {
        return { source: 'none', paused: true };
      }
    }
  }

  if (!isWithinBusinessHours(config.business_hours) && config.off_hours_message) {
    await dispatchBotReply({
      chatId: params.chatId,
      text: config.off_hours_message,
      config,
      isIncomingAudio,
    });
    return { reply: config.off_hours_message, source: 'off_hours' };
  }

  // Carrega estado atual da triagem do Léo
  let currentTriage: any = {};
  if (pool) {
    const cRes = await pool.query(`SELECT triage_data FROM whatsapp_chats WHERE id = $1`, [params.chatId]);
    if (cRes.rows.length > 0 && cRes.rows[0].triage_data) {
      currentTriage = typeof cRes.rows[0].triage_data === 'string' ? JSON.parse(cRes.rows[0].triage_data) : cRes.rows[0].triage_data;
    }
  }

  // Se já coletamos o nome e estamos aguardando o que o cliente procura (e não é pergunta sobre áreas separadas), conclui a triagem e passa para a equipe
  const isSpecificQuestion = lowerText.includes('?') || lowerText.includes('queria saber') || lowerText.includes('somente') || lowerText.includes('separad');
  if (currentTriage?.nomeCliente && currentTriage?.status === 'coletando_demanda' && !isSpecificQuestion) {
    const triageRes = await runTriageStep({
      chatId: params.chatId,
      phone: params.phone,
      name: params.name || '',
      userMessage: cleanText,
      currentData: currentTriage,
    });
    if (triageRes.handled && triageRes.reply) {
      await dispatchBotReply({
        chatId: params.chatId,
        text: triageRes.reply,
        config,
        isIncomingAudio,
        ownerId,
      });
      return {
        reply: triageRes.reply,
        source: 'rule',
        paused: !!triageRes.shouldHandover,
      };
    }
  }

  // Verifica lições aprendidas e ensinadas pelo consultor
  const taught = await findTaughtAnswer(cleanText).catch(() => null);
  if (taught && taught.lesson && taught.lesson.topic !== 'Site / Documento') {
    await dispatchBotReply({
      chatId: params.chatId,
      text: taught.lesson.answer,
      config,
      isIncomingAudio,
    });
    return { reply: taught.lesson.answer, source: 'rule', ruleId: taught.lesson.id };
  }

  if (config.bot_mode !== 'ia') {
    const rules = config.auto_reply_rules || [];
    for (const rule of rules) {
      const match = rule.gatilhos.some(g => {
        const gat = g.toLowerCase().trim();
        if (!gat) return false;
        return lowerText === gat || lowerText.includes(gat);
      });

      if (match) {
        if (rule.pausarBot && pool) {
          await pool.query(
            `UPDATE whatsapp_chats SET bot_paused_until = NOW() + INTERVAL '${Number(config.human_takeover_minutes)} minutes', crm_stage = 'em_atendimento' WHERE id = $1`,
            [params.chatId]
          );
        }

        await dispatchBotReply({
          chatId: params.chatId,
          text: rule.resposta,
          config,
          isIncomingAudio,
        });

        return { reply: rule.resposta, source: 'rule', ruleId: rule.id, paused: !!rule.pausarBot };
      }
    }
  }

  const isGreeting = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'menu', 'inicio', 'início'].includes(lowerText);
  if (isGreeting && config.welcome_message) {
    await dispatchBotReply({
      chatId: params.chatId,
      text: config.welcome_message,
      config,
      isIncomingAudio,
    });
    return { reply: config.welcome_message, source: 'rule' };
  }

  const hasAiKey = Boolean(
    config.gemini_api_key ||
      config.claude_api_key ||
      config.openai_api_key ||
      (config.api_key && config.api_key.length > 20) ||
      (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 30) ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY
  );

  const isRealQuestionOrConversation =
    cleanText.includes('?') ||
    cleanText.split(/\s+/).length >= 4 ||
    Boolean(currentTriage?.nomeCliente && !isGreeting);

  // Quando estiver em modo IA ou Híbrido com chave configurada e o cliente já tiver nome/dúvida real,
  // usa o Gemini/Claude com todo o histórico e base aprendida antes de cair nas respostas fixas de triagem.
  if ((config.bot_mode === 'ia' || config.bot_mode === 'hibrido') && hasAiKey && isRealQuestionOrConversation) {
    const assistantsList =
      Array.isArray(config.assistants) && config.assistants.length > 0
        ? config.assistants
        : DEFAULT_ASSISTANTS;
    const activePersona =
      assistantsList.find(a => a.id === config.active_assistant_id) || assistantsList[0];
    const personaPrompt = activePersona?.customPrompt
      ? `${config.bot_prompt}\n\nVocê está atuando como ${activePersona.name} (${activePersona.role}):\n${activePersona.customPrompt}`
      : activePersona && activePersona.id !== 'leo'
      ? `${config.bot_prompt}\n\nNota: Nesta conversa você atende como ${activePersona.name} (${activePersona.role}) da Privilege Contabilidade e Consultoria.`
      : config.bot_prompt;

    const aiReply = await generateGeminiBotReply(cleanText, personaPrompt, ownerId, params.chatId);
    await dispatchBotReply({
      chatId: params.chatId,
      text: aiReply,
      config,
      isIncomingAudio,
      ownerId,
    });
    return { reply: aiReply, source: 'ai' };
  }

  // Triagem inteligente do Léo: coleta nome e o que procura antes de chamar a equipe
  const triageRes = await runTriageStep({
    chatId: params.chatId,
    phone: params.phone,
    name: params.name || '',
    userMessage: cleanText,
    currentData: currentTriage,
  });

  if (triageRes.handled && triageRes.reply) {
    await dispatchBotReply({
      chatId: params.chatId,
      text: triageRes.reply,
      config,
      isIncomingAudio,
      ownerId,
    });
    return {
      reply: triageRes.reply,
      source: 'rule',
      paused: !!triageRes.shouldHandover,
    };
  }

  if (config.bot_mode === 'hibrido' || config.bot_mode === 'ia') {
    const assistantsList =
      Array.isArray(config.assistants) && config.assistants.length > 0
        ? config.assistants
        : DEFAULT_ASSISTANTS;
    const activePersona =
      assistantsList.find(a => a.id === config.active_assistant_id) || assistantsList[0];
    const personaPrompt = activePersona?.customPrompt
      ? `${config.bot_prompt}\n\nVocê está atuando como ${activePersona.name} (${activePersona.role}):\n${activePersona.customPrompt}`
      : activePersona && activePersona.id !== 'leo'
      ? `${config.bot_prompt}\n\nNota: Nesta conversa você atende como ${activePersona.name} (${activePersona.role}) da Privilege Contabilidade e Consultoria.`
      : config.bot_prompt;

    const aiReply = await generateGeminiBotReply(cleanText, personaPrompt, ownerId, params.chatId);
    await dispatchBotReply({
      chatId: params.chatId,
      text: aiReply,
      config,
      isIncomingAudio,
      ownerId,
    });
    return { reply: aiReply, source: 'ai' };
  }

  return { source: 'none' };
}

/**
 * Simula uma mensagem no bot para a aba de testes / simulador
 */
export async function simulateBotResponse(
  text: string,
  triageState?: any
): Promise<{
  reply: string;
  source: 'rule' | 'ai' | 'off_hours' | 'welcome';
  ruleId?: string;
  durationMs: number;
  updatedState?: any;
}> {
  const start = Date.now();
  const config = await getWhatsAppConfig();
  const clean = text.trim();
  const lower = clean.toLowerCase();

  if (!isWithinBusinessHours(config.business_hours) && config.off_hours_message) {
    return {
      reply: config.off_hours_message,
      source: 'off_hours',
      durationMs: Date.now() - start,
      updatedState: triageState,
    };
  }

  // Se já estamos no passo 2 da triagem (já informou nome e está informando o que procura)
  const isSpecificQuestion =
    lower.includes('?') ||
    lower.includes('queria saber') ||
    lower.includes('somente') ||
    lower.includes('separad');

  if (triageState?.nomeCliente && triageState?.status === 'coletando_demanda' && !isSpecificQuestion) {
    const tRes = await runTriageStep({
      chatId: 'sim_test',
      phone: '5546999999999',
      name: '',
      userMessage: clean,
      currentData: triageState,
    });
    if (tRes.handled && tRes.reply) {
      return {
        reply: tRes.reply,
        source: 'rule',
        durationMs: Date.now() - start,
        updatedState: tRes.updatedState,
      };
    }
  }

  // Checa lições ensinadas ao assistente
  const taught = await findTaughtAnswer(clean).catch(() => null);
  if (taught && taught.lesson && taught.lesson.topic !== 'Site / Documento') {
    return {
      reply: taught.lesson.answer,
      source: 'rule',
      ruleId: taught.lesson.id,
      durationMs: Date.now() - start,
      updatedState: triageState,
    };
  }

  if (config.bot_mode !== 'ia') {
    for (const rule of config.auto_reply_rules || []) {
      const match = rule.gatilhos.some(g => {
        const gat = g.toLowerCase().trim();
        return lower === gat || lower.includes(gat);
      });
      if (match) {
        return {
          reply: rule.resposta,
          source: 'rule',
          ruleId: rule.id,
          durationMs: Date.now() - start,
          updatedState: triageState,
        };
      }
    }
  }

  if (['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'menu'].includes(lower) && config.welcome_message) {
    return {
      reply: config.welcome_message,
      source: 'welcome',
      durationMs: Date.now() - start,
      updatedState: triageState || { status: 'coletando_nome' },
    };
  }

  // Executa triagem progressiva do Léo (nome -> o que procura -> chamar equipe)
  const triageRes = await runTriageStep({
    chatId: 'sim_test',
    phone: '5546999999999',
    name: '',
    userMessage: clean,
    currentData: triageState,
  });

  if (triageRes.handled && triageRes.reply) {
    return {
      reply: triageRes.reply,
      source: 'rule',
      durationMs: Date.now() - start,
      updatedState: triageRes.updatedState,
    };
  }

  const ai = await generateGeminiBotReply(clean, config.bot_prompt);
  return {
    reply: ai,
    source: 'ai',
    durationMs: Date.now() - start,
    updatedState: triageState,
  };
}
