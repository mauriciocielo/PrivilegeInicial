import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';
import {
  ensureFinancasPessoaisTables,
  resolverChavesFinancasUsuario,
} from '../../../../lib/financas-pessoais';
import { ensureFinancasWealthTables } from '../../../../lib/financas-pessoais-wealth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financas-pessoais/wealth?mes=YYYY-MM
 * Retorna Cartões de Crédito, Investimentos/Bolsa/Day Trade/Consórcios, Empréstimos/Dívidas,
 * Patrimônio Líquido, Relatório Semanal (7d), Evolução 6 Meses e Cálculo DARF Day Trade (20%).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await Promise.all([ensureFinancasPessoaisTables(), ensureFinancasWealthTables()]);
    const { allKeys } = await resolverChavesFinancasUsuario(auth.session.userId);

    const url = new URL(request.url);
    const mesParam = (url.searchParams.get('mes') || '').trim();
    const mes = /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : new Date().toISOString().slice(0, 7);

    const hoje = new Date();
    const seteDiasAtras = new Date(hoje.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const inicio6Meses = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1).toISOString().slice(0, 10);

    const [cartoesRaw, patrimonioRaw, dividasRaw, lancs6m] = await Promise.all([
      db.$queryRawUnsafe<any[]>(
        `SELECT * FROM financas_pessoais_cartoes WHERE owner_key = ANY($1::text[]) ORDER BY created_at DESC`,
        allKeys
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT * FROM financas_pessoais_patrimonio WHERE owner_key = ANY($1::text[]) ORDER BY classe ASC, valor_atual DESC`,
        allKeys
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT * FROM financas_pessoais_dividas WHERE owner_key = ANY($1::text[]) ORDER BY taxa_juros_mensal DESC, saldo_devedor DESC`,
        allKeys
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT tipo, valor, categoria, forma_pagamento, data FROM financas_pessoais_lancamentos
         WHERE owner_key = ANY($1::text[]) AND data >= $2`,
        allKeys,
        inicio6Meses
      ),
    ]);

    // Gastos no crédito no mês para estimar fatura total de cartões
    const gastoCreditoMes = lancs6m
      .filter((l) => l.tipo === 'despesa' && String(l.data || '').startsWith(mes) && /cr[eé]dito/i.test(String(l.forma_pagamento || '')))
      .reduce((acc, l) => acc + Number(l.valor || 0), 0);

    const cartoes = cartoesRaw.map((c) => ({
      id: String(c.id),
      nome: String(c.nome),
      banco: String(c.banco || ''),
      limiteTotal: Number(c.limite_total || 0),
      diaFechamento: Number(c.dia_fechamento || 5),
      diaVencimento: Number(c.dia_vencimento || 15),
      cor: String(c.cor || '#1d4ed8'),
    }));

    const patrimonio = patrimonioRaw.map((p) => {
      const aplicado = Number(p.valor_aplicado || 0);
      const atual = Number(p.valor_atual || 0);
      const resultado = Math.round((atual - aplicado) * 100) / 100;
      const rentabilidadePct = aplicado > 0 ? Math.round(((atual - aplicado) / aplicado) * 1000) / 10 : 0;
      return {
        id: String(p.id),
        classe: String(p.classe || 'renda_fixa'),
        nome: String(p.nome),
        instituicao: String(p.instituicao || ''),
        quantidade: Number(p.quantidade || 1),
        valorAplicado: aplicado,
        valorAtual: atual,
        resultado,
        rentabilidadePct,
        taxaOuDetalhe: String(p.taxa_ou_detalhe || ''),
        dataReferencia: String(p.data_referencia || ''),
      };
    });

    const dividas = dividasRaw.map((d) => ({
      id: String(d.id),
      credor: String(d.credor),
      tipo: String(d.tipo || 'emprestimo'),
      saldoDevedor: Number(d.saldo_devedor || 0),
      taxaJurosMensal: Number(d.taxa_juros_mensal || 0),
      valorParcela: Number(d.valor_parcela || 0),
      parcelasRestantes: Number(d.parcelas_restantes || 1),
      diaVencimento: Number(d.dia_vencimento || 10),
    }));

    // Day Trade: resultado líquido do mês e DARF 20% (alíquota oficial de Day Trade em Bolsa no Brasil)
    const dayTradesMes = patrimonio.filter((p) => p.classe === 'day_trade' && (!p.dataReferencia || p.dataReferencia.startsWith(mes)));
    const lucroDayTradeMes = Math.round(dayTradesMes.reduce((acc, p) => acc + p.resultado, 0) * 100) / 100;
    const darfDayTradeEstimado = lucroDayTradeMes > 0 ? Math.round(lucroDayTradeMes * 0.2 * 100) / 100 : 0;

    // Totais de Patrimônio x Dívidas
    const totalAtivos = Math.round(
      patrimonio.filter((p) => p.classe !== 'day_trade').reduce((acc, p) => acc + p.valorAtual, 0) * 100
    ) / 100;
    const totalDividas = Math.round(dividas.reduce((acc, d) => acc + d.saldoDevedor, 0) * 100) / 100;
    const parcelaMensalDividas = Math.round(dividas.reduce((acc, d) => acc + d.valorParcela, 0) * 100) / 100;
    const patrimonioLiquido = Math.round((totalAtivos - totalDividas) * 100) / 100;

    // Relatório Semanal (últimos 7 dias)
    let entrou7d = 0;
    let saiu7d = 0;
    const cat7d = new Map<string, number>();
    for (const l of lancs6m) {
      if (String(l.data || '') < seteDiasAtras) continue;
      const v = Number(l.valor || 0);
      if (l.tipo === 'receita') entrou7d += v;
      else {
        saiu7d += v;
        const c = String(l.categoria || 'Outros');
        cat7d.set(c, (cat7d.get(c) || 0) + v);
      }
    }
    const topCategoriasSemana = Array.from(cat7d.entries())
      .map(([categoria, total]) => ({ categoria, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Evolução Mensal (últimos 6 meses)
    const mesesMap = new Map<string, { mes: string; receitas: number; despesas: number; saldo: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      mesesMap.set(ym, { mes: `${ym.slice(5)}/${ym.slice(2, 4)}`, receitas: 0, despesas: 0, saldo: 0 });
    }
    for (const l of lancs6m) {
      const ym = String(l.data || '').slice(0, 7);
      const item = mesesMap.get(ym);
      if (!item) continue;
      const v = Number(l.valor || 0);
      if (l.tipo === 'receita') item.receitas += v;
      else item.despesas += v;
    }
    const evolucao6Meses = Array.from(mesesMap.values()).map((m) => ({
      mes: m.mes,
      receitas: Math.round(m.receitas * 100) / 100,
      despesas: Math.round(m.despesas * 100) / 100,
      saldo: Math.round((m.receitas - m.despesas) * 100) / 100,
    }));

    return NextResponse.json({
      mes,
      gastoCreditoMes: Math.round(gastoCreditoMes * 100) / 100,
      resumoWealth: {
        totalAtivos,
        totalDividas,
        patrimonioLiquido,
        parcelaMensalDividas,
        lucroDayTradeMes,
        darfDayTradeEstimado,
      },
      relatorioSemanal: {
        periodoInicio: seteDiasAtras,
        entrou: Math.round(entrou7d * 100) / 100,
        saiu: Math.round(saiu7d * 100) / 100,
        saldo: Math.round((entrou7d - saiu7d) * 100) / 100,
        topCategorias: topCategoriasSemana,
      },
      evolucao6Meses,
      cartoes,
      patrimonio,
      dividas,
    });
  } catch (error) {
    console.error('Erro em GET /api/financas-pessoais/wealth:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar patrimônio, cartões e dívidas.' }, { status: 500 });
  }
}

/**
 * POST /api/financas-pessoais/wealth
 * Cadastra item de acordo com `recurso`: 'cartao' | 'patrimonio' | 'divida'.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasWealthTables();
    const { primaryKey } = await resolverChavesFinancasUsuario(auth.session.userId);
    const body = await request.json().catch(() => ({}));
    const recurso = String(body?.recurso || '');
    const id = crypto.randomUUID();

    if (recurso === 'cartao') {
      const nome = String(body?.nome || '').trim();
      const limiteTotal = Math.max(0, Number(body?.limiteTotal || 0));
      if (!nome || limiteTotal <= 0) {
        return NextResponse.json({ error: 'Informe nome do cartão e limite total.' }, { status: 400 });
      }
      await db.$executeRawUnsafe(
        `INSERT INTO financas_pessoais_cartoes (id, owner_key, nome, banco, limite_total, dia_fechamento, dia_vencimento, cor, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        id,
        primaryKey,
        nome,
        String(body?.banco || '').trim(),
        limiteTotal,
        Number(body?.diaFechamento || 5),
        Number(body?.diaVencimento || 15),
        String(body?.cor || '#1d4ed8')
      );
      return NextResponse.json({ ok: true, id });
    }

    if (recurso === 'patrimonio') {
      const nome = String(body?.nome || '').trim();
      const classe = String(body?.classe || 'renda_fixa').trim();
      if (!nome) return NextResponse.json({ error: 'Informe o nome do investimento/ativo.' }, { status: 400 });
      await db.$executeRawUnsafe(
        `INSERT INTO financas_pessoais_patrimonio
          (id, owner_key, classe, nome, instituicao, quantidade, valor_aplicado, valor_atual, taxa_ou_detalhe, data_referencia, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        id,
        primaryKey,
        classe,
        nome,
        String(body?.instituicao || '').trim(),
        Number(body?.quantidade || 1),
        Number(body?.valorAplicado || 0),
        Number(body?.valorAtual || 0),
        String(body?.taxaOuDetalhe || '').trim(),
        String(body?.dataReferencia || new Date().toISOString().slice(0, 10))
      );
      return NextResponse.json({ ok: true, id });
    }

    if (recurso === 'divida') {
      const credor = String(body?.credor || '').trim();
      const saldoDevedor = Math.max(0, Number(body?.saldoDevedor || 0));
      if (!credor || saldoDevedor <= 0) {
        return NextResponse.json({ error: 'Informe o credor/banco e o saldo devedor.' }, { status: 400 });
      }
      await db.$executeRawUnsafe(
        `INSERT INTO financas_pessoais_dividas
          (id, owner_key, credor, tipo, saldo_devedor, taxa_juros_mensal, valor_parcela, parcelas_restantes, dia_vencimento, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        id,
        primaryKey,
        credor,
        String(body?.tipo || 'emprestimo'),
        saldoDevedor,
        Math.max(0, Number(body?.taxaJurosMensal || 0)),
        Math.max(0, Number(body?.valorParcela || 0)),
        Math.max(1, Number(body?.parcelasRestantes || 1)),
        Number(body?.diaVencimento || 10)
      );
      return NextResponse.json({ ok: true, id });
    }

    return NextResponse.json({ error: 'Recurso inválido.' }, { status: 400 });
  } catch (error) {
    console.error('Erro em POST /api/financas-pessoais/wealth:', error);
    return NextResponse.json({ error: 'Erro ao salvar registro.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasWealthTables();
    const { allKeys } = await resolverChavesFinancasUsuario(auth.session.userId);
    const url = new URL(request.url);
    const recurso = (url.searchParams.get('recurso') || '').trim();
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });

    const tabela =
      recurso === 'cartao'
        ? 'financas_pessoais_cartoes'
        : recurso === 'patrimonio'
        ? 'financas_pessoais_patrimonio'
        : recurso === 'divida'
        ? 'financas_pessoais_dividas'
        : null;
    if (!tabela) return NextResponse.json({ error: 'Recurso inválido.' }, { status: 400 });

    await db.$executeRawUnsafe(`DELETE FROM ${tabela} WHERE id = $1 AND owner_key = ANY($2::text[])`, id, allKeys);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em DELETE /api/financas-pessoais/wealth:', error);
    return NextResponse.json({ error: 'Erro ao excluir registro.' }, { status: 500 });
  }
}
