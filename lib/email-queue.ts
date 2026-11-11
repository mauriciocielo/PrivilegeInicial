import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { salvarLog, lerLogs } from './email-log-service';

function getStoragePath(filename: string): string {
  if (process.env.VERCEL || (process.env.NODE_ENV === 'production' && process.platform !== 'win32')) {
    return path.join('/tmp', filename);
  }
  return path.resolve(process.cwd(), filename);
}

const QUEUE_FILE = getStoragePath('data-email-queue.json');

export interface CampanhaFila {
  id: string;
  empresaId?: string;
  assunto: string;
  mensagem?: string;
  somenteImagem?: boolean;
  linkImagem?: string;
  imagens?: { filename: string; base64: string; cid: string }[];
  totalDestinatarios: number;
  tamanhoLote: number; // Padrão: 70
  intervaloMinutos: number; // Padrão: 65
  destinatariosPendentes: { nome?: string; email: string }[];
  destinatariosEnviados: string[];
  destinatariosFalhas: { email: string; erro: string }[];
  status: 'aguardando' | 'processando' | 'pausada' | 'concluida' | 'erro';
  criadoEm: string;
  ultimoLoteEm?: string;
  proximoLoteEm?: string;
  erroUltimaTentativa?: string;
  smtpUserCustom?: string;
  smtpPassCustom?: string;
}

export function lerFila(): CampanhaFila[] {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const data = fs.readFileSync(QUEUE_FILE, 'utf8');
      return JSON.parse(data) || [];
    }
  } catch {}
  return [];
}

export function salvarFila(campanhas: CampanhaFila[]): void {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(campanhas, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro ao salvar fila de e-mails:', e);
  }
}

export function obterCampanhaAtiva(): CampanhaFila | null {
  const fila = lerFila();
  return fila.find(c => c.status === 'aguardando' || c.status === 'processando' || c.status === 'pausada') || null;
}

function getSmtpConfig(customAuth?: { user?: string; pass?: string }) {
  let envPass = customAuth?.pass || process.env.SMTP_PASS;
  let envUser = customAuth?.user || process.env.SMTP_USER;
  let envHost = process.env.SMTP_HOST;
  let envPort = process.env.SMTP_PORT;
  let envFrom = process.env.SMTP_FROM;

  const possiblePaths = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
  ];

  for (const p of possiblePaths) {
    if (!envPass && fs.existsSync(p)) {
      try {
        const parsed = dotenv.parse(fs.readFileSync(p, 'utf8'));
        if (parsed.SMTP_PASS) {
          envPass = envPass || parsed.SMTP_PASS;
          envUser = envUser || parsed.SMTP_USER;
          envHost = envHost || parsed.SMTP_HOST;
          envPort = envPort || parsed.SMTP_PORT;
          envFrom = envFrom || parsed.SMTP_FROM;
        }
      } catch {}
    }
  }

  const smtpHost = envHost || 'mail.privilegecontabilidade.com.br';
  const smtpPort = Number(envPort) || 465;
  const smtpUser = envUser || 'consultoria@privilegecontabilidade.com.br';
  const smtpPass = envPass || '@Privilege1452';
  const smtpFrom = envFrom || 'consultoria@privilegecontabilidade.com.br';

  const transporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: false,
    },
  });

  return { transporter, smtpFrom, smtpUser };
}

function formatarMensagemParaEmail(texto: string): string {
  if (!texto) return '';
  let html = texto;
  html = html.replace(/^### (.*$)/gim, '<h3 style="color: #600000; font-size: 16px; font-weight: bold; margin: 18px 0 6px;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="color: #600000; font-size: 18px; font-weight: bold; margin: 22px 0 8px;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="color: #600000; font-size: 20px; font-weight: 800; margin: 24px 0 10px;">$1</h1>');
  html = html.replace(/^\> (.*$)/gim, '<div style="background: #fdf2f2; border-left: 4px solid #600000; padding: 12px 16px; margin: 14px 0; border-radius: 4px; color: #475569; font-style: italic; line-height: 1.5;">$1</div>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #0f172a; font-weight: 700;">$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong style="color: #0f172a; font-weight: 700;">$1</strong>');
  html = html.replace(/(^|[^\w])\*(.*?)\*([^\w]|$)/g, '$1<em style="color: #334155;">$2</em>$3');
  html = html.replace(/\[(.*?)\]\((https?:\/\/.*?)\)/gi, '<a href="$2" target="_blank" style="color: #600000; font-weight: bold; text-decoration: underline;">$1</a>');

  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        processedLines.push('<ul style="margin: 12px 0; padding-left: 22px; color: #334155; line-height: 1.6;">');
        inList = true;
      }
      const itemContent = trimmed.replace(/^[•\-\*]\s+/, '');
      processedLines.push(`<li style="margin-bottom: 6px;">${itemContent}</li>`);
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(lines[i]);
    }
  }
  if (inList) processedLines.push('</ul>');

  html = processedLines.join('\n');
  html = html.replace(/\n\n/g, '<p style="margin: 14px 0;"></p>');
  html = html.replace(/\n/g, '<br />');
  return html;
}

export function enfileirarCampanha(params: {
  empresaId?: string;
  assunto: string;
  mensagem?: string;
  somenteImagem?: boolean;
  linkImagem?: string;
  imagens?: { filename: string; base64: string; cid: string }[];
  destinatarios: { nome?: string; email: string }[];
  tamanhoLote?: number;
  intervaloMinutos?: number;
  iniciarEmMinutos?: number; // 0 = dispara 1º lote já; 65 = aguarda 65 min
  smtpUserCustom?: string;
  smtpPassCustom?: string;
}): CampanhaFila {
  const fila = lerFila();
  const id = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tamanhoLote = params.tamanhoLote || 70;
  const intervaloMinutos = params.intervaloMinutos || 65;
  const delayInicial = typeof params.iniciarEmMinutos === 'number' ? params.iniciarEmMinutos : 0;

  const proximoLoteEm = delayInicial > 0
    ? new Date(Date.now() + delayInicial * 60 * 1000).toISOString()
    : new Date().toISOString();

  const nova: CampanhaFila = {
    id,
    empresaId: params.empresaId,
    assunto: params.assunto.trim(),
    mensagem: params.mensagem?.trim(),
    somenteImagem: params.somenteImagem,
    linkImagem: params.linkImagem,
    imagens: params.imagens,
    totalDestinatarios: params.destinatarios.length,
    tamanhoLote,
    intervaloMinutos,
    destinatariosPendentes: [...params.destinatarios],
    destinatariosEnviados: [],
    destinatariosFalhas: [],
    status: 'aguardando',
    criadoEm: new Date().toISOString(),
    proximoLoteEm,
    smtpUserCustom: params.smtpUserCustom,
    smtpPassCustom: params.smtpPassCustom,
  };

  // Se já houver outra em andamento, deixa a anterior pausada ou conclui
  fila.unshift(nova);
  salvarFila(fila);

  return nova;
}

export async function processarProximoLote(campanhaId?: string): Promise<{
  ok: boolean;
  enviados: number;
  falhas: number;
  restantes: number;
  proximoLoteEm?: string;
  status: string;
  erro?: string;
}> {
  const fila = lerFila();
  let camp: CampanhaFila | undefined;

  if (campanhaId) {
    camp = fila.find(c => c.id === campanhaId);
  } else {
    camp = fila.find(c => c.status === 'aguardando' && c.proximoLoteEm && new Date(c.proximoLoteEm).getTime() <= Date.now());
  }

  if (!camp) {
    return { ok: true, enviados: 0, falhas: 0, restantes: 0, status: 'nenhuma_campanha_pronta' };
  }

  if (camp.destinatariosPendentes.length === 0) {
    camp.status = 'concluida';
    camp.proximoLoteEm = undefined;
    salvarFila(fila);
    return { ok: true, enviados: 0, falhas: 0, restantes: 0, status: 'concluida' };
  }

  camp.status = 'processando';
  salvarFila(fila);

  const { transporter, smtpFrom } = getSmtpConfig({
    user: camp.smtpUserCustom,
    pass: camp.smtpPassCustom,
  });

  const baseUrl = process.env.NEXTAUTH_URL || 'https://privilegecontabilidade.cnt.br';
  const logoPath = path.resolve(process.cwd(), 'public/assets/privilege-logo.png');
  const hasLogo = fs.existsSync(logoPath);

  const attachments: any[] = [];
  if (hasLogo) {
    attachments.push({
      filename: 'privilege-logo.png',
      content: fs.readFileSync(logoPath),
      cid: 'privilege-logo',
      contentType: 'image/png',
    });
  }

  if (Array.isArray(camp.imagens)) {
    for (let i = 0; i < camp.imagens.length; i++) {
      const img = camp.imagens[i];
      if (img?.base64) {
        const raw = img.base64.includes('base64,') ? img.base64.split('base64,')[1] : img.base64;
        attachments.push({
          filename: img.filename || `imagem_${i + 1}.jpg`,
          content: Buffer.from(raw, 'base64'),
          cid: img.cid || `img_anexo_${i}`,
        });
      }
    }
  }

  const loteParaEnviar = camp.destinatariosPendentes.slice(0, camp.tamanhoLote);
  let enviadosNoLote = 0;
  let falhasNoLote = 0;
  let limiteAtingido = false;
  let erroMensagemServidor = '';

  const enviadosComSucesso: string[] = [];
  const falhasRegistradas: { email: string; erro: string }[] = [];

  for (const dest of loteParaEnviar) {
    const logId = `news_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const randomRef = Math.random().toString(36).slice(2, 10);
    const webViewUrl = `${baseUrl}/api/email-servicos/view?id=${logId}&ref=${randomRef}`;
    const pixelUrl = `${baseUrl}/api/email-servicos/pixel?id=${logId}`;
    const nomeDest = dest.nome || 'Cliente';

    let bodyHtml = formatarMensagemParaEmail(camp.mensagem || '');
    let htmlImagens = '';

    if (attachments.some(a => a.cid.startsWith('img_anexo_'))) {
      const linkWhatsDestino = (camp.linkImagem || '').trim() || `https://wa.me/5546999048990?text=${encodeURIComponent('Olá! Vi o comunicado da Privilege e gostaria de mais informações.')}`;
      htmlImagens = `
        <div style="margin: 22px 0; text-align: center;">
          ${attachments
            .filter(att => att.cid.startsWith('img_anexo_'))
            .map(att => `
              <div style="margin-bottom: 16px;">
                <a href="${linkWhatsDestino}" target="_blank" style="display: inline-block; text-decoration: none;">
                  <img src="cid:${att.cid}" alt="${camp.assunto}" style="max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 6px; display: block; margin-left: auto; margin-right: auto; box-shadow: 0 4px 14px rgba(0,0,0,0.08);" />
                </a>
              </div>
            `)
            .join('')}

          <div style="margin-top: 14px; text-align: center;">
            <a href="${linkWhatsDestino}" target="_blank" style="display: inline-block; background-color: #25D366; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 13px 26px; border-radius: 30px; box-shadow: 0 4px 12px rgba(37,211,102,0.35); letter-spacing: 0.3px; font-family: Arial, sans-serif;">
              💬 Falar com a Consultoria no WhatsApp &rarr;
            </a>
            <p style="margin: 8px 0 0; font-size: 11.5px; color: #64748b;">
              (Toque na imagem acima ou no botão verde para abrir a conversa)
            </p>
          </div>
        </div>
      `;
    }

    const htmlCompleto = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${camp.assunto}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
          .email-wrapper { max-width: 640px; background: #ffffff; border-radius: 8px; margin: 0 auto; overflow: hidden; border: 1px solid #e2e8f0; }
          .top-link { font-size: 11px; color: #64748b; text-align: center; padding: 12px 18px 8px; background: #fafafa; border-bottom: 1px solid #f1f5f9; }
          .header-logo { padding: 20px 24px 22px; text-align: center; border-bottom: 1px solid #f1f5f9; background: #ffffff; }
          .content-box { padding: 26px 32px; font-size: 14.5px; line-height: 1.6; color: #334155; }
          .footer-box { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11.5px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="top-link">
            Se houver problemas com o modo de exibição desta mensagem, 
            <a href="${webViewUrl}" target="_blank" style="color: #600000; font-weight: 600; text-decoration: underline;">clique aqui para exibi-la em um navegador da Web</a>
            ou acesse nosso site: 
            <a href="https://privilegecontabilidade.cnt.br" target="_blank" style="color: #600000; font-weight: 600; text-decoration: underline;">privilegecontabilidade.cnt.br</a>.
          </div>
          
          <div class="header-logo">
            <a href="https://privilegecontabilidade.cnt.br" target="_blank" style="display: inline-block; text-decoration: none;">
              ${hasLogo
                ? `<img src="cid:privilege-logo" alt="Privilege Contabilidade e Consultoria" width="260" style="display: block; margin: 0 auto; max-width: 260px; height: auto;" />`
                : `<h2 style="color: #600000; margin: 0; font-size: 20px; font-weight: 800;">PRIVILEGE CONTABILIDADE E CONSULTORIA</h2>`
              }
            </a>
          </div>

          <div class="content-box">
            ${camp.somenteImagem ? `
              <div style="text-align: center; margin: 8px 0 16px;">
                ${htmlImagens}
              </div>
            ` : `
              <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">
                Prezado(a) <strong>${nomeDest}</strong>,
              </p>
              <div style="color: #334155;">
                ${bodyHtml}
              </div>
              ${htmlImagens}

              <div style="margin-top: 30px; padding-top: 18px; border-top: 2px solid #600000; font-size: 13px; color: #334155; line-height: 1.6;">
                <p style="margin: 0; font-weight: 800; font-size: 14.5px; color: #600000;">
                  PRIVILEGE CONTABILIDADE E CONSULTORIA
                </p>
                <p style="margin: 2px 0 12px; font-size: 12.5px; color: #64748b;">
                  Contabilidade Estratégica, BPO Financeiro e Apoio à Gestão Empresarial
                </p>
                <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; color: #475569; margin-top: 8px;">
                  <tr>
                    <td style="padding: 2px 0; width: 22px;">🏢</td>
                    <td style="padding: 2px 0;"><strong>Razão Social:</strong> PRIVILEGE CONSULTORIA LTDA · <strong>Nome Fantasia:</strong> PRIVILEGE CONTABILIDADE E CONSULTORIA</td>
                  </tr>
                  <tr>
                    <td style="padding: 2px 0;">📋</td>
                    <td style="padding: 2px 0;"><strong>CNPJ:</strong> 58.033.979/0001-84</td>
                  </tr>
                  <tr>
                    <td style="padding: 2px 0;">📍</td>
                    <td style="padding: 2px 0;"><strong>Endereço:</strong> Rua Pará, 127, Sala 103, Centro – Francisco Beltrão / PR · CEP 85.601-290</td>
                  </tr>
                  <tr>
                    <td style="padding: 2px 0;">📞</td>
                    <td style="padding: 2px 0;"><strong>Telefones:</strong> (46) 3035-1061 · (46) 3035-1018 · 📱 <strong>WhatsApp Oficial:</strong> (46) 99904-8990</td>
                  </tr>
                  <tr>
                    <td style="padding: 2px 0;">✉️</td>
                    <td style="padding: 2px 0;"><strong>E-mail:</strong> <a href="mailto:consultoria@privilegecontabilidade.com.br" style="color: #600000; font-weight: bold; text-decoration: none;">consultoria@privilegecontabilidade.com.br</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 2px 0;">🌐</td>
                    <td style="padding: 2px 0;"><strong>Site Oficial:</strong> <a href="https://privilegecontabilidade.cnt.br" target="_blank" style="color: #600000; font-weight: bold; text-decoration: none;">privilegecontabilidade.cnt.br</a></td>
                  </tr>
                </table>
              </div>
            `}
          </div>

          <div class="footer-box">
            <strong>Precisa de ajuda ou orientação contábil?</strong><br />
            Telefones: <strong>(46) 3035-1061 · (46) 3035-1018</strong> · WhatsApp: <strong>(46) 99904-8990</strong><br />
            <span style="display: inline-block; margin-top: 6px; color: #94a3b8;">
              PRIVILEGE CONSULTORIA LTDA (CNPJ 58.033.979/0001-84) · Francisco Beltrão/PR
            </span>
          </div>
          ${pixelUrl ? `<img src="${pixelUrl}" width="1" height="1" border="0" style="width:1px;height:1px;" alt="" />` : ''}
        </div>
      </body>
      </html>
    `;

    try {
      await transporter.sendMail({
        from: `"Privilege Consultoria" <${smtpFrom}>`,
        to: dest.email,
        subject: camp.assunto,
        html: htmlCompleto,
        attachments,
      });

      enviadosNoLote++;
      enviadosComSucesso.push(dest.email);

      salvarLog({
        id: logId,
        empresaId: camp.empresaId,
        tipo: 'newsletter',
        assunto: camp.assunto,
        destinatarioEmail: dest.email,
        destinatarioNome: nomeDest,
        status: 'entregue',
        enviadoEm: new Date().toISOString(),
        html: htmlCompleto,
      });

      await new Promise(r => setTimeout(r, 120));
    } catch (e: any) {
      const errMsg = e.message || '';
      erroMensagemServidor = errMsg;

      // Detecta se a hospedagem barrou por limite por hora (554 5.7.1 Excedeu o limite por hora)
      if (errMsg.includes('Excedeu o limite') || errMsg.includes('554 5.7.1') || errMsg.includes('limit exceeded') || errMsg.includes('quota exceeded')) {
        limiteAtingido = true;
        break; // Interrompe imediatamente para reagendar em 65 minutos
      }

      falhasNoLote++;
      falhasRegistradas.push({ email: dest.email, erro: errMsg });

      salvarLog({
        id: logId,
        empresaId: camp.empresaId,
        tipo: 'newsletter',
        assunto: camp.assunto,
        destinatarioEmail: dest.email,
        destinatarioNome: nomeDest,
        status: 'falha',
        erroMensagem: errMsg,
        enviadoEm: new Date().toISOString(),
      });
    }
  }

  // Atualiza estado da campanha
  const enviadosSet = new Set(enviadosComSucesso);
  const falhasSet = new Set(falhasRegistradas.map(f => f.email));

  camp.destinatariosEnviados.push(...enviadosComSucesso);
  camp.destinatariosFalhas.push(...falhasRegistradas);

  // Remove do pool de pendentes somente os que foram processados (enviados ou com falha definitiva)
  camp.destinatariosPendentes = camp.destinatariosPendentes.filter(
    d => !enviadosSet.has(d.email) && !falhasSet.has(d.email)
  );

  camp.ultimoLoteEm = new Date().toISOString();

  if (limiteAtingido) {
    camp.status = 'aguardando';
    camp.erroUltimaTentativa = `Hospedagem atingiu o limite por hora (${erroMensagemServidor}). Próximo lote agendado para 65 min.`;
    camp.proximoLoteEm = new Date(Date.now() + camp.intervaloMinutos * 60 * 1000).toISOString();
  } else if (camp.destinatariosPendentes.length === 0) {
    camp.status = 'concluida';
    camp.proximoLoteEm = undefined;
    camp.erroUltimaTentativa = undefined;
  } else {
    camp.status = 'aguardando';
    camp.erroUltimaTentativa = undefined;
    camp.proximoLoteEm = new Date(Date.now() + camp.intervaloMinutos * 60 * 1000).toISOString();
  }

  salvarFila(fila);

  return {
    ok: true,
    enviados: enviadosNoLote,
    falhas: falhasNoLote,
    restantes: camp.destinatariosPendentes.length,
    proximoLoteEm: camp.proximoLoteEm,
    status: camp.status,
    erro: limiteAtingido ? camp.erroUltimaTentativa : undefined,
  };
}

export function pausarFila(campanhaId: string) {
  const fila = lerFila();
  const camp = fila.find(c => c.id === campanhaId);
  if (camp && camp.status !== 'concluida') {
    camp.status = 'pausada';
    salvarFila(fila);
  }
}

export function retomarFila(campanhaId: string) {
  const fila = lerFila();
  const camp = fila.find(c => c.id === campanhaId);
  if (camp && camp.status === 'pausada') {
    camp.status = 'aguardando';
    camp.proximoLoteEm = new Date().toISOString(); // Pronto para disparar
    salvarFila(fila);
  }
}

export function cancelarFila(campanhaId: string) {
  let fila = lerFila();
  fila = fila.filter(c => c.id !== campanhaId);
  salvarFila(fila);
}

// Background Worker Singleton
let workerIniciado = false;

export function iniciarWorkerFilaEmail() {
  if (workerIniciado) return;
  // Nunca inicia worker durante o build no Vercel/Next.js
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  workerIniciado = true;

  console.log('[Worker Fila E-mails] Iniciado com verificação a cada 60s.');

  const timer = setInterval(async () => {
    try {
      const fila = lerFila();
      const campanhaPronta = fila.find(
        c => c.status === 'aguardando' && c.proximoLoteEm && new Date(c.proximoLoteEm).getTime() <= Date.now()
      );

      if (campanhaPronta) {
        console.log(`[Worker Fila E-mails] Disparando próximo lote da campanha "${campanhaPronta.assunto}"...`);
        const resultado = await processarProximoLote(campanhaPronta.id);
        console.log(`[Worker Fila E-mails] Lote concluído: ${resultado.enviados} enviados, ${resultado.restantes} restantes.`);
      }
    } catch (e) {
      console.error('[Worker Fila E-mails] Erro ao verificar fila:', e);
    }
  }, 60 * 1000);

  // Evita que o timer segure o processo de encerramento do Node.js
  if (timer && typeof (timer as any).unref === 'function') {
    (timer as any).unref();
  }
}

