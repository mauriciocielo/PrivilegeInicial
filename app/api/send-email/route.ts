import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { nome, email, whatsapp, mensagem } = await request.json();

    if (!nome || !email || !whatsapp || !mensagem) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'no-reply@privilegecontabilidade.com.br';

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json({ error: 'Configurações de SMTP ausentes nas variáveis de ambiente' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const mailOptions = {
      from: `"Portal Privilege" <${smtpFrom}>`,
      to: 'contato@privilegecontabilidade.com.br',
      cc: 'consultoria@privilegecontabilidade.com.br',
      subject: `Nova Solicitação de Diagnóstico - ${nome}`,
      text: `Uma nova solicitação de diagnóstico foi recebida através da página inicial.\n\n` +
            `Detalhes do Contato:\n` +
            `- Nome Completo: ${nome}\n` +
            `- E-mail: ${email}\n` +
            `- WhatsApp: ${whatsapp}\n\n` +
            `Mensagem:\n` +
            `${mensagem}\n\n` +
            `Atenciosamente,\nPortal Privilege`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #f3f4f6; padding-bottom: 16px;">
            <h2 style="color: #8c1a22; text-transform: uppercase; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 1px;">Privilege Contabilidade</h2>
            <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">Solicitação de Diagnóstico Contábil</p>
          </div>
          <p style="font-size: 15px; color: #374151;">Olá,</p>
          <p style="font-size: 15px; color: #374151;">Uma nova solicitação de contato e diagnóstico inicial foi recebida através da página inicial do site:</p>
          
          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #4b5563; font-weight: bold; width: 130px;">Nome Completo:</td>
                <td style="padding: 6px 0; color: #111827;">${nome}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #4b5563; font-weight: bold;">E-mail:</td>
                <td style="padding: 6px 0; color: #111827;"><a href="mailto:${email}" style="color: #8c1a22; text-decoration: none;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #4b5563; font-weight: bold;">WhatsApp:</td>
                <td style="padding: 6px 0; color: #111827;"><a href="https://api.whatsapp.com/send?phone=55${whatsapp.replace(/\D/g, '')}" style="color: #8c1a22; text-decoration: none;">${whatsapp}</a></td>
              </tr>
            </table>
          </div>
          
          <div style="margin: 20px 0;">
            <h4 style="color: #374151; margin-bottom: 8px; font-size: 14px; font-weight: bold;">Mensagem / Necessidades:</h4>
            <div style="background-color: #fff8f8; border-left: 4px solid #8c1a22; padding: 12px 16px; color: #5a4c4e; font-size: 14px; line-height: 1.6; border-radius: 0 8px 8px 0; font-style: italic;">
              "${mensagem.replace(/\n/g, '<br />')}"
            </div>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
          <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">Este é um e-mail automático enviado pelo Portal Privilege.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao enviar e-mail de contato:', error);
    return NextResponse.json({ error: (error as Error).message || 'Erro interno do servidor' }, { status: 500 });
  }
}
