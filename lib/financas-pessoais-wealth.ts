// ============================================================
// FINANÇAS PESSOAIS WEALTH & DÍVIDAS (Cartões, Investimentos,
// Bolsa, Day Trade, Consórcios, Empréstimos e Extrato OFX/CSV)
// ============================================================

import db from './prisma';

let tabelasWealthGarantidas = false;

export async function ensureFinancasWealthTables() {
  if (tabelasWealthGarantidas) return;

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financas_pessoais_cartoes (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      nome TEXT NOT NULL,
      banco TEXT NOT NULL DEFAULT '',
      limite_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      dia_fechamento INTEGER NOT NULL DEFAULT 5,
      dia_vencimento INTEGER NOT NULL DEFAULT 15,
      cor TEXT NOT NULL DEFAULT '#1d4ed8',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_fp_cartoes_owner ON financas_pessoais_cartoes(owner_key)`
  );

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financas_pessoais_patrimonio (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      classe TEXT NOT NULL DEFAULT 'renda_fixa',
      nome TEXT NOT NULL,
      instituicao TEXT NOT NULL DEFAULT '',
      quantidade DOUBLE PRECISION NOT NULL DEFAULT 1,
      valor_aplicado DOUBLE PRECISION NOT NULL DEFAULT 0,
      valor_atual DOUBLE PRECISION NOT NULL DEFAULT 0,
      taxa_ou_detalhe TEXT NOT NULL DEFAULT '',
      data_referencia TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_fp_patr_owner ON financas_pessoais_patrimonio(owner_key, classe)`
  );

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financas_pessoais_dividas (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      credor TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'emprestimo',
      saldo_devedor DOUBLE PRECISION NOT NULL DEFAULT 0,
      taxa_juros_mensal DOUBLE PRECISION NOT NULL DEFAULT 0,
      valor_parcela DOUBLE PRECISION NOT NULL DEFAULT 0,
      parcelas_restantes INTEGER NOT NULL DEFAULT 1,
      dia_vencimento INTEGER NOT NULL DEFAULT 10,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_fp_dividas_owner ON financas_pessoais_dividas(owner_key)`
  );

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financas_pessoais_rendimentos (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      patrimonio_id TEXT,
      ativo_nome TEXT NOT NULL,
      tipo_rendimento TEXT NOT NULL DEFAULT 'dividendo',
      valor_bruto DOUBLE PRECISION NOT NULL DEFAULT 0,
      ir_retido DOUBLE PRECISION NOT NULL DEFAULT 0,
      valor_liquido DOUBLE PRECISION NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      observacao TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_fp_rend_owner_data ON financas_pessoais_rendimentos(owner_key, data DESC)`
  );

  tabelasWealthGarantidas = true;
}

export interface TransacaoExtratoPf {
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number;
  tipo: 'despesa' | 'receita';
}

/**
 * Parser leve para extratos bancários PF em formato OFX ou CSV (Nubank, Itaú, Inter, Bradesco, Sicredi, BB).
 */
export function parseExtratoBancarioPf(conteudo: string, nomeArquivo: string): TransacaoExtratoPf[] {
  const texto = (conteudo || '').trim();
  if (!texto) return [];
  const lowerName = (nomeArquivo || '').toLowerCase();

  // 1. OFX
  if (lowerName.endsWith('.ofx') || /<STMTTRN>/i.test(texto)) {
    const out: TransacaoExtratoPf[] = [];
    const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || texto.split(/<STMTTRN>/i).slice(1);
    for (const b of blocos) {
      const mData = b.match(/<DTPOSTED>(\d{8})/i);
      const mVal = b.match(/<TRNAMT>([-+]?\d+(?:[.,]\d+)?)/i);
      const mMemo = b.match(/<(?:MEMO|NAME)>([^\r\n<]+)/i);
      if (!mData || !mVal) continue;
      const dRaw = mData[1];
      const data = `${dRaw.slice(0, 4)}-${dRaw.slice(4, 6)}-${dRaw.slice(6, 8)}`;
      const num = parseFloat(mVal[1].replace(',', '.'));
      if (!Number.isFinite(num) || num === 0) continue;
      out.push({
        data,
        descricao: (mMemo?.[1] || 'Lançamento bancário').trim().slice(0, 120),
        valor: Math.round(Math.abs(num) * 100) / 100,
        tipo: num > 0 ? 'receita' : 'despesa',
      });
    }
    return out;
  }

  // 2. CSV (separador ; ou ,)
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length < 2) return [];
  const sep = linhas[0].includes(';') ? ';' : ',';
  const out: TransacaoExtratoPf[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
    if (cols.length < 3) continue;

    // Detecta coluna de data (DD/MM/YYYY ou YYYY-MM-DD)
    let data = '';
    let desc = '';
    let valNum = 0;

    for (const c of cols) {
      if (!data) {
        const mBr = c.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        const mIso = c.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (mBr) {
          data = `${mBr[3]}-${mBr[2]}-${mBr[1]}`;
          continue;
        }
        if (mIso) {
          data = `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
          continue;
        }
      }
      if (valNum === 0 && /^[-+]?(?:R\$\s*)?[\d.,]+$/.test(c)) {
        const cleaned = c.replace(/R\$/gi, '').trim();
        const parsed = cleaned.includes(',')
          ? parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
          : parseFloat(cleaned);
        if (Number.isFinite(parsed) && parsed !== 0) {
          valNum = parsed;
          continue;
        }
      }
      if (c.length > desc.length && !/^\d+$/.test(c)) {
        desc = c;
      }
    }

    if (data && valNum !== 0) {
      out.push({
        data,
        descricao: (desc || 'Movimentação bancária').slice(0, 120),
        valor: Math.round(Math.abs(valNum) * 100) / 100,
        tipo: valNum > 0 ? 'receita' : 'despesa',
      });
    }
  }

  return out;
}
