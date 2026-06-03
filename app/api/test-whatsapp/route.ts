import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const targetPhone = searchParams.get('phone') || '5546999048990';

    // 1. Obter o usuário para o teste
    let user = null;
    if (userId) {
      user = await db.user.findUnique({ where: { id: userId } });
    }

    if (!user) {
      // Se não for fornecido userId, pega o primeiro administrador como padrão para o teste
      user = await db.user.findFirst({
        orderBy: { role: 'asc' } // Geralmente traz "administrador" antes de "cliente" / "consultor"
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'Nenhum usuário encontrado no sistema para o teste.' }, { status: 404 });
    }

    console.log(`[WhatsApp Test] Gerando relatório para usuário: ${user.name} (${user.role})`);

    // 2. Determinar as empresas com base no papel do usuário
    let empresas = [];
    if (user.role === 'administrador') {
      empresas = await db.empresa.findMany();
    } else {
      // Para consultor e cliente, apenas as vinculadas/liberadas (user.empresaIds)
      empresas = await db.empresa.findMany({
        where: { id: { in: user.empresaIds } }
      });
    }

    if (empresas.length === 0) {
      return NextResponse.json({
        success: false,
        message: `O usuário ${user.name} (${user.role}) não possui nenhuma empresa vinculada/liberada.`
      });
    }

    // Hoje formatado (YYYY-MM-DD)
    const today = new Date(new Date().getTime() - 3 * 3600 * 1000).toISOString().split('T')[0];

    // 3. Montar a mensagem do WhatsApp
    let whatsappTextBody = `*Privilege Financeiro - Teste de Envio*\n`;
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

    // 4. Enviar mensagem de WhatsApp
    const whatsappApiUrl = process.env.WHATSAPP_API_URL;
    const whatsappApiKey = process.env.WHATSAPP_API_KEY;

    if (!whatsappApiUrl) {
      return NextResponse.json({
        success: false,
        message: 'WhatsApp API URL não configurada no ambiente (.env).',
        payloadPreview: {
          to: targetPhone,
          message: whatsappTextBody
        }
      });
    }

    const cleanPhone = String(targetPhone).replace(/\D/g, '');
    const payload: Record<string, any> = {};

    if (whatsappApiUrl.includes('z-api') || whatsappApiUrl.includes('zapi')) {
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
      if (whatsappApiKey.startsWith('Bearer ')) {
        wsHeaders['Authorization'] = whatsappApiKey;
      } else {
        wsHeaders['Authorization'] = `Bearer ${whatsappApiKey}`;
        wsHeaders['apikey'] = whatsappApiKey;
        wsHeaders['X-API-KEY'] = whatsappApiKey;
      }
    }

    console.log(`[WhatsApp Test] Enviando para ${whatsappApiUrl}...`);
    const wsRes = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: wsHeaders,
      body: JSON.stringify(payload)
    });

    if (wsRes.ok) {
      return NextResponse.json({
        success: true,
        message: `WhatsApp enviado com sucesso para ${cleanPhone}`,
        user: { name: user.name, role: user.role },
        companiesCount: empresas.length,
        whatsappTextBody
      });
    } else {
      const wsErrText = await wsRes.text();
      return NextResponse.json({
        success: false,
        error: `Erro retornado pela API do WhatsApp: Código ${wsRes.status}`,
        details: wsErrText,
        payloadPreview: payload
      }, { status: wsRes.status });
    }

  } catch (error) {
    console.error('Erro no endpoint de teste do WhatsApp:', error);
    return NextResponse.json({ error: (error as Error).message || 'Erro interno' }, { status: 500 });
  }
}

function saldoConsolidatedString(val: number): string {
  return `${val >= 0 ? '' : '-'}${Math.abs(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}
