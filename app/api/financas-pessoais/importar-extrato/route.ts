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
import {
  ensureFinancasWealthTables,
  parseExtratoBancarioPf,
  parseTextoExtratoPdfPf,
  type TransacaoExtratoPf,
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
  'Salário / Pró-labore',
  'Renda Extra',
  'Outros',
];

function normalizarTexto(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(pix|ted|doc|compra|debito|credito|pagto|pagamento|enviado|recebido|transf|transferencia|parcela|cartao|elo|visa|mastercard|banco|ltda|sa|me|epp)\b/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairTokens(s: string): string[] {
  return normalizarTexto(s)
    .split(' ')
    .filter((w) => w.length >= 4);
}

function diffDias(d1: string, d2: string): number {
  const t1 = Date.parse(`${d1}T12:00:00Z`);
  const t2 = Date.parse(`${d2}T12:00:00Z`);
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return 999;
  return Math.abs(Math.round((t1 - t2) / (24 * 60 * 60 * 1000)));
}

function detectarTipoRendimento(desc: string): string | null {
  const t = desc.toLowerCase();
  if (/(dividendo|div\b)/i.test(t)) return 'dividendo';
  if (/(jcp|juros\s+sobre\s+capital)/i.test(t)) return 'jcp';
  if (/(rendimento\s+fii|provento.*11|fii\b)/i.test(t)) return 'aluguel_fii';
  if (/(rendimento|juros\s+cdb|resgate\s+cdb|tesouro|lci|lca|poupanca|poupan[cç]a|aplicacao|aplica[cç][aã]o|provento|rentabilidade)/i.test(t)) {
    return 'renda_fixa';
  }
  return null;
}

function classificarHeuristica(desc: string, tipo: 'despesa' | 'receita'): {
  categoria: string;
  destino: 'lancamento' | 'rendimento_investimento';
  tipoRendimento: string;
  motivo: string;
} {
  const t = desc.toLowerCase();
  if (tipo === 'receita') {
    const tipoRend = detectarTipoRendimento(desc);
    if (tipoRend) {
      return {
        categoria: 'Investimentos',
        destino: 'rendimento_investimento',
        tipoRendimento: tipoRend,
        motivo: 'Detectado como rendimento/provento de investimento',
      };
    }
    if (/(sal[aá]rio|pr[oó]-?labore|folha|remunera)/i.test(t)) {
      return { categoria: 'Salário / Pró-labore', destino: 'lancamento', tipoRendimento: 'dividendo', motivo: 'Receita salarial' };
    }
    return { categoria: 'Renda Extra', destino: 'lancamento', tipoRendimento: 'dividendo', motivo: 'Receita avulsa' };
  }
  if (/(mercado|supermercado|a[cç]ougue|padaria|restaurante|ifood|lanche|pizza|caf[eé]|panificadora)/i.test(t)) {
    return { categoria: 'Alimentação', destino: 'lancamento', tipoRendimento: 'dividendo', motivo: 'Alimentação / mercado' };
  }
  if (/(aluguel|condom[ií]nio|energia|copel|sanepar|internet|claro|vivo|tim|oi\b|luz|[aá]gua|g[aá]s)/i.test(t)) {
    return { categoria: 'Moradia', destino: 'lancamento', tipoRendimento: 'dividendo', motivo: 'Despesa de moradia / conta da casa' };
  }
  if (/(posto|combust[ií]vel|gasolina|etanol|uber|99|ped[aá]gio|estacionamento|oficina|ipva)/i.test(t)) {
    return { categoria: 'Transporte', destino: 'lancamento', tipoRendimento: 'dividendo', motivo: 'Transporte / combustível' };
  }
  if (/(unimed|m[eé]dic|dentista|cl[ií]nica|hospital|farm[aá]cia|drogaria|laborat[oó]rio|exame|psic[oó]log|fisioterap)/i.test(t)) {
    return { categoria: 'Saúde', destino: 'lancamento', tipoRendimento: 'dividendo', motivo: 'Saúde (dedutível IRPF)' };
  }
  if (/(escola|col[eé]gio|faculdade|universidade|curso|mensalidade\s+escolar|pos\s+grad)/i.test(t)) {
    return { categoria: 'Educação', destino: 'lancamento', tipoRendimento: 'dividendo', motivo: 'Educação (dedutível IRPF)' };
  }
  if (/(previd[eê]ncia|pgbl|vgbl)/i.test(t)) {
    return { categoria: 'Previdência', destino: 'lancamento', tipoRendimento: 'dividendo', motivo: 'Previdência privada' };
  }
  if (/(fatura|cart[aã]o|nubank|inter|visa|mastercard|ita[uú]\s*card)/i.test(t)) {
    return { categoria: 'Cartão de Crédito', destino: 'lancamento', tipoRendimento: 'dividendo', motivo: 'Fatura de cartão' };
  }
  if (/(netflix|spotify|cinema|hotel|viagem|disney|amazon\s+prime|youtube|bar\b|ingresso)/i.test(t)) {
    return { categoria: 'Lazer', destino: 'lancamento', tipoRendimento: 'dividendo', motivo: 'Lazer / assinaturas' };
  }
  if (/(tesouro|cdb|xp\s|btg|rico|nuinvest|b3|corretora|aporte|invest)/i.test(t)) {
    return { categoria: 'Investimentos', destino: 'lancamento', tipoRendimento: 'dividendo', motivo: 'Aporte em investimentos' };
  }
  return { categoria: 'Outros', destino: 'lancamento', tipoRendimento: 'dividendo', motivo: 'Classificação padrão' };
}

interface HistoricoItem {
  data: string;
  tipo: string;
  valor: number;
  categoria: string;
  descricao: string;
  dedutivel_irpf: boolean;
}

function buscarNoHistorico(
  desc: string,
  tipo: 'despesa' | 'receita',
  historico: HistoricoItem[]
): { categoria: string; dedutivelIrpf: boolean; referencia: string } | null {
  const norm = normalizarTexto(desc);
  const tokens = extrairTokens(desc);
  if (!norm && tokens.length === 0) return null;

  const votos = new Map<string, { count: number; dedutivel: boolean; ref: string }>();

  for (const h of historico) {
    if (h.tipo !== tipo) continue;
    const hNorm = normalizarTexto(h.descricao);
    if (!hNorm) continue;

    let bateu = false;
    if (norm.length >= 5 && (hNorm.includes(norm) || norm.includes(hNorm))) {
      bateu = true;
    } else if (tokens.length > 0) {
      const hTokens = new Set(extrairTokens(h.descricao));
      const comuns = tokens.filter((t) => hTokens.has(t));
      if (comuns.length >= 2 || (comuns.length === 1 && comuns[0].length >= 6)) {
        bateu = true;
      }
    }

    if (bateu && CATEGORIAS_VALIDAS.includes(h.categoria)) {
      const cur = votos.get(h.categoria) || { count: 0, dedutivel: false, ref: h.descricao };
      cur.count += 1;
      if (h.dedutivel_irpf) cur.dedutivel = true;
      votos.set(h.categoria, cur);
    }
  }

  let melhor: { categoria: string; count: number; dedutivel: boolean; ref: string } | null = null;
  for (const [cat, info] of votos.entries()) {
    if (!melhor || info.count > melhor.count) {
      melhor = { categoria: cat, count: info.count, dedutivel: info.dedutivel, ref: info.ref };
    }
  }

  if (!melhor) return null;
  return {
    categoria: melhor.categoria,
    dedutivelIrpf: tipo === 'despesa' && (melhor.dedutivel || CATEGORIAS_DEDUTIVEIS_IRPF.has(melhor.categoria)),
    referencia: melhor.ref.slice(0, 45),
  };
}

async function classificarLoteComIA(
  pendentes: Array<{ idx: number; data: string; tipo: 'despesa' | 'receita'; valor: number; descricao: string }>,
  exemplosHistorico: Array<{ descricao: string; tipo: string; categoria: string }>
): Promise<
  Map<
    number,
    {
      categoria: string;
      destino: 'lancamento' | 'rendimento_investimento';
      tipoRendimento?: string;
      dedutivelIrpf?: boolean;
      motivo: string;
    }
  >
> {
  const mapa = new Map<
    number,
    {
      categoria: string;
      destino: 'lancamento' | 'rendimento_investimento';
      tipoRendimento?: string;
      dedutivelIrpf?: boolean;
      motivo: string;
    }
  >();

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey || pendentes.length === 0) return mapa;

  const lote = pendentes.slice(0, 55);
  const exemplosTxt =
    exemplosHistorico.length > 0
      ? exemplosHistorico
          .slice(0, 25)
          .map((e) => `- "${e.descricao}" (${e.tipo}) => ${e.categoria}`)
          .join('\n')
      : '(sem histórico anterior ainda)';

  const itensTxt = lote
    .map((p) => `[${p.idx}] ${p.data} | ${p.tipo} | R$ ${p.valor.toFixed(2)} | ${p.descricao}`)
    .join('\n');

  const prompt = `Você é um assistente especialista em conciliação bancária pessoal (PF) no Brasil.
Classifique cada transação do extrato abaixo usando EXCLUSIVAMENTE uma destas categorias:
${CATEGORIAS_VALIDAS.join(', ')}

Padrões já usados por este usuário no histórico dele (respeite o estilo dele!):
${exemplosTxt}

Regras:
1. Se uma RECEITA for dividendo, JCP, rendimento de CDB/Tesouro/FII/Poupança/Fundo, use destino="rendimento_investimento", categoria="Investimentos" e tipoRendimento em ("dividendo","jcp","aluguel_fii","renda_fixa","fundo","outros").
2. Para demais transações, use destino="lancamento".
3. Marque dedutivelIrpf=true APENAS se for despesa de Saúde (médico, dentista, clínica, hospital, plano de saúde, laboratório), Educação (escola, faculdade, pós) ou Previdência PGBL.
4. Responda APENAS com um JSON válido no formato:
{"itens":[{"idx":0,"categoria":"Alimentação","destino":"lancamento","dedutivelIrpf":false,"motivo":"Supermercado"}]}

Transações para classificar:
${itensTxt}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Responda estritamente em JSON válido.' },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return mapa;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed?.itens) ? parsed.itens : [];

    for (const item of arr) {
      const idx = Number(item?.idx);
      if (!Number.isInteger(idx)) continue;
      const cat = CATEGORIAS_VALIDAS.includes(String(item?.categoria)) ? String(item.categoria) : 'Outros';
      const destino = item?.destino === 'rendimento_investimento' ? 'rendimento_investimento' : 'lancamento';
      mapa.set(idx, {
        categoria: destino === 'rendimento_investimento' ? 'Investimentos' : cat,
        destino,
        tipoRendimento: typeof item?.tipoRendimento === 'string' ? item.tipoRendimento : 'renda_fixa',
        dedutivelIrpf: Boolean(item?.dedutivelIrpf),
        motivo: String(item?.motivo || 'Sugerido pela IA').slice(0, 70),
      });
    }
  } catch (err) {
    console.warn('Classificação IA de extrato falhou (usando heurística):', err);
  }

  return mapa;
}

async function extrairTransacoesPdfComIA(textoPdf: string): Promise<TransacaoExtratoPf[]> {
  const groqKey = process.env.GROQ_API_KEY;
  const limpo = (textoPdf || '').trim();
  if (!groqKey || limpo.length < 20) return [];

  const anoAtual = new Date().getFullYear();
  const trecho = limpo.slice(0, 24000);
  const prompt = `Você é um extrator de transações de extratos bancários brasileiros (PDF convertido em texto).
Extraia TODAS as movimentações reais (entradas e saídas) do texto abaixo.
REGRAS IMPORTANTES:
- IGNORE cabeçalhos, dados da conta, "Saldo Anterior", "Saldo do Dia", "Saldo Final", "Saldo Disponível", "Total de Entradas/Saídas".
- Se a data não tiver ano, use o ano que aparecer no cabeçalho do extrato (ou ${anoAtual}).
- Formate data como YYYY-MM-DD.
- valor deve ser número positivo (ex: 85.5).
- tipo deve ser "receita" (crédito/entrada/pix recebido/C/+) ou "despesa" (débito/saída/pagamento/compra/pix enviado/D/-).
- Responda APENAS JSON válido no formato:
{"transacoes":[{"data":"2026-11-15","descricao":"Supermercado Muffato","valor":185.4,"tipo":"despesa"}]}

Texto do extrato PDF:
${trecho}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.05,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Responda estritamente em JSON válido.' },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(22000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed?.transacoes) ? parsed.transacoes : [];

    const out: TransacaoExtratoPf[] = [];
    for (const item of arr) {
      const dataStr = String(item?.data || '').trim();
      const val = Math.round(Math.abs(Number(item?.valor || 0)) * 100) / 100;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr) || !Number.isFinite(val) || val <= 0) continue;
      out.push({
        data: dataStr,
        descricao: String(item?.descricao || 'Movimentação bancária (PDF)').trim().slice(0, 120),
        valor: val,
        tipo: item?.tipo === 'receita' ? 'receita' : 'despesa',
      });
    }
    return out;
  } catch (err) {
    console.warn('Extração IA de extrato PDF falhou (usando parser heurístico):', err);
    return [];
  }
}

/**
 * POST /api/financas-pessoais/importar-extrato
 * Suporta:
 * - modo: 'analisar' -> analisa OFX/CSV com histórico + IA, identifica o que já está lançado e devolve prévia editável.
 * - modo: 'confirmar' -> grava os itens revisados/aprovados pelo usuário (lançamentos e/ou rendimentos de investimentos).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await Promise.all([ensureFinancasPessoaisTables(), ensureFinancasWealthTables()]);
    const { primaryKey, allKeys, phone } = await resolverChavesFinancasUsuario(auth.session.userId);
    const body = await request.json().catch(() => ({}));
    const modo = String(body?.modo || 'analisar');

    // =========================================================
    // MODO CONFIRMAR: grava itens revisados pelo usuário
    // =========================================================
    if (modo === 'confirmar') {
      const itens = Array.isArray(body?.itens) ? body.itens : [];
      if (itens.length === 0) {
        return NextResponse.json({ error: 'Nenhum item selecionado para lançar.' }, { status: 400 });
      }

      let importados = 0;
      let rendimentosCriados = 0;
      let irpfDetectados = 0;

      for (const raw of itens) {
        const tipo: 'despesa' | 'receita' = raw?.tipo === 'receita' ? 'receita' : 'despesa';
        const valor = Math.round(Math.abs(Number(raw?.valor || 0)) * 100) / 100;
        const data = /^\d{4}-\d{2}-\d{2}$/.test(String(raw?.data || ''))
          ? String(raw.data)
          : new Date().toISOString().slice(0, 10);
        const descricao = String(raw?.descricao || 'Movimentação bancária').trim().slice(0, 140);
        const categoria = CATEGORIAS_VALIDAS.includes(String(raw?.categoria)) ? String(raw.categoria) : 'Outros';
        const destino = raw?.destino === 'rendimento_investimento' ? 'rendimento_investimento' : 'lancamento';
        const dedutivel = tipo === 'despesa' && Boolean(raw?.dedutivelIrpf || CATEGORIAS_DEDUTIVEIS_IRPF.has(categoria));

        if (valor <= 0) continue;

        if (destino === 'rendimento_investimento' && tipo === 'receita') {
          const tipoRendimento = String(raw?.tipoRendimento || detectarTipoRendimento(descricao) || 'renda_fixa');
          const patrimonioId = raw?.patrimonioId ? String(raw.patrimonioId).trim() : null;
          let ativoNomeFinal = descricao.slice(0, 90);
          let pidValido: string | null = null;
          if (patrimonioId) {
            const invRows = await db.$queryRawUnsafe<Array<{ id: string; nome: string; instituicao: string }>>(
              `SELECT id, nome, instituicao FROM financas_pessoais_patrimonio WHERE id = $1 AND owner_key = ANY($2::text[]) LIMIT 1`,
              patrimonioId,
              allKeys
            );
            if (invRows[0]) {
              pidValido = invRows[0].id;
              ativoNomeFinal = invRows[0].instituicao
                ? `${invRows[0].nome} (${invRows[0].instituicao})`
                : invRows[0].nome;
            }
          }
          await db.$executeRawUnsafe(
            `INSERT INTO financas_pessoais_rendimentos
              (id, owner_key, patrimonio_id, ativo_nome, tipo_rendimento, valor_bruto, ir_retido, valor_liquido, data, observacao, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 0, $6, $7, 'Conciliado do extrato bancário', NOW())`,
            crypto.randomUUID(),
            primaryKey,
            pidValido,
            ativoNomeFinal,
            tipoRendimento,
            valor,
            data
          );
          rendimentosCriados++;
        }

        if (dedutivel) irpfDetectados++;

        await db.$executeRawUnsafe(
          `INSERT INTO financas_pessoais_lancamentos
            (id, owner_key, user_id, phone, tipo, valor, categoria, forma_pagamento, descricao, data, status, dedutivel_irpf, origem, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pago', $11, 'extrato', NOW())`,
          crypto.randomUUID(),
          primaryKey,
          auth.session.userId,
          phone,
          tipo,
          valor,
          destino === 'rendimento_investimento' ? 'Investimentos' : categoria,
          destino === 'rendimento_investimento' ? 'Rendimento' : 'Extrato Bancário',
          descricao,
          data,
          dedutivel
        );
        importados++;
      }

      return NextResponse.json({
        ok: true,
        importados,
        rendimentosCriados,
        irpfDetectados,
      });
    }

    // =========================================================
    // MODO ANALISAR: lê PDF, OFX ou CSV, concilia com histórico + IA
    // =========================================================
    const conteudo = String(body?.conteudo || '');
    const nomeArquivo = String(body?.nomeArquivo || 'extrato.ofx');
    const ehPdf = body?.tipoArquivo === 'pdf' || nomeArquivo.toLowerCase().endsWith('.pdf');

    let transacoes: TransacaoExtratoPf[] = [];
    if (ehPdf) {
      transacoes = await extrairTransacoesPdfComIA(conteudo);
      if (transacoes.length === 0) {
        transacoes = parseTextoExtratoPdfPf(conteudo);
      }
    } else {
      transacoes = parseExtratoBancarioPf(conteudo, nomeArquivo);
    }

    if (transacoes.length === 0) {
      return NextResponse.json(
        {
          error: ehPdf
            ? 'Nenhuma movimentação encontrada neste PDF. Verifique se o PDF possui texto selecionável (não é apenas foto escaneada) ou tente baixar em OFX/CSV.'
            : 'Nenhuma transação encontrada no arquivo. Envie um extrato PDF, OFX ou CSV válido do seu banco.',
        },
        { status: 400 }
      );
    }

    const [historico, rendimentosExistentes, investimentosCadastrados] = await Promise.all([
      db.$queryRawUnsafe<HistoricoItem[]>(
        `SELECT data, tipo, valor, categoria, descricao, dedutivel_irpf
         FROM financas_pessoais_lancamentos
         WHERE owner_key = ANY($1::text[])
         ORDER BY data DESC, created_at DESC
         LIMIT 1500`,
        allKeys
      ),
      db.$queryRawUnsafe<Array<{ data: string; valor_liquido: number; ativo_nome: string }>>(
        `SELECT data, valor_liquido, ativo_nome
         FROM financas_pessoais_rendimentos
         WHERE owner_key = ANY($1::text[])
         ORDER BY data DESC
         LIMIT 500`,
        allKeys
      ),
      db.$queryRawUnsafe<Array<{ id: string; nome: string; instituicao: string; classe: string }>>(
        `SELECT id, nome, instituicao, classe
         FROM financas_pessoais_patrimonio
         WHERE owner_key = ANY($1::text[]) AND classe <> 'day_trade'
         ORDER BY nome ASC`,
        allKeys
      ),
    ]);

    const encontrarInvestimentoNaDesc = (desc: string): string => {
      const low = normalizarTexto(desc);
      if (!low || investimentosCadastrados.length === 0) return investimentosCadastrados[0]?.id || '';
      const match = investimentosCadastrados.find((inv) => {
        const n = normalizarTexto(inv.nome);
        const inst = normalizarTexto(inv.instituicao);
        return (n.length >= 3 && low.includes(n)) || (inst.length >= 3 && low.includes(inst));
      });
      return match?.id || investimentosCadastrados[0]?.id || '';
    };

    // Passo 1: Detectar já lançados + aprender pelo histórico
    const preliminares = transacoes.map((tr, idx) => {
      const centavos = Math.round(tr.valor * 100);

      // 1a. Match exato ou próximo (±2 dias com mesmo valor e tipo)
      const matchExato = historico.find(
        (h) => h.tipo === tr.tipo && Math.round(Number(h.valor) * 100) === centavos && h.data === tr.data
      );
      const matchProximo =
        matchExato ||
        historico.find(
          (h) => h.tipo === tr.tipo && Math.round(Number(h.valor) * 100) === centavos && diffDias(h.data, tr.data) <= 2
        );
      const matchRendimento =
        tr.tipo === 'receita'
          ? rendimentosExistentes.find(
              (r) => Math.round(Number(r.valor_liquido) * 100) === centavos && diffDias(r.data, tr.data) <= 2
            )
          : null;

      const jaLancado = Boolean(matchProximo || matchRendimento);
      const motivoMatch = matchProximo
        ? `Já lançado em ${matchProximo.data}: ${matchProximo.descricao.slice(0, 40)} (${matchProximo.categoria})`
        : matchRendimento
        ? `Rendimento já lançado em ${matchRendimento.data}: ${matchRendimento.ativo_nome.slice(0, 40)}`
        : null;

      // 1b. Aprendizado pelo histórico do usuário
      const hist = !jaLancado ? buscarNoHistorico(tr.descricao, tr.tipo, historico) : null;
      const heur = classificarHeuristica(tr.descricao, tr.tipo);

      const destino: 'lancamento' | 'rendimento_investimento' =
        tr.tipo === 'receita' && heur.destino === 'rendimento_investimento'
          ? 'rendimento_investimento'
          : 'lancamento';

      return {
        idx,
        data: tr.data,
        tipo: tr.tipo,
        valor: tr.valor,
        descricao: tr.descricao,
        jaLancado,
        motivoMatch,
        selecionado: !jaLancado,
        categoria: hist ? hist.categoria : heur.categoria,
        destino,
        patrimonioId: destino === 'rendimento_investimento' ? encontrarInvestimentoNaDesc(tr.descricao) : '',
        tipoRendimento: heur.tipoRendimento,
        dedutivelIrpf: hist
          ? hist.dedutivelIrpf
          : tr.tipo === 'despesa' && CATEGORIAS_DEDUTIVEIS_IRPF.has(heur.categoria),
        origemClassificacao: (jaLancado ? 'existente' : hist ? 'historico' : 'regra') as
          | 'existente'
          | 'historico'
          | 'ia'
          | 'regra',
        motivoClassificacao: jaLancado
          ? motivoMatch || 'Já lançado anteriormente'
          : hist
          ? `Aprendido do seu histórico ("${hist.referencia}")`
          : heur.motivo,
      };
    });

    // Passo 2: Chamar IA para os itens novos que não tiveram match direto no histórico
    const pendentesIa = preliminares
      .filter((p) => !p.jaLancado && p.origemClassificacao === 'regra')
      .map((p) => ({ idx: p.idx, data: p.data, tipo: p.tipo, valor: p.valor, descricao: p.descricao }));

    // Amostra diversificada do histórico do usuário para a IA imitar o padrão dele
    const exemplosUnicos = new Map<string, { descricao: string; tipo: string; categoria: string }>();
    for (const h of historico) {
      const k = `${h.tipo}|${h.categoria}|${normalizarTexto(h.descricao).slice(0, 20)}`;
      if (!exemplosUnicos.has(k)) {
        exemplosUnicos.set(k, { descricao: h.descricao, tipo: h.tipo, categoria: h.categoria });
      }
      if (exemplosUnicos.size >= 30) break;
    }

    const sugestoesIa = await classificarLoteComIA(pendentesIa, Array.from(exemplosUnicos.values()));

    const itensFinais = preliminares.map((p) => {
      const ia = sugestoesIa.get(p.idx);
      if (!ia) return p;
      const dedutivel =
        p.tipo === 'despesa' && Boolean(ia.dedutivelIrpf || CATEGORIAS_DEDUTIVEIS_IRPF.has(ia.categoria));
      const destinoFinal = p.tipo === 'receita' ? ia.destino : 'lancamento';
      return {
        ...p,
        categoria: ia.categoria,
        destino: destinoFinal,
        patrimonioId: destinoFinal === 'rendimento_investimento' ? p.patrimonioId || encontrarInvestimentoNaDesc(p.descricao) : '',
        tipoRendimento: ia.tipoRendimento || p.tipoRendimento,
        dedutivelIrpf: dedutivel,
        origemClassificacao: 'ia' as const,
        motivoClassificacao: ia.motivo,
      };
    });

    const resumo = {
      totalLidas: itensFinais.length,
      novos: itensFinais.filter((i) => !i.jaLancado).length,
      jaLancados: itensFinais.filter((i) => i.jaLancado).length,
      classificadosPorHistorico: itensFinais.filter((i) => i.origemClassificacao === 'historico').length,
      classificadosPorIa: itensFinais.filter((i) => i.origemClassificacao === 'ia').length,
      rendimentosDetectados: itensFinais.filter((i) => !i.jaLancado && i.destino === 'rendimento_investimento').length,
      irpfDetectados: itensFinais.filter((i) => !i.jaLancado && i.dedutivelIrpf).length,
    };

    return NextResponse.json({
      ok: true,
      preview: true,
      nomeArquivo,
      resumo,
      itens: itensFinais,
    });
  } catch (error) {
    console.error('Erro em POST /api/financas-pessoais/importar-extrato:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao conciliar extrato bancário.' }, { status: 500 });
  }
}
