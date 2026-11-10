import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '../../../lib/prisma';
import { captureError } from '../../../lib/sentry-helper';

function getTransporter() {
  const smtpHost = process.env.SMTP_HOST || 'mail.privilegecontabilidade.com.br';
  const smtpPort = Number(process.env.SMTP_PORT) || 465;
  const smtpUser = process.env.SMTP_USER || 'contato@privilegecontabilidade.com.br';
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || 'contato@privilegecontabilidade.com.br';

  if (!smtpPass) {
    throw new Error('SMTP_PASS não configurada no servidor.');
  }

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

  return { transporter, smtpFrom };
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
      // Dados para cobrança / boleto / nfse:
      nfseNumero,
      valor,
      vencimento,
      linhaDigitavel,
      codigoBarras,
      brcodePix,
      txidPix,
      pdfBoletoBase64,
      xmlNfse,
      // Dados para newsletter:
      filtroRegime, // opcional: 'todos' | 'simples' | 'presumido' | 'real'
    } = body;

    const { transporter, smtpFrom } = getTransporter();

    // -------------------------------------------------------------
    // CASO 1: ENVIO DE BOLETO / COBRANÇA / NFS-E
    // -------------------------------------------------------------
    if (tipo === 'cobranca_boleto' || (!tipo && (linhaDigitavel || brcodePix || nfseNumero))) {
      const emailAlvo = destinatarioEmail?.trim();
      if (!emailAlvo || !emailAlvo.includes('@')) {
        return NextResponse.json({ error: 'E-mail do destinatário inválido ou não informado.' }, { status: 400 });
      }

      const nomeCliente = destinatarioNome?.trim() || 'Prezado(a) Cliente';
      const valorFormatado = valor ? (typeof valor === 'number' ? `R$ ${valor.toFixed(2).replace('.', ',')}` : String(valor)) : '';
      const subject = assunto || `Cobrança e Boleto Sicoob — Privilege Consultoria${nfseNumero ? ` (NFS-e Nº ${nfseNumero})` : ''}`;

      const qrCodeImgSrc = brcodePix
        ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(brcodePix)}`
        : '';

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
            .highlight-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; }
            .highlight-row:last-child { margin-bottom: 0; }
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
              CNPJ: 58.033.979/0001-84 · Central: contato@privilegecontabilidade.com.br<br />
              Este é um e-mail automático gerado pelo sistema financeiro.
            </div>
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

      const info = await transporter.sendMail({
        from: `"Privilege Consultoria" <${smtpFrom}>`,
        to: emailAlvo,
        subject,
        html,
        attachments,
      });

      return NextResponse.json({
        ok: true,
        messageId: info.messageId,
        enviadoPara: emailAlvo,
      });
    }

    // -------------------------------------------------------------
    // CASO 2: DISPARADOR DE NEWSLETTER / COMUNICADOS EM MASSA
    // -------------------------------------------------------------
    if (tipo === 'newsletter') {
      const tituloAssunto = assunto?.trim();
      const conteudoHtml = mensagem?.trim();

      if (!tituloAssunto || !conteudoHtml) {
        return NextResponse.json({ error: 'Assunto e mensagem são obrigatórios para a newsletter.' }, { status: 400 });
      }

      // Busca todos os clientes ativos com e-mail cadastrado
      const whereClause: any = {
        ativo: true,
        email: { not: null },
      };

      if (empresaId) {
        whereClause.empresaId = empresaId;
      }

      const clientes = await db.cliente.findMany({
        where: whereClause,
        select: {
          id: true,
          nome: true,
          nomeFantasia: true,
          email: true,
          cpfCnpj: true,
        },
      });

      const emailsValidos = clientes.filter(c => c.email && c.email.includes('@'));

      if (emailsValidos.length === 0) {
        return NextResponse.json({
          error: 'Nenhum cliente ativo com e-mail válido foi encontrado no cadastro.',
          totalEncontrados: 0,
        }, { status: 400 });
      }

      let enviados = 0;
      let falhas = 0;
      const logsEnvio: { email: string; status: 'ok' | 'erro'; erro?: string }[] = [];

      for (const cli of emailsValidos) {
        try {
          const nomeDest = cli.nomeFantasia || cli.nome || 'Cliente';
          const templatePersonalizado = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8" />
              <style>
                body { font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
                .card { max-width: 640px; background: #ffffff; border-radius: 10px; margin: 0 auto; overflow: hidden; border: 1px solid #e2e8f0; }
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
                  <div>${conteudoHtml.replace(/\n/g, '<br />')}</div>
                </div>
                <div class="footer">
                  <strong>Privilege Consultoria Ltda</strong><br />
                  Francisco Beltrão/PR · contato@privilegecontabilidade.com.br<br />
                  Você está recebendo este e-mail por ser cliente parceiro da Privilege Consultoria.
                </div>
              </div>
            </body>
            </html>
          `;

          await transporter.sendMail({
            from: `"Privilege Consultoria" <${smtpFrom}>`,
            to: cli.email!,
            subject: tituloAssunto,
            html: templatePersonalizado,
          });

          enviados++;
          logsEnvio.push({ email: cli.email!, status: 'ok' });
          // Pausa sutil de 150ms para evitar bloqueios de taxa no SMTP
          await new Promise(r => setTimeout(r, 150));
        } catch (e) {
          falhas++;
          logsEnvio.push({ email: cli.email!, status: 'erro', erro: (e as Error).message });
        }
      }

      return NextResponse.json({
        ok: true,
        enviados,
        falhas,
        totalDestinatarios: emailsValidos.length,
        logs: logsEnvio,
      });
    }

    return NextResponse.json({ error: 'Tipo de operação não reconhecido.' }, { status: 400 });
  } catch (err: any) {
    captureError(err, { context: 'api/email-servicos' });
    return NextResponse.json({ error: err.message || 'Erro ao processar envio de e-mail' }, { status: 500 });
  }
}

