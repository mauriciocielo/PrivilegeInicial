// ============================================================
// CONTROLE FINANCEIRO PESSOAL (PF) VIA WHATSAPP + PASTA IRPF
// ============================================================
// Permite a qualquer pessoa física (ou sócio de empresa cliente) registrar
// gastos e receitas por texto, áudio ou foto no WhatsApp, acompanhar metas
// por categoria e separar automaticamente gastos dedutíveis no IRPF.

import crypto from 'crypto';
import db from './prisma';
import { apenasDigitos } from './nfse/dps';
import { generateText } from './ai-provider';

export const CATEGORIAS_PF = [
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
] as const;

export const CATEGORIAS_DEDUTIVEIS_IRPF = new Set(['Saúde', 'Educação', 'Previdência']);

let tabelasPfGarantidas = false;

export async function ensureFinancasPessoaisTables() {
  if (tabelasPfGarantidas) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financas_pessoais_lancamentos (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      user_id TEXT,
      phone TEXT,
      tipo TEXT NOT NULL DEFAULT 'despesa',
      valor DOUBLE PRECISION NOT NULL,
      categoria TEXT NOT NULL DEFAULT 'Outros',
      forma_pagamento TEXT NOT NULL DEFAULT 'PIX',
      descricao TEXT NOT NULL,
      data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pago',
      dedutivel_irpf BOOLEAN NOT NULL DEFAULT FALSE,
      origem TEXT NOT NULL DEFAULT 'whatsapp',
      comprovante_data TEXT,
      comprovante_nome TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(
    `ALTER TABLE financas_pessoais_lancamentos ADD COLUMN IF NOT EXISTS comprovante_data TEXT`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE financas_pessoais_lancamentos ADD COLUMN IF NOT EXISTS comprovante_nome TEXT`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_fp_lanc_owner_data ON financas_pessoais_lancamentos(owner_key, data DESC)`
  );
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financas_pessoais_metas (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      categoria TEXT NOT NULL,
      limite_mensal DOUBLE PRECISION NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(owner_key, categoria)
    )
  `);
  tabelasPfGarantidas = true;
}

export function normalizarOwnerKeyTelefone(phone?: string | null): string {
  const ult8 = apenasDigitos(phone || '').slice(-8);
  return ult8.length === 8 ? `phone:${ult8}` : '';
}

/**
 * Resolve as chaves de busca de um usuário logado na web:
 * une o que ele lançou pela web (user:<id>) e o que lançou pelo WhatsApp (phone:<ult8>).
 */
export async function resolverChavesFinancasUsuario(userId: string): Promise<{
  primaryKey: string;
  allKeys: string[];
  phone: string | null;
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true },
  });
  const phoneKey = normalizarOwnerKeyTelefone(user?.phone);
  const userKey = `user:${userId}`;
  // Se o usuário tem telefone cadastrado, prioriza phone:<ult8> como chave principal para casar 100% com o WhatsApp
  const primaryKey = phoneKey || userKey;
  const keysSet = new Set<string>([primaryKey, userKey, ...(phoneKey ? [phoneKey] : [])]);

  // Se houver cônjuge vinculado com compartilhamento ativo, une as chaves do casal
  try {
    const vinculos = await db.$queryRawUnsafe<
      Array<{ user_id: string; phone: string; conjuge_user_id: string | null; conjuge_phone: string }>
    >(
      `SELECT user_id, phone, conjuge_user_id, conjuge_phone
       FROM financas_pessoais_assinaturas
       WHERE compartilhar_financas = TRUE
         AND (user_id = $1 OR conjuge_user_id = $1)
       LIMIT 1`,
      userId
    );
    const v = vinculos[0];
    if (v) {
      if (v.user_id) keysSet.add(`user:${v.user_id}`);
      if (v.conjuge_user_id) keysSet.add(`user:${v.conjuge_user_id}`);
      const pkTit = normalizarOwnerKeyTelefone(v.phone);
      const pkConj = normalizarOwnerKeyTelefone(v.conjuge_phone);
      if (pkTit) keysSet.add(pkTit);
      if (pkConj) keysSet.add(pkConj);
    }
  } catch {
    // tabela pode ainda não ter colunas em ambientes antigos — ignora silenciosamente
  }

  return { primaryKey, allKeys: Array.from(keysSet), phone: user?.phone || null };
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

function inferirCategoria(texto: string, tipo: 'despesa' | 'receita'): string {
  const t = texto.toLowerCase();
  if (tipo === 'receita') {
    if (/(sal[aá]rio|pr[oó]-?labore|holerite|pagamento\s+mensal)/i.test(t)) return 'Salário / Pró-labore';
    return 'Renda Extra';
  }
  if (/(mercado|supermercado|a[cç]ougue|padaria|restaurante|lanche|ifood|pizza|almo[cç]o|jantar|caf[eé]|comida)/i.test(t)) return 'Alimentação';
  if (/(aluguel|condom[ií]nio|iptu|energia|luz|[aá]gua|g[aá]s|internet|casa|apartamento)/i.test(t)) return 'Moradia';
  if (/(gasolina|etanol|diesel|posto|uber|99|estacionamento|ped[aá]gio|oficina|mec[aâ]nico|ipva|carro|moto)/i.test(t)) return 'Transporte';
  if (/(m[eé]dico|consulta|dentista|cl[ií]nica|hospital|exame|farm[aá]cia|rem[eé]dio|plano\s+de\s+sa[uú]de|unimed|psic[oó]logo|fisio)/i.test(t)) return 'Saúde';
  if (/(escola|faculdade|curso|mensalidade\s+escolar|col[eé]gio|p[oó]s|ingl[eê]s|livro)/i.test(t)) return 'Educação';
  if (/(previd[eê]ncia|pgbl|vgbl)/i.test(t)) return 'Previdência';
  if (/(cinema|viagem|hotel|bar|festa|show|netflix|spotify|lazer|passeio)/i.test(t)) return 'Lazer';
  if (/(fatura|cart[aã]o)/i.test(t)) return 'Cartão de Crédito';
  if (/(investi|cdb|tesouro|a[cç][oõ]es|fii|poupan[cç]a)/i.test(t)) return 'Investimentos';
  if (/(roupa|sapato|shopping|amazon|mercado\s+livre|loja|compra)/i.test(t)) return 'Compras';
  return 'Outros';
}

function inferirFormaPagamento(texto: string): string {
  const t = texto.toLowerCase();
  if (/\b(cr[eé]dito|cart[aã]o\s+de\s+cr[eé]dito)\b/.test(t)) return 'Cartão de Crédito';
  if (/\b(d[eé]bito|cart[aã]o\s+de\s+d[eé]bito)\b/.test(t)) return 'Débito';
  if (/\b(dinheiro|esp[eé]cie)\b/.test(t)) return 'Dinheiro';
  if (/\b(boleto)\b/.test(t)) return 'Boleto';
  return 'PIX';
}

function parseValor(texto: string): number {
  const m = texto.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)/i);
  if (!m) return 0;
  const raw = m[1];
  return raw.includes(',') ? parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0 : parseFloat(raw) || 0;
}

/**
 * Processa comandos de Finanças Pessoais (PF) no WhatsApp:
 * - Lançar gasto/receita por texto, áudio ou foto ("Gastei 85 no mercado no crédito", "Recebi 5000 de pró-labore")
 * - Consultar resumo ("Quanto gastei este mês?", "Meu resumo pessoal", "Onde estou gastando mais?")
 * - Definir meta ("Meta de alimentação 1000")
 * - Desfazer último lançamento ("Apaga o último gasto")
 */
export async function processarComandoFinancasPessoaisWhatsApp(params: {
  sendJid: string;
  cleanPhone: string;
  text: string;
  mediaUrl?: string | null;
  fileName?: string | null;
  enviarMensagem: (jid: string, texto: string) => Promise<any>;
}): Promise<boolean> {
  const limpo = params.text.replace(/^\[[^\]]+\]:\s*/, '').trim();
  if (!limpo) return false;
  const ownerKey = normalizarOwnerKeyTelefone(params.cleanPhone);
  if (!ownerKey) return false;

  const lower = limpo.toLowerCase();

  // 1. Consulta de Resumo Pessoal do Mês
  const pedeResumo =
    /\b(quanto\s+(eu\s+)?gastei|meu\s+resumo\s+(financeiro|pessoal)|resumo\s+do\s+m[eê]s|meus\s+gastos|onde\s+(eu\s+)?(estou|t[oô])\s+gastando|saldo\s+pessoal|minhas\s+finan[cç]as)\b/i.test(
      lower
    );
  if (pedeResumo) {
    await ensureFinancasPessoaisTables();
    const mesAtual = new Date().toISOString().slice(0, 7);
    const anoAtual = mesAtual.slice(0, 4);
    const [rowsMes, rowsIrpf] = await Promise.all([
      db.$queryRawUnsafe<any[]>(
        `SELECT tipo, categoria, valor FROM financas_pessoais_lancamentos
         WHERE owner_key = $1 AND data LIKE $2`,
        ownerKey,
        `${mesAtual}%`
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(SUM(valor), 0)::float AS total FROM financas_pessoais_lancamentos
         WHERE owner_key = $1 AND dedutivel_irpf = TRUE AND data LIKE $2`,
        ownerKey,
        `${anoAtual}%`
      ),
    ]);

    let entrou = 0;
    let saiu = 0;
    const porCat = new Map<string, number>();
    for (const r of rowsMes) {
      const v = Number(r.valor || 0);
      if (r.tipo === 'receita') entrou += v;
      else {
        saiu += v;
        const c = String(r.categoria || 'Outros');
        porCat.set(c, (porCat.get(c) || 0) + v);
      }
    }
    const topCats = Array.from(porCat.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const totalIrpf = Number(rowsIrpf[0]?.total || 0);

    await params.enviarMensagem(
      params.sendJid,
      [
        `💰 *Resumo Financeiro Pessoal (${mesAtual})*`,
        '',
        `🟢 *Entrou:* ${fmtBRL(entrou)}`,
        `🔴 *Saiu:* ${fmtBRL(saiu)}`,
        `💵 *Saldo do mês:* ${fmtBRL(entrou - saiu)}`,
        ...(topCats.length > 0
          ? ['', `📊 *Maiores gastos:*`, ...topCats.map(([c, v]) => `• ${c}: ${fmtBRL(v)}`)]
          : ['', '_Nenhum lançamento pessoal registrado neste mês ainda._']),
        ...(totalIrpf > 0 ? ['', `📋 *Dedutíveis IRPF (${anoAtual}):* ${fmtBRL(totalIrpf)}`] : []),
        '',
        `_Dica: mande "Gastei 85 no mercado" ou "Meta de alimentação 1000" a qualquer hora._`,
      ].join('\n')
    );
    return true;
  }

  // 2. Definir Meta Mensal ("Meta de alimentação 1000" / "Limite de lazer 500")
  const mMeta = limpo.match(/^(?:meta|limite)\s+(?:de\s+|para\s+)?([a-zA-ZÀ-ÿ\s]{3,28}?)\s+(?:de\s+|r\$\s*)?(\d[\d.,]*)/i);
  if (mMeta) {
    const valorMeta = parseValor(mMeta[2]);
    if (valorMeta > 0) {
      await ensureFinancasPessoaisTables();
      const cat = inferirCategoria(mMeta[1], 'despesa');
      const catFinal = cat !== 'Outros' ? cat : mMeta[1].trim().replace(/^\w/, (c) => c.toUpperCase());
      await db.$executeRawUnsafe(
        `INSERT INTO financas_pessoais_metas (id, owner_key, categoria, limite_mensal, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (owner_key, categoria) DO UPDATE SET limite_mensal = EXCLUDED.limite_mensal, updated_at = NOW()`,
        crypto.randomUUID(),
        ownerKey,
        catFinal,
        Math.round(valorMeta * 100) / 100
      );
      await params.enviarMensagem(
        params.sendJid,
        `🎯 *Meta definida!* Limite mensal de *${catFinal}*: *${fmtBRL(valorMeta)}*. Vou te avisar conforme você for lançando seus gastos!`
      );
      return true;
    }
  }

  // 3. Desfazer último lançamento ("Apaga o último gasto" / "Desfazer último lançamento")
  if (/^(?:apag[ae]r?|exclu[ia]r?|desfaz(?:er)?|cancel[ae]r?)\s+(?:o\s+)?[uú]ltim[oa]\s+(?:gasto|lan[cç]amento|despesa|receita)/i.test(lower)) {
    await ensureFinancasPessoaisTables();
    const ult = await db.$queryRawUnsafe<any[]>(
      `SELECT id, descricao, valor FROM financas_pessoais_lancamentos
       WHERE owner_key = $1 ORDER BY created_at DESC LIMIT 1`,
      ownerKey
    );
    if (!ult[0]) {
      await params.enviarMensagem(params.sendJid, 'Não encontrei nenhum lançamento pessoal recente para apagar.');
      return true;
    }
    await db.$executeRawUnsafe(`DELETE FROM financas_pessoais_lancamentos WHERE id = $1`, ult[0].id);
    await params.enviarMensagem(
      params.sendJid,
      `🗑️ Lançamento apagado: *${ult[0].descricao}* (${fmtBRL(Number(ult[0].valor))}).`
    );
    return true;
  }

  // 4. Lançamento de Gasto ou Receita Pessoal por Texto, Áudio ou Foto!
  const gatilhoGasto = /\b(gastei|paguei|comprei|despesa\s+pessoal|lan[cç]a(?:r)?\s+gasto|anota(?:r)?\s+gasto|passei\s+no\s+cart[aã]o|irpf|recibo|nota\s+m[eé]dica|dentista|escola|faculdade|plano\s+de\s+sa[uú]de)\b/i;
  const gatilhoReceita = /\b(recebi|entrou\s+(?:r\$|\d)|ganhei|receita\s+pessoal|lan[cç]a(?:r)?\s+receita)\b/i;
  const ehFotoComprovante = lower.includes('[análise da imagem enviada pelo cliente:') && /\b(pix|cupom|nota\s+fiscal|comprovante|pagamento|total|r\$|recibo|consulta|m[eé]dic|dentista|escola)\b/i.test(lower);
  const ehDocIrpf = Boolean(params.mediaUrl && /\b(irpf|imposto\s+de\s+renda|recibo|sa[uú]de|m[eé]dic|dentista|escola|faculdade|previd[eê]ncia)\b/i.test(lower));

  if (!gatilhoGasto.test(lower) && !gatilhoReceita.test(lower) && !ehFotoComprovante && !ehDocIrpf) {
    return false;
  }

  // Não confundir com pedido de emissão de NFS-e
  if (/\b(emitir|emite|tirar|fazer)\s+(uma\s+)?(nfse|nfs-e|nota\s+fiscal)\b/i.test(lower)) {
    return false;
  }

  let tipo: 'despesa' | 'receita' = gatilhoReceita.test(lower) && !gatilhoGasto.test(lower) ? 'receita' : 'despesa';
  let valor = parseValor(limpo);
  let categoria = inferirCategoria(limpo, tipo);
  let formaPagamento = inferirFormaPagamento(limpo);
  let descricao = limpo
    .replace(/\[Análise da imagem enviada pelo cliente:[\s\S]*$/i, '')
    .trim()
    .slice(0, 120);

  // Usa IA rápida para extrair com perfeição em áudios/fotos ou valores por extenso
  if (valor <= 0 || ehFotoComprovante) {
    try {
      const ai = await generateText({
        jsonMode: true,
        maxTokens: 200,
        temperature: 0.1,
        timeoutMs: 9000,
        system:
          `Extraia um lançamento financeiro pessoal em JSON: ` +
          `{"ehLancamento": true/false, "tipo": "despesa"|"receita", "valor": numero_float, "categoria": uma de [${CATEGORIAS_PF.join(', ')}], "formaPagamento": "PIX"|"Cartão de Crédito"|"Débito"|"Dinheiro"|"Boleto", "descricao": "descrição curta até 60 chars"}. ` +
          `Se não houver valor numérico claro, retorne {"ehLancamento": false}.`,
        prompt: limpo,
      });
      if (ai.text) {
        const parsed = JSON.parse(ai.text);
        if (!parsed?.ehLancamento || !(Number(parsed.valor) > 0)) return false;
        tipo = parsed.tipo === 'receita' ? 'receita' : 'despesa';
        valor = Math.round(Number(parsed.valor) * 100) / 100;
        if (parsed.categoria) categoria = String(parsed.categoria);
        if (parsed.formaPagamento) formaPagamento = String(parsed.formaPagamento);
        if (parsed.descricao) descricao = String(parsed.descricao).slice(0, 120);
      }
    } catch {
      if (valor <= 0) return false;
    }
  }

  if (valor <= 0) return false;
  if (!descricao) descricao = `${categoria} (${formaPagamento})`;

  await ensureFinancasPessoaisTables();
  const hoje = new Date().toISOString().slice(0, 10);
  const mesAtual = hoje.slice(0, 7);
  const dedutivelIrpf = tipo === 'despesa' && (CATEGORIAS_DEDUTIVEIS_IRPF.has(categoria) || ehDocIrpf);
  const comprovanteData =
    params.mediaUrl && params.mediaUrl.startsWith('data:') && params.mediaUrl.length <= 4 * 1024 * 1024
      ? params.mediaUrl
      : null;
  const comprovanteNome = comprovanteData
    ? params.fileName || (comprovanteData.startsWith('data:application/pdf') ? `Documento_IRPF_${hoje}.pdf` : `Comprovante_${hoje}.jpg`)
    : null;

  await db.$executeRawUnsafe(
    `INSERT INTO financas_pessoais_lancamentos
      (id, owner_key, phone, tipo, valor, categoria, forma_pagamento, descricao, data, status, dedutivel_irpf, origem, comprovante_data, comprovante_nome, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pago', $10, 'whatsapp', $11, $12, NOW())`,
    crypto.randomUUID(),
    ownerKey,
    params.cleanPhone,
    tipo,
    valor,
    categoria,
    formaPagamento,
    descricao,
    hoje,
    dedutivelIrpf,
    comprovanteData,
    comprovanteNome
  );

  // Checa meta da categoria no mês para dar feedback imediato
  let linhaMeta = '';
  if (tipo === 'despesa') {
    const [metaRows, somaRows] = await Promise.all([
      db.$queryRawUnsafe<any[]>(
        `SELECT limite_mensal FROM financas_pessoais_metas WHERE owner_key = $1 AND categoria = $2 LIMIT 1`,
        ownerKey,
        categoria
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(SUM(valor), 0)::float AS total FROM financas_pessoais_lancamentos
         WHERE owner_key = $1 AND tipo = 'despesa' AND categoria = $2 AND data LIKE $3`,
        ownerKey,
        categoria,
        `${mesAtual}%`
      ),
    ]);
    const limite = Number(metaRows[0]?.limite_mensal || 0);
    const gastoCat = Number(somaRows[0]?.total || 0);
    if (limite > 0) {
      const pct = Math.round((gastoCat / limite) * 100);
      const icone = pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : '🎯';
      linhaMeta = `\n${icone} *Meta ${categoria}:* ${fmtBRL(gastoCat)} de ${fmtBRL(limite)} (${pct}%)`;
    }
  }

  const linhaIrpf = dedutivelIrpf
    ? comprovanteData
      ? `\n📋 *Pasta IRPF:* Documento fiscal salvo (${comprovanteNome}) e pronto para download!`
      : `\n📋 *Pasta IRPF:* Marcado automaticamente como despesa dedutível!`
    : '';

  await params.enviarMensagem(
    params.sendJid,
    [
      tipo === 'receita' ? `🟢 *Receita pessoal anotada!*` : `✅ *Gasto pessoal anotado!*`,
      `• *Valor:* ${fmtBRL(valor)} (${formaPagamento})`,
      `• *Categoria:* ${categoria}`,
      `• *Descrição:* ${descricao}`,
      linhaMeta,
      linhaIrpf,
    ]
      .filter(Boolean)
      .join('\n')
  );
  return true;
}
