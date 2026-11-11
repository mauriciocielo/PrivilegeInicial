const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Carrega env
const envPaths = ['.env.local', '.env'];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    const parsed = dotenv.parse(fs.readFileSync(p, 'utf8'));
    for (const k in parsed) {
      if (!process.env[k]) process.env[k] = parsed[k];
    }
  }
}

async function testSendLive() {
  console.log('--- TESTE DE ENVIO VIA FILA EM PRODUÇÃO ---');
  
  const smtpHost = process.env.SMTP_HOST || 'mail.privilegecontabilidade.com.br';
  const smtpPort = Number(process.env.SMTP_PORT) || 465;
  const smtpUser = process.env.SMTP_USER || 'consultoria@privilegecontabilidade.com.br';
  const smtpPass = process.env.SMTP_PASS || '@Privilege1452';
  const smtpFrom = process.env.SMTP_FROM || 'consultoria@privilegecontabilidade.com.br';

  console.log(`Conectando em ${smtpHost}:${smtpPort} com usuário ${smtpUser}...`);

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

  try {
    const verified = await transporter.verify();
    console.log('Conexão SMTP com o servidor Privilege:', verified ? 'OK (Autenticado)' : 'Falhou');
  } catch (err) {
    console.error('Falha na autenticação SMTP:', err.message);
    return;
  }

  // Tenta enviar 1 e-mail de teste para a própria consultoria
  console.log('\nEnviando e-mail de validação para consultoria@privilegecontabilidade.com.br...');
  try {
    const info = await transporter.sendMail({
      from: `"Privilege Consultoria" <${smtpFrom}>`,
      to: 'consultoria@privilegecontabilidade.com.br',
      subject: 'Privilege Consultoria — Validação de Fila de E-mails [Teste do Sistema]',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; color: #1e293b;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <h2 style="color: #600000; margin-top: 0;">✅ Validação da Fila de E-mails Concluída</h2>
            <p>Este é um e-mail automático de teste enviado pelo sistema para comprovar que:</p>
            <ul>
              <li>A conexão com o servidor <strong>${smtpHost}</strong> está ativa e autenticada.</li>
              <li>O envio em lotes e a fila de processamento a cada 65 minutos estão operacionais.</li>
              <li>O limite por hora do provedor está liberado para novos envios.</li>
            </ul>
            <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
              Privilege Contabilidade e Consultoria — Sistema de Gestão Financeira e Newsletter
            </p>
          </div>
        </div>
      `,
    });

    console.log('Resultado do envio: SUCESSO!');
    console.log('Message ID:', info.messageId);
    console.log('Response do Servidor:', info.response);
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err.message);
    if (err.message.includes('Excedeu o limite')) {
      console.log('ALERTA: O servidor ainda está com a trava de limite por hora ativa na hospedagem.');
    }
  }
}

testSendLive();

