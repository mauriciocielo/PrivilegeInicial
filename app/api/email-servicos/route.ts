import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { db } from '../../../lib/prisma';
import { captureError } from '../../../lib/sentry-helper';
import { salvarLog } from './log/route';

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
  const smtpUser = envUser || 'contato@privilegecontabilidade.com.br';
  const smtpPass = envPass || 'Con@*010203';
  const smtpFrom = envFrom || 'contato@privilegecontabilidade.com.br';

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
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

    const origin = req.headers.get('origin') || req.headers.get('host') ? `http://${req.headers.get('host')}` : '';

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

      const pixelUrl = origin ? `${origin}/api/email-servicos/pixel?id=${logId}` : '';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 20px; color: #1f2937; }
            .container { max-width: 620px; background: #ffffff; border-radius: 8px; margin: 0 auto; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .header { background: #003641; color: #ffffff; padding: 24px 28px; text-align: center; }
            .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
            .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
            .body { padding: 26px 28px; }
            .highlight-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0; }
            .pix-box { text-align: center; background: #ffffff; border: 1.5px solid #003641; border-radius: 8px; padding: 18px; margin: 24px 0; }
            .pix-title { font-weight: 800; color: #003641; font-size: 15px; margin-bottom: 12px; }
            .code-box { background: #f3f4f6; border: 1px dashed #9ca3af; padding: 10px; font-family: monospace; font-size: 13px; word-break: break-all; margin: 12px 0; border-radius: 4px; text-align: center; font-weight: bold; }
            .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 18px 28px; text-align: center; font-size: 12px; color: #6b7280; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>PRIVILEGE CONSULTORIA & ASSESSORIA CONTÁBIL</h1>
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
                <div style="background: #f8fafc; border-left: 3px solid #003641; padding: 12px 14px; margin-top: 18px; font-size: 13.5px; color: #334155;">
                  ${mensagem.replace(/\n/g, '<br />')}
                </div>
              ` : ''}
            </div>

            <div class="footer">
              <strong>PRIVILEGE CONSULTORIA LTDA</strong><br />
              CNPJ: 58.033.979/0001-84 · Central: contato@privilegecontabilidade.com.br
            </div>
            ${pixelUrl ? `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />` : ''}
          </div>
        </body>
        </html>
      `;

      const attachments: any[] = [];
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
          const clientes = await db.cliente.findMany({
            where: whereClause,
            select: { id: true, nome: true, nomeFantasia: true, email: true },
          });

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
      const logsEnvio: { email: string; status: 'ok' | 'erro'; erro?: string }[] = [];

      for (const dest of emailsDestino) {
        const logId = `news_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const pixelUrl = origin ? `${origin}/api/email-servicos/pixel?id=${logId}` : '';

        try {
          const nomeDest = dest.nome || 'Cliente';
          let bodyHtml = (conteudoHtml || '').replace(/\n/g, '<br />');

          let htmlImagens = '';
          if (attachmentsNewsletter.length > 0) {
            htmlImagens = `
              <div style="margin-top: 20px; text-align: center;">
                ${attachmentsNewsletter.map(att => `<img src="cid:${att.cid}" alt="Imagem em anexo" style="max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;" />`).join('')}
              </div>
            `;
          }

          const templatePersonalizado = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8" />
              <style>
                body { font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
                .card { max-width: 640px; background: #ffffff; border-radius: 10px; margin: 0 auto; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
                .topbar { background: #8c1a22; color: #ffffff; padding: 24px 28px; text-align: center; }
                .topbar h2 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
                .topbar p { margin: 4px 0 0; font-size: 13px; opacity: 0.9; }
                .content { padding: 28px; font-size: 15px; line-height: 1.6; color: #334155; }
                .footer { background: #f1f5f9; padding: 18px 28px; text-align: center; font-size: 12px; color: #64748b; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="topbar">
                  <h2>PRIVILEGE CONSULTORIA CONTÁBIL</h2>
                  <p>Informativo e Comunicado Oficial</p>
                </div>
                <div class="content">
                  <p>Prezado(a) <strong>${nomeDest}</strong>,</p>
                  <div>${bodyHtml}</div>
                  ${htmlImagens}
                </div>
                <div class="footer">
                  <strong>Privilege Consultoria Ltda</strong><br />
                  Francisco Beltrão/PR · contato@privilegecontabilidade.com.br<br />
                  Você está recebendo este e-mail por ser cliente parceiro da Privilege Consultoria.
                </div>
                ${pixelUrl ? `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />` : ''}
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
