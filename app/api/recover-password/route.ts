import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';
import nodemailer from 'nodemailer';
import { hashPassword } from '../../../lib/auth-hash';
import { checkRateLimit, getClientKey } from '../../../lib/rate-limit';
import { captureError } from '../../../lib/sentry-helper';

export async function POST(request: Request) {
  try {
    // Limita tentativas por IP (evita bombardeio de e-mail/SMS e força-bruta de enumeração de contas)
    const clientKey = getClientKey(request);
    const rate = checkRateLimit(`recover-password:${clientKey}`, 3, 15 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${Math.ceil(rate.retryAfterSeconds / 60)} minuto(s).` },
        { status: 429 }
      );
    }

    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'E-mail não fornecido' }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Verificar se o usuário existe no PostgreSQL
    const user = await db.user.findFirst({
      where: { email: cleanEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'Nenhum usuário cadastrado com este e-mail' }, { status: 404 });
    }

    // 2. Gerar uma nova senha aleatória (6 dígitos)
    const newPassword = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Atualizar a senha no banco de dados PostgreSQL (hash, nunca texto puro)
    await db.user.update({
      where: { id: user.id },
      data: { password: hashPassword(newPassword) }
    });

    // 4. Configurar e Enviar E-mail usando SMTP
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'no-reply@privilegecontabilidade.com.br';

    let emailSent = false;
    let emailErrorMsg = '';

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass
          },
          tls: {
            // Não falha por certificados SSL inválidos (comum em cPanel/Hostgator)
            rejectUnauthorized: false
          }
        });

        await transporter.sendMail({
          from: `"Privilege Financeiro" <${smtpFrom}>`,
          to: cleanEmail,
          subject: 'Sua nova senha de acesso - Privilege',
          text: `Olá, ${user.name}.\n\nUma nova senha temporária foi gerada para a sua conta.\n\nSua nova senha de acesso: ${newPassword}\n\nRecomendamos alterar sua senha após fazer login.\n\nAtenciosamente,\nEquipe Privilege`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; borderRadius: 8px;">
              <h2 style="color: #600000; text-align: center; text-transform: uppercase;">Privilege</h2>
              <p>Olá, <strong>${user.name}</strong>,</p>
              <p>Uma nova senha temporária foi gerada com sucesso para a sua conta.</p>
              <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #1f2937; margin: 20px 0; borderRadius: 4px;">
                ${newPassword}
              </div>
              <p style="color: #4b5563; font-size: 13px;">Recomendamos que você altere esta senha nas configurações do seu perfil após entrar no sistema.</p>
              <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="font-size: 11px; color: #9ca3af; text-align: center;">Este é um e-mail automático. Por favor, não responda.</p>
            </div>
          `
        });
        emailSent = true;
      } catch (err) {
        console.error('Erro ao enviar e-mail via SMTP:', err);
        captureError(err);
        emailErrorMsg = (err as Error).message;
      }
    } else {
      console.warn('Configurações de SMTP ausentes. E-mail não enviado. Nova senha gerada: ' + newPassword);
      emailErrorMsg = 'Serviço de e-mail (SMTP) não configurado nas variáveis de ambiente.';
    }

    // 5. Backup PARCIAL (somente usuários) para o navegador atualizar sua cópia local
    // com a nova senha (hash) imediatamente — nunca o banco inteiro da empresa.
    const cf_users = await db.user.findMany();

    return NextResponse.json({
      success: true,
      emailSent,
      emailError: emailErrorMsg || null,
      backup: {
        version: '7',
        timestamp: new Date().toISOString(),
        isPartial: true,
        data: { cf_users }
      },
      // Retorna a senha em ambiente de desenvolvimento ou se o SMTP não estiver configurado para facilitar o teste
      tempPassword: (!smtpHost || process.env.NODE_ENV !== 'production') ? newPassword : null
    });

  } catch (error) {
    console.error('Erro na recuperação de senha:', error);
    captureError(error);
    return NextResponse.json({ error: (error as Error).message || 'Erro interno do servidor' }, { status: 500 });
  }
}
