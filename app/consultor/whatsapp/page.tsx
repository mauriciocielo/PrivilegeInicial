'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { WHATSAPP_SHARE_STORAGE_KEY, WhatsAppSharePayload } from '@/lib/whatsapp-share';
import { store } from '@/lib/store';
import './whatsapp.css';
import {
  MessageSquare,
  QrCode,
  Bot,
  Send,
  Phone,
  RefreshCw,
  Clock,
  ShieldCheck,
  Check,
  CheckCheck,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  Search,
  User,
  Power,
  Pause,
  Play,
  Zap,
  Calendar,
  AlertCircle,
  ExternalLink,
  Kanban,
  FileText,
  DollarSign,
  TrendingUp,
  Cpu,
  GraduationCap,
  BookOpen,
  Mic,
  Image as ImageIcon,
  Paperclip,
  Smile,
  Square,
  Download,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface AutoReplyRule {
  id: string;
  gatilhos: string[];
  resposta: string;
  pausarBot?: boolean;
}

interface BusinessDayHours {
  ativo: boolean;
  inicio: string;
  fim: string;
}

interface BusinessHours {
  seg: BusinessDayHours;
  ter: BusinessDayHours;
  qua: BusinessDayHours;
  qui: BusinessDayHours;
  sex: BusinessDayHours;
  sab: BusinessDayHours;
  dom: BusinessDayHours;
}

interface QuickReply {
  id: string;
  titulo: string;
  texto: string;
}

interface WhatsAppConfig {
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
  ai_provider?: 'groq' | 'gemini' | 'claude' | 'openai' | 'ollama';
  ai_model?: string;
  gemini_api_key?: string;
  claude_api_key?: string;
  openai_api_key?: string;
  gemini_mcp_url?: string;
  gemini_mcp_token?: string;
  reply_audio_on_audio?: boolean;
  always_reply_audio?: boolean;
  active_assistant_id?: string;
  assistants?: AssistantPersona[];
}

export interface AssistantPersona {
  id: string;
  name: string;
  role: string;
  gender: 'male' | 'female';
  voiceId: string;
  avatarColor: string;
  replyAudioOnAudio: boolean;
  alwaysReplyAudio: boolean;
  customPrompt?: string;
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
  protocol_number?: string | null;
  closed_at?: string | null;
  closed_reason?: string | null;
  internal_notes?: string | null;
  triage_summary?: string | null;
  triage_status?: string | null;
  triage_data?: any;
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
  status?: string;
  timestamp: string;
  sent_by: 'cliente' | 'consultor' | 'bot' | 'sistema';
}

export interface KnowledgeLesson {
  id: string;
  topic: string;
  question: string;
  answer: string;
  keywords: string[];
  learned_from: string;
  usage_count: number;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✅'];

function getContactAvatarUrl(chat: WhatsAppChat): string {
  if (chat.profile_pic && chat.profile_pic.trim().length > 5) {
    return chat.profile_pic;
  }
  const label = encodeURIComponent(chat.name || chat.phone || 'WA');
  return `https://ui-avatars.com/api/?name=${label}&background=600000&color=fff&bold=true&size=128&font-size=0.4`;
}

export default function WhatsAppPage() {
  const [selectedLine, setSelectedLine] = useState<'1' | '2'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cf_whatsapp_line') === '2' ? '2' : '1';
    }
    return '1';
  });
  const selectedLineRef = useRef<'1' | '2'>(selectedLine);
  selectedLineRef.current = selectedLine;

  function waFetch(input: RequestInfo | URL, init?: RequestInit) {
    const headers = new Headers(init?.headers || {});
    if (selectedLineRef.current === '2') {
      headers.set('x-whatsapp-owner', 'linha2');
    }
    return fetch(input, { ...init, headers });
  }

  function switchWhatsAppLine(line: '1' | '2') {
    if (line === selectedLineRef.current) return;
    selectedLineRef.current = line;
    setSelectedLine(line);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cf_whatsapp_line', line);
    }
    setSelectedChat(null);
    selectedChatIdRef.current = null;
    setMessages([]);
    lastMessagesJsonRef.current = '';
    prevTotalUnreadRef.current = null;
    toast.success(`Alternado para Número ${line}${line === '2' ? ' (Comercial / Extra)' : ' (Principal)'}`);
    loadConfig();
    loadChats(true);
    loadCampaigns();
  }

  const [activeTab, setActiveTab] = useState<
    'inbox' | 'qrcode' | 'bot' | 'crm' | 'knowledge' | 'campaigns'
  >('inbox');
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [lessons, setLessons] = useState<KnowledgeLesson[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [chatFilter, setChatFilter] = useState<
    'abertos' | 'encerrados' | 'followup' | 'todos' | 'unreads' | 'humano' | 'bot' | 'triagem'
  >('abertos');
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Estados para mídias, gravação de áudio e reações
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pendingAttachment, setPendingAttachment] = useState<{
    mediaType: 'image' | 'document' | 'audio';
    mediaUrl: string;
    fileName: string;
    mimeType: string;
    fileSize?: number;
  } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const docUploadRef = useRef<HTMLInputElement>(null);

  // Estados para novo contato modal
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');

  // Estados para agendamento de Follow-up CRM & Encerramento de Chamados
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);
  const [followupTargetChatId, setFollowupTargetChatId] = useState<string>('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupNote, setFollowupNote] = useState('');
  const [followupMessage, setFollowupMessage] = useState('');
  const [followupAutoSend, setFollowupAutoSend] = useState(true);
  const [closeTicketOnFollowup, setCloseTicketOnFollowup] = useState(false);
  const [followupFilter, setFollowupFilter] = useState<'pendentes' | 'atrasados' | 'concluidos' | 'todos'>('pendentes');

  // Estados para criar tarefa na Agenda a partir de demanda
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [agendaTitle, setAgendaTitle] = useState('');
  const [agendaDate, setAgendaDate] = useState('');
  const [agendaHorario, setAgendaHorario] = useState('09:00');
  const [agendaSaving, setAgendaSaving] = useState(false);

  // Estados para Protocolos de Atendimento
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const [protocolSubject, setProtocolSubject] = useState('');
  const [protocolSummary, setProtocolSummary] = useState('');
  const [protocolSendToClient, setProtocolSendToClient] = useState(true);
  const [protocolSaving, setProtocolSaving] = useState(false);

  function openProtocolModalForChat(chat: WhatsAppChat) {
    setProtocolSubject('Atendimento WhatsApp');
    setProtocolSummary(chat.triage_summary || chat.last_message || '');
    setProtocolSendToClient(true);
    setIsProtocolModalOpen(true);
  }

  async function handleSaveProtocol(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedChat) return;
    setProtocolSaving(true);
    try {
      const res = await waFetch('/api/whatsapp/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: selectedChat.id,
          subject: protocolSubject.trim() || 'Atendimento WhatsApp',
          summary: protocolSummary.trim(),
          status: selectedChat.ticket_status === 'encerrado' ? 'encerrado' : 'aberto',
          sendToClient: protocolSendToClient,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Erro ao salvar protocolo');
        return;
      }
      const protNum = data.protocol?.protocol_number;
      if (protNum) {
        setSelectedChat(prev => (prev ? { ...prev, protocol_number: protNum } : prev));
        setChats(prev => prev.map(c => (c.id === selectedChat.id ? { ...c, protocol_number: protNum } : c)));
      }
      toast.success(`Protocolo ${protNum || ''} salvo com sucesso!`);
      setIsProtocolModalOpen(false);
      loadMessages(selectedChat.id, false);
    } catch {
      toast.error('Erro de conexão ao salvar protocolo');
    } finally {
      setProtocolSaving(false);
    }
  }

  function openAgendaModalForChat(chat: WhatsAppChat, customText?: string) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const localDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const nextH = now.getHours() < 8 || now.getHours() >= 17 ? 9 : now.getHours() + 1;
    const baseText = (customText || chat.last_message || '').trim().slice(0, 120);
    setAgendaTitle(`[WhatsApp] ${chat.name || chat.phone}: ${baseText}`);
    setAgendaDate(localDate);
    setAgendaHorario(`${pad(nextH)}:00`);
    setIsAgendaModalOpen(true);
  }

  async function handleSaveAgendaTask(e: React.FormEvent) {
    e.preventDefault();
    if (!agendaTitle.trim() || !selectedChat) return;
    setAgendaSaving(true);
    try {
      const res = await waFetch('/api/whatsapp/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: agendaTitle.trim(),
          dateStr: agendaDate,
          horario: agendaHorario,
          clienteParticipante: selectedChat.name || selectedChat.phone,
          location: 'WhatsApp',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Erro ao criar tarefa na Agenda');
        return;
      }
      if (data.task) {
        const existing = store.getAgendaTasks();
        store.saveAgendaTasks([...existing, data.task]);
      }
      toast.success('Tarefa criada na Agenda com sucesso!');
      setIsAgendaModalOpen(false);
    } catch {
      toast.error('Erro de conexão ao salvar na Agenda');
    } finally {
      setAgendaSaving(false);
    }
  }

  // Estados para Campanhas & Transmissão em Massa (Anti-Banimento)
  const [campName, setCampName] = useState('');
  const [campMessage, setCampMessage] = useState(
    '{Olá|Oi|Tudo bem}, *{primeiro_nome}*! {saudacao}! Aqui é o Léo, da Privilege Consultoria de Francisco Beltrão.\n\nEstamos apoiando empresas da região na montagem do Planejamento Estratégico e Financeiro para 2027. Vocês já definiram as metas de caixa e vendas para o ano novo ou ainda estão fechando este ano?'
  );
  const [campSelectedChatIds, setCampSelectedChatIds] = useState<string[]>([]);
  const [campManualNumbers, setCampManualNumbers] = useState('');
  const [campStageFilter, setCampStageFilter] = useState<string>('todos');
  const [campSafetyPreset, setCampSafetyPreset] = useState<'ultra' | 'equilibrado' | 'rapido'>('ultra');
  const [campMinDelay, setCampMinDelay] = useState(20);
  const [campMaxDelay, setCampMaxDelay] = useState(45);
  const [campBatchSize, setCampBatchSize] = useState(15);
  const [campBatchCooldown, setCampBatchCooldown] = useState(180);
  const [campSimulateTyping, setCampSimulateTyping] = useState(true);
  const [campPersonalizeGreeting, setCampPersonalizeGreeting] = useState(true);
  const [campCloseTicketAfterSend, setCampCloseTicketAfterSend] = useState(true);
  const [campAiRewrite, setCampAiRewrite] = useState(true);
  const [campSkipAlreadySent, setCampSkipAlreadySent] = useState(true);
  const [campMediaType, setCampMediaType] = useState<'text' | 'image' | 'document'>('text');
  const [campMediaUrl, setCampMediaUrl] = useState<string>('');
  const [campFileName, setCampFileName] = useState<string>('');
  const [campMimeType, setCampMimeType] = useState<string>('');
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const campFileRef = useRef<HTMLInputElement>(null);

  // Estados para Ensino do Assistente Virtual (Estúdio do Agente Léo)
  const [isTeachModalOpen, setIsTeachModalOpen] = useState(false);
  const [newKbTopic, setNewKbTopic] = useState('BPO Financeiro');
  const [newKbQuestion, setNewKbQuestion] = useState('');
  const [newKbAnswer, setNewKbAnswer] = useState('');
  const [newKbKeywords, setNewKbKeywords] = useState('');
  const [kbSearch, setKbSearch] = useState('');
  const [kbTopicFilter, setKbTopicFilter] = useState('todos');

  const [leoSection, setLeoSection] = useState<
    'conhecimento' | 'fala' | 'midia' | 'ritmo' | 'humano' | 'vendas' | 'integracoes' | 'ia' | 'config_ia'
  >('conhecimento');
  const [leoMenuSearch, setLeoMenuSearch] = useState('');
  const [learnMode, setLearnMode] = useState<'aprovacao' | 'automatico' | 'desligado'>('aprovacao');
  const [siteUrlInput, setSiteUrlInput] = useState('');
  const [scrapingSite, setScrapingSite] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para nova regra de bot
  const [newGatilhos, setNewGatilhos] = useState('');
  const [newResposta, setNewResposta] = useState('');
  const [newPausarBot, setNewPausarBot] = useState(false);

  // Estados para simulador de bot
  const [simPrompt, setSimPrompt] = useState('');
  const [simPendingFile, setSimPendingFile] = useState<{
    fileName: string;
    mediaType: 'image' | 'document';
    mediaUrl: string;
    fileSize?: number;
  } | null>(null);
  const simFileInputRef = useRef<HTMLInputElement>(null);
  const [simHistory, setSimHistory] = useState<
    Array<{ from: 'user' | 'bot'; text: string; source?: string; durationMs?: number }>
  >([
    {
      from: 'bot',
      text: 'Olá! Sou o assistente de IA da Privilege Contabilidade. O que você me ensinar na aba "Ensinar Assistente", eu aprenderei e responderei na hora!',
    },
  ]);
  const [simLoading, setSimLoading] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesCountRef = useRef<number>(0);
  const prevChatIdRef = useRef<string | null>(null);
  const lastMessagesJsonRef = useRef<string>('');

  const selectedChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedChatIdRef.current = selectedChat?.id || null;
  }, [selectedChat?.id]);

  useEffect(() => {
    loadConfig();
    loadChats();
    loadLessons();
    loadCampaigns();

    // Escuta eventos WebSocket em tempo real disparados pelo Baileys no servidor
    // Em produção os eventos vêm do servidor contínuo do WhatsApp (NEXT_PUBLIC_WHATSAPP_SOCKET_URL).
    const socketUrl = process.env.NEXT_PUBLIC_WHATSAPP_SOCKET_URL;
    const socket = socketUrl ? io(socketUrl, { path: '/socket.io', transports: ['websocket', 'polling'] }) : io();
    socket.on('whatsapp_update', (payload?: { chatId?: string }) => {
      loadChats(false);
      const activeId = selectedChatIdRef.current;
      if (activeId && (!payload?.chatId || payload.chatId === activeId)) {
        loadMessages(activeId, false);
      }
    });
    socket.on('whatsapp_campaign_update', () => {
      loadCampaigns();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadChats(false);
      if (selectedChat) {
        loadMessages(selectedChat.id, false);
      }
      if (activeTab === 'campaigns') {
        loadCampaigns();
      }
    }, 2500);
    const handleWaOpenChat = () => {
      loadChats(false);
    };
    window.addEventListener('waOpenChat', handleWaOpenChat);
    window.addEventListener('waSharePayload', handleWaOpenChat);
    return () => {
      clearInterval(interval);
      window.removeEventListener('waOpenChat', handleWaOpenChat);
      window.removeEventListener('waSharePayload', handleWaOpenChat);
    };
  }, [selectedChat, activeTab]);

  // Polling automático para carregar o QR Code enquanto a aba de conexão estiver aberta
  useEffect(() => {
    if (activeTab !== 'qrcode' || config?.status === 'conectado') return;
    let cancelled = false;

    async function pollQr() {
      try {
        const res = await waFetch(`/api/whatsapp/qrcode?_t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        if (cancelled || !data?.success) return;
        if (data.status === 'conectado') {
          loadConfig();
        } else if (data.qr_code) {
          setConfig(prev => (prev ? { ...prev, qr_code: data.qr_code, status: 'qrcode' } : prev));
        }
      } catch {}
    }

    pollQr();
    const timer = setInterval(pollQr, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeTab, config?.status, selectedLine]);

  // Rola apenas internamente na caixa de mensagens e somente quando mudar de conversa ou chegar nova mensagem
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const chatChanged = selectedChat?.id !== prevChatIdRef.current;
    const newMsgAdded = messages.length > prevMessagesCountRef.current;

    if (chatChanged || newMsgAdded) {
      container.scrollTop = container.scrollHeight;
    }

    prevChatIdRef.current = selectedChat?.id || null;
    prevMessagesCountRef.current = messages.length;
  }, [messages, selectedChat?.id]);

  async function loadConfig() {
    try {
      const res = await waFetch('/api/whatsapp/config', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const chatFilterRef = useRef(chatFilter);
  useEffect(() => {
    chatFilterRef.current = chatFilter;
  }, [chatFilter]);

  // Controle de som de notificação quando chega nova mensagem
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevTotalUnreadRef = useRef<number | null>(null);
  const prevLastChatTimeRef = useRef<Record<string, string>>({});
  const lastSoundPlayedAtRef = useRef<number>(0);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Desbloqueia AudioContext na primeira interação do usuário no navegador
  useEffect(() => {
    function unlockAudio() {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new Ctx();
        }
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => { });
        }
      } catch { }
    }
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  function playNotificationSound(force = false) {
    if (!soundEnabledRef.current && !force) return;
    const now = Date.now();
    if (!force && now - lastSoundPlayedAtRef.current < 1200) return;
    lastSoundPlayedAtRef.current = now;

    try {
      if (force && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => { });
      }

      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => { });
      }

      const playTone = (freq: number, startOffset: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
        gain.gain.setValueAtTime(0.001, ctx.currentTime + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + startOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startOffset);
        osc.stop(ctx.currentTime + startOffset + duration + 0.02);
      };

      // Toque duplo estilo notificação WhatsApp (Mi5 -> Lá5)
      playTone(659.25, 0, 0.16);
      playTone(880.0, 0.14, 0.24);
    } catch { }
  }

  async function loadChats(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const res = await waFetch('/api/whatsapp/chats', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.chats)) {
        const incomingChats: WhatsAppChat[] = data.chats;

        // Verifica se chegou nova mensagem em alguma conversa após o carregamento inicial
        const totalUnread = incomingChats.reduce((acc, c) => acc + (c.unread_count || 0), 0);
        const hasNewUnread =
          prevTotalUnreadRef.current !== null && totalUnread > prevTotalUnreadRef.current;

        let hasNewActivityInOtherChat = false;
        if (prevTotalUnreadRef.current !== null) {
          for (const c of incomingChats) {
            const prevTime = prevLastChatTimeRef.current[c.id];
            if (c.last_message_time && prevTime && c.last_message_time !== prevTime && c.unread_count > 0) {
              hasNewActivityInOtherChat = true;
              break;
            }
          }
        }
        prevTotalUnreadRef.current = totalUnread;
        const timeMap: Record<string, string> = {};
        for (const c of incomingChats) {
          if (c.last_message_time) timeMap[c.id] = c.last_message_time;
        }
        prevLastChatTimeRef.current = timeMap;

        if (hasNewUnread || hasNewActivityInOtherChat) {
          playNotificationSound();
        }

        setChats(incomingChats);
        const rawShare =
          typeof window !== 'undefined' ? sessionStorage.getItem(WHATSAPP_SHARE_STORAGE_KEY) : null;
        if (rawShare) {
          sessionStorage.removeItem(WHATSAPP_SHARE_STORAGE_KEY);
          try {
            const sharePayload: WhatsAppSharePayload = JSON.parse(rawShare);
            setActiveTab('inbox');
            let targetChat: WhatsAppChat | undefined;
            const targetDigits = (sharePayload.phone || '').replace(/\D/g, '');
            if (targetDigits) {
              const tail = targetDigits.slice(-8);
              targetChat = incomingChats.find((c: WhatsAppChat) => {
                const cDigits = (c.phone || '').replace(/\D/g, '');
                return cDigits === targetDigits || (tail.length >= 8 && cDigits.endsWith(tail));
              });
              if (!targetChat) {
                const createRes = await waFetch('/api/whatsapp/chats', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'create_chat',
                    phone: targetDigits,
                    name: sharePayload.name || targetDigits,
                  }),
                });
                const createData = await createRes.json();
                if (createData.success && createData.chat) {
                  targetChat = createData.chat;
                  setChats((prev) => [createData.chat, ...prev.filter((x) => x.id !== createData.chat.id)]);
                }
              }
            } else if (incomingChats.length > 0) {
              targetChat =
                incomingChats.find((c: WhatsAppChat) => c.id === selectedChatIdRef.current) ||
                incomingChats.find((c: WhatsAppChat) => (c.ticket_status || 'aberto') === 'aberto') ||
                incomingChats[0];
            }

            if (targetChat) {
              await selectChat(targetChat);
            }
            if (sharePayload.text) {
              setMessageInput(sharePayload.text);
            }
            if (sharePayload.attachment) {
              setPendingAttachment({
                mediaType: sharePayload.attachment.mediaType,
                mediaUrl: sharePayload.attachment.dataUrl,
                fileName: sharePayload.attachment.fileName,
                mimeType: sharePayload.attachment.mimeType || 'application/octet-stream',
              });
            }
            if (!targetDigits) {
              toast.success('Conteúdo carregado! Escolha o contato na lista ou clique em + para enviar.');
              if (!targetChat) setIsNewChatModalOpen(true);
            }
            return;
          } catch { }
        }

        const pendingOpenId =
          typeof window !== 'undefined' ? sessionStorage.getItem('wa_open_chat_id') : null;
        if (pendingOpenId) {
          const targetChat = incomingChats.find((c: WhatsAppChat) => c.id === pendingOpenId);
          if (targetChat) {
            sessionStorage.removeItem('wa_open_chat_id');
            setActiveTab('inbox');
            selectChat(targetChat);
            return;
          }
        }
        const activeId = selectedChatIdRef.current;
        const currentFilter = chatFilterRef.current;

        if (!activeId) {
          if (currentFilter === 'encerrados') {
            const firstClosed = incomingChats.find(
              (c: WhatsAppChat) => c.ticket_status === 'encerrado'
            );
            if (firstClosed) selectChat(firstClosed);
          } else {
            const firstOpen = incomingChats.find(
              (c: WhatsAppChat) => (c.ticket_status || 'aberto') === 'aberto'
            );
            if (firstOpen) selectChat(firstOpen);
          }
        } else {
          const freshSelected = incomingChats.find((c: WhatsAppChat) => c.id === activeId);
          if (freshSelected) {
            if (
              freshSelected.ticket_status === 'encerrado' &&
              currentFilter !== 'encerrados' &&
              currentFilter !== 'todos'
            ) {
              const nextOpen = incomingChats.find(
                (c: WhatsAppChat) => (c.ticket_status || 'aberto') === 'aberto'
              );
              if (nextOpen) {
                selectChat(nextOpen);
              } else {
                setSelectedChat(null);
                selectedChatIdRef.current = null;
                setMessages([]);
              }
            } else {
              setSelectedChat(freshSelected);
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function loadLessons() {
    try {
      const res = await waFetch('/api/whatsapp/knowledge', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.lessons)) {
        setLessons(data.lessons);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadCampaigns() {
    try {
      const res = await waFetch('/api/whatsapp/campaigns', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.campaigns)) {
        setCampaigns(data.campaigns);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function applySafetyPreset(preset: 'ultra' | 'equilibrado' | 'rapido') {
    setCampSafetyPreset(preset);
    if (preset === 'ultra') {
      setCampMinDelay(20);
      setCampMaxDelay(45);
      setCampBatchSize(15);
      setCampBatchCooldown(180);
      setCampSimulateTyping(true);
      setCampPersonalizeGreeting(true);
    } else if (preset === 'equilibrado') {
      setCampMinDelay(12);
      setCampMaxDelay(25);
      setCampBatchSize(25);
      setCampBatchCooldown(120);
      setCampSimulateTyping(true);
      setCampPersonalizeGreeting(true);
    } else {
      setCampMinDelay(6);
      setCampMaxDelay(14);
      setCampBatchSize(35);
      setCampBatchCooldown(60);
      setCampSimulateTyping(true);
      setCampPersonalizeGreeting(true);
    }
  }

  async function handleCampaignMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const isImg = file.type.startsWith('image/');
      setCampMediaType(isImg ? 'image' : 'document');
      setCampMediaUrl(dataUrl);
      setCampFileName(file.name);
      setCampMimeType(file.type);
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = '';
    }
  }

  async function handleCreateCampaign(e: React.FormEvent, startImmediately = true) {
    e.preventDefault();
    if (!campName.trim() || !campMessage.trim() || creatingCampaign) return;

    const recipientsList: Array<{ name: string; phone: string; chatId?: string }> = [];

    // 1. Contatos selecionados da lista do CRM/WhatsApp
    for (const chatId of campSelectedChatIds) {
      const c = chats.find(item => item.id === chatId);
      if (c) {
        recipientsList.push({
          name: c.name,
          phone: c.phone,
          chatId: c.id,
        });
      }
    }

    // 2. Contatos colados manualmente (ex: "Nome, 46999998888" ou "46999998888")
    if (campManualNumbers.trim()) {
      const lines = campManualNumbers
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);
      for (const line of lines) {
        if (line.includes(',') || line.includes(';')) {
          const sep = line.includes(',') ? ',' : ';';
          const parts = line.split(sep).map(p => p.trim());
          const firstDigits = parts[0].replace(/[^0-9]/g, '');
          if (firstDigits.length >= 10) {
            recipientsList.push({ phone: parts[0], name: parts[1] || parts[0] });
          } else {
            recipientsList.push({ name: parts[0], phone: parts[1] || '' });
          }
        } else {
          recipientsList.push({ name: line, phone: line });
        }
      }
    }

    if (recipientsList.length === 0) {
      alert('Selecione pelo menos 1 contato da lista ou cole os números para transmissão.');
      return;
    }

    setCreatingCampaign(true);
    try {
      const res = await waFetch('/api/whatsapp/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: campName.trim(),
          message_template: campMessage,
          media_type: campMediaUrl ? campMediaType : 'text',
          media_url: campMediaUrl || null,
          file_name: campFileName || null,
          mime_type: campMimeType || null,
          anti_ban_config: {
            minDelaySec: Number(campMinDelay) || 15,
            maxDelaySec: Number(campMaxDelay) || 35,
            batchSize: Number(campBatchSize) || 20,
            batchCooldownSec: Number(campBatchCooldown) || 120,
            simulateTyping: campSimulateTyping,
            personalizeGreeting: campPersonalizeGreeting,
            closeTicketAfterSend: campCloseTicketAfterSend,
            aiRewritePerLead: campAiRewrite,
          },
          recipients: recipientsList,
          startImmediately,
          skipAlreadySent: campSkipAlreadySent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCampName('');
        setCampManualNumbers('');
        setCampMediaUrl('');
        setCampFileName('');
        setCampMediaType('text');
        await loadCampaigns();
        if (data.skipped_duplicates_count > 0) {
          alert(
            `Campanha criada com ${data.campaign?.total_count || 0} contato(s) novo(s)! ${data.skipped_duplicates_count} número(s) já haviam recebido envio em campanhas anteriores e foram pulados automaticamente.`
          );
        }
      } else {
        alert(data.error || 'Erro ao criar campanha');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingCampaign(false);
    }
  }

  async function handleCampaignAction(
    campaignId: string,
    action: 'start' | 'pause' | 'cancel' | 'delete'
  ) {
    if (action === 'delete' && !confirm('Deseja excluir esta campanha do histórico?')) return;
    try {
      await waFetch('/api/whatsapp/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, campaignId }),
      });
      await loadCampaigns();
    } catch (err) {
      console.error(err);
    }
  }

  async function selectChat(chat: WhatsAppChat) {
    setSelectedChat(chat);
    selectedChatIdRef.current = chat.id;
    lastMessagesJsonRef.current = '';
    setPendingAttachment(null);
    loadMessages(chat.id, true);
    waFetch('/api/whatsapp/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', chatId: chat.id }),
    }).catch(() => { });
  }

  async function loadMessages(chatId: string, showLoading = true) {
    try {
      const res = await fetch(
        `/api/whatsapp/messages?chatId=${encodeURIComponent(chatId)}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        const serialized = JSON.stringify(data.messages);
        if (showLoading || serialized !== lastMessagesJsonRef.current) {
          const hadPrevious = Boolean(lastMessagesJsonRef.current);
          const lastMsg = data.messages[data.messages.length - 1];
          if (!showLoading && hadPrevious && lastMsg && !lastMsg.from_me) {
            playNotificationSound();
          }
          lastMessagesJsonRef.current = serialized;
          setMessages(data.messages);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedChat || sending) return;
    if (!messageInput.trim() && !pendingAttachment) return;

    const textInput = messageInput.trim();
    const attachment = pendingAttachment;

    setMessageInput('');
    setPendingAttachment(null);
    setSending(true);

    try {
      const finalText = attachment
        ? textInput ||
        (attachment.mediaType === 'image'
          ? '📷 Imagem'
          : attachment.mediaType === 'audio'
            ? '🎤 Mensagem de áudio'
            : `📄 ${attachment.fileName}`)
        : textInput;

      const res = await waFetch('/api/whatsapp/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: selectedChat.id,
          text: finalText,
          sentBy: 'consultor',
          mediaType: attachment ? attachment.mediaType : 'text',
          mediaUrl: attachment ? attachment.mediaUrl : undefined,
          fileName: attachment ? attachment.fileName : undefined,
          mimeType: attachment ? attachment.mimeType : undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setMessages(prev => [...prev, data.message]);
        loadChats(false);
      } else {
        toast.error(data.error || 'Não foi possível enviar a mensagem.');
        if (textInput) setMessageInput(textInput);
        if (attachment) setPendingAttachment(attachment);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro de conexão ao enviar mensagem.');
      if (textInput) setMessageInput(textInput);
      if (attachment) setPendingAttachment(attachment);
    } finally {
      setSending(false);
    }
  }

  async function handleMediaSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    mediaType: 'image' | 'document'
  ) {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Mantém o anexo na tela para o usuário conferir antes de clicar em Enviar
      setPendingAttachment({
        mediaType,
        mediaUrl: dataUrl,
        fileName: file.name,
        mimeType: file.type || (mediaType === 'image' ? 'image/jpeg' : 'application/octet-stream'),
        fileSize: file.size,
      });
    } catch (err) {
      console.error('Erro ao preparar mídia:', err);
    } finally {
      e.target.value = '';
    }
  }

  async function startAudioRecording() {
    if (!selectedChat) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = ev => {
        if (ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      alert('Permissão de microfone necessária para gravar áudio.');
      console.error(err);
    }
  }

  function cancelAudioRecording() {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      } catch { }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecordingAudio(false);
    setRecordingSeconds(0);
  }

  async function finishAndSendAudio() {
    if (!mediaRecorderRef.current || !selectedChat) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      try {
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        recorder.stream.getTracks().forEach(t => t.stop());

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });

        // Coloca o áudio gravado na área de conferência para ouvir antes de enviar
        setPendingAttachment({
          mediaType: 'audio',
          mediaUrl: dataUrl,
          fileName: `Audio_${new Date().toLocaleTimeString('pt-BR').replace(/:/g, '-')}.webm`,
          mimeType,
          fileSize: audioBlob.size,
        });
      } catch (err) {
        console.error('Erro ao preparar áudio:', err);
      } finally {
        setIsRecordingAudio(false);
        setRecordingSeconds(0);
      }
    };

    recorder.stop();
  }

  async function handleReactMessage(messageId: string, emoji: string) {
    if (!selectedChat) return;
    setActiveReactionMsgId(null);

    try {
      const res = await waFetch('/api/whatsapp/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'react',
          messageId,
          chatId: selectedChat.id,
          emoji,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.reactions)) {
        setMessages(prev =>
          prev.map(m => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    } catch (err) {
      console.error('Erro ao reagir:', err);
    }
  }

  async function handleTeachSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newKbQuestion.trim() || !newKbAnswer.trim()) return;

    try {
      const res = await waFetch('/api/whatsapp/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'teach',
          topic: newKbTopic,
          question: newKbQuestion.trim(),
          answer: newKbAnswer.trim(),
          keywords: newKbKeywords
            .split(',')
            .map(k => k.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewKbQuestion('');
        setNewKbAnswer('');
        setNewKbKeywords('');
        setIsTeachModalOpen(false);
        await loadLessons();
        alert('Lição ensinada com sucesso! O assistente já aprendeu esta resposta.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteLesson(id: string) {
    if (!confirm('Deseja excluir este item de conhecimento?')) return;
    try {
      await waFetch('/api/whatsapp/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      loadLessons();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleScrapeSite(e: React.FormEvent) {
    e.preventDefault();
    if (!siteUrlInput.trim() || scrapingSite) return;
    setScrapingSite(true);
    try {
      const res = await waFetch('/api/whatsapp/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scrape_url', url: siteUrlInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSiteUrlInput('');
        await loadLessons();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScrapingSite(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await waFetch('/api/whatsapp/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload_doc',
          fileName: file.name,
          content: text || `Documento ${file.name} adicionado à base do Léo.`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadLessons();
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleOpenTeachForQuestion(clientQuestion: string) {
    setNewKbQuestion(clientQuestion);
    setNewKbAnswer('');
    setIsTeachModalOpen(true);
  }

  async function handleUpdateCrmStage(chatId: string, stage: CrmStage) {
    try {
      const res = await waFetch('/api/whatsapp/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_crm', chatId, crm_stage: stage }),
      });
      const data = await res.json();
      if (data.success) {
        setChats(prev => prev.map(c => (c.id === chatId ? { ...c, crm_stage: stage } : c)));
        if (selectedChat?.id === chatId) {
          setSelectedChat(prev => (prev ? { ...prev, crm_stage: stage } : null));
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  function toLocalInputDateTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  }

  function applyFollowupPresetHours(hoursFromNow: number) {
    const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
    setFollowupDate(toLocalInputDateTime(d));
  }

  function handleOpenFollowupModal(chat?: WhatsAppChat | null, shouldCloseTicket = false) {
    const target = chat || selectedChat || chats[0] || null;
    if (!target) return;
    setFollowupTargetChatId(target.id);
    if (target.followup_date) {
      setFollowupDate(toLocalInputDateTime(new Date(target.followup_date)));
    } else {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
      setFollowupDate(toLocalInputDateTime(tomorrow));
    }
    setFollowupNote(target.followup_note || '');
    setFollowupMessage(
      target.followup_message ||
      `Olá, ${target.name}! 😊 Tudo bem? Passando para acompanhar nosso atendimento aqui na Privilege Contabilidade e Consultoria. Ficou alguma dúvida ou podemos avançar?`
    );
    setFollowupAutoSend(target.followup_auto_send !== undefined ? !!target.followup_auto_send : true);
    setCloseTicketOnFollowup(shouldCloseTicket);
    setIsFollowupModalOpen(true);
  }

  async function handleSaveFollowup(e: React.FormEvent) {
    e.preventDefault();
    const targetId = followupTargetChatId || selectedChat?.id;
    if (!targetId || !followupDate) return;

    const isoDate = new Date(followupDate).toISOString();

    try {
      const res = await waFetch('/api/whatsapp/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: closeTicketOnFollowup ? 'close_ticket' : 'update_crm',
          chatId: targetId,
          closed_reason: 'Encerrado com Follow-up agendado',
          followup_date: isoDate,
          followup_note: followupNote.trim(),
          followup_message: followupMessage.trim(),
          followup_auto_send: followupAutoSend,
          followup_status: 'pendente',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsFollowupModalOpen(false);
        await loadChats(false);
        if (selectedChat?.id === targetId) {
          setSelectedChat(prev =>
            prev
              ? {
                ...prev,
                followup_date: isoDate,
                followup_note: followupNote.trim(),
                followup_message: followupMessage.trim(),
                followup_auto_send: followupAutoSend,
                followup_status: 'pendente',
                ticket_status: closeTicketOnFollowup ? 'encerrado' : prev.ticket_status,
              }
              : null
          );
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSendFollowupNow(chatId: string, customText?: string) {
    try {
      const res = await waFetch('/api/whatsapp/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_followup_now',
          chatId,
          text: customText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (selectedChat?.id === chatId && data.message) {
          setMessages(prev => [...prev, data.message]);
        }
        await loadChats(false);
        setIsFollowupModalOpen(false);
      }
    } catch (err) {
      console.error('Erro ao disparar follow-up:', err);
    }
  }

  async function handleCompleteFollowup(chatId: string) {
    try {
      const res = await waFetch('/api/whatsapp/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_followup',
          chatId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChats(prev =>
          prev.map(c => (c.id === chatId ? { ...c, followup_status: 'concluido' } : c))
        );
        if (selectedChat?.id === chatId) {
          setSelectedChat(prev => (prev ? { ...prev, followup_status: 'concluido' } : null));
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCloseTicket(chatId: string, reason = 'Atendimento concluído') {
    try {
      const res = await waFetch('/api/whatsapp/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close_ticket',
          chatId,
          closed_reason: reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChats(prev => {
          const updated = prev.map(c =>
            c.id === chatId
              ? {
                ...c,
                ticket_status: 'encerrado' as const,
                crm_stage: 'fechado' as CrmStage,
                unread_count: 0,
                bot_paused_until: null,
              }
              : c
          );

          // Se encerrou a conversa que estava aberta na tela (e não estamos na aba de Fechados), remove ela da tela imediatamente
          if (selectedChatIdRef.current === chatId && chatFilterRef.current !== 'encerrados') {
            const nextOpen = updated.find(
              c => c.id !== chatId && (c.ticket_status || 'aberto') === 'aberto'
            );
            if (nextOpen) {
              selectChat(nextOpen);
            } else {
              setSelectedChat(null);
              selectedChatIdRef.current = null;
              setMessages([]);
            }
          } else if (selectedChatIdRef.current === chatId) {
            setSelectedChat(prevSel =>
              prevSel ? { ...prevSel, ticket_status: 'encerrado', crm_stage: 'fechado' } : null
            );
          }
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleReopenTicket(chatId: string) {
    try {
      const res = await waFetch('/api/whatsapp/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reopen_ticket',
          chatId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChats(prev =>
          prev.map(c =>
            c.id === chatId
              ? {
                ...c,
                ticket_status: 'aberto',
                crm_stage: c.crm_stage === 'fechado' ? 'em_atendimento' : c.crm_stage,
              }
              : c
          )
        );
        if (selectedChat?.id === chatId) {
          setSelectedChat(prev =>
            prev
              ? {
                ...prev,
                ticket_status: 'aberto',
                crm_stage: prev.crm_stage === 'fechado' ? 'em_atendimento' : prev.crm_stage,
              }
              : null
          );
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCloseAllOpenTickets() {
    const openChats = chats.filter(c => (c.ticket_status || 'aberto') === 'aberto');
    if (openChats.length === 0) return;
    if (
      !confirm(
        `Deseja encerrar todos os ${openChats.length} chamados em aberto? Eles sairão da tela inicial e irão para a aba "Fechados".`
      )
    ) {
      return;
    }

    try {
      const res = await waFetch('/api/whatsapp/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close_all_tickets',
          chatIds: openChats.map(c => c.id),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedChat(null);
        selectedChatIdRef.current = null;
        setMessages([]);
        await loadChats(false);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleToggleBot(chatId: string, currentStatus: boolean) {
    try {
      const res = await waFetch('/api/whatsapp/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_bot',
          chatId,
          bot_enabled: !currentStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChats(prev =>
          prev.map(c => (c.id === chatId ? { ...c, bot_enabled: !currentStatus } : c))
        );
        if (selectedChat?.id === chatId) {
          setSelectedChat(prev => (prev ? { ...prev, bot_enabled: !currentStatus } : null));
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handlePauseBot(chatId: string, minutes = 30) {
    try {
      const res = await waFetch('/api/whatsapp/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause_bot', chatId, minutes }),
      });
      const data = await res.json();
      if (data.success) {
        const until = new Date(Date.now() + minutes * 60000).toISOString();
        setChats(prev =>
          prev.map(c => (c.id === chatId ? { ...c, bot_paused_until: until } : c))
        );
        if (selectedChat?.id === chatId) {
          setSelectedChat(prev => (prev ? { ...prev, bot_paused_until: until } : null));
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleResumeBot(chatId: string) {
    try {
      const res = await waFetch('/api/whatsapp/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume_bot', chatId }),
      });
      const data = await res.json();
      if (data.success) {
        setChats(prev =>
          prev.map(c => (c.id === chatId ? { ...c, bot_paused_until: null, bot_enabled: true } : c))
        );
        if (selectedChat?.id === chatId) {
          setSelectedChat(prev => (prev ? { ...prev, bot_paused_until: null, bot_enabled: true } : null));
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRefreshQR() {
    try {
      const res = await waFetch('/api/whatsapp/qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      const data = await res.json();
      if (data.success && data.qr_code) {
        setConfig(prev => (prev ? { ...prev, qr_code: data.qr_code, status: 'qrcode' } : null));
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSimulateConnect() {
    try {
      const res = await waFetch('/api/whatsapp/qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate_connect' }),
      });
      const data = await res.json();
      if (data.success) {
        loadConfig();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Deseja realmente desconectar o WhatsApp desta sessão?')) return;
    try {
      const res = await waFetch('/api/whatsapp/qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      const data = await res.json();
      if (data.success) {
        loadConfig();
      }
    } catch (err) {
      console.error(err);
    }
  }

  const [savedBadge, setSavedBadge] = useState(false);
  const [simTriageState, setSimTriageState] = useState<any>(null);
  const [aiConfigInstruction, setAiConfigInstruction] = useState('');
  const [understandAudio, setUnderstandAudio] = useState(true);
  const [understandImages, setUnderstandImages] = useState(true);
  const [replyWithVoice, setReplyWithVoice] = useState(false);
  const [shortMessages, setShortMessages] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState(true);
  const [testingAiProvider, setTestingAiProvider] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);
  const [isNewAssistantOpen, setIsNewAssistantOpen] = useState(false);
  const [newAstName, setNewAstName] = useState('');
  const [newAstRole, setNewAstRole] = useState('Assistente Virtual de Voz & Atendimento');
  const [newAstGender, setNewAstGender] = useState<'female' | 'male'>('female');
  const [newAstPrompt, setNewAstPrompt] = useState('');
  const [newAstReplyAudioOnAudio, setNewAstReplyAudioOnAudio] = useState(true);
  const [newAstAlwaysAudio, setNewAstAlwaysAudio] = useState(false);

  async function handleCreateAssistant(e: React.FormEvent) {
    e.preventDefault();
    if (!newAstName.trim()) return;
    const currentList: AssistantPersona[] =
      config?.assistants && config.assistants.length > 0
        ? config.assistants
        : [
          {
            id: 'leo',
            name: 'Léo',
            role: 'Atendente Comercial & Triagem 360º',
            gender: 'male',
            voiceId: 'onyx',
            avatarColor: '#600000',
            replyAudioOnAudio: true,
            alwaysReplyAudio: false,
          },
          {
            id: 'clara',
            name: 'Clara',
            role: 'Assistente Executiva de Voz & Relacionamento',
            gender: 'female',
            voiceId: 'nova',
            avatarColor: '#0f766e',
            replyAudioOnAudio: true,
            alwaysReplyAudio: false,
          },
        ];

    const newItem: AssistantPersona = {
      id: 'ast_' + Date.now(),
      name: newAstName.trim(),
      role: newAstRole.trim() || 'Assistente Virtual Privilege',
      gender: newAstGender,
      voiceId: newAstGender === 'female' ? 'nova' : 'onyx',
      avatarColor: newAstGender === 'female' ? '#0f766e' : '#600000',
      replyAudioOnAudio: newAstReplyAudioOnAudio,
      alwaysReplyAudio: newAstAlwaysAudio,
      customPrompt: newAstPrompt.trim() || undefined,
    };

    const updatedList = [...currentList, newItem];
    await handleSaveConfig({
      assistants: updatedList,
      active_assistant_id: newItem.id,
      reply_audio_on_audio: newItem.replyAudioOnAudio,
      always_reply_audio: newItem.alwaysReplyAudio,
    });
    setNewAstName('');
    setNewAstPrompt('');
    setIsNewAssistantOpen(false);
  }

  async function handleTestAiConnection(updates?: Partial<WhatsAppConfig>) {
    setTestingAiProvider(true);
    setAiTestResult(null);
    try {
      const mergedUpdates = updates || {
        ai_provider: config?.ai_provider,
        ai_model: config?.ai_model,
        claude_api_key: config?.claude_api_key,
        openai_api_key: config?.openai_api_key,
        gemini_api_key: config?.gemini_api_key,
      };
      const res = await waFetch('/api/whatsapp/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_ai_connection',
          configUpdates: mergedUpdates,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiTestResult(`✅ Conectado (${data.durationMs}ms): "${data.reply}"`);
        loadConfig();
      } else {
        setAiTestResult(`❌ Erro ao testar conexão: ${data.error || 'Falha'}`);
      }
    } catch (err: any) {
      setAiTestResult(`❌ Falha ao testar: ${err?.message || 'Erro de rede'}`);
    } finally {
      setTestingAiProvider(false);
    }
  }

  async function handleSaveConfig(updates: Partial<WhatsAppConfig>) {
    try {
      setConfig(prev => (prev ? { ...prev, ...updates } : null));
      const res = await waFetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setSavedBadge(true);
        setTimeout(() => setSavedBadge(false), 2500);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleApplyAiConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!aiConfigInstruction.trim() || !config) return;
    const instruction = aiConfigInstruction.trim();
    setAiConfigInstruction('');

    const updatedPrompt = `${config.bot_prompt}\n\n<<<dono (Ajuste adicionado)\n${instruction}\ndono>>>`;
    await handleSaveConfig({ bot_prompt: updatedPrompt });

    // Também registra na base de conhecimento para aplicação imediata
    await waFetch('/api/whatsapp/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'teach',
        topic: 'Geral',
        question: instruction.slice(0, 80),
        answer: instruction,
      }),
    }).catch(() => { });
    await loadLessons();
  }

  async function handleCreateNewChat(e: React.FormEvent) {
    e.preventDefault();
    if (!newChatPhone.trim()) return;

    try {
      const res = await waFetch('/api/whatsapp/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_chat',
          phone: newChatPhone.trim(),
          name: newChatName.trim() || newChatPhone.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.chat) {
        setIsNewChatModalOpen(false);
        setNewChatPhone('');
        setNewChatName('');
        await loadChats(true);
        selectChat(data.chat);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!config || !newGatilhos.trim() || !newResposta.trim()) return;

    const gatilhosArray = newGatilhos
      .split(',')
      .map(g => g.trim())
      .filter(Boolean);

    const newRule: AutoReplyRule = {
      id: 'rule_' + Date.now(),
      gatilhos: gatilhosArray,
      resposta: newResposta.trim(),
      pausarBot: newPausarBot,
    };

    const updatedRules = [...(config.auto_reply_rules || []), newRule];
    await handleSaveConfig({ auto_reply_rules: updatedRules });
    setNewGatilhos('');
    setNewResposta('');
    setNewPausarBot(false);
  }

  async function handleDeleteRule(ruleId: string) {
    if (!config) return;
    const updated = config.auto_reply_rules.filter(r => r.id !== ruleId);
    await handleSaveConfig({ auto_reply_rules: updated });
  }

  async function handleSimFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setSimPendingFile({
        fileName: file.name,
        mediaType: file.type.startsWith('image/') ? 'image' : 'document',
        mediaUrl: dataUrl,
        fileSize: file.size,
      });
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = '';
    }
  }

  async function handleTestSimulator(e: React.FormEvent) {
    e.preventDefault();
    if ((!simPrompt.trim() && !simPendingFile) || simLoading) return;

    const attached = simPendingFile;
    const userText =
      simPrompt.trim() ||
      (attached ? `[Anexo: ${attached.fileName}]` : '');
    setSimPrompt('');
    setSimPendingFile(null);
    setSimHistory(prev => [
      ...prev,
      {
        from: 'user',
        text: attached && simPrompt.trim() ? `📎 ${attached.fileName}\n${userText}` : userText,
      },
    ]);
    setSimLoading(true);

    try {
      const res = await waFetch('/api/whatsapp/test-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText, triageState: simTriageState }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.updatedState) {
          setSimTriageState(data.updatedState);
        }
        setSimHistory(prev => [
          ...prev,
          {
            from: 'bot',
            text: data.reply,
            source: data.source,
            durationMs: data.durationMs,
          },
        ]);
      }
    } catch (err) {
      setSimHistory(prev => [
        ...prev,
        { from: 'bot', text: 'Erro ao processar mensagem no simulador.' },
      ]);
    } finally {
      setSimLoading(false);
    }
  }

  const openChatsCount = chats.filter(c => (c.ticket_status || 'aberto') === 'aberto').length;
  const closedChatsCount = chats.filter(c => c.ticket_status === 'encerrado').length;
  const activeFollowupsList = chats.filter(
    c => c.followup_date && c.followup_status !== 'concluido'
  );

  const filteredChats = chats.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (c.followup_note || '').toLowerCase().includes(searchFilter.toLowerCase());

    if (!matchesSearch) return false;

    const status = c.ticket_status || 'aberto';

    if (chatFilter === 'abertos') return status === 'aberto';
    if (chatFilter === 'encerrados') return status === 'encerrado';
    if (chatFilter === 'followup') {
      return Boolean(c.followup_date && c.followup_status !== 'concluido');
    }
    if (chatFilter === 'unreads') return c.unread_count > 0 && status === 'aberto';
    if (chatFilter === 'triagem') {
      return (
        status === 'aberto' &&
        (c.triage_status === 'transferido_humano' ||
          (c.bot_paused_until && new Date(c.bot_paused_until) > new Date()))
      );
    }
    if (chatFilter === 'humano') {
      const isPaused = c.bot_paused_until && new Date(c.bot_paused_until) > new Date();
      return status === 'aberto' && (!c.bot_enabled || isPaused);
    }
    if (chatFilter === 'bot') {
      const isPaused = c.bot_paused_until && new Date(c.bot_paused_until) > new Date();
      return status === 'aberto' && c.bot_enabled && !isPaused;
    }

    return true;
  });

  const filteredLessons = lessons.filter(l => {
    const matchesTopic = kbTopicFilter === 'todos' || l.topic === kbTopicFilter;
    const matchesSearch =
      !kbSearch ||
      l.question.toLowerCase().includes(kbSearch.toLowerCase()) ||
      l.answer.toLowerCase().includes(kbSearch.toLowerCase()) ||
      l.keywords.some(k => k.toLowerCase().includes(kbSearch.toLowerCase()));
    return matchesTopic && matchesSearch;
  });

  const totalUnreadCount = chats
    .filter(c => (c.ticket_status || 'aberto') === 'aberto')
    .reduce((acc, c) => acc + (c.unread_count || 0), 0);
  const totalPipelineValue = chats.reduce((acc, c) => acc + (c.crm_value || 0), 0);
  const pendingFollowups = activeFollowupsList.length;

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : 'https://privilegecontabilidade.cnt.br/api/whatsapp/webhook';

  const mcpUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/mcp`
      : 'https://privilegecontabilidade.cnt.br/api/whatsapp/mcp';

  return (
    <div className="wa-container">
      {/* HEADER PRINCIPAL */}
      <div className="wa-header">
        <div className="wa-title-group">
          <div className="wa-icon-badge">
            <MessageSquare size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="wa-title">WhatsApp, Assistente com Aprendizado & CRM</h1>
              {config?.status === 'conectado' ? (
                <span className="wa-status-pill online">
                  <span className="wa-pulse-dot" />
                  Online: {config.phone_number || 'Conectado'}
                </span>
              ) : (
                <span className="wa-status-pill offline">
                  <span className="wa-pulse-dot" />
                  Aguardando Conexão QR Code
                </span>
              )}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: 3,
                  borderRadius: 99,
                  background: 'var(--bg-card2)',
                  border: '1px solid var(--border)',
                }}
                title="Alterne entre até 2 números de WhatsApp cadastrados na sua conta"
              >
                <button
                  type="button"
                  onClick={() => switchWhatsAppLine('1')}
                  style={{
                    border: 'none',
                    borderRadius: 99,
                    padding: '4px 10px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: selectedLine === '1' ? 'var(--accent)' : 'transparent',
                    color: selectedLine === '1' ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  📱 Número 1
                </button>
                <button
                  type="button"
                  onClick={() => switchWhatsAppLine('2')}
                  style={{
                    border: 'none',
                    borderRadius: 99,
                    padding: '4px 10px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: selectedLine === '2' ? '#16a34a' : 'transparent',
                    color: selectedLine === '2' ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  📱 Número 2
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  soundEnabledRef.current = next;
                  if (next) playNotificationSound(true);
                }}
                className="wa-btn wa-btn-secondary"
                style={{ padding: '4px 10px', fontSize: 11.5 }}
                title={soundEnabled ? 'Som de notificação ativo (clique para silenciar)' : 'Som silenciado (clique para ativar e testar)'}
              >
                {soundEnabled ? <Volume2 size={14} color="var(--green)" /> : <VolumeX size={14} color="var(--text-muted)" />}
                <span>{soundEnabled ? 'Som Ativo' : 'Silenciado'}</span>
              </button>
            </div>
            <p className="wa-subtitle">
              Privilege Contabilidade & Consultoria · Atendimento multicanal, base de conhecimento treinável, conexão MCP e follow-up CRM
            </p>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="wa-tabs">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`wa-tab-btn ${activeTab === 'inbox' ? 'active' : ''}`}
          >
            <MessageSquare size={16} />
            <span>Conversas ao Vivo</span>
            {totalUnreadCount > 0 && <span className="wa-badge-count">{totalUnreadCount}</span>}
          </button>

          <button
            onClick={() => setActiveTab('knowledge')}
            className={`wa-tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
            style={activeTab === 'knowledge' ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
          >
            <GraduationCap size={16} />
            <span>Ensinar Assistente</span>
            <span className="wa-badge-count" style={{ background: 'var(--gold)' }}>
              {lessons.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('campaigns')}
            className={`wa-tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
          >
            <Send size={16} />
            <span>Transmissão em Massa</span>
            {campaigns.some(c => c.status === 'em_andamento') && (
              <span className="wa-badge-count" style={{ background: 'var(--green)' }}>
                Ao Vivo
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('qrcode')}
            className={`wa-tab-btn ${activeTab === 'qrcode' ? 'active' : ''}`}
          >
            <QrCode size={16} />
            <span>Conexão QR Code</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('knowledge');
              setLeoSection('integracoes');
            }}
            className={`wa-tab-btn ${activeTab === 'bot' || (activeTab === 'knowledge' && leoSection === 'integracoes') ? 'active' : ''}`}
          >
            <Cpu size={16} />
            <span>Robô & MCP</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: CENTRAL DE MENSAGENS AO VIVO (WHATSAPP WEB)                        */}
      {/* ========================================================================= */}
      {activeTab === 'inbox' && (
        <div className="wa-inbox-grid">
          {/* COLUNA ESQUERDA: LISTA DE CONVERSAS */}
          <div className="wa-chats-col">
            <div className="wa-chats-header">
              <div className="wa-chats-top">
                <span className="wa-chats-title">
                  {chatFilter === 'abertos'
                    ? `Chamados Abertos (${filteredChats.length})`
                    : chatFilter === 'encerrados'
                      ? `Encerrados (${filteredChats.length})`
                      : chatFilter === 'followup'
                        ? `Follow-ups (${filteredChats.length})`
                        : `Conversas (${filteredChats.length})`}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {openChatsCount > 0 && chatFilter === 'abertos' && (
                    <button
                      type="button"
                      onClick={handleCloseAllOpenTickets}
                      className="wa-btn wa-btn-secondary"
                      style={{ padding: '5px 9px', fontSize: 11 }}
                      title="Encerrar todos os chamados abertos para limpar a fila"
                    >
                      <Check size={13} /> Limpar Fila
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsNewChatModalOpen(true)}
                    className="wa-btn wa-btn-primary"
                    style={{ padding: '5px 10px', fontSize: 11 }}
                  >
                    <Plus size={13} /> Novo
                  </button>
                </div>
              </div>

              <div className="wa-search-box">
                <Search size={14} className="wa-search-icon" />
                <input
                  type="text"
                  placeholder="Buscar conversa, telefone ou follow-up..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="wa-search-input"
                />
              </div>

              <div className="wa-filter-chips">
                <button
                  onClick={() => setChatFilter('abertos')}
                  className={`wa-filter-chip ${chatFilter === 'abertos' ? 'active' : ''}`}
                >
                  🟢 Abertos ({openChatsCount})
                </button>
                <button
                  onClick={() => setChatFilter('encerrados')}
                  className={`wa-filter-chip ${chatFilter === 'encerrados' ? 'active' : ''}`}
                >
                  ✅ Fechados ({closedChatsCount})
                </button>
                <button
                  onClick={() => setChatFilter('followup')}
                  className={`wa-filter-chip ${chatFilter === 'followup' ? 'active' : ''}`}
                  style={
                    chatFilter === 'followup'
                      ? { background: 'var(--yellow)', borderColor: 'var(--yellow)', color: '#fff' }
                      : {}
                  }
                >
                  ⏰ Follow-up ({pendingFollowups})
                </button>
                <button
                  onClick={() => setChatFilter('triagem')}
                  className={`wa-filter-chip ${chatFilter === 'triagem' ? 'active' : ''}`}
                >
                  📋 Aguardando Humano
                </button>
                <button
                  onClick={() => setChatFilter('unreads')}
                  className={`wa-filter-chip ${chatFilter === 'unreads' ? 'active' : ''}`}
                >
                  Não Lidas
                </button>
                <button
                  onClick={() => setChatFilter('todos')}
                  className={`wa-filter-chip ${chatFilter === 'todos' ? 'active' : ''}`}
                >
                  Todas
                </button>
              </div>
            </div>

            <div className="wa-chat-list">
              {filteredChats.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {chatFilter === 'abertos' ? (
                    <>
                      <Check size={28} color="var(--green)" style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        Fila limpa! Nenhum chamado em aberto.
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Novas mensagens recebidas abrirão o chamado automaticamente, ou consulte a aba{' '}
                        <button
                          type="button"
                          onClick={() => setChatFilter('encerrados')}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--accent)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 0,
                          }}
                        >
                          Encerrados ({closedChatsCount})
                        </button>
                        .
                      </div>
                    </>
                  ) : (
                    'Nenhuma conversa encontrada neste filtro.'
                  )}
                </div>
              ) : (
                filteredChats.map(chat => {
                  const isSelected = selectedChat?.id === chat.id;
                  const isBotPaused =
                    chat.bot_paused_until && new Date(chat.bot_paused_until) > new Date();
                  const isClosed = chat.ticket_status === 'encerrado';
                  const hasFollowup = Boolean(
                    chat.followup_date && chat.followup_status !== 'concluido'
                  );

                  return (
                    <div
                      key={chat.id}
                      onClick={() => selectChat(chat)}
                      className={`wa-chat-item ${isSelected ? 'selected' : ''}`}
                      style={isClosed ? { opacity: 0.78 } : undefined}
                    >
                      <div className="wa-avatar">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getContactAvatarUrl(chat)}
                          alt={chat.name}
                          className="wa-avatar-img"
                          onError={e => {
                            const target = e.currentTarget;
                            target.onerror = null;
                            target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              chat.name || 'WA'
                            )}&background=600000&color=fff&bold=true&size=128`;
                          }}
                        />
                      </div>

                      <div className="wa-chat-info">
                        <div className="wa-chat-row1">
                          <span className="wa-chat-name">{chat.name}</span>
                          <span className="wa-chat-time">
                            {chat.last_message_time
                              ? new Date(chat.last_message_time).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                              : ''}
                          </span>
                        </div>

                        <div className="wa-chat-snippet">
                          {chat.last_message || 'Nenhuma mensagem recente'}
                        </div>

                        <div className="wa-chat-meta">
                          {isClosed ? (
                            <span
                              className="wa-tag"
                              style={{
                                background: 'rgba(21, 128, 61, 0.12)',
                                color: 'var(--green)',
                                fontWeight: 700,
                              }}
                            >
                              ✓ Encerrado
                            </span>
                          ) : (
                            <span className={`wa-tag crm-${chat.crm_stage || 'atendimento'}`}>
                              {chat.crm_stage === 'lead' && 'Lead'}
                              {chat.crm_stage === 'em_atendimento' && 'Em Atendimento'}
                              {chat.crm_stage === 'aguardando_documentos' && 'Aguardando Docs'}
                              {chat.crm_stage === 'proposta' && 'Proposta'}
                              {chat.crm_stage === 'fechado' && 'Fechado'}
                              {chat.crm_stage === 'pos_venda' && 'Pós-Venda'}
                            </span>
                          )}

                          {hasFollowup && (
                            <span
                              className="wa-tag"
                              style={{
                                background: 'rgba(180, 83, 9, 0.14)',
                                color: 'var(--yellow)',
                                fontWeight: 700,
                              }}
                              title={`Follow-up: ${new Date(chat.followup_date!).toLocaleString('pt-BR')}`}
                            >
                              ⏰{' '}
                              {new Date(chat.followup_date!).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                              })}
                            </span>
                          )}

                          {!isClosed &&
                            (chat.triage_status === 'transferido_humano' ? (
                              <span
                                className="wa-tag"
                                style={{
                                  background: 'rgba(180, 83, 9, 0.15)',
                                  color: 'var(--yellow)',
                                  fontWeight: 700,
                                }}
                              >
                                📋 Triado
                              </span>
                            ) : isBotPaused ? (
                              <span className="wa-tag humano">Humano</span>
                            ) : chat.bot_enabled ? (
                              <span className="wa-tag bot">Bot</span>
                            ) : null)}

                          {/* Botões rápidos de Encerrar / Reabrir e Follow-up direto no card */}
                          <div
                            style={{
                              marginLeft: 'auto',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            {chat.unread_count > 0 && !isClosed && (
                              <span className="wa-badge-count">{chat.unread_count}</span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenFollowupModal(chat, false)}
                              className="wa-mini-action-btn"
                              title="Agendar Follow-up"
                            >
                              ⏰
                            </button>
                            {isClosed ? (
                              <button
                                type="button"
                                onClick={() => handleReopenTicket(chat.id)}
                                className="wa-mini-action-btn reopen"
                                title="Reabrir Chamado"
                              >
                                ↺ Reabrir
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCloseTicket(chat.id)}
                                className="wa-mini-action-btn close"
                                title="Encerrar chamado para limpar a fila"
                              >
                                ✓ Encerrar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUNA DIREITA: JANELA DO CHAT */}
          <div className="wa-chat-main">
            {selectedChat ? (
              <>
                <div className="wa-chat-topbar">
                  <div className="wa-chat-partner">
                    <div className="wa-avatar" style={{ width: 44, height: 44 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getContactAvatarUrl(selectedChat)}
                        alt={selectedChat.name}
                        className="wa-avatar-img"
                        onError={e => {
                          const target = e.currentTarget;
                          target.onerror = null;
                          target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            selectedChat.name || 'WA'
                          )}&background=600000&color=fff&bold=true&size=128`;
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="wa-chat-partner-name">{selectedChat.name}</span>
                        {selectedChat.ticket_status === 'encerrado' && (
                          <span
                            className="wa-tag"
                            style={{
                              background: 'rgba(21, 128, 61, 0.14)',
                              color: 'var(--green)',
                              fontWeight: 700,
                            }}
                          >
                            ✓ Chamado Encerrado
                          </span>
                        )}
                      </div>
                      <div className="wa-chat-partner-phone">
                        {selectedChat.phone} · Estágio CRM:{' '}
                        <select
                          value={selectedChat.crm_stage || 'em_atendimento'}
                          onChange={e =>
                            handleUpdateCrmStage(selectedChat.id, e.target.value as CrmStage)
                          }
                          style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontWeight: 600,
                          }}
                        >
                          <option value="lead">Lead</option>
                          <option value="em_atendimento">Em Atendimento</option>
                          <option value="aguardando_documentos">Aguardando Documentos</option>
                          <option value="proposta">Proposta / Orçamento</option>
                          <option value="fechado">Contrato Fechado</option>
                          <option value="pos_venda">Pós-Venda</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenFollowupModal(selectedChat, false)}
                      className="wa-btn wa-btn-secondary"
                      style={{ padding: '6px 11px', fontSize: 11.5 }}
                    >
                      <Calendar size={13} /> Follow-up
                    </button>

                    {selectedChat.ticket_status === 'encerrado' ? (
                      <button
                        type="button"
                        onClick={() => handleReopenTicket(selectedChat.id)}
                        className="wa-btn wa-btn-secondary"
                        style={{
                          padding: '6px 11px',
                          fontSize: 11.5,
                          borderColor: 'var(--blue)',
                          color: 'var(--blue)',
                        }}
                      >
                        <RefreshCw size={13} /> Reabrir Chamado
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCloseTicket(selectedChat.id)}
                        className="wa-btn wa-btn-green"
                        style={{ padding: '6px 12px', fontSize: 11.5 }}
                        title="Encerra este chamado e limpa da fila de abertos"
                      >
                        <Check size={14} /> Encerrar Chamado
                      </button>
                    )}

                    {selectedChat.bot_paused_until &&
                      new Date(selectedChat.bot_paused_until) > new Date() ? (
                      <button
                        type="button"
                        onClick={() => handleResumeBot(selectedChat.id)}
                        className="wa-btn wa-btn-secondary"
                        style={{ padding: '6px 10px', fontSize: 11.5 }}
                      >
                        <Play size={13} /> Reativar Bot
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePauseBot(selectedChat.id, 30)}
                        className="wa-btn wa-btn-secondary"
                        style={{
                          padding: '6px 10px',
                          fontSize: 11.5,
                          borderColor: 'var(--yellow)',
                          color: 'var(--yellow)',
                        }}
                      >
                        <Pause size={13} /> Assumir (30m)
                      </button>
                    )}

                    {selectedChat.protocol_number && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedChat.protocol_number || '');
                          toast.success(`Protocolo ${selectedChat.protocol_number} copiado!`);
                        }}
                        className="wa-btn wa-btn-secondary"
                        style={{ padding: '4px 8px', fontSize: 11, fontFamily: 'monospace' }}
                        title="Clique para copiar o número do protocolo"
                      >
                        🎫 {selectedChat.protocol_number}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openProtocolModalForChat(selectedChat)}
                      className="wa-btn wa-btn-secondary"
                      style={{ padding: '5px 9px', fontSize: 11.5 }}
                      title="Gerar ou salvar protocolo deste atendimento"
                    >
                      🎫 Protocolo
                    </button>

                    <button
                      type="button"
                      onClick={() => openAgendaModalForChat(selectedChat)}
                      className="wa-btn wa-btn-secondary"
                      style={{ padding: '5px 9px', fontSize: 11.5 }}
                      title="Criar tarefa na Agenda para esta demanda"
                    >
                      📅 Agenda
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleBot(selectedChat.id, selectedChat.bot_enabled)}
                      className="wa-btn wa-btn-secondary"
                      style={{ padding: 6 }}
                      title={selectedChat.bot_enabled ? 'Bot ligado neste chat' : 'Bot desligado neste chat'}
                    >
                      <Bot size={15} color={selectedChat.bot_enabled ? 'var(--blue)' : 'var(--red)'} />
                    </button>
                  </div>
                </div>

                {/* FAIXA DE FOLLOW-UP AGENDADO NESTA CONVERSA */}
                {selectedChat.followup_date && selectedChat.followup_status !== 'concluido' && (
                  <div className="wa-followup-banner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <Clock size={15} color="var(--yellow)" style={{ flexShrink: 0 }} />
                      <div style={{ fontSize: 12, minWidth: 0 }}>
                        <strong>Follow-up agendado:</strong>{' '}
                        {new Date(selectedChat.followup_date).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {selectedChat.followup_note ? ` — ${selectedChat.followup_note}` : ''}
                        {selectedChat.followup_auto_send && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 10.5,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: 'rgba(21,128,61,0.12)',
                              color: 'var(--green)',
                              fontWeight: 700,
                            }}
                          >
                            ⚡ Envio Automático
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleSendFollowupNow(selectedChat.id)}
                        className="wa-btn wa-btn-primary"
                        style={{ padding: '4px 9px', fontSize: 11 }}
                        title="Disparar mensagem de Follow-up agora no WhatsApp"
                      >
                        <Send size={11} /> Enviar Agora
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenFollowupModal(selectedChat, false)}
                        className="wa-btn wa-btn-secondary"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCompleteFollowup(selectedChat.id)}
                        className="wa-btn wa-btn-green"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                      >
                        ✓ Concluir
                      </button>
                    </div>
                  </div>
                )}

                {/* FICHA RESUMO DA TRIAGEM DO ASSISTENTE */}
                {selectedChat.triage_summary && selectedChat.ticket_status !== 'encerrado' && (
                  <div className="wa-triage-card">
                    <div className="wa-triage-top">
                      <span className="wa-triage-title">
                        <FileText size={14} /> Ficha de Atendimento (Triagem Concluída pelo Robô)
                      </span>
                      <span className="wa-tag" style={{ background: 'rgba(180, 83, 9, 0.15)', color: 'var(--yellow)', fontWeight: 700 }}>
                        👤 Pronto para Atendimento Humano
                      </span>
                    </div>
                    <div className="wa-triage-text">
                      {selectedChat.triage_summary}
                    </div>
                    <div className="wa-triage-actions">
                      <button
                        type="button"
                        onClick={() => handleResumeBot(selectedChat.id)}
                        className="wa-btn wa-btn-secondary"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        title="Reativa o robô automático para continuar respondendo"
                      >
                        Devolver ao Robô
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenFollowupModal(selectedChat, true)}
                        className="wa-btn wa-btn-secondary"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                      >
                        ⏰ Encerrar + Follow-up
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCloseTicket(selectedChat.id, 'Triagem atendida e encerrada')}
                        className="wa-btn wa-btn-primary"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        title="Encerra o chamado e limpa da fila"
                      >
                        ✓ Encerrar Chamado
                      </button>
                    </div>
                  </div>
                )}

                <div ref={messagesContainerRef} className="wa-messages-area">
                  {messages.length === 0 ? (
                    <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <MessageSquare size={36} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                      <p style={{ margin: 0, fontSize: 14 }}>Nenhuma mensagem trocada ainda.</p>
                      <p style={{ margin: '4px 0 0', fontSize: 12 }}>Digite abaixo para iniciar o atendimento.</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isMe = msg.from_me;
                      const isBot = msg.sent_by === 'bot';
                      const prevMsg = idx > 0 ? messages[idx - 1] : null;
                      const mType = msg.media_type || 'text';
                      const reactions = Array.isArray(msg.reactions) ? msg.reactions : [];

                      return (
                        <div
                          key={msg.id}
                          className={`wa-msg-wrapper ${isMe ? 'me' : 'them'}`}
                        >
                          <div className="wa-msg-row">
                            <div
                              className={`wa-bubble ${isMe ? (isBot ? 'me bot' : 'me consultor') : 'them'
                                }`}
                            >
                              {/* Seletor flutuante de reações */}
                              {activeReactionMsgId === msg.id && (
                                <div className="wa-reaction-picker">
                                  {REACTION_EMOJIS.map(emoji => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => handleReactMessage(msg.id, emoji)}
                                      className="wa-emoji-btn"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}

                              <div className="wa-bubble-sender">
                                {isMe ? (
                                  isBot ? (
                                    <>
                                      <Bot size={13} />
                                      <span>{msg.sender_name || 'Léo (Assistente Virtual)'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <User size={13} />
                                      <span>{msg.sender_name || 'Consultor Privilege'}</span>
                                    </>
                                  )
                                ) : (
                                  <span>{msg.sender_name || selectedChat.name}</span>
                                )}
                              </div>

                              {/* Renderização de Imagem */}
                              {mType === 'image' && msg.media_url && (
                                <a href={msg.media_url} target="_blank" rel="noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={msg.media_url}
                                    alt={msg.text || 'Imagem'}
                                    className="wa-media-img"
                                  />
                                </a>
                              )}

                              {/* Renderização de Áudio */}
                              {mType === 'audio' && msg.media_url && (
                                <audio controls src={msg.media_url} className="wa-media-audio" />
                              )}

                              {/* Renderização de Documento */}
                              {mType === 'document' && msg.media_url && (
                                <a
                                  href={msg.media_url}
                                  download={msg.file_name || 'documento'}
                                  className="wa-media-doc"
                                >
                                  <FileText size={20} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: 12.5,
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {msg.file_name || msg.text || 'Documento'}
                                    </div>
                                    <div style={{ fontSize: 10.5, opacity: 0.8 }}>
                                      Clique para baixar o arquivo
                                    </div>
                                  </div>
                                  <Download size={15} />
                                </a>
                              )}

                              {/* Texto / Legenda */}
                              {msg.text &&
                                !(mType === 'audio' && msg.text === '🎤 Mensagem de áudio') && (
                                  <div style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
                                )}

                              <div className="wa-bubble-time">
                                <span>
                                  {msg.timestamp
                                    ? new Date(msg.timestamp).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                    : ''}
                                </span>
                                {isMe && <CheckCheck size={13} />}
                              </div>
                            </div>

                            {/* Botão para abrir reações (emoji) */}
                            <button
                              type="button"
                              onClick={() =>
                                setActiveReactionMsgId(
                                  activeReactionMsgId === msg.id ? null : msg.id
                                )
                              }
                              className="wa-react-trigger"
                              title="Reagir com emoji"
                            >
                              <Smile size={14} />
                            </button>
                          </div>

                          {/* Pílulas de Reações abaixo do balão */}
                          {reactions.length > 0 && (
                            <div className="wa-reactions-pills">
                              {reactions.map((emoji, rIdx) => (
                                <span
                                  key={rIdx}
                                  onClick={() => handleReactMessage(msg.id, emoji)}
                                  className="wa-reaction-pill"
                                  title="Clique para alternar reação"
                                >
                                  {emoji}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Botão de Ensinar Resposta Melhor para mensagens do bot */}
                          {isBot && prevMsg && !prevMsg.from_me && (
                            <button
                              onClick={() => handleOpenTeachForQuestion(prevMsg.text)}
                              style={{
                                alignSelf: 'flex-end',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--accent)',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 4,
                                padding: '2px 6px',
                                borderRadius: 4,
                              }}
                              title="Ensinar uma resposta melhor para que o robô aprenda e responda perfeitamente nas próximas vezes"
                            >
                              <GraduationCap size={13} /> Ensinar Resposta Melhor
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Respostas Rápidas */}
                {config?.quick_replies && config.quick_replies.length > 0 && (
                  <div className="wa-quick-replies-bar">
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={13} color="var(--yellow)" /> Respostas Rápidas:
                    </span>
                    {config.quick_replies.map(qr => (
                      <button
                        key={qr.id}
                        type="button"
                        onClick={() => setMessageInput(qr.texto)}
                        className="wa-qr-chip"
                      >
                        {qr.titulo}
                      </button>
                    ))}
                  </div>
                )}

                {/* Inputs ocultos de upload de imagem e documento */}
                <input
                  ref={imageUploadRef}
                  type="file"
                  accept="image/*"
                  onChange={e => handleMediaSelect(e, 'image')}
                  style={{ display: 'none' }}
                />
                <input
                  ref={docUploadRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.xml,.txt,.zip,.pfx"
                  onChange={e => handleMediaSelect(e, 'document')}
                  style={{ display: 'none' }}
                />

                {/* PAINEL DE CONFERÊNCIA DE ARQUIVO / IMAGEM / ÁUDIO ANTES DE ENVIAR */}
                {pendingAttachment && (
                  <div className="wa-attachment-preview-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      {pendingAttachment.mediaType === 'image' && (
                        <a
                          href={pendingAttachment.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Clique para ampliar e conferir a imagem"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pendingAttachment.mediaUrl}
                            alt={pendingAttachment.fileName}
                            className="wa-attachment-thumb"
                          />
                        </a>
                      )}

                      {pendingAttachment.mediaType === 'document' && (
                        <div className="wa-attachment-doc-icon">
                          <FileText size={22} color="var(--accent)" />
                        </div>
                      )}

                      {pendingAttachment.mediaType === 'audio' && (
                        <audio
                          controls
                          src={pendingAttachment.mediaUrl}
                          style={{ height: 36, maxWidth: 240 }}
                        />
                      )}

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {pendingAttachment.mediaType === 'image' && '📷 Imagem pronta para envio: '}
                          {pendingAttachment.mediaType === 'document' && '📄 Documento pronto para envio: '}
                          {pendingAttachment.mediaType === 'audio' && '🎤 Áudio gravado (ouça para conferir): '}
                          {pendingAttachment.fileName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          {pendingAttachment.fileSize && (
                            <span>{(pendingAttachment.fileSize / 1024).toFixed(1)} KB</span>
                          )}
                          <span>• Confira o arquivo acima, adicione uma legenda (opcional) abaixo e clique em Enviar.</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {pendingAttachment.mediaType !== 'audio' && (
                        <a
                          href={pendingAttachment.mediaUrl}
                          download={pendingAttachment.fileName}
                          target="_blank"
                          rel="noreferrer"
                          className="wa-btn wa-btn-secondary"
                          style={{ padding: '5px 10px', fontSize: 11, textDecoration: 'none' }}
                        >
                          <ExternalLink size={12} /> Abrir / Conferir
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingAttachment(null)}
                        className="wa-btn wa-btn-danger"
                        style={{ padding: '5px 10px', fontSize: 11 }}
                        title="Remover anexo"
                      >
                        ✕ Remover
                      </button>
                    </div>
                  </div>
                )}

                {/* Campo de Envio com Áudio, Imagem e Documento */}
                <form onSubmit={handleSendMessage} className="wa-input-bar">
                  {isRecordingAudio ? (
                    <div className="wa-recording-bar">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="wa-pulse-dot" />
                        <span>
                          Gravando áudio... {Math.floor(recordingSeconds / 60)}:
                          {String(recordingSeconds % 60).padStart(2, '0')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          onClick={cancelAudioRecording}
                          className="wa-btn wa-btn-secondary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={finishAndSendAudio}
                          className="wa-btn wa-btn-green"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                        >
                          <Check size={13} /> Concluir e Conferir Áudio
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => imageUploadRef.current?.click()}
                        className="wa-attach-btn"
                        title="Anexar Foto ou Imagem (para conferência)"
                      >
                        <ImageIcon size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => docUploadRef.current?.click()}
                        className="wa-attach-btn"
                        title="Anexar Documento (PDF, XML, Planilha...)"
                      >
                        <Paperclip size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={startAudioRecording}
                        className="wa-attach-btn"
                        title="Gravar Mensagem de Voz (Áudio)"
                      >
                        <Mic size={17} />
                      </button>

                      <input
                        type="text"
                        placeholder={
                          pendingAttachment
                            ? `Adicione uma legenda opcional para "${pendingAttachment.fileName}" ou clique em Enviar...`
                            : 'Digite uma mensagem, ou anexe áudio, foto ou documento...'
                        }
                        value={messageInput}
                        onChange={e => setMessageInput(e.target.value)}
                        className="wa-input-text"
                      />
                      <button
                        type="submit"
                        disabled={sending || (!messageInput.trim() && !pendingAttachment)}
                        className="wa-send-btn"
                      >
                        <Send size={15} />
                        <span>{pendingAttachment ? 'Confirmar & Enviar' : 'Enviar'}</span>
                      </button>
                    </>
                  )}
                </form>
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                <MessageSquare size={48} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>Nenhuma conversa selecionada</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13 }}>Selecione um contato na lista à esquerda para conversar ao vivo.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: ESTÚDIO DO AGENTE LÉO (CONHECIMENTO, DOCUMENTOS, SITES & TESTE)    */}
      {/* ========================================================================= */}
      {(activeTab === 'knowledge' || activeTab === 'bot') && (
        <div className="leo-studio-wrapper">
          {/* TOP BAR DO ESTÚDIO DO ASSISTENTE */}
          <div className="leo-studio-topbar">
            <div className="leo-agent-badge">
              {(() => {
                const list = config?.assistants || [];
                const activeAst = list.find(a => a.id === config?.active_assistant_id) || list[0];
                return (
                  <>
                    <div
                      className="leo-agent-avatar"
                      style={activeAst?.avatarColor ? { background: activeAst.avatarColor } : undefined}
                    >
                      <Bot size={20} />
                    </div>
                    <div>
                      <h3 className="leo-agent-name">
                        {activeAst?.name || 'Léo'} · {activeAst?.role || 'Assistente Virtual Privilege Contabilidade'}
                      </h3>
                      <p className="leo-agent-sub">
                        Atende no WhatsApp ao vivo 24h ·{' '}
                        {config?.reply_audio_on_audio !== false
                          ? '🎤 Responde áudio com áudio direto'
                          : '💬 Responde em texto'}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <select
                value={config?.active_assistant_id || 'leo'}
                onChange={e => {
                  const id = e.target.value;
                  const target = (config?.assistants || []).find(a => a.id === id);
                  handleSaveConfig({
                    active_assistant_id: id,
                    reply_audio_on_audio: target ? target.replyAudioOnAudio : true,
                    always_reply_audio: target ? target.alwaysReplyAudio : false,
                  });
                }}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                }}
                title="Selecionar Assistente Ativo no WhatsApp"
              >
                {(config?.assistants && config.assistants.length > 0
                  ? config.assistants
                  : [
                    { id: 'leo', name: 'Léo (Voz Masculina)' },
                    { id: 'clara', name: 'Clara (Voz Feminina)' },
                  ]
                ).map(ast => (
                  <option key={ast.id} value={ast.id}>
                    🤖 {ast.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setLeoSection('midia');
                  setIsNewAssistantOpen(true);
                }}
                className="wa-btn wa-btn-secondary"
                style={{ padding: '6px 10px', fontSize: 11.5 }}
              >
                <Plus size={13} /> Criar Assistente
              </button>

              <button
                type="button"
                onClick={() => handleSaveConfig({ bot_enabled: !config?.bot_enabled })}
                className={`wa-btn ${config?.bot_enabled ? 'wa-btn-green' : 'wa-btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                <Power size={13} /> {config?.bot_enabled ? 'Robô Ligado' : 'Robô Pausado'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('leo-tester-input');
                  el?.focus();
                }}
                className="leo-btn-green"
              >
                Testar Agora
              </button>
            </div>
          </div>

          {/* GRID 3 COLUNAS DO ESTÚDIO */}
          <div className="leo-studio-grid">
            {/* COLUNA 1: MENU LATERAL DE AJUSTES */}
            <div className="leo-nav-sidebar">
              <div style={{ position: 'relative', marginBottom: 6 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Procurar ajuste"
                  value={leoMenuSearch}
                  onChange={e => setLeoMenuSearch(e.target.value)}
                  className="leo-search-input"
                />
              </div>

              {/* Grupo 1: Identidade e Fala */}
              <div className="leo-nav-group">
                <button
                  type="button"
                  onClick={() => setLeoSection('fala')}
                  className={`leo-nav-group-header ${leoSection === 'fala' ? 'active' : ''}`}
                >
                  <User size={15} />
                  <div>
                    <div>O que ele fala e como fala</div>
                    <span className="leo-nav-group-sub">Nome, foto, tom e relógio 24h</span>
                  </div>
                </button>
              </div>

              {/* Grupo 2: Conhecimento */}
              <div className="leo-nav-group">
                <button
                  type="button"
                  onClick={() => setLeoSection('conhecimento')}
                  className={`leo-nav-group-header ${leoSection === 'conhecimento' ? 'active' : ''}`}
                >
                  <BookOpen size={15} />
                  <div>
                    <div>Conhecimento</div>
                    <span className="leo-nav-group-sub">Documentos e o que ele aprendeu</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setLeoSection('conhecimento')}
                  className={`leo-nav-subitem ${leoSection === 'conhecimento' ? 'active' : ''}`}
                >
                  Documentos e páginas do site
                </button>
                <button
                  type="button"
                  onClick={() => setLeoSection('conhecimento')}
                  className="leo-nav-subitem"
                >
                  O que ele aprendeu ({lessons.length})
                </button>
              </div>

              {/* Grupo 3: Áudio, fotos e arquivos */}
              <div className="leo-nav-group">
                <button
                  type="button"
                  onClick={() => setLeoSection('midia')}
                  className={`leo-nav-group-header ${leoSection === 'midia' ? 'active' : ''}`}
                >
                  <FileText size={15} />
                  <div>
                    <div>Áudio, fotos e arquivos</div>
                    <span className="leo-nav-group-sub">O que o cliente manda e o que ele envia</span>
                  </div>
                </button>
              </div>

              {/* Grupo 4: Ritmo da conversa */}
              <div className="leo-nav-group">
                <button
                  type="button"
                  onClick={() => setLeoSection('ritmo')}
                  className={`leo-nav-group-header ${leoSection === 'ritmo' ? 'active' : ''}`}
                >
                  <Clock size={15} />
                  <div>
                    <div>Ritmo da conversa</div>
                    <span className="leo-nav-group-sub">Tempo e jeito de mandar</span>
                  </div>
                </button>
              </div>

              {/* Grupo 5: Quando você assume */}
              <div className="leo-nav-group">
                <button
                  type="button"
                  onClick={() => setLeoSection('humano')}
                  className={`leo-nav-group-header ${leoSection === 'humano' ? 'active' : ''}`}
                >
                  <ShieldCheck size={15} />
                  <div>
                    <div>Quando você assume</div>
                    <span className="leo-nav-group-sub">Pausa da IA e avisos pra você</span>
                  </div>
                </button>
              </div>

              {/* Grupo 6: Vendas e retorno */}
              <div className="leo-nav-group">
                <button
                  type="button"
                  onClick={() => setLeoSection('vendas')}
                  className={`leo-nav-group-header ${leoSection === 'vendas' ? 'active' : ''}`}
                >
                  <TrendingUp size={15} />
                  <div>
                    <div>Vendas e retorno</div>
                    <span className="leo-nav-group-sub">Chamar de volta, leads e links</span>
                  </div>
                </button>
              </div>

              {/* Grupo 7: Integrações */}
              <div className="leo-nav-group">
                <button
                  type="button"
                  onClick={() => setLeoSection('integracoes')}
                  className={`leo-nav-group-header ${leoSection === 'integracoes' ? 'active' : ''}`}
                >
                  <Cpu size={15} />
                  <div>
                    <div>Integrações</div>
                    <span className="leo-nav-group-sub">Agenda, planilhas e MCP</span>
                  </div>
                </button>
              </div>

              {/* Grupo 8: IA e chave */}
              <div className="leo-nav-group">
                <button
                  type="button"
                  onClick={() => setLeoSection('ia')}
                  className={`leo-nav-group-header ${leoSection === 'ia' ? 'active' : ''}`}
                >
                  <Bot size={15} />
                  <div>
                    <div>IA e chave</div>
                    <span className="leo-nav-group-sub">A IA do plano ou a sua chave</span>
                  </div>
                </button>
              </div>

              {/* Grupo 9: Configurar com sua IA */}
              <div className="leo-nav-group">
                <button
                  type="button"
                  onClick={() => setLeoSection('config_ia')}
                  className={`leo-nav-group-header ${leoSection === 'config_ia' ? 'active' : ''}`}
                >
                  <Sparkles size={15} />
                  <div>
                    <div>Configurar com sua IA</div>
                    <span className="leo-nav-group-sub">Prompt completo do Léo e regras</span>
                  </div>
                </button>
              </div>
            </div>

            {/* COLUNA 2: CONTEÚDO CENTRAL DE CONFIGURAÇÃO DO LÉO */}
            <div className="leo-center-main">
              <p className="leo-autosave-hint">Aqui tudo entra na hora, não precisa salvar.</p>

              {/* SEÇÃO: CONHECIMENTO (DOCUMENTOS, PÁGINAS DO SITE E O QUE ELE APRENDEU) */}
              {leoSection === 'conhecimento' && (
                <>
                  {/* CARD 1: DOCUMENTOS E PÁGINAS DO SITE */}
                  <div className="leo-panel-card">
                    <h4 className="leo-panel-title">Documentos e páginas do site</h4>

                    {/* Dropzone de Upload de Documento */}
                    <div className="leo-dropzone">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.csv,.html,.json,.pdf,.docx"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                      />
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Adicione um documento
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        PDF, DOCX, planilha, HTML ou texto · até 4,5 MB
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 480, lineHeight: 1.4 }}>
                        Cada documento lê até ~100 KB de texto. Um arquivo TXT, MD ou CSV maior que isso é dividido sozinho em partes, que aparecem como &ldquo;(parte 1 de N)&rdquo;.
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="leo-btn-green"
                        style={{ marginTop: 6 }}
                      >
                        Escolher arquivo
                      </button>
                    </div>

                    {/* Buscar uma página do seu site */}
                    <form onSubmit={handleScrapeSite} className="leo-site-box">
                      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Ou busque uma página do seu site
                      </label>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <input
                          type="text"
                          placeholder="https://seusite.com.br/precos"
                          value={siteUrlInput}
                          onChange={e => setSiteUrlInput(e.target.value)}
                          className="leo-input-dark"
                        />
                        <button type="submit" disabled={scrapingSite || !siteUrlInput.trim()} className="leo-btn-green">
                          {scrapingSite ? 'Lendo...' : 'Buscar página'}
                        </button>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Leio o texto da página e guardo como documento. Páginas que pedem login, ou que montam o conteúdo no navegador, podem vir vazias.
                      </span>
                    </form>

                    {/* Aprendizado Automático com TODAS as mensagens históricas */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'var(--bg-card2)',
                        border: '1px solid var(--border)',
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ fontSize: 12 }}>
                        <strong>🧠 Aprendizado Automático com Todas as Mensagens</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          Analisa todas as conversas do histórico para aprender perguntas e respostas reais da equipe.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await waFetch('/api/whatsapp/knowledge', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'learn_from_history' }),
                            });
                            const d = await res.json();
                            if (d.success) {
                              toast.success(
                                `Analisadas ${d.scannedMessages} mensagens! ${d.learnedCount} novas lições aprendidas (Total: ${d.totalLessons}).`
                              );
                              loadLessons();
                            } else {
                              toast.error(d.error || 'Erro ao processar histórico');
                            }
                          } catch {
                            toast.error('Erro de conexão ao processar histórico');
                          }
                        }}
                        className="leo-btn-green"
                        style={{ fontSize: 12 }}
                      >
                        <Sparkles size={13} /> Aprender com Todas as Conversas
                      </button>
                    </div>

                    {/* Lista de Sites e Documentos Indexados */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {lessons
                        .filter(l => l.learned_from === 'documento' || l.topic === 'Site / Documento')
                        .map(doc => (
                          <div key={doc.id} className="leo-indexed-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 8,
                                  background: 'var(--bg-card)',
                                  border: '1px solid var(--border)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                🌐
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {doc.question}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                    privilegecontabilidade.cnt.br · 32 trechos
                                  </span>
                                  <span className="leo-pill-ready">Pronto</span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <a
                                href="https://www.privilegecontabilidade.cnt.br"
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--text-secondary)', padding: 4 }}
                                title="Abrir site"
                              >
                                <ExternalLink size={14} />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDeleteLesson(doc.id)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 4 }}
                                title="Remover documento"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>

                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      O agente consulta esses documentos sozinho quando o cliente pergunta. Não precisa citar nada no prompt.
                    </span>
                  </div>

                  {/* CARD 2: O QUE ELE APRENDEU */}
                  <div className="leo-panel-card">
                    <div>
                      <h4 className="leo-panel-title">O que ele aprendeu</h4>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>Como o agente aprende:</strong> Quando o agente te chama e você responde o cliente, ele aprende com a sua resposta.
                      </p>
                    </div>

                    <div className="leo-learn-modes">
                      <div
                        onClick={() => setLearnMode('aprovacao')}
                        className={`leo-mode-card ${learnMode === 'aprovacao' ? 'selected' : ''}`}
                      >
                        <div className="leo-mode-card-title">Com minha aprovação</div>
                        <div className="leo-mode-card-desc">O agente pergunta antes de guardar.</div>
                      </div>

                      <div
                        onClick={() => setLearnMode('automatico')}
                        className={`leo-mode-card ${learnMode === 'automatico' ? 'selected' : ''}`}
                      >
                        <div className="leo-mode-card-title">Automático</div>
                        <div className="leo-mode-card-desc">
                          O agente guarda sozinho e te avisa. Preço, prazo, troca e garantia sempre pedem sua aprovação.
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => setLearnMode(learnMode === 'desligado' ? 'aprovacao' : 'desligado')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: learnMode === 'desligado' ? 'var(--red)' : 'var(--text-muted)',
                          fontSize: 12,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        {learnMode === 'desligado' ? 'Aprendizado desligado (Clique para religar)' : 'Desligar aprendizado'}
                      </button>
                    </div>

                    {/* Lista do que ele já aprendeu */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          Ensinado no teste e no atendimento ({lessons.filter(l => l.topic !== 'Site / Documento').length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsTeachModalOpen(true)}
                          className="leo-btn-green"
                          style={{ padding: '5px 12px', fontSize: 11.5 }}
                        >
                          + Ensinar nova resposta
                        </button>
                      </div>

                      {lessons
                        .filter(l => l.topic !== 'Site / Documento')
                        .map(lesson => (
                          <div
                            key={lesson.id}
                            style={{
                              background: 'var(--bg-card2)',
                              border: '1px solid var(--border)',
                              borderRadius: 12,
                              padding: 14,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
                                {lesson.topic} · Usada {lesson.usage_count}x
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteLesson(lesson.id)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                              <strong>Pergunta do cliente:</strong> {lesson.question}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                              <strong>Resposta do dono:</strong> {lesson.answer}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}

              {/* SEÇÃO: O QUE ELE FALA E COMO FALA */}
              {leoSection === 'fala' && (
                <>
                  <div className="leo-panel-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 className="leo-panel-title">Nome, Foto e Mensagem de Abertura</h4>
                      {savedBadge && <span className="leo-pill-ready">✓ Salvo na hora</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                          Nome do Atendente Virtual
                        </label>
                        <input
                          type="text"
                          value={config?.profile_name || 'Léo - Privilege Consultoria'}
                          onChange={e =>
                            setConfig(prev => (prev ? { ...prev, profile_name: e.target.value } : null))
                          }
                          onBlur={() => handleSaveConfig({ profile_name: config?.profile_name })}
                          className="leo-input-dark"
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                          Mensagem de Boas-Vindas (quando o cliente manda &ldquo;Oi&rdquo; / &ldquo;Olá&rdquo;)
                        </label>
                        <textarea
                          rows={3}
                          value={config?.welcome_message || ''}
                          onChange={e =>
                            setConfig(prev => (prev ? { ...prev, welcome_message: e.target.value } : null))
                          }
                          onBlur={() => handleSaveConfig({ welcome_message: config?.welcome_message })}
                          className="leo-input-dark"
                          style={{ width: '100%', lineHeight: 1.5 }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                          Sobre o negócio e diretrizes de fala (escrito pelo dono)
                        </label>
                        <textarea
                          rows={6}
                          value={config?.bot_prompt || ''}
                          onChange={e =>
                            setConfig(prev => (prev ? { ...prev, bot_prompt: e.target.value } : null))
                          }
                          onBlur={() => handleSaveConfig({ bot_prompt: config?.bot_prompt })}
                          className="leo-input-dark"
                          style={{ width: '100%', lineHeight: 1.5 }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveConfig({
                              profile_name: config?.profile_name,
                              welcome_message: config?.welcome_message,
                              bot_prompt: config?.bot_prompt,
                            })
                          }
                          className="leo-btn-green"
                        >
                          Salvar Identidade e Fala
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="leo-panel-card">
                    <h4 className="leo-panel-title">Relógio e fuso horário (Funcionamento 24h)</h4>
                    <div className="leo-learn-modes">
                      <div
                        onClick={() =>
                          handleSaveConfig({
                            off_hours_message: '',
                            business_hours: {
                              seg: { ativo: true, inicio: '00:00', fim: '23:59' },
                              ter: { ativo: true, inicio: '00:00', fim: '23:59' },
                              qua: { ativo: true, inicio: '00:00', fim: '23:59' },
                              qui: { ativo: true, inicio: '00:00', fim: '23:59' },
                              sex: { ativo: true, inicio: '00:00', fim: '23:59' },
                              sab: { ativo: true, inicio: '00:00', fim: '23:59' },
                              dom: { ativo: true, inicio: '00:00', fim: '23:59' },
                            },
                          })
                        }
                        className={`leo-mode-card ${!config?.off_hours_message ? 'selected' : ''}`}
                      >
                        <div className="leo-mode-card-title">Atende 24 horas, todos os dias</div>
                        <div className="leo-mode-card-desc">
                          O Léo responde imediatamente em qualquer horário e dia da semana.
                        </div>
                      </div>

                      <div
                        onClick={() =>
                          handleSaveConfig({
                            off_hours_message:
                              'Olá! Nosso expediente comercial é de segunda a sexta, das 08h às 18h. Assim que retornarmos nossa equipe te responde por aqui!',
                          })
                        }
                        className={`leo-mode-card ${config?.off_hours_message ? 'selected' : ''}`}
                      >
                        <div className="leo-mode-card-title">Horário Comercial com Aviso</div>
                        <div className="leo-mode-card-desc">
                          Envia mensagem de ausência fora do horário comercial configurado.
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* SEÇÃO: ÁUDIO, VOZ DIRETA, FOTOS E ASSISTENTES */}
              {leoSection === 'midia' && (
                <div className="leo-panel-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h4 className="leo-panel-title">Áudio Direto, Voz & Assistentes (Léo / Clara / Novos)</h4>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                        Configure para o assistente ouvir áudios do cliente e responder com nota de voz real direto no WhatsApp.
                      </p>
                    </div>
                    {savedBadge && <span className="leo-pill-ready">✓ Salvo na hora</span>}
                  </div>

                  {/* Controles principais de Áudio */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label className="leo-indexed-item" style={{ cursor: 'pointer', borderColor: config?.reply_audio_on_audio !== false ? 'var(--green)' : undefined }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                          🎤 Enviar áudio direto quando o cliente responder com áudio
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          O sistema transcreve o áudio do cliente, gera a resposta do Léo/Clara e envia uma nota de voz (PTT) direto no WhatsApp.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={config?.reply_audio_on_audio !== false}
                        onChange={e =>
                          handleSaveConfig({ reply_audio_on_audio: e.target.checked })
                        }
                      />
                    </label>

                    <label className="leo-indexed-item" style={{ cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                          🔊 Sempre responder com áudio (mesmo quando o cliente mandar texto)
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          Se ativado, todas as respostas do assistente ativo serão enviadas em formato de áudio no WhatsApp.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!config?.always_reply_audio}
                        onChange={e =>
                          handleSaveConfig({ always_reply_audio: e.target.checked })
                        }
                      />
                    </label>

                    <label className="leo-indexed-item" style={{ cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                          Analisar fotos, comprovantes e documentos PDF/XML
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          Identifica imagens e arquivos anexados na conversa
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={understandImages}
                        onChange={e => setUnderstandImages(e.target.checked)}
                      />
                    </label>
                  </div>

                  {/* Gestão de Assistentes (Léo, Clara e criar nova assistente) */}
                  <div className="leo-site-box" style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                          🤖 Assistentes de Voz & Atendimento Disponíveis
                        </strong>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          Alterne entre o Léo (voz masculina), a Clara (voz feminina) ou crie uma nova assistente exclusiva.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsNewAssistantOpen(v => !v)}
                        className="leo-btn-green"
                        style={{ padding: '6px 12px', fontSize: 11.5 }}
                      >
                        <Plus size={13} /> {isNewAssistantOpen ? 'Fechar Formulário' : 'Criar Nova Assistente'}
                      </button>
                    </div>

                    {isNewAssistantOpen && (
                      <form
                        onSubmit={handleCreateAssistant}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: 12,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                              Nome da Assistente / Assistente:
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: Sofia, Ana, Marcos..."
                              value={newAstName}
                              onChange={e => setNewAstName(e.target.value)}
                              required
                              className="leo-input-dark"
                              style={{ width: '100%' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                              Voz (Gênero):
                            </label>
                            <select
                              value={newAstGender}
                              onChange={e => setNewAstGender(e.target.value as 'female' | 'male')}
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                fontSize: 12.5,
                                borderRadius: 8,
                                border: '1px solid var(--border)',
                                background: 'var(--bg-card)',
                              }}
                            >
                              <option value="female">👩 Voz Feminina (PT-BR / Nova)</option>
                              <option value="male">👨 Voz Masculina (PT-BR / Onyx)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                            Especialidade / Função:
                          </label>
                          <input
                            type="text"
                            value={newAstRole}
                            onChange={e => setNewAstRole(e.target.value)}
                            className="leo-input-dark"
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                            Personalidade / Instrução Extra (opcional):
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Ex: Foco em atendimento humanizado por áudio, fechamento de BPO Financeiro..."
                            value={newAstPrompt}
                            onChange={e => setNewAstPrompt(e.target.value)}
                            className="leo-input-dark"
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={newAstReplyAudioOnAudio}
                              onChange={e => setNewAstReplyAudioOnAudio(e.target.checked)}
                            />
                            Responder áudios com áudio direto
                          </label>
                          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={newAstAlwaysAudio}
                              onChange={e => setNewAstAlwaysAudio(e.target.checked)}
                            />
                            Sempre responder em áudio
                          </label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => setIsNewAssistantOpen(false)}
                            className="wa-btn wa-btn-secondary"
                            style={{ fontSize: 12 }}
                          >
                            Cancelar
                          </button>
                          <button type="submit" className="leo-btn-green">
                            <Check size={13} /> Criar e Ativar Assistente
                          </button>
                        </div>
                      </form>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
                      {(config?.assistants && config.assistants.length > 0
                        ? config.assistants
                        : [
                          {
                            id: 'leo',
                            name: 'Léo',
                            role: 'Atendente Comercial & Triagem 360º',
                            gender: 'male' as const,
                            voiceId: 'onyx',
                            avatarColor: '#600000',
                            replyAudioOnAudio: true,
                            alwaysReplyAudio: false,
                          },
                          {
                            id: 'clara',
                            name: 'Clara',
                            role: 'Assistente Executiva de Voz & Relacionamento',
                            gender: 'female' as const,
                            voiceId: 'nova',
                            avatarColor: '#0f766e',
                            replyAudioOnAudio: true,
                            alwaysReplyAudio: false,
                          },
                        ]
                      ).map(ast => {
                        const isActive = (config?.active_assistant_id || 'leo') === ast.id;
                        return (
                          <div
                            key={ast.id}
                            onClick={() =>
                              handleSaveConfig({
                                active_assistant_id: ast.id,
                                reply_audio_on_audio: ast.replyAudioOnAudio,
                                always_reply_audio: ast.alwaysReplyAudio,
                              })
                            }
                            className={`leo-mode-card ${isActive ? 'selected' : ''}`}
                            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div className="leo-mode-card-title" style={{ margin: 0 }}>
                                {ast.gender === 'female' ? '👩' : '👨'} {ast.name}
                              </div>
                              {isActive && (
                                <span className="leo-pill-ready">✓ Ativo no WhatsApp</span>
                              )}
                            </div>
                            <div className="leo-mode-card-desc">{ast.role}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                              🎤 {ast.replyAudioOnAudio ? 'Áudio → Áudio direto ativo' : 'Apenas texto'}
                              {ast.alwaysReplyAudio ? ' · Sempre áudio' : ''}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SEÇÃO: RITMO DA CONVERSA */}
              {leoSection === 'ritmo' && (
                <div className="leo-panel-card">
                  <h4 className="leo-panel-title">Ritmo da conversa (Tempo e jeito de mandar)</h4>
                  <div className="leo-learn-modes">
                    <div
                      onClick={() => setShortMessages(true)}
                      className={`leo-mode-card ${shortMessages ? 'selected' : ''}`}
                    >
                      <div className="leo-mode-card-title">Mensagens curtas e diretas</div>
                      <div className="leo-mode-card-desc">
                        Respostas enxutas estilo WhatsApp, fáceis de ler no celular.
                      </div>
                    </div>

                    <div
                      onClick={() => setShortMessages(false)}
                      className={`leo-mode-card ${!shortMessages ? 'selected' : ''}`}
                    >
                      <div className="leo-mode-card-title">Mensagens completas</div>
                      <div className="leo-mode-card-desc">
                        Explicações detalhadas em um único bloco de mensagem.
                      </div>
                    </div>
                  </div>

                  <label className="leo-indexed-item" style={{ cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Mostrar &ldquo;Digitando...&rdquo; no WhatsApp antes de responder
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        Torna a experiência mais natural e próxima para o cliente
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={typingIndicator}
                      onChange={e => setTypingIndicator(e.target.checked)}
                    />
                  </label>
                </div>
              )}

              {/* SEÇÃO: QUANDO VOCÊ ASSUME */}
              {leoSection === 'humano' && (
                <div className="leo-panel-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 className="leo-panel-title">Quando você assume (Pausa da IA e transbordo)</h4>
                    {savedBadge && <span className="leo-pill-ready">✓ Salvo na hora</span>}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                    Quando um consultor envia uma mensagem para o cliente ou quando o Léo conclui a triagem, o robô pausa automaticamente para não interromper.
                  </p>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      Tempo de pausa automática do Léo quando humano assume (minutos):
                    </label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[15, 30, 45, 60, 120].map(mins => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => handleSaveConfig({ human_takeover_minutes: mins })}
                          className={
                            config?.human_takeover_minutes === mins
                              ? 'leo-btn-green'
                              : 'wa-btn wa-btn-secondary'
                          }
                        >
                          {mins} min
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="leo-site-box">
                    <strong style={{ fontSize: 12, color: 'var(--accent)' }}>
                      Regra de transferência do Léo:
                    </strong>
                    <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
                      Quando não souber ou após coletar o <strong>nome</strong> e <strong>o que o cliente procura</strong>, o Léo avisa que vai chamar alguém da equipe que responde por aqui mesmo (sem prometer tempo de resposta).
                    </span>
                  </div>
                </div>
              )}

              {/* SEÇÃO: VENDAS E RETORNO */}
              {leoSection === 'vendas' && (
                <div className="leo-panel-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 className="leo-panel-title">Vendas, Triagem e Retorno (Gatilhos Rápidos)</h4>
                    {savedBadge && <span className="leo-pill-ready">✓ Salvo na hora</span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {config?.auto_reply_rules?.map((rule, idx) => (
                      <div key={rule.id || idx} className="leo-indexed-item">
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                            {rule.gatilhos.map((g, gIdx) => (
                              <span key={gIdx} className="leo-pill-ready">
                                {g}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{rule.resposta}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddRule} className="leo-site-box">
                    <strong style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
                      + Adicionar novo gatilho de venda ou resposta rápida
                    </strong>
                    <input
                      type="text"
                      placeholder="Palavras-chave separadas por vírgula (ex: holding, abertura, filial)"
                      value={newGatilhos}
                      onChange={e => setNewGatilhos(e.target.value)}
                      className="leo-input-dark"
                    />
                    <textarea
                      rows={2}
                      placeholder="O que o Léo deve responder quando o cliente falar isso..."
                      value={newResposta}
                      onChange={e => setNewResposta(e.target.value)}
                      className="leo-input-dark"
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={newPausarBot}
                          onChange={e => setNewPausarBot(e.target.checked)}
                        />
                        Chamar equipe humana após responder
                      </label>
                      <button type="submit" className="leo-btn-green">
                        Adicionar Gatilho
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* SEÇÃO: INTEGRAÇÕES (CLAUDE MCP, CHATGPT ACTIONS & WEBHOOK) */}
              {leoSection === 'integracoes' && (
                <div className="leo-panel-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <h4 className="leo-panel-title">Integrações Diretas: Conectar Claude, ChatGPT e Webhook</h4>
                    <span className="leo-pill-ready">Bridge MCP & OpenAPI 3.1 Ativa</span>
                  </div>

                  {/* 1. Conectar Claude (Anthropic MCP) */}
                  <div className="leo-site-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                        🟣 1. Conectar ao Claude (Claude Desktop / Claude Web MCP)
                      </label>
                      <span className="wa-tag" style={{ background: 'rgba(96,0,0,0.08)', color: 'var(--accent)' }}>
                        Protocolo JSON-RPC 2.0 (lharries/whatsapp-mcp)
                      </span>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0 }}>
                      Permite ao Claude ler conversas, enviar mensagens no WhatsApp, agendar follow-ups e consultar dados fiscais em tempo real.
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input type="text" readOnly value={mcpUrl} className="leo-input-dark" />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(mcpUrl);
                          alert('URL do Servidor MCP copiada para conectar no Claude!');
                        }}
                        className="leo-btn-green"
                      >
                        <Copy size={13} /> Copiar URL MCP
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const claudeConfig = JSON.stringify(
                            {
                              mcpServers: {
                                'privilege-whatsapp': {
                                  command: 'npx',
                                  args: ['-y', 'mcp-remote', mcpUrl],
                                },
                              },
                            },
                            null,
                            2
                          );
                          navigator.clipboard.writeText(claudeConfig);
                          alert('JSON do claude_desktop_config.json copiado! Cole nas configurações de Developer do Claude.');
                        }}
                        className="wa-btn wa-btn-secondary"
                        style={{ fontSize: 12 }}
                      >
                        <Copy size={13} /> Copiar Config Claude Desktop
                      </button>
                    </div>
                  </div>

                  {/* 2. Conectar ChatGPT (OpenAI Custom GPT Actions) */}
                  <div className="leo-site-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                        🟢 2. Conectar ao ChatGPT (OpenAI GPT Actions / OpenAPI 3.1)
                      </label>
                      <span className="wa-tag" style={{ background: 'rgba(21,128,61,0.1)', color: 'var(--green)' }}>
                        OpenAPI 3.1.0 Schema
                      </span>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0 }}>
                      No ChatGPT, acesse <strong>Explore GPTs → Create → Configure → Actions → Import from URL</strong> e cole o endereço abaixo para conectar o ChatGPT ao seu WhatsApp:
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        readOnly
                        value={`${mcpUrl}?format=openapi`}
                        className="leo-input-dark"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${mcpUrl}?format=openapi`);
                          alert('URL OpenAPI copiada! Cole em "Import from URL" nas Actions do ChatGPT.');
                        }}
                        className="leo-btn-green"
                      >
                        <Copy size={13} /> Copiar URL para ChatGPT
                      </button>
                    </div>
                  </div>

                  {/* 3. Conectar Gemini (Google Gemini CLI / Antigravity MCP) */}
                  <div className="leo-site-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>
                        🔵 3. Conectar ao Gemini (Gemini CLI / Antigravity / MCP)
                      </label>
                      <span className="wa-tag" style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--blue)' }}>
                        MCP HTTP / JSON-RPC 2.0
                      </span>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0 }}>
                      Conecte o Google Gemini via MCP (no <strong>Gemini CLI</strong>, <strong>Antigravity</strong> ou clientes compatíveis com <code>mcpServers</code>) para ler conversas, responder clientes e gerenciar o WhatsApp.
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input type="text" readOnly value={mcpUrl} className="leo-input-dark" />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(mcpUrl);
                          toast.success('URL MCP copiada para conectar no Gemini!');
                        }}
                        className="leo-btn-green"
                      >
                        <Copy size={13} /> Copiar URL MCP
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const geminiConfig = JSON.stringify(
                            {
                              mcpServers: {
                                'privilege-whatsapp': {
                                  httpUrl: mcpUrl,
                                },
                              },
                            },
                            null,
                            2
                          );
                          navigator.clipboard.writeText(geminiConfig);
                          toast.success('JSON do ~/.gemini/settings.json copiado!');
                        }}
                        className="wa-btn wa-btn-secondary"
                        style={{ fontSize: 12 }}
                      >
                        <Copy size={13} /> Copiar Config Gemini (JSON)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`gemini mcp add --transport http privilege-whatsapp ${mcpUrl}`);
                          toast.success('Comando gemini mcp add copiado!');
                        }}
                        className="wa-btn wa-btn-secondary"
                        style={{ fontSize: 12 }}
                      >
                        <Copy size={13} /> Copiar Comando CLI
                      </button>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: '1px dashed var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Configurar Servidor MCP Externo da Gemini (opcional)
                      </label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          placeholder="URL do Servidor MCP da Gemini (ex: https://seu-mcp-gemini/mcp)"
                          value={config?.gemini_mcp_url || ''}
                          onChange={e =>
                            setConfig(prev => (prev ? { ...prev, gemini_mcp_url: e.target.value } : prev))
                          }
                          className="leo-input-dark"
                          style={{ flex: '2 1 240px' }}
                        />
                        <input
                          type="password"
                          placeholder="Token / Chave MCP Gemini (opcional)"
                          value={config?.gemini_mcp_token || ''}
                          onChange={e =>
                            setConfig(prev => (prev ? { ...prev, gemini_mcp_token: e.target.value } : prev))
                          }
                          className="leo-input-dark"
                          style={{ flex: '1 1 180px' }}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await waFetch('/api/whatsapp/config', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  gemini_mcp_url: config?.gemini_mcp_url || '',
                                  gemini_mcp_token: config?.gemini_mcp_token || '',
                                }),
                              });
                              const d = await res.json();
                              if (d.success) {
                                toast.success('Configuração MCP da Gemini salva!');
                              } else {
                                toast.error(d.error || 'Erro ao salvar MCP da Gemini');
                              }
                            } catch {
                              toast.error('Erro de conexão ao salvar MCP da Gemini');
                            }
                          }}
                          className="leo-btn-green"
                        >
                          <Check size={13} /> Salvar MCP Gemini
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4. Webhook */}
                  <div className="leo-site-box">
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                      🔗 4. Webhook de Recebimento em Tempo Real
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="text" readOnly value={webhookUrl} className="leo-input-dark" />
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(webhookUrl)}
                        className="leo-btn-green"
                      >
                        <Copy size={13} /> Copiar Webhook
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SEÇÃO: IA E CHAVE (CONECTAR CLAUDE, CHATGPT E GEMINI) */}
              {leoSection === 'ia' && (
                <div className="leo-panel-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h4 className="leo-panel-title">Conectar Inteligência Artificial: Claude, ChatGPT e Gemini</h4>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                        Escolha qual IA comanda o assistente Léo e conecte suas chaves da Anthropic (Claude), OpenAI (ChatGPT) ou Google Gemini.
                      </p>
                    </div>
                    {savedBadge && <span className="leo-pill-ready">✓ Salvo na hora</span>}
                  </div>

                  {/* Seleção do Provedor Ativo (Claude vs ChatGPT vs Gemini) */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                      1. Escolha o Motor de IA Principal do Assistente Léo:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                      <div
                        onClick={() => handleSaveConfig({ ai_provider: 'groq' })}
                        className={`leo-mode-card ${(!config?.ai_provider || config?.ai_provider === 'groq') ? 'selected' : ''}`}
                      >
                        <div className="leo-mode-card-title">⚡ Groq (padrão, gratuito)</div>
                        <div className="leo-mode-card-desc">
                          GPT-OSS e Qwen na cota gratuita da Groq. É sempre tentada primeiro; os demais motores entram só como contingência.
                        </div>
                      </div>

                      <div
                        onClick={() => handleSaveConfig({ ai_provider: 'ollama' })}
                        className={`leo-mode-card ${config?.ai_provider === 'ollama' ? 'selected' : ''}`}
                      >
                        <div className="leo-mode-card-title">🦙 Ollama</div>
                        <div className="leo-mode-card-desc">
                          Servidor Ollama próprio (OLLAMA_BASE_URL). Usado quando houver um endereço configurado.
                        </div>
                      </div>

                      <div
                        onClick={() =>
                          handleSaveConfig({
                            ai_provider: 'claude',
                            ai_model: 'claude-3-5-sonnet-latest',
                          })
                        }
                        className={`leo-mode-card ${config?.ai_provider === 'claude' ? 'selected' : ''}`}
                      >
                        <div className="leo-mode-card-title">🟣 Claude (Anthropic)</div>
                        <div className="leo-mode-card-desc">
                          Claude 3.5 / 3.7 Sonnet & Haiku. Excelente escrita natural, empatia e raciocínio contábil.
                        </div>
                      </div>

                      <div
                        onClick={() =>
                          handleSaveConfig({
                            ai_provider: 'openai',
                            ai_model: 'gpt-4o-mini',
                          })
                        }
                        className={`leo-mode-card ${config?.ai_provider === 'openai' ? 'selected' : ''}`}
                      >
                        <div className="leo-mode-card-title">🟢 ChatGPT (OpenAI)</div>
                        <div className="leo-mode-card-desc">
                          GPT-4o e GPT-4o-mini. Respostas comerciais rápidas, objetivas e estruturadas.
                        </div>
                      </div>

                      <div
                        onClick={() =>
                          handleSaveConfig({
                            ai_provider: 'gemini',
                            ai_model: 'gemini-2.5-flash',
                          })
                        }
                        className={`leo-mode-card ${config?.ai_provider === 'gemini' ? 'selected' : ''}`}
                      >
                        <div className="leo-mode-card-title">🔵 Google Gemini</div>
                        <div className="leo-mode-card-desc">
                          Gemini 2.5 Flash & Pro. Alta velocidade e integração nativa com o ecossistema Google.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 1: Chave API Claude (Anthropic) */}
                  <div className="leo-site-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                        🟣 Chave de API do Claude (Anthropic API Key)
                      </label>
                      <span
                        className="wa-tag"
                        style={{
                          background: config?.claude_api_key ? 'rgba(21,128,61,0.12)' : 'var(--border)',
                          color: config?.claude_api_key ? 'var(--green)' : 'var(--text-muted)',
                        }}
                      >
                        {config?.claude_api_key ? '✓ Chave Claude Configurada' : 'Opcional'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="password"
                        placeholder="sk-ant-api03-..."
                        value={config?.claude_api_key || ''}
                        onChange={e =>
                          setConfig(prev => (prev ? { ...prev, claude_api_key: e.target.value } : null))
                        }
                        className="leo-input-dark"
                      />
                      <select
                        value={
                          config?.ai_model?.startsWith('claude-')
                            ? config.ai_model
                            : 'claude-3-5-sonnet-latest'
                        }
                        onChange={e =>
                          handleSaveConfig({
                            ai_provider: 'claude',
                            ai_model: e.target.value,
                          })
                        }
                        style={{ padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                      >
                        <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Recomendado)</option>
                        <option value="claude-3-7-sonnet-latest">Claude 3.7 Sonnet</option>
                        <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku (Mais Rápido)</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          handleSaveConfig({
                            ai_provider: 'claude',
                            claude_api_key: config?.claude_api_key,
                          })
                        }
                        className="leo-btn-green"
                      >
                        Conectar Claude
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Chave API ChatGPT (OpenAI) */}
                  <div className="leo-site-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                        🟢 Chave de API do ChatGPT (OpenAI API Key)
                      </label>
                      <span
                        className="wa-tag"
                        style={{
                          background: config?.openai_api_key ? 'rgba(21,128,61,0.12)' : 'var(--border)',
                          color: config?.openai_api_key ? 'var(--green)' : 'var(--text-muted)',
                        }}
                      >
                        {config?.openai_api_key ? '✓ Chave ChatGPT Configurada' : 'Opcional'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="password"
                        placeholder="sk-proj-..."
                        value={config?.openai_api_key || ''}
                        onChange={e =>
                          setConfig(prev => (prev ? { ...prev, openai_api_key: e.target.value } : null))
                        }
                        className="leo-input-dark"
                      />
                      <select
                        value={
                          config?.ai_model?.startsWith('gpt-')
                            ? config.ai_model
                            : 'gpt-4o-mini'
                        }
                        onChange={e =>
                          handleSaveConfig({
                            ai_provider: 'openai',
                            ai_model: e.target.value,
                          })
                        }
                        style={{ padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                      >
                        <option value="gpt-4o-mini">GPT-4o Mini (Rápido & Econômico)</option>
                        <option value="gpt-4o">GPT-4o (Completo)</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          handleSaveConfig({
                            ai_provider: 'openai',
                            openai_api_key: config?.openai_api_key,
                          })
                        }
                        className="leo-btn-green"
                      >
                        Conectar ChatGPT
                      </button>
                    </div>
                  </div>

                  {/* Card 3: Chave API Google Gemini */}
                  <div className="leo-site-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                        🔵 Chave de API do Google Gemini (Google AI Studio)
                      </label>
                      <span
                        className="wa-tag"
                        style={{
                          background: 'rgba(21,128,61,0.12)',
                          color: 'var(--green)',
                        }}
                      >
                        {config?.gemini_api_key ? '✓ Chave Própria Ativa' : '✓ Usando Chave do Sistema'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="password"
                        placeholder="AIzaSy... (ou deixe em branco para usar a do plano)"
                        value={config?.gemini_api_key || ''}
                        onChange={e =>
                          setConfig(prev => (prev ? { ...prev, gemini_api_key: e.target.value } : null))
                        }
                        className="leo-input-dark"
                      />
                      <select
                        value={
                          config?.ai_model?.startsWith('gemini-')
                            ? config.ai_model
                            : 'gemini-2.5-flash'
                        }
                        onChange={e =>
                          handleSaveConfig({
                            ai_provider: 'gemini',
                            ai_model: e.target.value,
                          })
                        }
                        style={{ padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                      >
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          handleSaveConfig({
                            ai_provider: 'gemini',
                            gemini_api_key: config?.gemini_api_key,
                          })
                        }
                        className="leo-btn-green"
                      >
                        Salvar Gemini
                      </button>
                    </div>
                  </div>

                  {/* Botão de Teste de Conexão da IA */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      type="button"
                      disabled={testingAiProvider}
                      onClick={() => handleTestAiConnection()}
                      className="wa-btn wa-btn-secondary"
                      style={{ fontSize: 12 }}
                    >
                      <Zap size={14} color="var(--yellow)" />{' '}
                      {testingAiProvider
                        ? 'Testando conexão com a IA...'
                        : `Testar Resposta da IA Ativa (${(config?.ai_provider || 'groq').toUpperCase()})`}
                    </button>

                    {aiTestResult && (
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                        {aiTestResult}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SEÇÃO: CONFIGURAR COM SUA IA (CLAUDE, CHATGPT OU CODEX) */}
              {leoSection === 'config_ia' && (
                <div className="leo-panel-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h4 className="leo-panel-title">Configurar com sua IA (Claude, ChatGPT ou Gemini)</h4>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                        Peça ao Claude, ao ChatGPT ou digite abaixo para ajustar o comportamento e ensinar novas regras ao Léo.
                      </p>
                    </div>
                    {savedBadge && <span className="leo-pill-ready">✓ Salvo na hora</span>}
                  </div>

                  {/* Atalhos para abrir/copiar instruções para Claude e ChatGPT */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="leo-site-box">
                      <strong style={{ fontSize: 12.5, color: 'var(--accent)' }}>
                        🟣 Configurar usando o Claude (Anthropic)
                      </strong>
                      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        Copie o prompt-base do Léo com o conector MCP para colar no Claude e pedir novos ajustes.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const text = `Estou configurando o assistente virtual Léo da Privilege Contabilidade e Consultoria no WhatsApp.\nEndpoint MCP: ${mcpUrl}\n\nPrompt atual do Léo:\n${config?.bot_prompt || ''}\n\nMe ajude a refinar as respostas e criar novos gatilhos de vendas mantendo todas as regras do ramo de Serviços Profissionais.`;
                          navigator.clipboard.writeText(text);
                          alert('Prompt de configuração copiado para usar no Claude!');
                        }}
                        className="leo-btn-green"
                        style={{ alignSelf: 'flex-start' }}
                      >
                        <Copy size={13} /> Copiar Contexto para o Claude
                      </button>
                    </div>

                    <div className="leo-site-box">
                      <strong style={{ fontSize: 12.5, color: 'var(--green)' }}>
                        🟢 Configurar usando o ChatGPT (OpenAI)
                      </strong>
                      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        Copie o contexto + Schema OpenAPI para montar ou treinar o atendente junto com o ChatGPT.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const text = `Estou configurando o assistente virtual Léo da Privilege Contabilidade e Consultoria no WhatsApp.\nSchema OpenAPI (Actions): ${mcpUrl}?format=openapi\n\nPrompt atual do Léo:\n${config?.bot_prompt || ''}\n\nMe ajude a criar novas perguntas e respostas para a base de conhecimento do Léo.`;
                          navigator.clipboard.writeText(text);
                          alert('Prompt de configuração copiado para usar no ChatGPT!');
                        }}
                        className="leo-btn-green"
                        style={{ alignSelf: 'flex-start', background: 'var(--green)' }}
                      >
                        <Copy size={13} /> Copiar Contexto para o ChatGPT
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleApplyAiConfig} className="leo-site-box">
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>
                      Ou digite diretamente uma instrução para aplicar no Léo agora:
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        placeholder="Ex.: Se perguntarem sobre BPO financeiro, diga que fazemos conciliação diária..."
                        value={aiConfigInstruction}
                        onChange={e => setAiConfigInstruction(e.target.value)}
                        className="leo-input-dark"
                      />
                      <button type="submit" disabled={!aiConfigInstruction.trim()} className="leo-btn-green">
                        Aplicar no Léo
                      </button>
                    </div>
                  </form>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Prompt completo e regras literais do Léo:
                    </label>
                    <textarea
                      rows={12}
                      value={config?.bot_prompt || ''}
                      onChange={e => setConfig(prev => (prev ? { ...prev, bot_prompt: e.target.value } : null))}
                      className="leo-input-dark"
                      style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        Regras de Serviços Profissionais ativas: Discrição, sem parecer técnico, sem prometer prazo.
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSaveConfig({ bot_prompt: config?.bot_prompt })}
                        className="leo-btn-green"
                      >
                        Salvar Prompt Completo
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* COLUNA 3: PAINEL TESTAR AO VIVO */}
            <div className="leo-tester-sidebar">
              <div className="leo-tester-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="leo-agent-avatar" style={{ width: 28, height: 28 }}>
                    <Bot size={15} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Testar Assistente Léo
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--green)', fontWeight: 600 }}>
                      ⚡ Responde na hora, sem o ritmo da conversa
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSimHistory([]);
                    setSimTriageState(null);
                  }}
                  className="wa-btn wa-btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 11 }}
                >
                  Recomeçar
                </button>
              </div>

              <div className="leo-tester-body">
                {simHistory.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'rgba(96, 0, 0, 0.08)',
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 10px',
                      }}
                    >
                      <MessageSquare size={20} />
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Envie uma mensagem para começar
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      Teste como o agente Léo responderá
                    </div>
                  </div>
                ) : (
                  simHistory.map((m, idx) => {
                    const prevUserMsg = idx > 0 && simHistory[idx - 1].from === 'user' ? simHistory[idx - 1].text : '';
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: m.from === 'user' ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '88%',
                            padding: '10px 14px',
                            borderRadius: 14,
                            fontSize: 12.5,
                            lineHeight: 1.45,
                            background: m.from === 'user' ? 'var(--accent)' : 'var(--bg-card)',
                            color: m.from === 'user' ? '#ffffff' : 'var(--text-primary)',
                            fontWeight: m.from === 'user' ? 500 : 400,
                            border: m.from === 'user' ? 'none' : '1px solid var(--border)',
                            boxShadow: 'var(--shadow-sm)',
                          }}
                        >
                          <div>{m.text}</div>
                        </div>

                        {m.from === 'bot' && prevUserMsg && (
                          <button
                            type="button"
                            onClick={() => handleOpenTeachForQuestion(prevUserMsg)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--accent)',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              marginTop: 4,
                              padding: '2px 4px',
                            }}
                          >
                            ✏️ Ensinar resposta melhor
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
                {simLoading && (
                  <div style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600 }}>
                    Léo está respondendo...
                  </div>
                )}
              </div>

              {/* Pré-visualização de anexo no Simulador antes de enviar */}
              <input
                ref={simFileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.xml,.txt"
                onChange={handleSimFileSelect}
                style={{ display: 'none' }}
              />
              {simPendingFile && (
                <div className="wa-attachment-preview-bar" style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    {simPendingFile.mediaType === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={simPendingFile.mediaUrl}
                        alt={simPendingFile.fileName}
                        className="wa-attachment-thumb"
                        style={{ width: 38, height: 38 }}
                      />
                    ) : (
                      <FileText size={18} color="var(--accent)" />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {simPendingFile.fileName}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        Pronto para conferência antes de enviar
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSimPendingFile(null)}
                    className="wa-btn wa-btn-danger"
                    style={{ padding: '3px 7px', fontSize: 10.5 }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <form onSubmit={handleTestSimulator} className="leo-tester-footer">
                <button
                  type="button"
                  onClick={() => simFileInputRef.current?.click()}
                  className="wa-attach-btn"
                  style={{ width: 34, height: 34 }}
                  title="Anexar arquivo ou imagem para testar (fica na tela para conferir)"
                >
                  <Paperclip size={15} />
                </button>
                <input
                  id="leo-tester-input"
                  type="text"
                  placeholder="Ex.: vocês atendem somente financeiro?"
                  value={simPrompt}
                  onChange={e => setSimPrompt(e.target.value)}
                  className="leo-input-dark"
                />
                <button
                  type="submit"
                  disabled={simLoading || (!simPrompt.trim() && !simPendingFile)}
                  className="leo-btn-green"
                  style={{ padding: '9px 12px' }}
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: CRM & FOLLOW-UP DE ATENDIMENTO                                     */}
      {/* ========================================================================= */}
      {activeTab === 'crm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Métricas do Pipeline CRM */}
          <div className="crm-stats-grid" style={{ marginBottom: 0 }}>
            <div className="crm-stat-card">
              <div className="crm-stat-label">Chamados em Aberto</div>
              <div className="crm-stat-val">{openChatsCount}</div>
            </div>
            <div className="crm-stat-card">
              <div className="crm-stat-label">Chamados Encerrados</div>
              <div className="crm-stat-val" style={{ color: 'var(--green)' }}>
                {closedChatsCount}
              </div>
            </div>
            <div className="crm-stat-card">
              <div className="crm-stat-label">Follow-ups Ativos</div>
              <div className="crm-stat-val" style={{ color: 'var(--yellow)' }}>
                {pendingFollowups}
              </div>
            </div>
            <div className="crm-stat-card">
              <div className="crm-stat-label">Valor em Pipeline</div>
              <div className="crm-stat-val" style={{ color: 'var(--accent)' }}>
                R$ {totalPipelineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* CENTRAL DE AGENDA DE FOLLOW-UP */}
          <div className="wa-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={18} color="var(--yellow)" /> Central de Follow-up & Retorno Programado
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  Acompanhe os clientes agendados, dispare mensagens de retorno no WhatsApp com 1 clique ou configure o envio automático.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div className="wa-filter-chips" style={{ paddingBottom: 0 }}>
                  <button
                    type="button"
                    onClick={() => setFollowupFilter('pendentes')}
                    className={`wa-filter-chip ${followupFilter === 'pendentes' ? 'active' : ''}`}
                  >
                    ⏰ Pendentes ({activeFollowupsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowupFilter('atrasados')}
                    className={`wa-filter-chip ${followupFilter === 'atrasados' ? 'active' : ''}`}
                  >
                    🔴 Para Hoje / Vencidos (
                    {
                      activeFollowupsList.filter(
                        c => c.followup_date && new Date(c.followup_date) <= new Date()
                      ).length
                    }
                    )
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowupFilter('concluidos')}
                    className={`wa-filter-chip ${followupFilter === 'concluidos' ? 'active' : ''}`}
                  >
                    ✅ Concluídos (
                    {chats.filter(c => c.followup_status === 'concluido').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowupFilter('todos')}
                    className={`wa-filter-chip ${followupFilter === 'todos' ? 'active' : ''}`}
                  >
                    Todos
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenFollowupModal(selectedChat || chats[0], false)}
                  className="wa-btn wa-btn-primary"
                  style={{ fontSize: 12, padding: '7px 14px' }}
                >
                  <Plus size={14} /> Novo Follow-up
                </button>
              </div>
            </div>

            {(() => {
              const list = chats
                .filter(c => {
                  if (!c.followup_date) return false;
                  if (followupFilter === 'pendentes') return c.followup_status !== 'concluido';
                  if (followupFilter === 'atrasados') {
                    return (
                      c.followup_status !== 'concluido' &&
                      new Date(c.followup_date) <= new Date()
                    );
                  }
                  if (followupFilter === 'concluidos') return c.followup_status === 'concluido';
                  return true;
                })
                .sort(
                  (a, b) =>
                    new Date(a.followup_date || 0).getTime() -
                    new Date(b.followup_date || 0).getTime()
                );

              if (list.length === 0) {
                return (
                  <div
                    style={{
                      padding: 28,
                      textAlign: 'center',
                      background: 'var(--bg-card2)',
                      borderRadius: 12,
                      border: '1px dashed var(--border)',
                      color: 'var(--text-muted)',
                      fontSize: 13,
                    }}
                  >
                    Nenhum follow-up encontrado neste filtro. Clique em <strong>+ Novo Follow-up</strong> para agendar um retorno.
                  </div>
                );
              }

              return (
                <div className="followup-grid-list">
                  {list.map(item => {
                    const isOverdue =
                      item.followup_date &&
                      new Date(item.followup_date) <= new Date() &&
                      item.followup_status !== 'concluido';
                    const isDone = item.followup_status === 'concluido';
                    const isSent = item.followup_status === 'enviado';

                    return (
                      <div key={item.id} className="followup-item-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="wa-avatar" style={{ width: 38, height: 38 }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={getContactAvatarUrl(item)}
                                alt={item.name}
                                className="wa-avatar-img"
                              />
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {item.name}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                {item.phone} · {item.crm_stage}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {isDone ? (
                              <span className="wa-tag" style={{ background: 'rgba(21,128,61,0.12)', color: 'var(--green)' }}>
                                ✅ Concluído
                              </span>
                            ) : isSent ? (
                              <span className="wa-tag" style={{ background: 'rgba(29,78,216,0.12)', color: 'var(--blue)' }}>
                                📤 Mensagem Enviada
                              </span>
                            ) : isOverdue ? (
                              <span className="wa-tag" style={{ background: 'rgba(185,28,28,0.12)', color: 'var(--red)', fontWeight: 700 }}>
                                🔴 Vencido / Hoje
                              </span>
                            ) : (
                              <span className="wa-tag" style={{ background: 'rgba(180,83,9,0.12)', color: 'var(--yellow)', fontWeight: 700 }}>
                                ⏰ Agendado
                              </span>
                            )}
                            {item.followup_auto_send && !isDone && (
                              <span className="wa-tag" style={{ background: 'rgba(21,128,61,0.12)', color: 'var(--green)' }}>
                                ⚡ Auto
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginTop: 8 }}>
                          <div>
                            <strong>Data/Hora:</strong>{' '}
                            {new Date(item.followup_date!).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          {item.followup_note && (
                            <div style={{ marginTop: 3 }}>
                              <strong>Pauta:</strong> {item.followup_note}
                            </div>
                          )}
                          {item.followup_message && (
                            <div
                              style={{
                                marginTop: 6,
                                padding: '6px 10px',
                                background: 'var(--bg-card2)',
                                borderRadius: 8,
                                fontSize: 11.5,
                                color: 'var(--text-secondary)',
                                borderLeft: '3px solid var(--accent)',
                              }}
                            >
                              &ldquo;{item.followup_message}&rdquo;
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: '1px solid var(--border-light)',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleSendFollowupNow(item.id)}
                              className="wa-btn wa-btn-primary"
                              style={{ padding: '5px 10px', fontSize: 11.5 }}
                            >
                              <Send size={12} /> Disparar no WhatsApp
                            </button>
                            {!isDone && (
                              <button
                                type="button"
                                onClick={() => handleCompleteFollowup(item.id)}
                                className="wa-btn wa-btn-green"
                                style={{ padding: '5px 10px', fontSize: 11.5 }}
                              >
                                <Check size={12} /> Concluir
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenFollowupModal(item, false)}
                              className="wa-btn wa-btn-secondary"
                              style={{ padding: '5px 10px', fontSize: 11.5 }}
                            >
                              Editar
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              selectChat(item);
                              setActiveTab('inbox');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--accent)',
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Abrir Conversa →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Quadro Kanban de Estágios do CRM */}
          <div className="crm-kanban-board">
            {(
              [
                { id: 'lead', title: '1. Novos Leads' },
                { id: 'em_atendimento', title: '2. Em Atendimento' },
                { id: 'aguardando_documentos', title: '3. Aguardando Docs' },
                { id: 'proposta', title: '4. Proposta Enviada' },
                { id: 'fechado', title: '5. Contrato Ativo' },
              ] as const
            ).map(col => {
              const colChats = chats.filter(c => (c.crm_stage || 'em_atendimento') === col.id);

              return (
                <div key={col.id} className="crm-column">
                  <div className="crm-col-header">
                    <span>{col.title}</span>
                    <span style={{ fontSize: 11, background: 'var(--border)', padding: '2px 8px', borderRadius: 10 }}>
                      {colChats.length}
                    </span>
                  </div>

                  {colChats.map(chat => (
                    <div
                      key={chat.id}
                      className="crm-card"
                      onClick={() => {
                        selectChat(chat);
                        setActiveTab('inbox');
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="crm-card-title">{chat.name}</div>
                        {chat.ticket_status === 'encerrado' && (
                          <span style={{ fontSize: 9.5, color: 'var(--green)', fontWeight: 700 }}>
                            ✓ Encerrado
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{chat.phone}</div>

                      {chat.crm_value > 0 && (
                        <div className="crm-card-val">
                          R$ {Number(chat.crm_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      )}

                      {chat.followup_date && chat.followup_status !== 'concluido' && (
                        <div className="crm-card-followup">
                          <Clock size={12} />
                          <span>
                            {new Date(chat.followup_date).toLocaleDateString('pt-BR')}
                            {chat.followup_note ? `: ${chat.followup_note}` : ''}
                          </span>
                        </div>
                      )}

                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenFollowupModal(chat, false)}
                          className="wa-mini-action-btn"
                        >
                          ⏰ Follow-up
                        </button>
                        <span
                          onClick={() => {
                            selectChat(chat);
                            setActiveTab('inbox');
                          }}
                          style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Abrir Chat →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA: CAMPANHAS DE TRANSMISSÃO EM MASSA & ESCUDO ANTI-BANIMENTO            */}
      {/* ========================================================================= */}
      {activeTab === 'campaigns' && (
        <div className="campaign-studio-grid">
          {/* COLUNA ESQUERDA: CRIADOR DE CAMPANHA + CONFIGURAÇÃO ANTI-BAN */}
          <form onSubmit={e => handleCreateCampaign(e, true)} className="wa-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="wa-icon-badge" style={{ width: 40, height: 40 }}>
                  <Send size={19} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    Nova Campanha de Transmissão em Massa
                  </h2>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Disparo cadenciado inteligente com intervalo randômico e simulação de digitação humana
                  </p>
                </div>
              </div>
              <span className="wa-tag" style={{ background: 'rgba(21,128,61,0.12)', color: 'var(--green)', fontWeight: 700 }}>
                🛡️ Proteção Anti-Ban Ativa
              </span>
            </div>

            {/* 1. Nome da Campanha */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                1. Nome da Campanha:
              </label>
              <input
                type="text"
                placeholder="Ex: Comunicado Fechamento Fiscal / Apresentação Consultoria 360º"
                value={campName}
                onChange={e => setCampName(e.target.value)}
                required
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </div>

            {/* 2. Seleção de Destinatários */}
            <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  2. Selecionar Contatos do WhatsApp / CRM ({campSelectedChatIds.length} selecionados):
                </label>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <select
                    value={campStageFilter}
                    onChange={e => setCampStageFilter(e.target.value)}
                    style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                  >
                    <option value="todos">Todos os Estágios ({chats.length})</option>
                    <option value="lead">Apenas Leads</option>
                    <option value="em_atendimento">Em Atendimento</option>
                    <option value="aguardando_documentos">Aguardando Docs</option>
                    <option value="proposta">Em Proposta</option>
                    <option value="fechado">Contratos Fechados</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const targetList = chats
                        .filter(c => campStageFilter === 'todos' || c.crm_stage === campStageFilter)
                        .map(c => c.id);
                      setCampSelectedChatIds(targetList);
                    }}
                    className="wa-qr-chip"
                  >
                    ✓ Marcar Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampSelectedChatIds([])}
                    className="wa-qr-chip"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Lista de checkboxes de contatos */}
              <div
                style={{
                  maxHeight: 155,
                  overflowY: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: 6,
                  padding: 8,
                  background: 'var(--bg-card)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  marginBottom: 10,
                }}
              >
                {chats
                  .filter(c => campStageFilter === 'todos' || c.crm_stage === campStageFilter)
                  .map(c => {
                    const checked = campSelectedChatIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12,
                          padding: '5px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: checked ? 'rgba(96, 0, 0, 0.06)' : 'transparent',
                          border: checked ? '1px solid rgba(96, 0, 0, 0.25)' : '1px solid transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            if (e.target.checked) {
                              setCampSelectedChatIds(prev => [...prev, c.id]);
                            } else {
                              setCampSelectedChatIds(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{c.phone}</div>
                        </div>
                      </label>
                    );
                  })}
              </div>

              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Ou cole uma lista adicional de números/contatos (1 por linha — Ex: <code>Empresa Alfa, 46999998888</code>):
              </label>
              <textarea
                rows={3}
                placeholder={'Auto Posto Alvorada, 46999112233\n Construtora Horizonte, 46999445566'}
                value={campManualNumbers}
                onChange={e => setCampManualNumbers(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
              />
              {(() => {
                const alreadySentSet = new Set<string>();
                for (const camp of campaigns) {
                  for (const rec of (camp.recipients || [])) {
                    if (rec.status === 'enviado' && rec.phone) {
                      let d = String(rec.phone).replace(/[^0-9]/g, '');
                      if (d.length === 10 || d.length === 11) d = '55' + d;
                      if (d.length >= 10) {
                        alreadySentSet.add(d);
                        if (d.startsWith('55') && d.length === 13 && d[4] === '9') {
                          alreadySentSet.add(d.slice(0, 4) + d.slice(5));
                        } else if (d.startsWith('55') && d.length === 12) {
                          alreadySentSet.add(d.slice(0, 4) + '9' + d.slice(4));
                        }
                      }
                    }
                  }
                }
                const parsedDigits: string[] = [];
                for (const chatId of campSelectedChatIds) {
                  const ch = chats.find(item => item.id === chatId);
                  if (ch?.phone) {
                    let d = String(ch.phone).replace(/[^0-9]/g, '');
                    if (d.length === 10 || d.length === 11) d = '55' + d;
                    if (d.length >= 10) parsedDigits.push(d);
                  }
                }
                for (const line of campManualNumbers.split(/\r?\n/)) {
                  const cleanLine = line.trim();
                  if (!cleanLine) continue;
                  let rawPhone = cleanLine;
                  if (cleanLine.includes(',') || cleanLine.includes(';')) {
                    const parts = cleanLine.split(cleanLine.includes(',') ? ',' : ';').map(p => p.trim());
                    rawPhone = parts[0].replace(/[^0-9]/g, '').length >= 10 ? parts[0] : (parts[1] || '');
                  }
                  let d = rawPhone.replace(/[^0-9]/g, '');
                  if (d.length === 10 || d.length === 11) d = '55' + d;
                  if (d.length >= 10) parsedDigits.push(d);
                }
                if (parsedDigits.length === 0) return null;
                const uniqueDigits = Array.from(new Set(parsedDigits));
                const dupInside = parsedDigits.length - uniqueDigits.length;
                const alreadyCount = uniqueDigits.filter(d => alreadySentSet.has(d)).length;
                const newCount = campSkipAlreadySent ? uniqueDigits.length - alreadyCount : uniqueDigits.length;
                return (
                  <div
                    style={{
                      marginTop: 6,
                      padding: '7px 10px',
                      borderRadius: 6,
                      fontSize: 11.5,
                      background: alreadyCount > 0 ? 'rgba(234, 179, 8, 0.12)' : 'rgba(22, 163, 74, 0.08)',
                      border: `1px solid ${alreadyCount > 0 ? 'rgba(234, 179, 8, 0.35)' : 'rgba(22, 163, 74, 0.25)'}`,
                      color: 'var(--text-primary)',
                    }}
                  >
                    📊 <strong>{uniqueDigits.length}</strong> número(s) válido(s)
                    {dupInside > 0 ? ` (${dupInside} repetido(s) na lista removidos)` : ''}
                    {' · '}
                    <strong style={{ color: '#b45309' }}>{alreadyCount}</strong> já enviado(s) anteriormente
                    {campSkipAlreadySent && alreadyCount > 0 ? ' (serão pulados)' : ''}
                    {' · '}
                    <strong style={{ color: '#15803d' }}>{newCount}</strong> novo(s) para disparo
                  </div>
                );
              })()}
            </div>

            {/* 3. Mensagem com Variáveis & Spintax Anti-Ban */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  3. Mensagem Personalizada (com Variáveis e Spintax Anti-Ban):
                </label>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {[
                    { label: '+ {primeiro_nome}', token: '{primeiro_nome}' },
                    { label: '+ {nome}', token: '{nome}' },
                    { label: '+ {saudacao}', token: '{saudacao}' },
                    { label: '+ Spintax {Olá|Oi|Tudo bem}', token: '{Olá|Oi|Tudo bem}' },
                  ].map(v => (
                    <button
                      key={v.label}
                      type="button"
                      onClick={() => setCampMessage(prev => `${prev} ${v.token}`)}
                      className="wa-qr-chip"
                      style={{ fontSize: 11 }}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modelos rápidos de campanha (Prospecção Fria Modo 1 & Lembretes) */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {[
                  {
                    label: '🎯 Frio A: Planejamento 2027',
                    text: '{Olá|Oi|Tudo bem}, *{primeiro_nome}*! {saudacao}! Aqui é o Léo, da Privilege Consultoria de Francisco Beltrão.\n\nEstamos apoiando empresas da região na montagem do Planejamento Estratégico e Financeiro para 2027. Vocês já definiram as metas de caixa e vendas para o ano novo ou ainda estão fechando este ano?',
                  },
                  {
                    label: '💰 Frio B: Margem, Caixa & Impostos',
                    text: '{Bom dia|Olá|Tudo bem}, *{primeiro_nome}*! {saudacao}! Sou o Léo, assistente da Privilege Contabilidade e Consultoria.\n\nEstamos conversando com empresários locais sobre proteção de margem de lucro e revisão tributária para 2027. Hoje o foco maior de vocês para o próximo ano é melhorar o caixa, reduzir impostos ou acelerar o comercial?',
                  },
                  {
                    label: '🚀 Frio C: Gestão 360º',
                    text: '{Oi|Olá|Tudo certo}, *{primeiro_nome}*! Aqui é o Léo, da Privilege Consultoria Empresarial aqui de Beltrão.\n\nAtuamos ajudando empresas a alinharem Financeiro, Comercial e Gestão de Pessoas para crescerem com lucro em 2027. Com quem eu consigo falar rapidamente sobre a gestão estratégica da empresa de vocês?',
                  },
                  {
                    label: '🔄 Repescagem Lead Frio',
                    text: '{Oi|Olá}, *{primeiro_nome}*! Imagino que a rotina aí esteja corrida.\n\nMuitos empresários comentam que já têm contador, mas vale lembrar que nossa Consultoria 360º e Planejamento 2027 atuam de forma totalmente separada da contabilidade atual. Faz sentido trocarmos uma ideia rápida sobre isso?',
                  },
                  {
                    label: '📅 Lembrete Fiscal / Documentos',
                    text: '{Olá|Oi}, *{primeiro_nome}*! {saudacao}!\n\nPassando pela *Privilege Contabilidade* para lembrar do envio dos documentos e extratos do fechamento mensal. Caso já tenha enviado, pode desconsiderar! Qualquer dúvida estamos à disposição.',
                  },
                ].map(tpl => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => setCampMessage(tpl.text)}
                    className="wa-qr-chip"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={5}
                value={campMessage}
                onChange={e => setCampMessage(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 10, border: '1px solid var(--border)', lineHeight: 1.5 }}
              />

              {/* Anexo opcional para a campanha */}
              <input
                ref={campFileRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleCampaignMediaSelect}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => campFileRef.current?.click()}
                    className="wa-btn wa-btn-secondary"
                    style={{ fontSize: 11.5, padding: '6px 12px' }}
                  >
                    <Paperclip size={13} /> Anexar Imagem ou PDF na Campanha
                  </button>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Dica: O uso de <code>{'{primeiro_nome}'}</code> e <code>{'{Olá|Oi}'}</code> torna cada mensagem única!
                </span>
              </div>

              {campFileName && campMediaUrl && (
                <div className="wa-attachment-preview-bar" style={{ marginTop: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    {campMediaType === 'image' ? (
                      <a href={campMediaUrl} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={campMediaUrl} alt={campFileName} className="wa-attachment-thumb" />
                      </a>
                    ) : (
                      <div className="wa-attachment-doc-icon">
                        <FileText size={20} color="var(--accent)" />
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                        📎 Arquivo anexado para conferência: {campFileName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Confira o arquivo antes de iniciar a transmissão em massa.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a
                      href={campMediaUrl}
                      download={campFileName}
                      target="_blank"
                      rel="noreferrer"
                      className="wa-btn wa-btn-secondary"
                      style={{ padding: '4px 9px', fontSize: 11, textDecoration: 'none' }}
                    >
                      <ExternalLink size={12} /> Conferir
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setCampMediaUrl('');
                        setCampFileName('');
                        setCampMediaType('text');
                      }}
                      className="wa-btn wa-btn-danger"
                      style={{ padding: '4px 9px', fontSize: 11 }}
                    >
                      ✕ Remover
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Escudo de Tempo e Cadência Anti-Banimento */}
            <div className="antiban-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={18} color="var(--green)" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    4. Temporizador Inteligente Anti-Banimento (Proteção do Chip)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => applySafetyPreset('ultra')}
                    className={`wa-filter-chip ${campSafetyPreset === 'ultra' ? 'active' : ''}`}
                  >
                    🛡️ Ultra Seguro (20s–45s)
                  </button>
                  <button
                    type="button"
                    onClick={() => applySafetyPreset('equilibrado')}
                    className={`wa-filter-chip ${campSafetyPreset === 'equilibrado' ? 'active' : ''}`}
                  >
                    ⚖️ Equilibrado (12s–25s)
                  </button>
                  <button
                    type="button"
                    onClick={() => applySafetyPreset('rapido')}
                    className={`wa-filter-chip ${campSafetyPreset === 'rapido' ? 'active' : ''}`}
                  >
                    ⚡ Rápido (6s–14s)
                  </button>
                </div>
              </div>

              <div className="antiban-inputs-grid">
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Intervalo Mínimo (seg):
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={300}
                    value={campMinDelay}
                    onChange={e => setCampMinDelay(Number(e.target.value))}
                    style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Intervalo Máximo (seg):
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    value={campMaxDelay}
                    onChange={e => setCampMaxDelay(Number(e.target.value))}
                    style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Pausa a cada (Lote):
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={campBatchSize}
                    onChange={e => setCampBatchSize(Number(e.target.value))}
                    style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Descanso do Lote (seg):
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={1800}
                    value={campBatchCooldown}
                    onChange={e => setCampBatchCooldown(Number(e.target.value))}
                    style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={campSimulateTyping}
                    onChange={e => setCampSimulateTyping(e.target.checked)}
                  />
                  <span>✍️ <strong>Simular &ldquo;Digitando...&rdquo;</strong> por 3 a 5 segundos antes de cada mensagem</span>
                </label>

                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={campPersonalizeGreeting}
                    onChange={e => setCampPersonalizeGreeting(e.target.checked)}
                  />
                  <span>🔀 <strong>Hash Anti-Spam Único:</strong> variar saudação e caracteres invisíveis em cada mensagem</span>
                </label>

                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={campCloseTicketAfterSend}
                    onChange={e => setCampCloseTicketAfterSend(e.target.checked)}
                  />
                  <span>🧹 <strong>Fila Limpa:</strong> manter o chamado encerrado após o envio (só abre na fila se o cliente responder)</span>
                </label>

                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={campAiRewrite}
                    onChange={e => setCampAiRewrite(e.target.checked)}
                  />
                  <span>✨ <strong>Reescrita Única por IA (Leads Frios Anti-Spam):</strong> reescrever cada mensagem com Gemini/Claude variando sinônimos e estrutura para zero bloqueio</span>
                </label>

                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={campSkipAlreadySent}
                    onChange={e => setCampSkipAlreadySent(e.target.checked)}
                  />
                  <span>🛡️ <strong>Evitar Duplicidade (Pular já enviados):</strong> ignorar automaticamente números que já receberam disparo em campanhas anteriores</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="submit"
                disabled={creatingCampaign}
                className="wa-btn wa-btn-primary"
                style={{ padding: '10px 20px', fontSize: 13 }}
              >
                <Send size={15} />{' '}
                {creatingCampaign
                  ? 'Iniciando Transmissão...'
                  : 'Iniciar Transmissão com Proteção Anti-Ban'}
              </button>
            </div>
          </form>

          {/* COLUNA DIREITA: MONITOR DE FILA AO VIVO E HISTÓRICO DE CAMPANHAS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="wa-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={17} color="var(--accent)" /> Monitor de Campanhas & Fila Anti-Ban ({campaigns.length})
                </h3>
                <button
                  type="button"
                  onClick={loadCampaigns}
                  className="wa-btn wa-btn-secondary"
                  style={{ padding: '5px 10px', fontSize: 11 }}
                >
                  <RefreshCw size={12} /> Atualizar
                </button>
              </div>

              {campaigns.length === 0 ? (
                <div
                  style={{
                    padding: 36,
                    textAlign: 'center',
                    background: 'var(--bg-card2)',
                    borderRadius: 12,
                    border: '1px dashed var(--border)',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                  }}
                >
                  Nenhuma campanha disparada ainda. Configure sua lista ao lado e clique em <strong>Iniciar Transmissão</strong>.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {campaigns.map(camp => {
                    const total = camp.total_count || 1;
                    const done = (camp.sent_count || 0) + (camp.failed_count || 0);
                    const pct = Math.min(100, Math.round((done / total) * 100));
                    const isRunning = camp.status === 'em_andamento';
                    const isPaused = camp.status === 'pausada';
                    const isExpanded = expandedCampaignId === camp.id;

                    return (
                      <div key={camp.id} className="campaign-card-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {camp.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              Delay: {camp.anti_ban_config?.minDelaySec || 15}s a{' '}
                              {camp.anti_ban_config?.maxDelaySec || 35}s · Lote:{' '}
                              {camp.anti_ban_config?.batchSize || 20} msgs
                            </div>
                          </div>

                          <span
                            className="wa-tag"
                            style={{
                              background:
                                isRunning
                                  ? 'rgba(21,128,61,0.14)'
                                  : isPaused
                                    ? 'rgba(180,83,9,0.14)'
                                    : camp.status === 'concluida'
                                      ? 'rgba(29,78,216,0.12)'
                                      : 'var(--border)',
                              color:
                                isRunning
                                  ? 'var(--green)'
                                  : isPaused
                                    ? 'var(--yellow)'
                                    : camp.status === 'concluida'
                                      ? 'var(--blue)'
                                      : 'var(--text-muted)',
                              fontWeight: 700,
                            }}
                          >
                            {isRunning && '🟢 Disparando...'}
                            {isPaused && '⏸️ Pausada'}
                            {camp.status === 'concluida' && '✅ Concluída'}
                            {camp.status === 'cancelada' && '⏹️ Cancelada'}
                            {camp.status === 'rascunho' && '📝 Rascunho'}
                          </span>
                        </div>

                        {/* Barra de Progresso */}
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                            <span>
                              Enviados: <strong>{camp.sent_count}</strong> de <strong>{camp.total_count}</strong>
                              {' · '}
                              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                                👁️ Visualizados: {camp.read_count ?? (Array.isArray(camp.recipients) ? camp.recipients.filter((r: any) => r.deliveryStatus === 'visualizado').length : 0)}
                              </span>
                              {camp.failed_count > 0 ? ` · ${camp.failed_count} falhas` : ''}
                            </span>
                            <strong>{pct}%</strong>
                          </div>
                          <div className="campaign-progress-track">
                            <div
                              className="campaign-progress-fill"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Status em Tempo Real do Temporizador Anti-Ban */}
                        {camp.current_action && (
                          <div
                            style={{
                              marginTop: 8,
                              padding: '7px 10px',
                              borderRadius: 8,
                              background: 'var(--bg-card2)',
                              border: '1px solid var(--border)',
                              fontSize: 11.5,
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {camp.current_action}
                          </div>
                        )}

                        {/* Controles da Campanha */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {isRunning && (
                              <button
                                type="button"
                                onClick={() => handleCampaignAction(camp.id, 'pause')}
                                className="wa-btn wa-btn-secondary"
                                style={{ padding: '4px 10px', fontSize: 11 }}
                              >
                                <Pause size={12} /> Pausar
                              </button>
                            )}
                            {(isPaused || camp.status === 'rascunho') && (
                              <button
                                type="button"
                                onClick={() => handleCampaignAction(camp.id, 'start')}
                                className="wa-btn wa-btn-green"
                                style={{ padding: '4px 10px', fontSize: 11 }}
                              >
                                <Play size={12} /> Retomar Envio
                              </button>
                            )}
                            {(isRunning || isPaused) && (
                              <button
                                type="button"
                                onClick={() => handleCampaignAction(camp.id, 'cancel')}
                                className="wa-btn wa-btn-danger"
                                style={{ padding: '4px 10px', fontSize: 11 }}
                              >
                                Cancelar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCampaignAction(camp.id, 'delete')}
                              className="wa-btn wa-btn-secondary"
                              style={{ padding: '4px 8px', fontSize: 11, color: 'var(--red)' }}
                              title="Excluir campanha"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCampaignId(isExpanded ? null : camp.id)
                            }
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--accent)',
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {isExpanded ? 'Ocultar Log ▲' : 'Ver Log & Visualizações ▼'}
                          </button>
                        </div>

                        {isExpanded && Array.isArray(camp.recipients) && (
                          <div
                            style={{
                              marginTop: 10,
                              maxHeight: 240,
                              overflowY: 'auto',
                              borderTop: '1px solid var(--border)',
                              paddingTop: 8,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                            }}
                          >
                            {camp.recipients.map((rec: any) => {
                              const dStatus = rec.deliveryStatus || rec.status;
                              const isRead = dStatus === 'visualizado';
                              const isDelivered = dStatus === 'entregue';
                              const isSent = rec.status === 'enviado';
                              const isFail = rec.status === 'falha';
                              return (
                                <div
                                  key={rec.id}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontSize: 11.5,
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    background: 'var(--bg-card2)',
                                  }}
                                >
                                  <div style={{ minWidth: 0 }}>
                                    <strong>{rec.name}</strong> ({rec.phone})
                                    {rec.error && (
                                      <div style={{ fontSize: 10.5, color: 'var(--red)', marginTop: 1 }}>
                                        {rec.error}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <span
                                      style={{
                                        fontWeight: 700,
                                        color: isRead
                                          ? '#2563eb'
                                          : isDelivered || isSent
                                            ? 'var(--green)'
                                            : isFail
                                              ? 'var(--red)'
                                              : 'var(--text-muted)',
                                      }}
                                    >
                                      {isRead && '👁️ Visualizado ✓✓'}
                                      {!isRead && isDelivered && '✓✓ Entregue'}
                                      {!isRead && !isDelivered && isSent && '✓ Enviado'}
                                      {rec.status === 'pendente' && '⏳ Na fila'}
                                      {isFail && '❌ Falha'}
                                    </span>
                                    {(rec.readAt || rec.sentAt) && (
                                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                        {rec.readAt
                                          ? `Lido ${new Date(rec.readAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                                          : `Env ${new Date(rec.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: CONEXÃO VIA QR CODE                                                */}
      {/* ========================================================================= */}
      {activeTab === 'qrcode' && (
        <div className="wa-qr-grid">
          <div className="wa-card" style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'Instrument Serif', fontSize: 24, margin: '0 0 6px' }}>
              Conexão WhatsApp Web via QR Code
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 auto 16px', maxWidth: 400 }}>
              Código criptográfico autêntico do WhatsApp Multi-Device. Aponte a câmera do WhatsApp para conectar imediatamente.
            </p>

            {config?.status === 'conectado' ? (
              <div
                style={{
                  background: 'rgba(21, 128, 61, 0.08)',
                  border: '1px solid rgba(21, 128, 61, 0.25)',
                  borderRadius: 'var(--radius)',
                  padding: 32,
                  marginBottom: 20,
                }}
              >
                <ShieldCheck size={52} color="var(--green)" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ margin: 0, fontSize: 18, color: 'var(--green)', fontWeight: 700 }}>
                  WhatsApp Conectado com Sucesso!
                </h3>
                <p style={{ fontSize: 14, fontWeight: 600, margin: '6px 0 0', color: 'var(--text-primary)' }}>
                  {config.phone_number || '+55 (46) 99123-4567'}
                </p>
                <button
                  onClick={handleDisconnect}
                  className="wa-btn wa-btn-danger"
                  style={{ marginTop: 20 }}
                >
                  Desconectar Sessão
                </button>
              </div>
            ) : (
              <div className="wa-qr-box">
                {config?.qr_code ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={config.qr_code} alt="QR Code WhatsApp" className="wa-qr-img" />
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--accent)' }} />
                    Gerando QR Code oficial...
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={handleRefreshQR} className="wa-btn wa-btn-secondary">
                <RefreshCw size={14} /> Atualizar QR Code
              </button>
              {config?.status !== 'conectado' && (
                <button onClick={handleSimulateConnect} className="wa-btn wa-btn-green">
                  <Check size={14} /> Simular Conexão de Teste
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Instruções */}
            <div className="wa-card">
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={16} color="var(--green)" /> Passo a Passo para Parear
              </h3>
              <ol style={{ paddingLeft: 20, margin: 0, fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                <li>Abra o aplicativo do WhatsApp no smartphone corporativo.</li>
                <li>Toque em <strong>Configurações</strong> ou nos <strong>três pontos</strong> no canto superior.</li>
                <li>Selecione <strong>Aparelhos Conectados</strong> e clique em <strong>Conectar um Aparelho</strong>.</li>
                <li>Aponte a câmera para o QR Code exibido na tela.</li>
              </ol>
            </div>

            {/* Parâmetros do Webhook e Microserviço */}
            <div className="wa-card">
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ExternalLink size={16} color="var(--blue)" /> Integração Aberta (GitHub Baileys / Evolution API)
              </h3>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  URL do Webhook para Recebimento em Tempo Real
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontFamily: 'monospace',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card2)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 2000);
                    }}
                    className="wa-btn wa-btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                  >
                    {copiedWebhook ? <Check size={14} color="var(--green)" /> : <Copy size={14} />}
                    {copiedWebhook ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    URL da API
                  </label>
                  <input
                    type="text"
                    value={config?.api_url || ''}
                    onChange={e =>
                      setConfig(prev => (prev ? { ...prev, api_url: e.target.value } : null))
                    }
                    placeholder="https://api.evolution-api.com"
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card2)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Instância
                  </label>
                  <input
                    type="text"
                    value={config?.instance_name || 'privilege'}
                    onChange={e =>
                      setConfig(prev => (prev ? { ...prev, instance_name: e.target.value } : null))
                    }
                    placeholder="privilege"
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card2)' }}
                  />
                </div>
              </div>

              <button
                onClick={() =>
                  handleSaveConfig({
                    api_url: config?.api_url,
                    instance_name: config?.instance_name,
                  })
                }
                className="wa-btn wa-btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Salvar Parâmetros da API
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO CONTATO WHATSAPP                                              */}
      {/* ========================================================================= */}
      {isNewChatModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div className="wa-card" style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Iniciar Nova Conversa</h3>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                style={{ border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewChat} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  WhatsApp / Celular com DDD:
                </label>
                <input
                  type="text"
                  placeholder="(46) 99999-8888"
                  value={newChatPhone}
                  onChange={e => setNewChatPhone(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Nome da Empresa / Cliente:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Auto Posto Alvorada"
                  value={newChatName}
                  onChange={e => setNewChatName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(false)}
                  className="wa-btn wa-btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="wa-btn wa-btn-primary">
                  Iniciar Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ENSINAR RESPOSTA PARA UMA PERGUNTA DO CLIENTE (DO PRÓPRIO CHAT)     */}
      {/* ========================================================================= */}
      {isTeachModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div className="wa-card" style={{ width: '100%', maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GraduationCap size={20} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Ensinar Assistente</h3>
              </div>
              <button
                onClick={() => setIsTeachModalOpen(false)}
                style={{ border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              Ensine a resposta oficial da Privilege Contabilidade. O robô memoriza e usa essa resposta para sempre.
            </p>

            <form onSubmit={handleTeachSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Tópico:
                </label>
                <select
                  value={newKbTopic}
                  onChange={e => setNewKbTopic(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                >
                  <option value="Tributário / Fiscal">Tributário / Fiscal</option>
                  <option value="Honorários / Financeiro">Honorários / Financeiro</option>
                  <option value="DP / Folha">DP / Folha</option>
                  <option value="CND / Regularidade">CND / Regularidade</option>
                  <option value="BPO Financeiro">BPO Financeiro</option>
                  <option value="Geral">Geral</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Pergunta do Cliente:
                </label>
                <input
                  type="text"
                  value={newKbQuestion}
                  onChange={e => setNewKbQuestion(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Resposta que o Robô deve Dar:
                </label>
                <textarea
                  rows={4}
                  value={newKbAnswer}
                  onChange={e => setNewKbAnswer(e.target.value)}
                  placeholder="Escreva a resposta correta..."
                  required
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setIsTeachModalOpen(false)}
                  className="wa-btn wa-btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="wa-btn wa-btn-primary">
                  <Check size={14} /> Salvar e Ensinar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AGENDAR FOLLOW-UP CRM & MENSAGEM AUTOMÁTICA                        */}
      {/* ========================================================================= */}
      {isFollowupModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div className="wa-card" style={{ width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} color="var(--yellow)" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  Programar Follow-up & Retorno no WhatsApp
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFollowupModalOpen(false)}
                style={{ border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFollowup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Escolha de cliente */}
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Cliente / Conversa:
                </label>
                <select
                  value={followupTargetChatId}
                  onChange={e => {
                    const id = e.target.value;
                    setFollowupTargetChatId(id);
                    const c = chats.find(item => item.id === id);
                    if (c && !followupMessage) {
                      setFollowupMessage(
                        `Olá, ${c.name}! 😊 Tudo bem? Passando para acompanhar nosso atendimento aqui na Privilege Contabilidade e Consultoria. Ficou alguma dúvida ou podemos avançar?`
                      );
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 13,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                  }}
                >
                  {chats.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Atalhos rápidos de data/hora */}
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Atalhos Rápidos de Tempo:
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {[
                    { label: '+2 horas', hours: 2 },
                    { label: 'Amanhã (24h)', hours: 24 },
                    { label: 'Em 2 dias', hours: 48 },
                    { label: 'Em 3 dias', hours: 72 },
                    { label: 'Em 7 dias', hours: 168 },
                    { label: 'Em 15 dias', hours: 360 },
                    { label: 'Em 30 dias', hours: 720 },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyFollowupPresetHours(preset.hours)}
                      className="wa-qr-chip"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Data e Horário Exato do Retorno:
                </label>
                <input
                  type="datetime-local"
                  value={followupDate}
                  onChange={e => setFollowupDate(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>

              {/* Pauta interna */}
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Motivo / Pauta Interna do Retorno:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Retorno sobre proposta de Consultoria 360º ou cobrança de documentos..."
                  value={followupNote}
                  onChange={e => setFollowupNote(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>

              {/* Templates e Mensagem de WhatsApp */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>
                    Mensagem de Follow-up para o WhatsApp:
                  </label>
                  <span style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 600 }}>
                    Modelos prontos:
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {[
                    {
                      label: '💼 Retorno Comercial',
                      text: `Olá, ${(chats.find(c => c.id === followupTargetChatId)?.name || 'tudo bem')}! 😊 Passando para saber se conseguiu avaliar nossa conversa sobre a consultoria empresarial da Privilege. Ficou alguma dúvida em que eu possa te ajudar?`,
                    },
                    {
                      label: '📄 Lembrar Documentos',
                      text: `Olá, ${(chats.find(c => c.id === followupTargetChatId)?.name || 'tudo bem')}! Tudo bem? Passando para lembrar do envio da documentação pendente para darmos andamento por aqui.`,
                    },
                    {
                      label: '📊 Abertura / CNPJ',
                      text: `Olá, ${(chats.find(c => c.id === followupTargetChatId)?.name || 'tudo bem')}! Passando para acompanhar o processo de abertura do seu CNPJ com a equipe da Privilege Contabilidade. Podemos avançar com os próximos passos?`,
                    },
                    {
                      label: '🤝 Pós-Atendimento',
                      text: `Olá, ${(chats.find(c => c.id === followupTargetChatId)?.name || 'tudo bem')}! Passando para confirmar se deu tudo certo com a sua solicitação ou se precisa de mais algum suporte da nossa equipe.`,
                    },
                  ].map(tpl => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => setFollowupMessage(tpl.text)}
                      className="wa-qr-chip"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  placeholder="Mensagem que será enviada no WhatsApp do cliente..."
                  value={followupMessage}
                  onChange={e => setFollowupMessage(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>

              {/* Opções de Automação e Limpeza de Chamado */}
              <div
                style={{
                  background: 'var(--bg-card2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={followupAutoSend}
                    onChange={e => setFollowupAutoSend(e.target.checked)}
                  />
                  <span>⚡ Disparar esta mensagem automaticamente no WhatsApp ao chegar na data/hora</span>
                </label>

                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={closeTicketOnFollowup}
                    onChange={e => setCloseTicketOnFollowup(e.target.checked)}
                  />
                  <span>🧹 Encerrar o chamado atual agora para deixar a fila de abertos limpa até o retorno</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() =>
                    handleSendFollowupNow(
                      followupTargetChatId || selectedChat?.id || '',
                      followupMessage
                    )
                  }
                  className="wa-btn wa-btn-green"
                  style={{ fontSize: 12 }}
                >
                  <Send size={13} /> Disparar no WhatsApp Agora
                </button>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setIsFollowupModalOpen(false)}
                    className="wa-btn wa-btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="wa-btn wa-btn-primary">
                    <Check size={14} /> Salvar Follow-up
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAgendaModalOpen && selectedChat && (
        <div className="wa-modal-overlay" onClick={() => !agendaSaving && setIsAgendaModalOpen(false)}>
          <div className="wa-modal-card" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📅 Criar Tarefa na Agenda</h3>
              <button
                type="button"
                onClick={() => setIsAgendaModalOpen(false)}
                className="wa-btn wa-btn-secondary"
                style={{ padding: '4px 8px', fontSize: 12 }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveAgendaTask} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="wa-label">Descrição da Demanda / Tarefa</label>
                <textarea
                  className="wa-input"
                  rows={3}
                  value={agendaTitle}
                  onChange={e => setAgendaTitle(e.target.value)}
                  required
                  placeholder="Ex: Emitir guia DAS e enviar para o cliente"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="wa-label">Data</label>
                  <input
                    type="date"
                    className="wa-input"
                    value={agendaDate}
                    onChange={e => setAgendaDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="wa-label">Horário</label>
                  <input
                    type="time"
                    className="wa-input"
                    value={agendaHorario}
                    onChange={e => setAgendaHorario(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setIsAgendaModalOpen(false)}
                  className="wa-btn wa-btn-secondary"
                  disabled={agendaSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="wa-btn wa-btn-primary" disabled={agendaSaving}>
                  <Check size={14} /> {agendaSaving ? 'Salvando...' : 'Salvar na Agenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isProtocolModalOpen && selectedChat && (
        <div className="wa-modal-overlay" onClick={() => !protocolSaving && setIsProtocolModalOpen(false)}>
          <div className="wa-modal-card" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🎫 Protocolo de Atendimento</h3>
              <button
                type="button"
                onClick={() => setIsProtocolModalOpen(false)}
                className="wa-btn wa-btn-secondary"
                style={{ padding: '4px 8px', fontSize: 12 }}
              >
                ✕
              </button>
            </div>
            {selectedChat.protocol_number && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'var(--bg-card2)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                }}
              >
                Protocolo atual: <strong style={{ fontFamily: 'monospace' }}>{selectedChat.protocol_number}</strong>
              </div>
            )}
            <form onSubmit={handleSaveProtocol} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="wa-label">Assunto do Atendimento</label>
                <input
                  type="text"
                  className="wa-input"
                  value={protocolSubject}
                  onChange={e => setProtocolSubject(e.target.value)}
                  required
                  placeholder="Ex: Emissão de NFS-e / Dúvida Fiscal"
                />
              </div>
              <div>
                <label className="wa-label">Resumo / Observações para Salvar</label>
                <textarea
                  className="wa-input"
                  rows={3}
                  value={protocolSummary}
                  onChange={e => setProtocolSummary(e.target.value)}
                  placeholder="Resumo do que foi tratado e resolvido..."
                />
              </div>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={protocolSendToClient}
                  onChange={e => setProtocolSendToClient(e.target.checked)}
                />
                <span>Enviar número do protocolo para o cliente no WhatsApp</span>
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setIsProtocolModalOpen(false)}
                  className="wa-btn wa-btn-secondary"
                  disabled={protocolSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="wa-btn wa-btn-primary" disabled={protocolSaving}>
                  <Check size={14} /> {protocolSaving ? 'Salvando...' : 'Salvar Protocolo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
