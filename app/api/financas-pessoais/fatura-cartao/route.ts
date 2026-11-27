import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import { generateText, stripJsonFences } from '../../../../lib/ai-provider';
import {
  CATEGORIAS_DEDUTIVEIS_IRPF,
  ensureFinancasPessoaisTables,
  resolverChavesFinancasUsuario,
} from '../../../../lib/financas-pessoais';
import {
  ensureFinancasWealthTables,
  parseTextoExtratoPdfPf,
} from '../../../../lib/financas-pessoais-wealth';

export const dynamic = 'force-dynamic';

const CATEGORIAS_VALIDAS = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Cartão de Crédito',
  'Compras',
  'Contas Fixas',
  'Investimentos',
  'Previdência',
  'Outros',
];

const REGEX_ASSINATURAS =
  /(netflix|spotify|disney|hbo|max\.com|prime\s*video|amazon\s*prime|apple\.com|icloud|google\s*one|youtube|chatgpt|openai|claude|canva|adobe|microsoft|office\s*365|gympass|wellhub|smart\s*fit|academia|globoplay|deezer|paramount|uber\s*one|ifood\s*club|meli\+|mercado\s*livre|tim\s|vivo\s|claro\s|seguro|assinatura)/i;

function diffDias(d1: string, d2: string): number {
  const t1 = Date.parse(`${d1}T12:00:00Z`);
  const t2 = Date.parse(`${d2}T12:00:00Z`);
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return 999;
  return Math.abs(Math.round((t1 - t2) / (24 * 60 * 60 * 1000)));
}

function classificarCategoriaFatura(desc: string): string {
  const t = desc.toLowerCase();
  if (/(mercado|supermercado|a[cç]ougue|padaria|restaurante|ifood|lanche|pizza|caf[eé]|bar\b)/i.test(t)) return 'Alimentação';
  if (/(posto|combust[ií]vel|gasolina|uber|99|estacionamento|ped[aá]gio)/i.test(t)) return 'Transporte';
  if (/(farm[aá]cia|drogaria|m[eé]dic|dentista|cl[ií]nica|hospital|unimed|laborat[oó]rio)/i.test(t)) return 'Saúde';
  if (/(escola|col[eé]gio|faculdade|curso|udemy|alura)/i.test(t)) return 'Educação';
  if (REGEX_ASSINATURAS.test(t) || /(cinema|hotel|viagem|ingresso)/i.test(t)) return 'Lazer';
  if (/(internet|claro|vivo|tim|energia|condom[ií]nio)/i.test(t)) return 'Contas Fixas';
  return 'Compras';
}

interface ItemFaturaBruto {
  data: string;
  descricao: string;
  valor: number;
  parcela?: string;
  categoria?: string;
  pareceAssinatura?: boolean;
  dedutivelIrpf?: boolean;
}

async function extrairFaturaPdfComIA(textoPdf: string): Promise<ItemFaturaBruto[]> {
  const limpo = (textoPdf || '').trim();
  if (limpo.length < 20) return [];

  const anoAtual = new Date().getFullYear();
  const trecho = limpo.slice(0, 26000);
  const prompt = `Você é um auditor de faturas de cartão de crédito brasileiras (PDF convertido em texto: Nubank, Itaú, Inter, Sicoob, Bradesco, Santander, C6, BB, XP, BTG).
Extraia TODAS as compras, parcelas e assinaturas cobradas nesta fatura.
REGRAS:
- IGNORE "Pagamento recebido", "Pagamento da fatura anterior", "Saldo anterior", "Total da fatura", "Limite disponível", "Encargos/resumo geral".
- Se a data na linha for apenas DD/MM ou "12 NOV", converta para YYYY-MM-DD usando o ano da fatura (ou ${anoAtual}).
- valor deve ser número positivo (ex: 49.9).
- parcela: se houver indicação como "02/10" ou "Parcela 3/6", preencha "2/10"; senão "".
- categoria deve ser uma destas: ${CATEGORIAS_VALIDAS.join(', ')}.
- pareceAssinatura: true se for assinatura recorrente mensal (Netflix, Spotify, Apple/iCloud, Google, Amazon Prime, ChatGPT, Academia, Telefonia, Seguro, etc.).
- dedutivelIrpf: true apenas para Saúde (médico/dentista/clínica/hospital/laboratório) ou Educação (escola/faculdade).
- Responda APENAS JSON válido:
{"itens":[{"data":"2026-11-10","descricao":"NETFLIX.COM","valor":55.9,"parcela":"","categoria":"Lazer","pareceAssinatura":true,"dedutivelIrpf":false}]}

Texto da fatura em PDF:
${trecho}`;

  try {
    const ai = await generateText({
      system: 'Responda estritamente em JSON válido.',
      prompt,
      jsonMode: true,
      temperature: 0.05,
      maxTokens: 3500,
      timeoutMs: 24000,
    });
    if (!ai.text) return [];
    const parsed = JSON.parse(stripJsonFences(ai.text));
    const arr = Array.isArray(parsed?.itens) ? parsed.itens : [];
    const out: ItemFaturaBruto[] = [];
    for (const it of arr) {
      const dataStr = String(it?.data || '').trim();
      const val = Math.round(Math.abs(Number(it?.valor || 0)) * 100) / 100;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr) || !Number.isFinite(val) || val <= 0) continue;
      const desc = String(it?.descricao || 'Compra no cartão').trim().slice(0, 120);
      const cat = CATEGORIAS_VALIDAS.includes(String(it?.categoria))
        ? String(it.categoria)
        : classificarCategoriaFatura(desc);
      out.push({
        data: dataStr,
        descricao: desc,
        valor: val,
        parcela: String(it?.parcela || '').trim().slice(0, 16),
        categoria: cat,
        pareceAssinatura: Boolean(it?.pareceAssinatura) || REGEX_ASSINATURAS.test(desc),
        dedutivelIrpf: Boolean(it?.dedutivelIrpf) || CATEGORIAS_DEDUTIVEIS_IRPF.has(cat),
      });
    }
    return out;
  } catch (err) {
    console.warn('Extração IA de fatura PDF falhou (usando fallback):', err);
    return [];
  }
}

/**
 * POST /api/financas-pessoais/fatura-cartao
 * - modo: 'analisar' -> lê PDF da fatura com IA, confere quais compras já estão lançadas e detecta assinaturas recorrentes.
 * - modo: 'confirmar' -> lança as compras faltantes no Cartão de Crédito e cadastra as assinaturas marcadas.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await Promise.all([ensureFinancasPessoaisTables(), ensureFinancasWealthTables()]);
    const { primaryKey, allKeys, phone } = await resolverChavesFinancasUsuario(auth.session.userId);
    const body = await request.json().catch(() => ({}));
    const modo = String(body?.modo || 'analisar');

    if (modo === 'confirmar') {
      const itens = Array.isArray(body?.itens) ? body.itens : [];
      const cartaoId = body?.cartaoId ? String(body.cartaoId).trim() : null;
      const cartaoNome = String(body?.cartaoNome || '').trim();

      let lancados = 0;
      let assinaturasCriadas = 0;

      const assinExistentes = await db.$queryRawUnsafe<Array<{ nome: string }>>(
        `SELECT nome FROM financas_pessoais_assinaturas_cartao WHERE owner_key = ANY($1::text[])`,
        allKeys
      );
      const nomesAssinSet = new Set(assinExistentes.map((a) => String(a.nome || '').toLowerCase().trim()));

      for (const raw of itens) {
        const valor = Math.round(Math.abs(Number(raw?.valor || 0)) * 100) / 100;
        const data = /^\d{4}-\d{2}-\d{2}$/.test(String(raw?.data || ''))
          ? String(raw.data)
          : new Date().toISOString().slice(0, 10);
        const descricaoBase = String(raw?.descricao || 'Compra no cartão').trim().slice(0, 120);
        const parcela = String(raw?.parcela || '').trim();
        const categoria = CATEGORIAS_VALIDAS.includes(String(raw?.categoria)) ? String(raw.categoria) : 'Compras';
        const dedutivel = Boolean(raw?.dedutivelIrpf || CATEGORIAS_DEDUTIVEIS_IRPF.has(categoria));

        if (valor <= 0) continue;

        if (raw?.lancar) {
          const descFinal = `${descricaoBase}${parcela ? ` (${parcela})` : ''}${cartaoNome ? ` · ${cartaoNome}` : ''}`.slice(0, 140);
          await db.$executeRawUnsafe(
            `INSERT INTO financas_pessoais_lancamentos
              (id, owner_key, user_id, phone, tipo, valor, categoria, forma_pagamento, descricao, data, status, dedutivel_irpf, origem, created_at)
             VALUES ($1, $2, $3, $4, 'despesa', $5, $6, 'Cartão de Crédito', $7, $8, 'pago', $9, 'fatura_cartao', NOW())`,
            crypto.randomUUID(),
            primaryKey,
            auth.session.userId,
            phone,
            valor,
            categoria,
            descFinal,
            data,
            dedutivel
          );
          lancados++;
        }

        if (raw?.salvarAssinatura) {
          const chaveNome = descricaoBase.toLowerCase();
          if (!nomesAssinSet.has(chaveNome)) {
            nomesAssinSet.add(chaveNome);
            const diaCobr = Math.min(31, Math.max(1, Number(data.slice(8, 10)) || 10));
            await db.$executeRawUnsafe(
              `INSERT INTO financas_pessoais_assinaturas_cartao
                (id, owner_key, cartao_id, cartao_nome, nome, categoria, valor_mensal, dia_cobranca, ativa, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())`,
              crypto.randomUUID(),
              primaryKey,
              cartaoId,
              cartaoNome,
              descricaoBase,
              categoria,
              valor,
              diaCobr
            );
            assinaturasCriadas++;
          }
        }
      }

      return NextResponse.json({ ok: true, lancados, assinaturasCriadas });
    }

    // MODO ANALISAR
    const conteudo = String(body?.conteudo || '');
    const nomeArquivo = String(body?.nomeArquivo || 'fatura.pdf');
    const cartaoId = body?.cartaoId ? String(body.cartaoId).trim() : '';
    const cartaoNome = String(body?.cartaoNome || '').trim();

    let brutos = await extrairFaturaPdfComIA(conteudo);
    if (brutos.length === 0) {
      brutos = parseTextoExtratoPdfPf(conteudo)
        .filter((t) => t.tipo === 'despesa')
        .map((t) => ({
          data: t.data,
          descricao: t.descricao,
          valor: t.valor,
          parcela: '',
          categoria: classificarCategoriaFatura(t.descricao),
          pareceAssinatura: REGEX_ASSINATURAS.test(t.descricao),
          dedutivelIrpf: CATEGORIAS_DEDUTIVEIS_IRPF.has(classificarCategoriaFatura(t.descricao)),
        }));
    }

    if (brutos.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma compra foi encontrada neste PDF de fatura. Verifique se o PDF possui texto selecionável.' },
        { status: 400 }
      );
    }

    const [lancsExistentes, assinExistentes] = await Promise.all([
      db.$queryRawUnsafe<Array<{ data: string; valor: number; descricao: string; categoria: string }>>(
        `SELECT data, valor, descricao, categoria
         FROM financas_pessoais_lancamentos
         WHERE owner_key = ANY($1::text[]) AND tipo = 'despesa'
         ORDER BY data DESC
         LIMIT 1500`,
        allKeys
      ),
      db.$queryRawUnsafe<Array<{ nome: string; valor_mensal: number }>>(
        `SELECT nome, valor_mensal FROM financas_pessoais_assinaturas_cartao WHERE owner_key = ANY($1::text[])`,
        allKeys
      ),
    ]);

    const itens = brutos.map((b, idx) => {
      const centavos = Math.round(b.valor * 100);
      const matchLanc = lancsExistentes.find(
        (l) => Math.round(Number(l.valor || 0) * 100) === centavos && diffDias(l.data, b.data) <= 3
      );
      const jaLancado = Boolean(matchLanc);
      const jaEhAssinatura = assinExistentes.some(
        (a) =>
          Math.round(Number(a.valor_mensal || 0) * 100) === centavos &&
          b.descricao.toLowerCase().includes(String(a.nome || '').toLowerCase().slice(0, 6))
      );

      return {
        idx,
        data: b.data,
        descricao: b.descricao,
        valor: b.valor,
        parcela: b.parcela || '',
        categoria: matchLanc?.categoria || b.categoria || 'Compras',
        dedutivelIrpf: Boolean(b.dedutivelIrpf),
        jaLancado,
        motivoMatch: matchLanc ? `Conferido com lançamento de ${matchLanc.data}: ${matchLanc.descricao.slice(0, 35)}` : null,
        lancar: !jaLancado,
        pareceAssinatura: Boolean(b.pareceAssinatura),
        jaEhAssinatura,
        salvarAssinatura: Boolean(b.pareceAssinatura) && !jaEhAssinatura,
      };
    });

    const totalFatura = Math.round(itens.reduce((a, i) => a + i.valor, 0) * 100) / 100;
    const totalConferido = Math.round(itens.filter((i) => i.jaLancado).reduce((a, i) => a + i.valor, 0) * 100) / 100;
    const totalFaltando = Math.round((totalFatura - totalConferido) * 100) / 100;

    return NextResponse.json({
      ok: true,
      nomeArquivo,
      cartaoId,
      cartaoNome,
      resumo: {
        totalItens: itens.length,
        conferidos: itens.filter((i) => i.jaLancado).length,
        faltando: itens.filter((i) => !i.jaLancado).length,
        assinaturasDetectadas: itens.filter((i) => i.pareceAssinatura).length,
        totalFatura,
        totalConferido,
        totalFaltando,
      },
      itens,
    });
  } catch (error) {
    console.error('Erro em POST /api/financas-pessoais/fatura-cartao:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao analisar fatura do cartão.' }, { status: 500 });
  }
}
