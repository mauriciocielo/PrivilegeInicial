// ============================================================
// WHATSAPP BOT PREMIUM PLUS
// ============================================================
// 1. Visão Computacional (lê prints de erros, boletos, comprovantes e documentos enviados por foto)
// 2. Autoatendimento Fiscal Instantâneo (envia DANFSe PDF da última nota emitida direto no WhatsApp)
// 3. Auto-Qualificação CRM (extrai tags automáticas e temperatura do lead sem atrapalhar a conversa)

import QRCode from 'qrcode';
import db from './prisma';
import { getEmailDbPool } from './email-db';
import logoNfse from './nfse/dados/logo-nfse.json';
import { apenasDigitos } from './nfse/dps';
import { gerarDanfsePdf, lerDadosDanfse, marcaDaguaDaNota, urlConsultaPublica } from './nfse/danfse';
import { obterBrandingDaEmpresa } from './nfse/escritorios-terceiros';

/**
 * Analisa uma imagem enviada pelo cliente no WhatsApp (boleto, comprovante PIX, print de erro,
 * documento fiscal, cartão CNPJ, etc.) usando Groq Vision ou Gemini 2.5 Flash Vision.
 */
export async function analisarImagemWhatsApp(params: {
  mediaUrl: string;
  caption?: string;
  groqKey?: string;
  geminiKey?: string;
}): Promise<string | null> {
  const { mediaUrl, caption } = params;
  if (!mediaUrl || !mediaUrl.startsWith('data:image/')) return null;

  const instrucao =
    'Você é o olhar de um assistente contábil/empresarial no WhatsApp. ' +
    'Descreva de forma objetiva e curta (máx. 4 linhas) o que aparece nesta imagem: se for boleto/PIX/nota/documento, extraia valor, vencimento, beneficiário/CNPJ ou mensagem de erro na tela. Responda em português do Brasil.' +
    (caption && caption !== '📷 Imagem' ? ` Legenda enviada pelo cliente: "${caption}".` : '');

  const groqKey = (params.groqKey || process.env.GROQ_API_KEY || '').trim();
  if (groqKey && groqKey.length > 15) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          max_tokens: 260,
          temperature: 0.2,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: instrucao },
                { type: 'image_url', image_url: { url: mediaUrl } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const desc = String(data?.choices?.[0]?.message?.content || '').trim();
        if (desc) return desc;
      }
    } catch {
      // tenta Gemini
    }
  }

  const geminiKey = (params.geminiKey || process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey && geminiKey.length > 25) {
    try {
      const [header, base64Data] = mediaUrl.split('base64,');
      const mimeType = header.match(/^data:([^;]+);/)?.[1] || 'image/jpeg';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: instrucao },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const desc = String(json?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        if (desc) return desc;
      }
    } catch {
      // ignora
    }
  }

  return null;
}

/**
 * Autoatendimento instantâneo para clientes cadastrados:
 * - "me manda o pdf da última nota" / "envia a última nfse" / "2ª via da última nota"
 * Entrega o DANFSe PDF oficial diretamente no WhatsApp (com assinatura white-label do escritório).
 */
export async function processarAutoatendimentoClienteWhatsApp(params: {
  rawJid: string;
  sendJid: string;
  cleanPhone: string;
  isGroup: boolean;
  text: string;
  enviarMensagem: (
    jid: string,
    texto: string,
    media?: { mediaType: 'document'; mediaUrl: string; fileName: string; mimeType: string }
  ) => Promise<any>;
}): Promise<boolean> {
  const limpo = params.text.replace(/^\[[^\]]+\]:\s*/, '').trim().toLowerCase();
  const pedeUltimaNota =
    /\b(manda|envia|enviar|mandar|quero|preciso|2a via|segunda via|baixar|pdf)\b/.test(limpo) &&
    /\b([uú]ltima\s+nota|[uú]ltima\s+nfse|[uú]ltima\s+nfs-e|pdf\s+da\s+nota|danfse)\b/.test(limpo);

  if (!pedeUltimaNota) return false;

  try {
    let empresa: { id: string; razaoSocial: string; nomeFantasia: string; cnpj: string } | null = null;

    if (params.isGroup) {
      const rows = await db.$queryRawUnsafe<Array<{ empresa_id: string }>>(
        `SELECT empresa_id FROM whatsapp_empresa_grupos WHERE group_jid = $1 LIMIT 1`,
        params.rawJid
      ).catch(() => []);
      if (rows[0]?.empresa_id) {
        empresa = await db.empresa.findUnique({
          where: { id: String(rows[0].empresa_id) },
          select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
        });
      }
    } else {
      const ult8 = apenasDigitos(params.cleanPhone).slice(-8);
      if (ult8.length === 8) {
        const todas = await db.empresa.findMany({
          select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, telefone: true },
        });
        const encontrada = todas.find((e) => apenasDigitos(e.telefone).endsWith(ult8));
        if (encontrada) empresa = encontrada;
      }
    }

    if (!empresa) return false;

    const ultima = await db.nfsE.findFirst({
      where: { empresaId: empresa.id, status: 'emitida' },
      include: { documento: { select: { nfseXml: true } } },
      orderBy: [{ dataEmissao: 'desc' }, { createdAt: 'desc' }],
    });

    if (!ultima || !ultima.documento?.nfseXml) {
      await params.enviarMensagem(
        params.sendJid,
        `Ainda não encontrei nenhuma NFS-e emitida com XML para *${empresa.nomeFantasia || empresa.razaoSocial}*.`
      );
      return true;
    }

    const dados = lerDadosDanfse(ultima.documento.nfseXml);
    const qrText = dados.chave ? urlConsultaPublica(dados.chave) : '';
    const qrPng = qrText
      ? await QRCode.toBuffer(qrText, { errorCorrectionLevel: 'M', margin: 0, width: 140 }).catch(() => Buffer.alloc(0))
      : Buffer.alloc(0);
    const pdfBytes = gerarDanfsePdf(dados, {
      logoPng: Buffer.from(logoNfse.png, 'base64'),
      qrPng,
      marcaDagua: marcaDaguaDaNota('emitida', null),
    });

    const branding = await obterBrandingDaEmpresa(empresa.id);
    const assinatura = branding ? `\n\n_${branding.nome}${branding.telefone ? ` · ${branding.telefone}` : ''}_` : '';
    const valorFmt = Number(ultima.valorLiquido || ultima.valorServicos || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    await params.enviarMensagem(
      params.sendJid,
      `📄 Aqui está o PDF da sua última NFS-e emitida:\n\n• *Número:* ${ultima.numero}\n• *Tomador:* ${ultima.tomadorRazaoSocial}\n• *Valor:* ${valorFmt}\n• *Emissão:* ${ultima.dataEmissao.slice(0, 10)}${assinatura}`,
      {
        mediaType: 'document',
        mediaUrl: `data:application/pdf;base64,${Buffer.from(pdfBytes).toString('base64')}`,
        fileName: `DANFSe_${ultima.numero || 'ultima'}.pdf`,
        mimeType: 'application/pdf',
      }
    );
    return true;
  } catch (err) {
    console.warn('[WhatsApp Premium Plus] Erro no autoatendimento da última nota:', err);
    return false;
  }
}

/**
 * Auto-qualificação silenciosa de CRM:
 * Detecta interesse do contato e aplica tags úteis automaticamente no painel do consultor.
 */
export async function enriquecerCrmAutomaticamente(params: {
  chatId: string;
  userMessage: string;
}) {
  const pool = getEmailDbPool();
  if (!pool || !params.chatId || params.chatId === 'sim_test') return;

  const lower = params.userMessage.toLowerCase();
  const novasTags: string[] = [];

  if (/\bmei\b/.test(lower)) novasTags.push('MEI');
  if (/\bsimples\s+nacional\b|\bsimples\b/.test(lower)) novasTags.push('Simples Nacional');
  if (/\b(abrir|abertura)\s+(de\s+)?(empresa|cnpj)\b/.test(lower)) novasTags.push('Abertura CNPJ');
  if (/\b(trocar|troca)\s+de\s+contador\b/.test(lower)) novasTags.push('Troca de Contador');
  if (/\b(fator\s*r|imposto|tribut[aá]ri|reforma|ibs|cbs)\b/.test(lower)) novasTags.push('Planejamento Tributário');
  if (/\b(caixa|lucro|pre[cç]o|precifica[cç][aã]o|financeiro|bpo|d[ií]vida)\b/.test(lower)) novasTags.push('Consultoria Financeira');
  if (/\b(reuni[aã]o|diagn[oó]stico|agendar|hor[aá]rio|amanh[aã]|presencial|online)\b/.test(lower)) novasTags.push('🔥 Lead Quente');

  if (novasTags.length === 0) return;

  try {
    const res = await pool.query(`SELECT tags FROM whatsapp_chats WHERE id = $1 LIMIT 1`, [params.chatId]);
    const atuais: string[] = Array.isArray(res.rows[0]?.tags) ? res.rows[0].tags : [];
    const merged = Array.from(new Set([...atuais, ...novasTags])).slice(0, 12);
    if (merged.length !== atuais.length) {
      await pool.query(`UPDATE whatsapp_chats SET tags = $1::jsonb WHERE id = $2`, [
        JSON.stringify(merged),
        params.chatId,
      ]);
    }
  } catch {
    // silencioso
  }
}
