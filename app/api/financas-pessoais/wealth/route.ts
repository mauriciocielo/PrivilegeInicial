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

    const [cartoesRaw, patrimonioRaw, dividasRaw, lancs6m, rendimentosRaw, assinCartaoRaw] = await Promise.all([
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
      db.$queryRawUnsafe<any[]>(
        `SELECT * FROM financas_pessoais_rendimentos WHERE owner_key = ANY($1::text[]) ORDER BY data DESC, created_at DESC LIMIT 200`,
        allKeys
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT * FROM financas_pessoais_assinaturas_cartao WHERE owner_key = ANY($1::text[]) ORDER BY valor_mensal DESC, nome ASC`,
        allKeys
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

    const rendPorPatrimonio = new Map<string, number>();
    for (const r of rendimentosRaw) {
      if (r.patrimonio_id) {
        const pid = String(r.patrimonio_id);
        rendPorPatrimonio.set(pid, (rendPorPatrimonio.get(pid) || 0) + Number(r.valor_liquido || 0));
      }
    }

    const patrimonio = patrimonioRaw.map((p) => {
      const aplicado = Number(p.valor_aplicado || 0);
      const atual = Number(p.valor_atual || 0);
      const resultado = Math.round((atual - aplicado) * 100) / 100;
      const rentabilidadePct = aplicado > 0 ? Math.round(((atual - aplicado) / aplicado) * 1000) / 10 : 0;
      const pid = String(p.id);
      return {
        id: pid,
        classe: String(p.classe || 'renda_fixa'),
        nome: String(p.nome),
        instituicao: String(p.instituicao || ''),
        quantidade: Number(p.quantidade || 1),
        valorAplicado: aplicado,
        valorAtual: atual,
        resultado,
        rentabilidadePct,
        rendimentosAcumulados: Math.round((rendPorPatrimonio.get(pid) || 0) * 100) / 100,
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

    const rendimentos = rendimentosRaw.map((r) => ({
      id: String(r.id),
      patrimonioId: r.patrimonio_id ? String(r.patrimonio_id) : null,
      ativoNome: String(r.ativo_nome || ''),
      tipoRendimento: String(r.tipo_rendimento || 'dividendo'),
      valorBruto: Number(r.valor_bruto || 0),
      irRetido: Number(r.ir_retido || 0),
      valorLiquido: Number(r.valor_liquido || 0),
      data: String(r.data || ''),
      observacao: String(r.observacao || ''),
    }));

    const assinaturasCartao = assinCartaoRaw.map((a) => ({
      id: String(a.id),
      cartaoId: a.cartao_id ? String(a.cartao_id) : null,
      cartaoNome: String(a.cartao_nome || ''),
      nome: String(a.nome || ''),
      categoria: String(a.categoria || 'Lazer'),
      valorMensal: Number(a.valor_mensal || 0),
      diaCobranca: Number(a.dia_cobranca || 10),
      ativa: Boolean(a.ativa),
    }));

    const anoSel = mes.slice(0, 4);
    const rendimentosMes = Math.round(
      rendimentos.filter((r) => r.data.startsWith(mes)).reduce((acc, r) => acc + r.valorLiquido, 0) * 100
    ) / 100;
    const rendimentosAno = Math.round(
      rendimentos.filter((r) => r.data.startsWith(anoSel)).reduce((acc, r) => acc + r.valorLiquido, 0) * 100
    ) / 100;

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
        rendimentosMes,
        rendimentosAno,
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
      rendimentos,
      assinaturasCartao,
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

    await Promise.all([ensureFinancasPessoaisTables(), ensureFinancasWealthTables()]);
    const { primaryKey, allKeys, phone } = await resolverChavesFinancasUsuario(auth.session.userId);
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

    if (recurso === 'rendimento') {
      const patrimonioId = String(body?.patrimonioId || '').trim();
      const tipoRendimento = String(body?.tipoRendimento || 'dividendo').trim();
      const valorBruto = Math.max(0, Number(body?.valorBruto || 0));
      const irRetido = Math.max(0, Number(body?.irRetido || 0));
      const valorLiquido = Math.max(0, Math.round((valorBruto - irRetido) * 100) / 100);
      const data = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.data || ''))
        ? String(body.data)
        : new Date().toISOString().slice(0, 10);
      const observacao = String(body?.observacao || '').trim().slice(0, 200);
      const lancarNoCaixa = Boolean(body?.lancarNoCaixa);
      const somarNoValorAtual = Boolean(body?.somarNoValorAtual);

      if (!patrimonioId) {
        return NextResponse.json(
          { error: 'Selecione um investimento cadastrado na sua carteira para lançar o rendimento.' },
          { status: 400 }
        );
      }
      if (valorBruto <= 0) {
        return NextResponse.json({ error: 'Informe o valor do rendimento.' }, { status: 400 });
      }

      const invRows = await db.$queryRawUnsafe<Array<{ id: string; nome: string; instituicao: string }>>(
        `SELECT id, nome, instituicao FROM financas_pessoais_patrimonio WHERE id = $1 AND owner_key = ANY($2::text[]) LIMIT 1`,
        patrimonioId,
        allKeys
      );
      const investimento = invRows[0];
      if (!investimento) {
        return NextResponse.json(
          { error: 'Investimento cadastrado não encontrado. Cadastre o investimento primeiro.' },
          { status: 404 }
        );
      }

      const ativoNome = investimento.instituicao
        ? `${investimento.nome} (${investimento.instituicao})`
        : investimento.nome;

      await db.$executeRawUnsafe(
        `INSERT INTO financas_pessoais_rendimentos
          (id, owner_key, patrimonio_id, ativo_nome, tipo_rendimento, valor_bruto, ir_retido, valor_liquido, data, observacao, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        id,
        primaryKey,
        investimento.id,
        ativoNome,
        tipoRendimento,
        valorBruto,
        irRetido,
        valorLiquido,
        data,
        observacao
      );

      if (somarNoValorAtual && valorLiquido > 0) {
        await db.$executeRawUnsafe(
          `UPDATE financas_pessoais_patrimonio
           SET valor_atual = valor_atual + $1, updated_at = NOW()
           WHERE id = $2 AND owner_key = ANY($3::text[])`,
          valorLiquido,
          investimento.id,
          allKeys
        );
      }

      if (lancarNoCaixa && valorLiquido > 0) {
        const rotulosTipo: Record<string, string> = {
          dividendo: 'Dividendos',
          jcp: 'JCP',
          aluguel_fii: 'Rendimento FII',
          renda_fixa: 'Rendimento Renda Fixa',
          fundo: 'Rendimento Fundo',
          outros: 'Rendimento',
        };
        const descCaixa = `${rotulosTipo[tipoRendimento] || 'Rendimento'} — ${ativoNome}`;
        await db.$executeRawUnsafe(
          `INSERT INTO financas_pessoais_lancamentos
            (id, owner_key, user_id, phone, tipo, valor, categoria, forma_pagamento, descricao, data, status, dedutivel_irpf, origem, created_at)
           VALUES ($1, $2, $3, $4, 'receita', $5, 'Investimentos', 'Rendimento', $6, $7, 'pago', FALSE, 'painel', NOW())`,
          crypto.randomUUID(),
          primaryKey,
          auth.session.userId,
          phone,
          valorLiquido,
          descCaixa,
          data
        );
      }

      return NextResponse.json({ ok: true, id, valorLiquido });
    }

    if (recurso === 'assinatura_cartao') {
      const nome = String(body?.nome || '').trim();
      const valorMensal = Math.max(0, Number(body?.valorMensal || 0));
      const categoria = String(body?.categoria || 'Lazer').trim();
      const diaCobranca = Math.min(31, Math.max(1, Number(body?.diaCobranca || 10)));
      const cartaoId = body?.cartaoId ? String(body.cartaoId).trim() : null;
      let cartaoNome = String(body?.cartaoNome || '').trim();

      if (!nome || valorMensal <= 0) {
        return NextResponse.json({ error: 'Informe o nome e o valor mensal da assinatura.' }, { status: 400 });
      }
      if (cartaoId && !cartaoNome) {
        const cRows = await db.$queryRawUnsafe<Array<{ nome: string }>>(
          `SELECT nome FROM financas_pessoais_cartoes WHERE id = $1 AND owner_key = ANY($2::text[]) LIMIT 1`,
          cartaoId,
          allKeys
        );
        cartaoNome = cRows[0]?.nome || '';
      }

      await db.$executeRawUnsafe(
        `INSERT INTO financas_pessoais_assinaturas_cartao
          (id, owner_key, cartao_id, cartao_nome, nome, categoria, valor_mensal, dia_cobranca, ativa, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())`,
        id,
        primaryKey,
        cartaoId,
        cartaoNome,
        nome,
        categoria,
        valorMensal,
        diaCobranca
      );
      return NextResponse.json({ ok: true, id });
    }

    if (recurso === 'lancar_assinaturas_mes') {
      const mesAlvo = /^\d{4}-\d{2}$/.test(String(body?.mes || ''))
        ? String(body.mes)
        : new Date().toISOString().slice(0, 7);
      const [ativas, jaMes] = await Promise.all([
        db.$queryRawUnsafe<any[]>(
          `SELECT * FROM financas_pessoais_assinaturas_cartao WHERE owner_key = ANY($1::text[]) AND ativa = TRUE`,
          allKeys
        ),
        db.$queryRawUnsafe<Array<{ descricao: string; valor: number }>>(
          `SELECT descricao, valor FROM financas_pessoais_lancamentos WHERE owner_key = ANY($1::text[]) AND data LIKE $2 AND tipo = 'despesa'`,
          allKeys,
          `${mesAlvo}%`
        ),
      ]);

      let lancadas = 0;
      let puladas = 0;
      for (const a of ativas) {
        const val = Math.round(Number(a.valor_mensal || 0) * 100) / 100;
        const nomeAssin = String(a.nome || '').trim();
        const jaTem = jaMes.some(
          (l) =>
            Math.round(Number(l.valor || 0) * 100) === Math.round(val * 100) &&
            String(l.descricao || '').toLowerCase().includes(nomeAssin.toLowerCase().slice(0, 8))
        );
        if (jaTem) {
          puladas++;
          continue;
        }
        const dia = String(Math.min(28, Math.max(1, Number(a.dia_cobranca || 10)))).padStart(2, '0');
        const dataLanc = `${mesAlvo}-${dia}`;
        const desc = a.cartao_nome ? `${nomeAssin} (${a.cartao_nome})` : nomeAssin;
        await db.$executeRawUnsafe(
          `INSERT INTO financas_pessoais_lancamentos
            (id, owner_key, user_id, phone, tipo, valor, categoria, forma_pagamento, descricao, data, status, dedutivel_irpf, origem, created_at)
           VALUES ($1, $2, $3, $4, 'despesa', $5, $6, 'Cartão de Crédito', $7, $8, 'pago', FALSE, 'assinatura', NOW())`,
          crypto.randomUUID(),
          primaryKey,
          auth.session.userId,
          phone,
          val,
          String(a.categoria || 'Lazer'),
          desc,
          dataLanc
        );
        lancadas++;
      }
      return NextResponse.json({ ok: true, lancadas, puladas });
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
        : recurso === 'rendimento'
        ? 'financas_pessoais_rendimentos'
        : recurso === 'assinatura_cartao'
        ? 'financas_pessoais_assinaturas_cartao'
        : null;
    if (!tabela) return NextResponse.json({ error: 'Recurso inválido.' }, { status: 400 });

    await db.$executeRawUnsafe(`DELETE FROM ${tabela} WHERE id = $1 AND owner_key = ANY($2::text[])`, id, allKeys);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em DELETE /api/financas-pessoais/wealth:', error);
    return NextResponse.json({ error: 'Erro ao excluir registro.' }, { status: 500 });
  }
}
