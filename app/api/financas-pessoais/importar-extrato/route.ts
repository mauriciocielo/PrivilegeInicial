import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import {
  CATEGORIAS_DEDUTIVEIS_IRPF,
  ensureFinancasPessoaisTables,
  resolverChavesFinancasUsuario,
} from '../../../../lib/financas-pessoais';
import { parseExtratoBancarioPf } from '../../../../lib/financas-pessoais-wealth';

export const dynamic = 'force-dynamic';

function classificarCategoriaExtrato(desc: string, tipo: 'despesa' | 'receita'): string {
  const t = desc.toLowerCase();
  if (tipo === 'receita') {
    if (/(sal[aá]rio|pr[oó]-?labore|folha)/i.test(t)) return 'Salário / Pró-labore';
    return 'Renda Extra';
  }
  if (/(mercado|supermercado|a[cç]ougue|padaria|restaurante|ifood|lanche|pizza)/i.test(t)) return 'Alimentação';
  if (/(aluguel|condom[ií]nio|energia|copel|sanepar|internet|claro|vivo|tim)/i.test(t)) return 'Moradia';
  if (/(posto|combust[ií]vel|gasolina|uber|99|ped[aá]gio|estacionamento)/i.test(t)) return 'Transporte';
  if (/(unimed|m[eé]dic|dentista|cl[ií]nica|hospital|farm[aá]cia|drogaria|laborat[oó]rio)/i.test(t)) return 'Saúde';
  if (/(escola|col[eé]gio|faculdade|universidade|curso)/i.test(t)) return 'Educação';
  if (/(previd[eê]ncia|pgbl)/i.test(t)) return 'Previdência';
  if (/(fatura|cart[aã]o|nubank|inter|visa|master)/i.test(t)) return 'Cartão de Crédito';
  if (/(netflix|spotify|cinema|hotel|viagem)/i.test(t)) return 'Lazer';
  if (/(tesouro|cdb|xp|btg|rico|nuinvest|b3)/i.test(t)) return 'Investimentos';
  return 'Outros';
}

/**
 * POST /api/financas-pessoais/importar-extrato
 * Importa e concilia extrato bancário pessoal (OFX ou CSV), classificando automaticamente
 * categorias, dedutíveis do IRPF e pulando lançamentos já existentes (mesma data + valor).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasPessoaisTables();
    const { primaryKey, allKeys, phone } = await resolverChavesFinancasUsuario(auth.session.userId);
    const body = await request.json().catch(() => ({}));
    const conteudo = String(body?.conteudo || '');
    const nomeArquivo = String(body?.nomeArquivo || 'extrato.ofx');

    const transacoes = parseExtratoBancarioPf(conteudo, nomeArquivo);
    if (transacoes.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma transação encontrada no arquivo. Envie um extrato OFX ou CSV válido do seu banco.' },
        { status: 400 }
      );
    }

    const existentes = await db.$queryRawUnsafe<Array<{ data: string; valor: number; tipo: string }>>(
      `SELECT data, valor, tipo FROM financas_pessoais_lancamentos WHERE owner_key = ANY($1::text[])`,
      allKeys
    );
    const chavesExistentes = new Set(
      existentes.map((e) => `${e.data}|${e.tipo}|${Math.round(Number(e.valor) * 100)}`)
    );

    let importados = 0;
    let duplicados = 0;
    let irpfDetectados = 0;

    for (const tr of transacoes) {
      const chave = `${tr.data}|${tr.tipo}|${Math.round(tr.valor * 100)}`;
      if (chavesExistentes.has(chave)) {
        duplicados++;
        continue;
      }
      chavesExistentes.add(chave);

      const categoria = classificarCategoriaExtrato(tr.descricao, tr.tipo);
      const dedutivel = tr.tipo === 'despesa' && CATEGORIAS_DEDUTIVEIS_IRPF.has(categoria);
      if (dedutivel) irpfDetectados++;

      await db.$executeRawUnsafe(
        `INSERT INTO financas_pessoais_lancamentos
          (id, owner_key, user_id, phone, tipo, valor, categoria, forma_pagamento, descricao, data, status, dedutivel_irpf, origem, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Extrato Bancário', $8, $9, 'pago', $10, 'extrato', NOW())`,
        crypto.randomUUID(),
        primaryKey,
        auth.session.userId,
        phone,
        tr.tipo,
        tr.valor,
        categoria,
        tr.descricao,
        tr.data,
        dedutivel
      );
      importados++;
    }

    return NextResponse.json({
      ok: true,
      totalLidas: transacoes.length,
      importados,
      duplicados,
      irpfDetectados,
    });
  } catch (error) {
    console.error('Erro em POST /api/financas-pessoais/importar-extrato:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao conciliar extrato bancário.' }, { status: 500 });
  }
}
