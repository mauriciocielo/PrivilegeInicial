import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { generateText } from '../../../../lib/ai-provider';
import {
  ensureFinancasPessoaisTables,
  resolverChavesFinancasUsuario,
} from '../../../../lib/financas-pessoais';
import { ensureFinancasWealthTables } from '../../../../lib/financas-pessoais-wealth';
import { apenasDigitos } from '../../../../lib/nfse/dps';
import { encontrarSessaoAdminPorNumero } from '../../../../lib/nfse/enviar-whatsapp-nfse';
import { sendBaileysLiveMessage } from '../../../../lib/baileys-manager';
import { resolveWhatsAppOwnerId } from '../../../../lib/whatsapp-owner';

export const dynamic = 'force-dynamic';

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

/**
 * POST /api/financas-pessoais/ia-consultor
 * Consultor Financeiro Pessoal de IA:
 * Analisa renda, gastos, cartões, dívidas (juros/parcelas), investimentos, bolsa, day trade e consórcios
 * para gerar um Plano de Ação concreto de quitação de dívidas e melhoria de investimentos.
 * Opcionalmente (`enviarWhatsapp: true`) envia o plano/resumo no WhatsApp do usuário!
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await Promise.all([ensureFinancasPessoaisTables(), ensureFinancasWealthTables()]);
    const { allKeys, phone } = await resolverChavesFinancasUsuario(auth.session.userId);
    const body = await request.json().catch(() => ({}));
    const mes = /^\d{4}-\d{2}$/.test(String(body?.mes || '')) ? String(body.mes) : new Date().toISOString().slice(0, 7);
    const objetivoUsuario = String(body?.objetivo || '').trim();
    const enviarWhatsapp = Boolean(body?.enviarWhatsapp);

    const [lancs, cartoes, patrimonio, dividas] = await Promise.all([
      db.$queryRawUnsafe<any[]>(
        `SELECT tipo, valor, categoria, forma_pagamento FROM financas_pessoais_lancamentos
         WHERE owner_key = ANY($1::text[]) AND data LIKE $2`,
        allKeys,
        `${mes}%`
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT nome, limite_total FROM financas_pessoais_cartoes WHERE owner_key = ANY($1::text[])`,
        allKeys
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT classe, nome, valor_aplicado, valor_atual, taxa_ou_detalhe FROM financas_pessoais_patrimonio WHERE owner_key = ANY($1::text[])`,
        allKeys
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT credor, tipo, saldo_devedor, taxa_juros_mensal, valor_parcela, parcelas_restantes FROM financas_pessoais_dividas WHERE owner_key = ANY($1::text[]) ORDER BY taxa_juros_mensal DESC`,
        allKeys
      ),
    ]);

    let entrou = 0;
    let saiu = 0;
    const catMap = new Map<string, number>();
    for (const l of lancs) {
      const v = Number(l.valor || 0);
      if (l.tipo === 'receita') entrou += v;
      else {
        saiu += v;
        catMap.set(String(l.categoria || 'Outros'), (catMap.get(String(l.categoria || 'Outros')) || 0) + v);
      }
    }

    const totalAtivos = patrimonio.filter((p) => p.classe !== 'day_trade').reduce((a, p) => a + Number(p.valor_atual || 0), 0);
    const totalDividas = dividas.reduce((a, d) => a + Number(d.saldo_devedor || 0), 0);
    const lucroDayTrade = patrimonio.filter((p) => p.classe === 'day_trade').reduce((a, p) => a + (Number(p.valor_atual || 0) - Number(p.valor_aplicado || 0)), 0);

    const contexto = [
      `Mês analisado: ${mes}`,
      `Receitas no mês: ${fmtBRL(entrou)} | Despesas no mês: ${fmtBRL(saiu)} | Saldo: ${fmtBRL(entrou - saiu)}`,
      `Gastos por categoria: ${Array.from(catMap.entries()).map(([c, v]) => `${c}: ${fmtBRL(v)}`).join(', ') || 'Sem gastos registrados'}`,
      `Cartões de crédito: ${cartoes.map((c) => `${c.nome} (limite ${fmtBRL(Number(c.limite_total))})`).join(', ') || 'Nenhum cadastrado'}`,
      `Dívidas / Empréstimos (Total ${fmtBRL(totalDividas)}): ${
        dividas.length > 0
          ? dividas.map((d) => `${d.credor} (${d.tipo}) — saldo ${fmtBRL(Number(d.saldo_devedor))}, juros ${d.taxa_juros_mensal}%/mês, parcela ${fmtBRL(Number(d.valor_parcela))} (${d.parcelas_restantes}x)`).join(' | ')
          : 'Nenhuma dívida cadastrada'
      }`,
      `Investimentos / Patrimônio (Total ${fmtBRL(totalAtivos)}): ${
        patrimonio.length > 0
          ? patrimonio.map((p) => `[${p.classe}] ${p.nome}: aplicado ${fmtBRL(Number(p.valor_aplicado))}, atual ${fmtBRL(Number(p.valor_atual))} ${p.taxa_ou_detalhe ? `(${p.taxa_ou_detalhe})` : ''}`).join(' | ')
          : 'Nenhum investimento cadastrado'
      }`,
      lucroDayTrade !== 0 ? `Resultado Day Trade: ${fmtBRL(lucroDayTrade)} (DARF 20% sobre lucro líquido: ${fmtBRL(Math.max(0, lucroDayTrade * 0.2))})` : '',
      objetivoUsuario ? `Objetivo específico informado pelo usuário: ${objetivoUsuario}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const ai = await generateText({
      system:
        'Você é um planejador financeiro pessoal sênior (CFP) e especialista tributário brasileiro. ' +
        'Analise os dados reais do usuário e entregue um plano prático, direto e sem enrolação em português do Brasil, dividido em 4 blocos curtos com emojis: ' +
        '1) Diagnóstico Rápido (saúde do caixa e patrimônio líquido), ' +
        '2) Plano para Zerar Dívidas (ordem exata pelo método Avalanche/maior juros, renegociação ou portabilidade), ' +
        '3) Estratégia de Investimentos, Bolsa, Consórcios e Day Trade (reserva de emergência, diversificação e alerta de DARF 20% no Day Trade se houver), ' +
        '4) 3 Ações Imediatas para esta semana. ' +
        'Use os valores reais fornecidos. Nunca invente números.',
      prompt: contexto,
      maxTokens: 1100,
      temperature: 0.45,
      timeoutMs: 22000,
    });

    const analise =
      ai.text ||
      `📊 Diagnóstico (${mes}): Entrou ${fmtBRL(entrou)}, Saiu ${fmtBRL(saiu)}, Saldo ${fmtBRL(entrou - saiu)}. Patrimônio em ativos: ${fmtBRL(totalAtivos)} vs. Dívidas: ${fmtBRL(totalDividas)}. Priorize quitar primeiro as dívidas com maior taxa de juros mensal e manter reserva de emergência em liquidez diária.`;

    let whatsappEnviado = false;
    if (enviarWhatsapp && phone) {
      const dig = apenasDigitos(phone);
      if (dig.length >= 10) {
        const ownerId = await encontrarSessaoAdminPorNumero('46999800010', resolveWhatsAppOwnerId(request));
        if (ownerId) {
          const destino = dig.startsWith('55') ? dig : `55${dig}`;
          const resWa = await sendBaileysLiveMessage(
            destino,
            `🧠 *Plano Financeiro Pessoal (IA) — ${mes}*\n\n${analise}`,
            undefined,
            ownerId
          );
          whatsappEnviado = Boolean(resWa?.sent);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      analise,
      whatsappEnviado,
    });
  } catch (error) {
    console.error('Erro em POST /api/financas-pessoais/ia-consultor:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao gerar plano financeiro com IA.' }, { status: 500 });
  }
}
