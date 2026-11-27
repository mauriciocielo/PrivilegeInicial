import db from './prisma';
import { getEmailDbPool } from './email-db';
import { apenasDigitos } from './nfse/dps';
import type { AiChatMessage } from './ai-provider';

export interface WhatsAppAiContext {
  historyMessages: AiChatMessage[];
  hasRecentHistory: boolean;
  contactName: string | null;
  crmSummary: string;
  empresaSummary: string;
  dateTimeBrasilia: string;
}

function formatarDataHoraBrasilia(): string {
  const agora = new Date();
  const fmtData = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(agora);

  const horaStr = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false,
  }).format(agora);
  const hora = Number(horaStr) || 12;
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  return `${fmtData} (Brasília — saudação adequada agora: "${saudacao}")`;
}

/**
 * Monta o contexto inteligente completo para o bot do WhatsApp:
 * - Histórico multi-turn real (até 20 mensagens, incluindo áudios transcritos e documentos)
 * - Perfil CRM do contato (estágio, tags, notas internas do consultor, nome)
 * - Dados reais da empresa cliente (se o telefone pertencer a uma empresa cadastrada)
 * - Data e hora atuais de Brasília
 */
export async function buildWhatsAppAiContext(params: {
  chatId?: string;
  phone?: string;
  currentUserMessage?: string;
}): Promise<WhatsAppAiContext> {
  const historyMessages: AiChatMessage[] = [];
  let hasRecentHistory = false;
  let contactName: string | null = null;
  let crmSummary = '';
  let empresaSummary = '';

  const pool = getEmailDbPool();

  // 1. Histórico multi-turn real + perfil CRM do chat
  if (pool && params.chatId && params.chatId !== 'sim_test') {
    try {
      const [chatRes, histRes] = await Promise.all([
        pool.query(
          `SELECT name, phone, crm_stage, tags, internal_notes, triage_summary, triage_data
           FROM whatsapp_chats WHERE id = $1 LIMIT 1`,
          [params.chatId]
        ),
        pool.query(
          `SELECT from_me, text, media_type, file_name, timestamp
           FROM whatsapp_messages
           WHERE chat_id = $1 AND text IS NOT NULL AND TRIM(text) <> ''
           ORDER BY timestamp DESC
           LIMIT 20`,
          [params.chatId]
        ),
      ]);

      const chat = chatRes.rows[0];
      if (chat) {
        const rawName = String(chat.name || '').trim();
        const cleanName = rawName.replace(/[0-9+\-\s()]/g, '');
        if (cleanName.length >= 2 && cleanName.toLowerCase() !== 'cliente' && cleanName.toLowerCase() !== 'whatsapp') {
          contactName = rawName;
        }
        const partesCrm: string[] = [];
        if (contactName) partesCrm.push(`Nome do contato: ${contactName}`);
        if (chat.crm_stage) partesCrm.push(`Estágio CRM: ${chat.crm_stage}`);
        if (Array.isArray(chat.tags) && chat.tags.length > 0) {
          partesCrm.push(`Tags: ${chat.tags.join(', ')}`);
        }
        if (chat.internal_notes) {
          partesCrm.push(`Notas internas da equipe: ${String(chat.internal_notes).slice(0, 400)}`);
        }
        if (chat.triage_summary) {
          partesCrm.push(`Resumo anterior: ${String(chat.triage_summary).slice(0, 300)}`);
        }
        if (partesCrm.length > 0) crmSummary = partesCrm.join(' | ');
      }

      const rows = (histRes.rows || []).reverse();
      const dozeHorasAtras = Date.now() - 12 * 60 * 60 * 1000;
      // Verifica se já houve conversa real antes da mensagem atual
      if (rows.length > 1) {
        const penultima = rows[rows.length - 2];
        if (penultima?.timestamp && new Date(penultima.timestamp).getTime() >= dozeHorasAtras) {
          hasRecentHistory = true;
        }
      }

      for (const r of rows) {
        let content = String(r.text || '').trim();
        if (!content) continue;
        if (r.media_type === 'audio' && !content.startsWith('🎤')) {
          content = `[Áudio transcrito do cliente]: ${content}`;
        } else if (r.media_type === 'document' && r.file_name) {
          content = `[Enviou arquivo: ${r.file_name}] ${content}`;
        } else if (r.media_type === 'image' && content === '📷 Imagem') {
          content = '[Enviou uma imagem]';
        }
        historyMessages.push({
          role: r.from_me ? 'assistant' : 'user',
          content,
        });
      }

      // Evita duplicar a última mensagem do usuário se ela acabou de ser inserida no banco
      if (
        params.currentUserMessage &&
        historyMessages.length > 0 &&
        historyMessages[historyMessages.length - 1].role === 'user'
      ) {
        const lastNorm = historyMessages[historyMessages.length - 1].content
          .replace(/^\[Áudio transcrito do cliente\]:\s*/, '')
          .trim();
        if (lastNorm === params.currentUserMessage.trim()) {
          historyMessages.pop();
        }
      }
    } catch {
      // ignora erro de leitura de histórico
    }
  }

  // 2. Identifica se o telefone pertence a uma empresa cliente cadastrada (contexto real)
  const phoneDigits = apenasDigitos(params.phone || '');
  const ult8 = phoneDigits.slice(-8);
  if (ult8.length === 8) {
    try {
      const empresas = await db.empresa.findMany({
        select: {
          id: true,
          razaoSocial: true,
          nomeFantasia: true,
          cnpj: true,
          telefone: true,
          nfseConfig: {
            select: {
              opSimpNac: true,
              certValidoAte: true,
              usarProcuracao: true,
            },
          },
        },
      });
      const emp = empresas.find((e) => apenasDigitos(e.telefone).endsWith(ult8));
      if (emp) {
        const mesAtual = new Date().toISOString().slice(0, 7);
        const nfsesMes = await db.nfsE.findMany({
          where: {
            empresaId: emp.id,
            status: 'emitida',
            OR: [{ dataCompetencia: { startsWith: mesAtual } }, { dataEmissao: { startsWith: mesAtual } }],
          },
          select: { valorServicos: true },
        });
        const totalFatMes = nfsesMes.reduce((acc, n) => acc + Number(n.valorServicos || 0), 0);
        const opSimp = emp.nfseConfig?.opSimpNac ?? 3;
        const regime = opSimp === 2 ? 'MEI' : opSimp === 1 ? 'Regime Normal' : 'Simples Nacional';
        let certInfo = 'Não configurado';
        if (emp.nfseConfig?.certValidoAte) {
          const dias = Math.ceil((emp.nfseConfig.certValidoAte.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          certInfo =
            dias < 0
              ? `VENCIDO há ${Math.abs(dias)} dias`
              : `Válido até ${emp.nfseConfig.certValidoAte.toLocaleDateString('pt-BR')} (${dias} dias restantes)`;
        } else if (emp.nfseConfig?.usarProcuracao) {
          certInfo = 'Procuração eletrônica ativa';
        }

        empresaSummary = [
          `ESTE CONTATO É UM CLIENTE CADASTRADO NO SISTEMA (use esses dados para ajudar com precisão, sem expor informações para terceiros):`,
          `• Empresa: ${emp.nomeFantasia || emp.razaoSocial} (CNPJ ${emp.cnpj})`,
          `• Regime: ${regime}`,
          `• Certificado A1: ${certInfo}`,
          `• NFS-e emitidas em ${mesAtual}: ${nfsesMes.length} nota(s), total R$ ${totalFatMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `• Recurso disponível: o cliente pode emitir NFS-e direto por este WhatsApp enviando "Emite uma nota de R$ VALOR para NOME_DO_CLIENTE referente a SERVIÇO".`,
        ].join('\n');
      }
    } catch {
      // ignora erro de consulta de empresa
    }
  }

  return {
    historyMessages,
    hasRecentHistory,
    contactName,
    crmSummary,
    empresaSummary,
    dateTimeBrasilia: formatarDataHoraBrasilia(),
  };
}
