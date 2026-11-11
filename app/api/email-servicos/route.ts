import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { db } from '../../../lib/prisma';
import { captureError } from '../../../lib/sentry-helper';
import { salvarLog, lerLogs } from '../../../lib/email-log-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Converte marcações de texto e markdown em HTML seguro e estilizado para e-mails
 */
export function formatarMensagemParaEmail(texto: string): string {
  if (!texto) return '';

  let html = texto;

  // 1. Cabeçalhos Markdown: ###, ##, #
  html = html.replace(/^### (.*$)/gim, '<h3 style="color: #600000; font-size: 16px; font-weight: bold; margin: 18px 0 6px;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="color: #600000; font-size: 18px; font-weight: bold; margin: 22px 0 8px;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="color: #600000; font-size: 20px; font-weight: 800; margin: 24px 0 10px;">$1</h1>');

  // 2. Caixa de Destaque / Citação: > Alerta ou frase
  html = html.replace(/^\> (.*$)/gim, '<div style="background: #fdf2f2; border-left: 4px solid #600000; padding: 12px 16px; margin: 14px 0; border-radius: 4px; color: #475569; font-style: italic; line-height: 1.5;">$1</div>');

  // 3. Negrito: **texto** ou __texto__
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #0f172a; font-weight: 700;">$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong style="color: #0f172a; font-weight: 700;">$1</strong>');

  // 4. Itálico: *texto*
  html = html.replace(/(^|[^\w])\*(.*?)\*([^\w]|$)/g, '$1<em style="color: #334155;">$2</em>$3');

  // 5. Links Markdown: [texto](url)
  html = html.replace(/\[(.*?)\]\((https?:\/\/.*?)\)/gi, '<a href="$2" target="_blank" style="color: #600000; font-weight: bold; text-decoration: underline;">$1</a>');

  // 6. Listas com marcadores (linhas começando com •, -, ou *)
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
  if (inList) {
    processedLines.push('</ul>');
  }

  html = processedLines.join('\n');

  // 7. Quebras de parágrafo e linhas
  html = html.replace(/\n\n/g, '<p style="margin: 14px 0;"></p>');
  html = html.replace(/\n/g, '<br />');

  return html;
}

function getSmtpConfig(customAuth?: { user?: string; pass?: string; host?: string; port?: number }) {
  let envPass = customAuth?.pass || process.env.SMTP_PASS;
  let envUser = customAuth?.user || process.env.SMTP_USER;
  let envHost = customAuth?.host || process.env.SMTP_HOST;
  let envPort = customAuth?.port || process.env.SMTP_PORT;
  let envFrom = process.env.SMTP_FROM;

  const possiblePaths = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    'c:/Users/cielo/.gemini/antigravity/scratch/cashflow-system/.env.local',
    'c:/Users/cielo/.gemini/antigravity/scratch/cashflow-system/.env',
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      tipo, // 'cobranca_boleto' | 'newsletter' | 'avulso'
      empresaId,
      destinatarioEmail,
      destinatarioNome,
      assunto,
      mensagem,
      destinatariosLista,
      imagens,
      // Credenciais customizadas caso o usuário queira testar/alterar na própria tela
      smtpUserCustom,
      smtpPassCustom,
      // Dados de cobrança:
      nfseNumero,
      valor,
      vencimento,
      linhaDigitavel,
      codigoBarras,
      brcodePix,
      txidPix,
      pdfBoletoBase64,
      xmlNfse,
    } = body;

    const { transporter, smtpFrom } = getSmtpConfig({
      user: smtpUserCustom,
      pass: smtpPassCustom,
    });

    const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const protoHeader = req.headers.get('x-forwarded-proto') || (hostHeader.includes('localhost') ? 'http' : 'https');
    const origin = req.headers.get('origin') || (hostHeader ? `${protoHeader}://${hostHeader}` : 'https://privilegecontabilidade.cnt.br');
    const baseUrl = (origin && !origin.includes('localhost')) ? origin : 'https://privilegecontabilidade.cnt.br';

    const logoOficialPath = path.join(process.cwd(), 'public', 'privilege-logo-email.png');
    const hasLogoOficial = fs.existsSync(logoOficialPath);

    // -------------------------------------------------------------
    // CASO 1: ENVIO DE BOLETO / COBRANÇA / NFS-E
    // -------------------------------------------------------------
    if (tipo === 'cobranca_boleto' || (!tipo && (linhaDigitavel || brcodePix || nfseNumero))) {
      const emailAlvo = destinatarioEmail?.trim();
      if (!emailAlvo || !emailAlvo.includes('@')) {
        return NextResponse.json({ error: 'E-mail do destinatário inválido ou não informado.' }, { status: 400 });
      }

      const logId = `cob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const nomeCliente = destinatarioNome?.trim() || 'Prezado(a) Cliente';
      const valorFormatado = valor ? (typeof valor === 'number' ? `R$ ${valor.toFixed(2).replace('.', ',')}` : String(valor)) : '';
      const subject = assunto || `Cobrança e Boleto Sicoob — Privilege Consultoria${nfseNumero ? ` (NFS-e Nº ${nfseNumero})` : ''}`;

      const qrCodeImgSrc = brcodePix
        ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(brcodePix)}`
        : '';

      const pixelUrl = `${baseUrl}/api/email-servicos/pixel?id=${logId}`;
      const webViewUrl = `${baseUrl}/api/email-servicos/view?id=${logId}&ref=${Math.random().toString(36).slice(2, 10)}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1f2937; }
            .container { max-width: 620px; background: #ffffff; border-radius: 8px; margin: 0 auto; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .top-notice { font-size: 11px; color: #64748b; text-align: center; padding: 12px 16px 0; }
            .header { background: #ffffff; padding: 16px 28px 18px; text-align: center; border-bottom: 2px solid #600000; }
            .header h1 { margin: 10px 0 0; font-size: 16px; font-weight: 800; color: #111827; letter-spacing: 0.5px; }
            .header p { margin: 4px 0 0; font-size: 12.5px; color: #64748b; }
            .body { padding: 26px 28px; }
            .highlight-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0; }
            .pix-box { text-align: center; background: #ffffff; border: 1.5px solid #003641; border-radius: 8px; padding: 18px; margin: 24px 0; }
            .pix-title { font-weight: 800; color: #003641; font-size: 15px; margin-bottom: 12px; }
            .code-box { background: #f3f4f6; border: 1px dashed #9ca3af; padding: 10px; font-family: monospace; font-size: 13px; word-break: break-all; margin: 12px 0; border-radius: 4px; text-align: center; font-weight: bold; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 28px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="top-notice">
              Se houver problemas com o modo de exibição desta mensagem, <a href="#" style="color: #64748b; text-decoration: underline;">clique aqui para exibi-la em um navegador da Web</a>.
            </div>
            <div class="header">
              ${hasLogoOficial
                ? `<img src="cid:privilege-logo" alt="Privilege Contabilidade e Consultoria" width="180" style="display:block; margin: 0 auto; max-width: 180px; height: auto;" />`
                : `<h1 style="color: #600000; margin: 0;">PRIVILEGE CONTABILIDADE & CONSULTORIA</h1>`
              }
              <p>Cooperativa Sicoob 4342 · Cobrança Bancária Oficial</p>
            </div>
            <div class="body">
              <p style="font-size: 15px;">Olá, <strong>${nomeCliente}</strong>,</p>
              <p style="font-size: 14px; line-height: 1.5;">
                Esperamos que esteja bem! Segue a cobrança bancária referente aos serviços prestados${nfseNumero ? ` (NFS-e Nº <strong>${nfseNumero}</strong>)` : ''}.
              </p>

              <div class="highlight-box">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  ${valorFormatado ? `<tr><td style="padding: 4px 0; color: #4b5563;">Valor:</td><td style="padding: 4px 0; text-align: right; font-weight: bold; font-size: 16px; color: #166534;">${valorFormatado}</td></tr>` : ''}
                  ${vencimento ? `<tr><td style="padding: 4px 0; color: #4b5563;">Vencimento:</td><td style="padding: 4px 0; text-align: right; font-weight: bold; color: #111827;">${vencimento}</td></tr>` : ''}
                  ${nfseNumero ? `<tr><td style="padding: 4px 0; color: #4b5563;">Nº da Nota:</td><td style="padding: 4px 0; text-align: right; font-weight: bold; color: #111827;">${nfseNumero}</td></tr>` : ''}
                </table>
              </div>

              ${brcodePix ? `
                <div class="pix-box">
                  <div class="pix-title">⚡ PAGAMENTO RÁPIDO VIA QR CODE PIX</div>
                  <img src="${qrCodeImgSrc}" alt="QR Code Pix Sicoob" style="width: 180px; height: 180px; display: block; margin: 0 auto;" />
                  <p style="font-size: 12px; color: #4b5563; margin: 10px 0 4px;">Ou utilize a chave Pix Copia e Cola:</p>
                  <div class="code-box">${brcodePix}</div>
                </div>
              ` : ''}

              ${linhaDigitavel ? `
                <div style="margin: 20px 0;">
                  <div style="font-size: 13px; font-weight: bold; color: #374151; margin-bottom: 4px;">Linha Digitável do Boleto:</div>
                  <div class="code-box" style="font-size: 14px; color: #003641;">${linhaDigitavel}</div>
                  <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0;">Pagável em qualquer banco, internet banking ou agência lotérica até o vencimento.</p>
                </div>
              ` : ''}

              ${mensagem ? `
                <div style="background: #f8fafc; border-left: 3px solid #600000; padding: 12px 14px; margin-top: 18px; font-size: 13.5px; color: #334155;">
                  ${mensagem.replace(/\n/g, '<br />')}
                </div>
              ` : ''}

              <div style="margin-top: 26px; padding-top: 18px; border-top: 2px solid #600000; font-size: 13px; color: #334155; line-height: 1.6;">
                <p style="margin: 0; font-weight: 800; font-size: 14px; color: #600000;">PRIVILEGE CONTABILIDADE E CONSULTORIA</p>
                <p style="margin: 2px 0 10px; font-size: 12px; color: #64748b;">PRIVILEGE CONSULTORIA LTDA · CNPJ: 58.033.979/0001-84</p>
                <p style="margin: 0; font-size: 12.5px; color: #475569;">
                  📍 Rua Pará, 127, Sala 103, Centro – Francisco Beltrão / PR · CEP 85.601-290<br />
                  📞 (46) 3035-1061 · (46) 3035-1018 · 📱 WhatsApp: (46) 99904-8990<br />
                  ✉️ <a href="mailto:consultoria@privilegecontabilidade.com.br" style="color: #600000; text-decoration: none;">consultoria@privilegecontabilidade.com.br</a> · 🌐 <a href="https://privilegecontabilidade.cnt.br" target="_blank" style="color: #600000; text-decoration: none; font-weight: bold;">privilegecontabilidade.cnt.br</a>
                </p>
              </div>
            </div>

            <div class="footer">
              <strong>Precisa de ajuda com esta cobrança?</strong> Entre em contato pelos telefones (46) 3035-1061 / 3035-1018 ou WhatsApp (46) 99904-8990.<br />
              Privilege Consultoria Ltda · <a href="https://privilegecontabilidade.cnt.br" target="_blank" style="color: #64748b; text-decoration: underline;">privilegecontabilidade.cnt.br</a>
            </div>
            ${pixelUrl ? `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />` : ''}
          </div>
        </body>
        </html>
      `;

      const attachments: any[] = [];
      if (hasLogoOficial) {
        attachments.push({
          filename: 'privilege-logo.png',
          content: fs.readFileSync(logoOficialPath),
          cid: 'privilege-logo',
          contentType: 'image/png',
        });
      }
      if (pdfBoletoBase64) {
        attachments.push({
          filename: `Boleto-Sicoob-${nfseNumero || 'Cobranca'}.pdf`,
          content: Buffer.from(pdfBoletoBase64, 'base64'),
          contentType: 'application/pdf',
        });
      }
      if (xmlNfse) {
        attachments.push({
          filename: `NFSe-${nfseNumero || 'Documento'}.xml`,
          content: xmlNfse,
          contentType: 'application/xml',
        });
      }

      try {
        const info = await transporter.sendMail({
          from: `"Privilege Consultoria" <${smtpFrom}>`,
          to: emailAlvo,
          subject,
          html,
          attachments,
        });

        salvarLog({
          id: logId,
          empresaId,
          tipo: 'cobranca_boleto',
          assunto: subject,
          destinatarioEmail: emailAlvo,
          destinatarioNome: nomeCliente,
          status: 'entregue',
          enviadoEm: new Date().toISOString(),
        });

        return NextResponse.json({
          ok: true,
          messageId: info.messageId,
          enviadoPara: emailAlvo,
          logId,
        });
      } catch (errSend: any) {
        salvarLog({
          id: logId,
          empresaId,
          tipo: 'cobranca_boleto',
          assunto: subject,
          destinatarioEmail: emailAlvo,
          destinatarioNome: nomeCliente,
          status: 'falha',
          erroMensagem: errSend.message,
          enviadoEm: new Date().toISOString(),
        });
        throw errSend;
      }
    }

    // -------------------------------------------------------------
    // CASO 2: DISPARADOR DE NEWSLETTER / COMUNICADOS EM MASSA
    // -------------------------------------------------------------
    if (tipo === 'newsletter') {
      const tituloAssunto = assunto?.trim();
      const conteudoHtml = mensagem?.trim();

      if (!tituloAssunto || (!conteudoHtml && (!imagens || imagens.length === 0))) {
        return NextResponse.json({ error: 'Assunto e conteúdo ou imagem são obrigatórios para a newsletter.' }, { status: 400 });
      }

      let emailsDestino: { nome: string; email: string }[] = [];

      // A) Se foi fornecida uma lista manual de e-mails
      if (destinatariosLista) {
        const rawList = Array.isArray(destinatariosLista)
          ? destinatariosLista
          : String(destinatariosLista).split(/[\n,;]+/);

        for (const item of rawList) {
          const limpo = String(item).trim();
          if (limpo && limpo.includes('@')) {
            const match = limpo.match(/(?:(.*)<)?([^<>]+@[^<>]+)>?/);
            if (match) {
              const nome = match[1]?.trim() || 'Cliente';
              const email = match[2]?.trim();
              if (email && !emailsDestino.some(e => e.email.toLowerCase() === email.toLowerCase())) {
                emailsDestino.push({ nome, email });
              }
            }
          }
        }
      }

      // B) Se não forneceu lista manual, busca da base de clientes cadastrados
      if (emailsDestino.length === 0) {
        const whereClause: any = {
          ativo: true,
          email: { not: null },
        };
        if (empresaId) whereClause.empresaId = empresaId;

        try {
          let clientes = await db.cliente.findMany({
            where: whereClause,
            select: { id: true, nome: true, nomeFantasia: true, email: true },
          });

          // Se a empresa filtrada não possuir clientes com e-mail, busca em toda a base ativa da consultoria
          if (clientes.length === 0 && empresaId) {
            clientes = await db.cliente.findMany({
              where: { ativo: true, email: { not: null } },
              select: { id: true, nome: true, nomeFantasia: true, email: true },
            });
          }

          for (const c of clientes) {
            if (c.email && c.email.includes('@')) {
              emailsDestino.push({
                nome: c.nomeFantasia || c.nome || 'Cliente',
                email: c.email.trim(),
              });
            }
          }
        } catch {
          // Fallback caso db esteja indisponível
        }
      }

      if (emailsDestino.length === 0) {
        return NextResponse.json({
          error: 'Nenhum e-mail válido foi encontrado na lista informada ou no cadastro de clientes.',
          totalDestinatarios: 0,
        }, { status: 400 });
      }

      // Prepara anexos/imagens se existirem
      const attachmentsNewsletter: any[] = [];

      // Inclui a logo oficial do escritório como anexo inline embutido (CID)
      if (hasLogoOficial) {
        attachmentsNewsletter.push({
          filename: 'privilege-logo.png',
          content: fs.readFileSync(logoOficialPath),
          cid: 'privilege-logo',
          contentType: 'image/png',
        });
      }

      if (Array.isArray(imagens)) {
        for (let i = 0; i < imagens.length; i++) {
          const img = imagens[i];
          if (img?.base64) {
            const rawBase64 = img.base64.includes('base64,') ? img.base64.split('base64,')[1] : img.base64;
            const cid = img.cid || `img_anexo_${i}`;
            attachmentsNewsletter.push({
              filename: img.filename || `imagem_${i + 1}.png`,
              content: Buffer.from(rawBase64, 'base64'),
              cid,
            });
          }
        }
      }

      let enviados = 0;
      let falhas = 0;
      const logsEnvio: { email: string; status: 'ok' | 'erro'; erro?: string; jaEnviado?: boolean }[] = [];

      const temImagensAnexadas = attachmentsNewsletter.some(a => a.cid.startsWith('img_anexo_'));
      const isModoSomenteImagem = body.somenteImagem || (!conteudoHtml && temImagensAnexadas);

      // Proteção Antiduplicação: Evita reenviar para quem já recebeu este assunto com sucesso nas últimas 24h
      const logsRecentes = lerLogs();
      const destinatariosJaEnviados = new Set(
        logsRecentes
          .filter(l => {
            if (!l.destinatarioEmail || (l.status !== 'entregue' && l.status !== 'visualizado')) return false;
            if (l.assunto?.trim().toLowerCase() === tituloAssunto.toLowerCase()) {
              const diffHoras = (Date.now() - new Date(l.enviadoEm).getTime()) / (1000 * 60 * 60);
              return diffHoras < 24;
            }
            return false;
          })
          .map(l => l.destinatarioEmail.trim().toLowerCase())
      );

      for (const dest of emailsDestino) {
        const emailLower = dest.email.trim().toLowerCase();
        if (body.evitarDuplicados !== false && destinatariosJaEnviados.has(emailLower)) {
          // Já foi entregue com sucesso nas últimas 24 horas! Não duplica
          logsEnvio.push({ email: dest.email, status: 'ok', jaEnviado: true });
          enviados++;
          continue;
        }

        const logId = `news_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const randomRef = Math.random().toString(36).slice(2, 10);
        const webViewUrl = `${baseUrl}/api/email-servicos/view?id=${logId}&ref=${randomRef}`;
        const pixelUrl = `${baseUrl}/api/email-servicos/pixel?id=${logId}`;

        try {
          const nomeDest = dest.nome || 'Cliente';
          let bodyHtml = formatarMensagemParaEmail(conteudoHtml || '');

          let htmlImagens = '';
          if (temImagensAnexadas) {
            const linkWhatsDestino = (body.linkImagem || '').trim() || `https://wa.me/5546999048990?text=${encodeURIComponent('Olá! Vi o comunicado da Privilege e gostaria de mais informações.')}`;

            htmlImagens = `
              <div style="margin: 22px 0; text-align: center;">
                ${attachmentsNewsletter
                  .filter(att => att.cid.startsWith('img_anexo_'))
                  .map(att => `
                    <div style="margin-bottom: 16px;">
                      <a href="${linkWhatsDestino}" target="_blank" style="display: inline-block; text-decoration: none; cursor: pointer;">
                        <img src="cid:${att.cid}" alt="${tituloAssunto}" style="max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 6px; display: block; margin-left: auto; margin-right: auto; box-shadow: 0 4px 14px rgba(0,0,0,0.08);" />
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

          const templatePersonalizado = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>${tituloAssunto}</title>
              <style>
                body { font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; -webkit-font-smoothing: antialiased; }
                .email-wrapper { max-width: 640px; background: #ffffff; border-radius: 8px; margin: 0 auto; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
                .top-link { font-size: 11px; color: #64748b; text-align: center; padding: 12px 18px 8px; line-height: 1.5; background: #fafafa; border-bottom: 1px solid #f1f5f9; }
                .header-logo { padding: 20px 24px 22px; text-align: center; border-bottom: 1px solid #f1f5f9; background: #ffffff; }
                .content-box { padding: 26px 32px; font-size: 14.5px; line-height: 1.6; color: #334155; }
                .footer-box { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11.5px; color: #64748b; line-height: 1.5; }
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
                    ${hasLogoOficial
                      ? `<img src="cid:privilege-logo" alt="Privilege Contabilidade e Consultoria" width="260" style="display: block; margin: 0 auto; max-width: 260px; height: auto;" />`
                      : `<h2 style="color: #600000; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">PRIVILEGE CONTABILIDADE E CONSULTORIA</h2>`
                    }
                  </a>
                </div>

                <div class="content-box">
                  ${isModoSomenteImagem ? `
                    <!-- MODO SOMENTE IMAGEM / FLYER / COMUNICADO VISUAL -->
                    <div style="text-align: center; margin: 8px 0 16px;">
                      ${htmlImagens}
                    </div>
                  ` : `
                    <!-- MODO TEXTO & COMUNICADO COMPLETO FORMATADO -->
                    <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">
                      Prezado(a) <strong>${nomeDest}</strong>,
                    </p>
                    <div style="color: #334155;">
                      ${bodyHtml}
                    </div>
                    ${htmlImagens}

                    <div style="margin-top: 30px; padding-top: 18px; border-top: 2px solid #600000; font-size: 13px; color: #334155; line-height: 1.6;">
                      <p style="margin: 0; font-weight: 800; font-size: 14.5px; color: #600000; letter-spacing: 0.3px;">
                        PRIVILEGE CONTABILIDADE E CONSULTORIA
                      </p>
                      <p style="margin: 2px 0 12px; font-size: 12.5px; color: #64748b;">
                        Contabilidade Estratégica, BPO Financeiro e Apoio à Gestão Empresarial
                      </p>

                      <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; color: #475569; margin-top: 8px;">
                        <tr>
                          <td style="padding: 2px 0; vertical-align: top; width: 22px;">🏢</td>
                          <td style="padding: 2px 0;"><strong>Razão Social:</strong> PRIVILEGE CONSULTORIA LTDA · <strong>Nome Fantasia:</strong> PRIVILEGE CONTABILIDADE E CONSULTORIA</td>
                        </tr>
                        <tr>
                          <td style="padding: 2px 0; vertical-align: top;">📋</td>
                          <td style="padding: 2px 0;"><strong>CNPJ:</strong> 58.033.979/0001-84</td>
                        </tr>
                        <tr>
                          <td style="padding: 2px 0; vertical-align: top;">📍</td>
                          <td style="padding: 2px 0;"><strong>Endereço:</strong> Rua Pará, 127, Sala 103, Centro – Francisco Beltrão / PR · CEP 85.601-290</td>
                        </tr>
                        <tr>
                          <td style="padding: 2px 0; vertical-align: top;">📞</td>
                          <td style="padding: 2px 0;"><strong>Telefones:</strong> (46) 3035-1061 · (46) 3035-1018 · 📱 <strong>WhatsApp Oficial:</strong> (46) 99904-8990</td>
                        </tr>
                        <tr>
                          <td style="padding: 2px 0; vertical-align: top;">✉️</td>
                          <td style="padding: 2px 0;"><strong>E-mail:</strong> <a href="mailto:consultoria@privilegecontabilidade.com.br" style="color: #600000; text-decoration: none; font-weight: bold;">consultoria@privilegecontabilidade.com.br</a></td>
                        </tr>
                        <tr>
                          <td style="padding: 2px 0; vertical-align: top;">🌐</td>
                          <td style="padding: 2px 0;">
                            <strong>Site Oficial:</strong> <a href="https://privilegecontabilidade.cnt.br" target="_blank" style="color: #600000; font-weight: bold; text-decoration: none;">privilegecontabilidade.cnt.br</a>
                            · <strong>Instagram:</strong> <a href="https://instagram.com/privilegefb" target="_blank" style="color: #600000; font-weight: bold; text-decoration: none;">@privilegefb</a> e <a href="https://instagram.com/privilegeconsultoria.fb" target="_blank" style="color: #600000; font-weight: bold; text-decoration: none;">@privilegeconsultoria.fb</a>
                          </td>
                        </tr>
                      </table>
                    </div>
                  `}
                </div>

                <div class="footer-box">
                  <strong>Precisa de ajuda ou orientação contábil?</strong><br />
                  Entre em contato com nossa equipe pelos telefones <strong>(46) 3035-1061 · (46) 3035-1018</strong>, WhatsApp <strong>(46) 99904-8990</strong> ou responda a este e-mail.<br />
                  <span style="display: inline-block; margin-top: 6px; color: #94a3b8;">
                    PRIVILEGE CONSULTORIA LTDA (CNPJ 58.033.979/0001-84) · Rua Pará, 127, Sala 103, Centro – Francisco Beltrão/PR<br />
                    <a href="https://privilegecontabilidade.cnt.br" target="_blank" style="color: #64748b; text-decoration: underline; font-weight: bold;">privilegecontabilidade.cnt.br</a>
                  </span>
                </div>
                ${pixelUrl ? `<img src="${pixelUrl}" width="1" height="1" border="0" style="width:1px;height:1px;min-width:1px;min-height:1px;border:none;margin:0;padding:0;outline:none;" alt="" />` : ''}
              </div>
            </body>
            </html>
          `;

          await transporter.sendMail({
            from: `"Privilege Consultoria" <${smtpFrom}>`,
            to: dest.email,
            subject: tituloAssunto,
            html: templatePersonalizado,
            attachments: attachmentsNewsletter,
          });

          enviados++;
          logsEnvio.push({ email: dest.email, status: 'ok' });

          salvarLog({
            id: logId,
            empresaId,
            tipo: 'newsletter',
            assunto: tituloAssunto,
            destinatarioEmail: dest.email,
            destinatarioNome: nomeDest,
            status: 'entregue',
            enviadoEm: new Date().toISOString(),
            html: templatePersonalizado,
          });

          await new Promise(r => setTimeout(r, 150));
        } catch (e: any) {
          falhas++;
          logsEnvio.push({ email: dest.email, status: 'erro', erro: e.message });

          salvarLog({
            id: logId,
            empresaId,
            tipo: 'newsletter',
            assunto: tituloAssunto,
            destinatarioEmail: dest.email,
            destinatarioNome: dest.nome,
            status: 'falha',
            erroMensagem: e.message,
            enviadoEm: new Date().toISOString(),
          });
        }
      }

      return NextResponse.json({
        ok: true,
        enviados,
        falhas,
        totalDestinatarios: emailsDestino.length,
        logs: logsEnvio,
      });
    }

    return NextResponse.json({ error: 'Tipo de operação não reconhecido.' }, { status: 400 });
  } catch (err: any) {
    captureError(err, { context: 'api/email-servicos' });
    return NextResponse.json({ error: err.message || 'Erro ao processar envio de e-mail' }, { status: 500 });
  }
}
