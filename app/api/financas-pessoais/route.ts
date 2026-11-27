import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '../../../lib/prisma';
import { requireAuth } from '../../../lib/api-auth';
import { captureError } from '../../../lib/sentry-helper';
import {
  CATEGORIAS_DEDUTIVEIS_IRPF,
  ensureFinancasPessoaisTables,
  resolverChavesFinancasUsuario,
} from '../../../lib/financas-pessoais';
import { ensureFinancasAssinaturasTable } from '../../../lib/financas-pessoais-assinaturas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financas-pessoais?mes=YYYY-MM
 * Retorna resumo mensal, gráfico por categoria, metas, lançamentos (WhatsApp + Web) e Pasta Dedutíveis IRPF do ano.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await Promise.all([ensureFinancasPessoaisTables(), ensureFinancasAssinaturasTable()]);
    const url = new URL(request.url);
    const mesParam = (url.searchParams.get('mes') || '').trim();
    const mes = /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : new Date().toISOString().slice(0, 7);
    const ano = mes.slice(0, 4);

    const { allKeys, phone } = await resolverChavesFinancasUsuario(auth.session.userId);

    const [lancsMes, metasRaw, irpfAno, assinRows] = await Promise.all([
      db.$queryRawUnsafe<any[]>(
        `SELECT * FROM financas_pessoais_lancamentos
         WHERE owner_key = ANY($1::text[]) AND data LIKE $2
         ORDER BY data DESC, created_at DESC`,
        allKeys,
        `${mes}%`
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT id, categoria, limite_mensal FROM financas_pessoais_metas
         WHERE owner_key = ANY($1::text[])
         ORDER BY categoria ASC`,
        allKeys
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT * FROM financas_pessoais_lancamentos
         WHERE owner_key = ANY($1::text[]) AND dedutivel_irpf = TRUE AND data LIKE $2
         ORDER BY data DESC`,
        allKeys,
        `${ano}%`
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT status, plano, valido_ate FROM financas_pessoais_assinaturas WHERE user_id = $1 LIMIT 1`,
        auth.session.userId
      ),
    ]);

    let assinatura: {
      status: string;
      plano: string;
      validoAte: string;
      diasRestantes: number;
      checkoutUrl: string;
    } | null = null;

    if (assinRows[0]) {
      const st = String(assinRows[0].status || 'trial');
      const validoAte = String(assinRows[0].valido_ate || '');
      const hojeMs = Date.parse(`${new Date().toISOString().slice(0, 10)}T12:00:00Z`);
      const validMs = validoAte ? Date.parse(`${validoAte}T12:00:00Z`) : hojeMs;
      const diasRestantes = Math.ceil((validMs - hojeMs) / (24 * 60 * 60 * 1000));
      const expirado = (st === 'trial' || st === 'ativo') && diasRestantes < 0;
      assinatura = {
        status: expirado ? 'expirado' : st,
        plano: String(assinRows[0].plano || 'trial_7d'),
        validoAte,
        diasRestantes,
        checkoutUrl:
          process.env.NEXT_PUBLIC_PF_CHECKOUT_URL ||
          'https://wa.me/5546999800010?text=Ol%C3%A1!%20Quero%20ativar%20minha%20assinatura%20do%20Minhas%20Finan%C3%A7as%20PF%20(R%24%2029%2C90%2Fm%C3%AAs).',
      };
    }

    let entrou = 0;
    let saiu = 0;
    const catMap = new Map<string, number>();

    const lancamentos = lancsMes.map((r) => {
      const val = Number(r.valor || 0);
      if (r.tipo === 'receita') entrou += val;
      else {
        saiu += val;
        const c = String(r.categoria || 'Outros');
        catMap.set(c, (catMap.get(c) || 0) + val);
      }
      return {
        id: String(r.id),
        tipo: r.tipo === 'receita' ? 'receita' : 'despesa',
        valor: val,
        categoria: String(r.categoria || 'Outros'),
        formaPagamento: String(r.forma_pagamento || 'PIX'),
        descricao: String(r.descricao || ''),
        data: String(r.data || ''),
        status: r.status === 'pendente' ? 'pendente' : 'pago',
        dedutivelIrpf: Boolean(r.dedutivel_irpf),
        origem: String(r.origem || 'web'),
        temComprovante: Boolean(r.comprovante_data),
        comprovanteNome: r.comprovante_nome ? String(r.comprovante_nome) : null,
      };
    });

    const porCategoria = Array.from(catMap.entries())
      .map(([categoria, total]) => ({ categoria, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    const metas = metasRaw.map((m) => {
      const cat = String(m.categoria);
      const limite = Number(m.limite_mensal || 0);
      const gasto = Math.round((catMap.get(cat) || 0) * 100) / 100;
      const pct = limite > 0 ? Math.round((gasto / limite) * 100) : 0;
      return { id: String(m.id), categoria: cat, limiteMensal: limite, gastoAtual: gasto, percentual: pct };
    });

    const dedutiveisIrpf = irpfAno.map((r) => ({
      id: String(r.id),
      data: String(r.data || ''),
      categoria: String(r.categoria || ''),
      descricao: String(r.descricao || ''),
      valor: Number(r.valor || 0),
      formaPagamento: String(r.forma_pagamento || ''),
      temComprovante: Boolean(r.comprovante_data),
      comprovanteNome: r.comprovante_nome ? String(r.comprovante_nome) : null,
    }));
    const totalDedutivelAno = dedutiveisIrpf.reduce((acc, d) => acc + d.valor, 0);

    return NextResponse.json({
      mes,
      ano,
      whatsappVinculado: Boolean(phone),
      telefone: phone,
      assinatura,
      resumo: {
        entrou: Math.round(entrou * 100) / 100,
        saiu: Math.round(saiu * 100) / 100,
        saldo: Math.round((entrou - saiu) * 100) / 100,
        totalDedutivelAno: Math.round(totalDedutivelAno * 100) / 100,
      },
      porCategoria,
      metas,
      lancamentos,
      dedutiveisIrpf,
    });
  } catch (error) {
    console.error('Erro em GET /api/financas-pessoais:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao carregar finanças pessoais.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasPessoaisTables();
    const { primaryKey, phone } = await resolverChavesFinancasUsuario(auth.session.userId);
    const body = await request.json().catch(() => ({}));

    const tipo = body?.tipo === 'receita' ? 'receita' : 'despesa';
    const valor = Math.round((Number(body?.valor) || 0) * 100) / 100;
    const categoria = String(body?.categoria || 'Outros').trim();
    const formaPagamento = String(body?.formaPagamento || 'PIX').trim();
    const descricao = String(body?.descricao || '').trim().slice(0, 140);
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.data || ''))
      ? String(body.data)
      : new Date().toISOString().slice(0, 10);
    const status = body?.status === 'pendente' ? 'pendente' : 'pago';
    const dedutivelIrpf =
      tipo === 'despesa' && (Boolean(body?.dedutivelIrpf) || CATEGORIAS_DEDUTIVEIS_IRPF.has(categoria));

    const comprovanteData =
      typeof body?.comprovanteData === 'string' &&
      body.comprovanteData.startsWith('data:') &&
      body.comprovanteData.length <= 4 * 1024 * 1024
        ? body.comprovanteData
        : null;
    const comprovanteNome =
      comprovanteData && typeof body?.comprovanteNome === 'string'
        ? body.comprovanteNome.trim().slice(0, 140)
        : null;

    if (valor <= 0 || !descricao) {
      return NextResponse.json({ error: 'Informe descrição e valor maior que zero.' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO financas_pessoais_lancamentos
        (id, owner_key, user_id, phone, tipo, valor, categoria, forma_pagamento, descricao, data, status, dedutivel_irpf, origem, comprovante_data, comprovante_nome, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'web', $13, $14, NOW())`,
      id,
      primaryKey,
      auth.session.userId,
      phone,
      tipo,
      valor,
      categoria,
      formaPagamento,
      descricao,
      data,
      status,
      dedutivelIrpf,
      comprovanteData,
      comprovanteNome
    );

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error('Erro em POST /api/financas-pessoais:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao salvar lançamento pessoal.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasPessoaisTables();
    const { allKeys } = await resolverChavesFinancasUsuario(auth.session.userId);
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });

    if (body?.status === 'pago' || body?.status === 'pendente') {
      await db.$executeRawUnsafe(
        `UPDATE financas_pessoais_lancamentos SET status = $2 WHERE id = $1 AND owner_key = ANY($3::text[])`,
        id,
        body.status,
        allKeys
      );
    }
    if (typeof body?.dedutivelIrpf === 'boolean') {
      await db.$executeRawUnsafe(
        `UPDATE financas_pessoais_lancamentos SET dedutivel_irpf = $2 WHERE id = $1 AND owner_key = ANY($3::text[])`,
        id,
        body.dedutivelIrpf,
        allKeys
      );
    }
    if (
      typeof body?.comprovanteData === 'string' &&
      body.comprovanteData.startsWith('data:') &&
      body.comprovanteData.length <= 4 * 1024 * 1024
    ) {
      const nome = typeof body?.comprovanteNome === 'string' ? body.comprovanteNome.trim().slice(0, 140) : 'Documento_IRPF.pdf';
      await db.$executeRawUnsafe(
        `UPDATE financas_pessoais_lancamentos
         SET comprovante_data = $2, comprovante_nome = $3
         WHERE id = $1 AND owner_key = ANY($4::text[])`,
        id,
        body.comprovanteData,
        nome,
        allKeys
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em PATCH /api/financas-pessoais:', error);
    return NextResponse.json({ error: 'Erro ao atualizar lançamento.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureFinancasPessoaisTables();
    const { allKeys } = await resolverChavesFinancasUsuario(auth.session.userId);
    const url = new URL(request.url);
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });

    await db.$executeRawUnsafe(
      `DELETE FROM financas_pessoais_lancamentos WHERE id = $1 AND owner_key = ANY($2::text[])`,
      id,
      allKeys
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro em DELETE /api/financas-pessoais:', error);
    return NextResponse.json({ error: 'Erro ao excluir lançamento.' }, { status: 500 });
  }
}
