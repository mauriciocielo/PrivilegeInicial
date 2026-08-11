import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import nodemailer from 'nodemailer';

export async function GET(request: Request) {
  try {
    // 1. Autorização simples usando cabeçalho ou parâmetro de consulta para segurança
    const { searchParams } = new URL(request.url);
    const clientToken = searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && clientToken !== cronSecret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('Iniciando geração de relatórios diários para e-mail e WhatsApp...');

    // Hoje formatado como YYYY-MM-DD (usando fuso horário do Brasil)
    const today = new Date(new Date().getTime() - 3 * 3600 * 1000).toISOString().split('T')[0];

    // 2. Buscar usuários que ativaram o recebimento de relatório diário
    const activeUsers = await db.user.findMany({
      where: { receberEmailDiario: true }
    });

    if (activeUsers.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum usuário configurado para receber relatórios diários.' });
    }

    const emailResults: string[] = [];
    const whatsappResults: string[] = [];

    // Configuração de SMTP
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'no-reply@privilegecontabilidade.com.br';

    const whatsappApiUrl = process.env.WHATSAPP_API_URL;
    const whatsappApiKey = process.env.WHATSAPP_API_KEY;

    for (const user of activeUsers) {
      // 3. Obter empresas vinculadas ao usuário
      // Se for administrador, ele tem acesso a todas. Se for cliente ou consultor, filtramos pelas permitidas.
      let empresas;
      if (user.role === 'administrador') {
        empresas = await db.empresa.findMany();
      } else {
        empresas = await db.empresa.findMany({
          where: { id: { in: user.empresaIds } }
        });
      }

      if (empresas.length === 0) {
        continue;
      }

      // Preparar os resumos de cada empresa
      const summaries = [];
      let emailHtmlBody = '';
      let whatsappTextBody = `*Privilege Financeiro - Resumo Diário*\n`;
      whatsappTextBody += `Olá, *${user.name}*! Aqui está o resumo financeiro das suas empresas hoje (*${today.split('-').reverse().join('/')}*):\n\n`;

      for (const emp of empresas) {
        // Buscar lançamentos realizados hoje da empresa
        const lancamentosHoje = await db.lancamento.findMany({
          where: {
            empresaId: emp.id,
            data: today,
            status: 'realizado'
          }
        });

        const receitasHoje = lancamentosHoje
          .filter(l => l.tipo === 'receita')
          .reduce((sum, l) => sum + l.valor, 0);

        const despesasHoje = lancamentosHoje
          .filter(l => l.tipo === 'despesa')
          .reduce((sum, l) => sum + l.valor, 0);

        // Buscar portadores para calcular o saldo total acumulado
        const portadores = await db.portador.findMany({
          where: { empresaId: emp.id, ativo: true }
        });

        // Para calcular o saldo consolidado atual: saldoInicial + todas as receitas realizadas - todas as despesas realizadas
        let saldoConsolidado = 0;
        for (const p of portadores) {
          const lancsPortador = await db.lancamento.findMany({
            where: {
              portadorId: p.id,
              status: 'realizado',
              OR: [
                { data: { gte: p.saldoInicialData || '1970-01-01' } }
              ]
            }
          });
          const recPort = lancsPortador.filter(l => l.tipo === 'receita').reduce((sum, l) => sum + l.valor, 0);
          const despPort = lancsPortador.filter(l => l.tipo === 'despesa').reduce((sum, l) => sum + l.valor, 0);
          saldoConsolidado += p.saldoInicial + recPort - despPort;
        }

        // Buscar contas previstas que vencem hoje (contas a pagar / receber pendentes)
        const pendentesHoje = await db.lancamento.findMany({
          where: {
            empresaId: emp.id,
            data: today,
            status: 'previsto'
          }
        });

        const contasAPagarHoje = pendentesHoje.filter(l => l.tipo === 'despesa').reduce((sum, l) => sum + l.valor, 0);
        const contasAReceberHoje = pendentesHoje.filter(l => l.tipo === 'receita').reduce((sum, l) => sum + l.valor, 0);

        summaries.push({
          empresa: emp.nomeFantasia || emp.razaoSocial,
          receitasHoje,
          despesasHoje,
          saldoConsolidado,
          contasAPagarHoje,
          contasAReceberHoje
        });

        // Formatação HTML para o e-mail
        emailHtmlBody += `
          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="color: #1e3a8a; margin-top: 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; text-transform: uppercase; font-size: 14px;">
              ${emp.nomeFantasia || emp.razaoSocial}
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #4b5563;">Saldo Consolidado em Caixa:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: ${saldoConsolidado >= 0 ? '#10b981' : '#ef4444'};">
                  R$ ${saldoConsolidado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #4b5563;">Receitas Realizadas Hoje:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #10b981;">
                  R$ ${receitasHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #4b5563;">Despesas Realizadas Hoje:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #ef4444;">
                  R$ ${despesasHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #4b5563;">Previsão Contas a Receber Hoje:</td>
                <td style="padding: 6px 0; text-align: right; color: #3b82f6;">
                  R$ ${contasAReceberHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #4b5563;">Previsão Contas a Pagar Hoje:</td>
                <td style="padding: 6px 0; text-align: right; color: #b45309;">
                  R$ ${contasAPagarHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </table>
          </div>
        `;

        // Formatação em texto para o WhatsApp
        whatsappTextBody += `🏢 *${emp.nomeFantasia || emp.razaoSocial}*\n`;
        whatsappTextBody += `• Saldo em Caixa: *R$ ${saldoConsolidatedString(saldoConsolidado)}*\n`;
        whatsappTextBody += `• Receitas Realizadas: R$ ${receitasHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
        whatsappTextBody += `• Despesas Realizadas: R$ ${despesasHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
        if (contasAReceberHoje > 0) whatsappTextBody += `• Previsto a Receber: R$ ${contasAReceberHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
        if (contasAPagarHoje > 0) whatsappTextBody += `• Previsto a Pagar: R$ ${contasAPagarHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
        whatsappTextBody += `\n`;
      }

      whatsappTextBody += `*Equipe Privilege Contabilidade*`;

      // 4. Enviar E-mail via SMTP se configurado
      if (smtpHost && smtpUser && smtpPass && user.email) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
            tls: { rejectUnauthorized: false }
          });

          await transporter.sendMail({
            from: `"Privilege Relatório Diário" <${smtpFrom}>`,
            to: user.email,
            subject: `Resumo Financeiro Diário - ${today.split('-').reverse().join('/')}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <h2 style="color: #1e3a8a; text-transform: uppercase; margin: 0;">Privilege</h2>
                  <p style="color: #6b7280; font-size: 12px; margin: 4px 0 0 0;">Relatório Consolidado Diário — ${today.split('-').reverse().join('/')}</p>
                </div>
                <p>Olá, <strong>${user.name}</strong>,</p>
                <p>Aqui está o fechamento financeiro do dia das suas empresas acompanhadas:</p>
                ${emailHtmlBody}
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                <p style="font-size: 11px; color: #9ca3af; text-align: center;">Este e-mail é gerado automaticamente pelo portal Privilege.</p>
              </div>
            `
          });
          emailResults.push(`E-mail enviado com sucesso para ${user.email}`);
        } catch (mailErr) {
          console.error(`Erro ao enviar e-mail diário para ${user.email}:`, mailErr);
          emailResults.push(`Falha no envio de e-mail para ${user.email}: ${(mailErr as Error).message}`);
        }
      } else {
        emailResults.push(`E-mail pulado para ${user.email} (SMTP não configurado)`);
      }

      // 5. Enviar mensagem de WhatsApp se configurado
      if (whatsappApiUrl && user.phone) {
        try {
          const cleanPhone = String(user.phone).replace(/\D/g, '');
          
          // Suporte flexível de integração de API (pode enviar para Z-API, Evolution API, Twilio, etc.)
          // O payload padrão é adaptável, enviando o destinatário (to/phone/number) e a mensagem (text/message)
          const payload: Record<string, any> = {};
          const isMeta = whatsappApiUrl.includes('graph.facebook.com');
          
          if (isMeta || whatsappApiUrl.includes('zappfy')) {
            payload['messaging_product'] = 'whatsapp';
            payload['recipient_type'] = 'individual';
            payload['to'] = cleanPhone;
            payload['type'] = 'template';
            payload['template'] = {
              name: 'alerta_relatorio_diario',
              language: { code: 'pt_BR' },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: whatsappTextBody }
                  ]
                }
              ]
            };
          } else if (whatsappApiUrl.includes('z-api') || whatsappApiUrl.includes('zapi')) {
            payload['phone'] = cleanPhone;
            payload['message'] = whatsappTextBody;
          } else {
            payload['to'] = cleanPhone;
            payload['phone'] = cleanPhone;
            payload['number'] = cleanPhone;
            payload['message'] = whatsappTextBody;
            payload['text'] = whatsappTextBody;
          }

          const wsHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
          if (whatsappApiKey) {
            if (whatsappApiKey.startsWith('Bearer ') || isMeta) {
              const token = whatsappApiKey.replace('Bearer ', '');
              wsHeaders['Authorization'] = `Bearer ${token}`;
            } else {
              wsHeaders['Authorization'] = `Bearer ${whatsappApiKey}`;
              wsHeaders['apikey'] = whatsappApiKey; // Evolution API usa apikey no header
              wsHeaders['X-API-KEY'] = whatsappApiKey;
            }
          }

          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
          const wsRes = await fetch(whatsappApiUrl, {
            method: 'POST',
            headers: wsHeaders,
            body: JSON.stringify(payload)
          });

          if (wsRes.ok) {
            whatsappResults.push(`WhatsApp enviado para ${cleanPhone}`);
          } else {
            const wsErrText = await wsRes.text();
            throw new Error(`Código ${wsRes.status}: ${wsErrText}`);
          }
        } catch (wsErr) {
          console.error(`Erro ao enviar WhatsApp diário para o número ${user.phone}:`, wsErr);
          whatsappResults.push(`Falha no WhatsApp para ${user.phone}: ${(wsErr as Error).message}`);
        }
      } else {
        whatsappResults.push(`WhatsApp pulado para ${user.name} (Telefone ou API de WhatsApp não configurados)`);
      }
    }

    return NextResponse.json({
      success: true,
      today,
      emailResults,
      whatsappResults
    });

  } catch (error) {
    console.error('Erro na execução do Cron diário:', error);
    return NextResponse.json({ error: (error as Error).message || 'Erro interno' }, { status: 500 });
  }
}

function saldoConsolidatedString(val: number): string {
  return `${val >= 0 ? '' : '-'}${Math.abs(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}
