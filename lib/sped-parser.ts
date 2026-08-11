// ============================================================
// sped-parser.ts — Motor de Regras Tributárias
// EC 132/2023 | LC 214/2025 | LC 227/2026
//
// Pipeline: Ingesta SPED → Parsing Bloco a Bloco → Matriz NCM
//         → De/Para (Cenário Antigo x Reforma) → Anomalias CST
//         → Diagnóstico / Simulação / Insights / Action Items
// ============================================================

import {
  DiagnosticoTributario,
  SimulacaoReforma,
  InsightTributario,
  ActionItem,
  AnomaliaCST,
  ItemAnalisado,
  ParseLog,
  FonteIngestao,
  RegimeTributario,
} from './tributarioStore';

// ============================================================
// [1] MATRIZ NCM → REGRA DA REFORMA (LC 214/2025)
// Fonte: Anexos I, II, III e IV da LC 214/2025 e resoluções do
// Comitê Gestor do IBS (LC 227/2026)
// Alíquotas de referência: IBS = 17.7% | CBS = 8.8% | soma = 26.5%
// ============================================================

interface RegraNCM {
  categoria: string;
  reducaoAliqIBSCBS: number; // 0 = nenhuma, 0.6 = 60%, 1.0 = 100% (isento)
  impostoSeletivoAliq: number; // % IS sobre valor (LC 214/2025 art. 413+)
  baseLegal: string;
  observacao?: string;
}

const ALIQ_REFERENCIA_IBS = 0.177; // art. 9 LC 214/2025
const ALIQ_REFERENCIA_CBS = 0.088; // art. 10 LC 214/2025

// Mapa de prefixos NCM (8 ou 4 dígitos) para a regra aplicável
const MATRIZ_NCM: Record<string, RegraNCM> = {
  // ── Medicamentos e produtos de saúde (redução 60%) ──────────────
  '3003': { categoria: 'Medicamentos', reducaoAliqIBSCBS: 0.6, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 art. 120 §1º, Anexo I', observacao: 'Redução 60% IBS/CBS. Verificar cashback p/ CadÚnico' },
  '3004': { categoria: 'Medicamentos', reducaoAliqIBSCBS: 0.6, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 art. 120 §1º, Anexo I' },
  '3006': { categoria: 'Medicamentos', reducaoAliqIBSCBS: 0.6, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 art. 120 §1º, Anexo I' },
  // ── Alimentos (cesta básica nacional — isenção 100%) ────────────
  '0201': { categoria: 'Carne Bovina (Cesta Básica)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 art. 107 (Cashback) + Anexo III' },
  '0202': { categoria: 'Carne Bovina (Cesta Básica)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 Anexo III' },
  '0203': { categoria: 'Carne Suína (Cesta Básica)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 Anexo III' },
  '0207': { categoria: 'Carne de Aves (Cesta Básica)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 Anexo III' },
  '0302': { categoria: 'Peixe (Cesta Básica)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 Anexo III' },
  '0401': { categoria: 'Leite e Derivados (Cesta Básica)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 Anexo III' },
  '0402': { categoria: 'Leite e Derivados (Cesta Básica)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 Anexo III' },
  '1001': { categoria: 'Trigo/Farinha (Cesta Básica)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 Anexo III' },
  '1005': { categoria: 'Milho (Cesta Básica)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 Anexo III' },
  '1006': { categoria: 'Arroz (Cesta Básica)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 Anexo III' },
  '1101': { categoria: 'Farinha de Trigo (Cesta Básica)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 Anexo III' },
  '1507': { categoria: 'Óleo de Soja (Cesta Básica)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 Anexo III' },
  // ── Alimentos — redução 60% (fora cesta básica) ─────────────────
  '1601': { categoria: 'Embutidos', reducaoAliqIBSCBS: 0.6, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 art. 120, Anexo I' },
  '2009': { categoria: 'Sucos', reducaoAliqIBSCBS: 0.6, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 art. 120, Anexo I' },
  // ── Bebidas alcoólicas — Imposto Seletivo ────────────────────────
  '2203': { categoria: 'Cerveja', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 0.20, baseLegal: 'LC 214/2025 art. 413, Anexo IV', observacao: 'IS à alíquota de 20% incide sobre bebidas alcoólicas' },
  '2204': { categoria: 'Vinho', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 0.20, baseLegal: 'LC 214/2025 art. 413, Anexo IV' },
  '2205': { categoria: 'Vermute', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 0.20, baseLegal: 'LC 214/2025 art. 413, Anexo IV' },
  '2206': { categoria: 'Outras bebidas fermentadas', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 0.20, baseLegal: 'LC 214/2025 art. 413, Anexo IV' },
  '2207': { categoria: 'Álcool etílico (bebida)', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 0.20, baseLegal: 'LC 214/2025 art. 413, Anexo IV' },
  '2208': { categoria: 'Destilados/Spirits', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 0.20, baseLegal: 'LC 214/2025 art. 413, Anexo IV' },
  // ── Bebidas não alcoólicas com açúcar — IS ───────────────────────
  '2202': { categoria: 'Bebidas não alcoólicas açucaradas', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 0.08, baseLegal: 'LC 214/2025 art. 413 §3º', observacao: 'IS de 8% sobre bebidas açucaradas não alcoólicas' },
  // ── Tabaco — IS ──────────────────────────────────────────────────
  '2402': { categoria: 'Cigarros/Charutos', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 1.50, baseLegal: 'LC 214/2025 art. 413, Anexo IV', observacao: 'IS = 150% sobre base ad valorem' },
  '2403': { categoria: 'Tabaco manufaturado', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 1.50, baseLegal: 'LC 214/2025 art. 413, Anexo IV' },
  // ── Combustíveis — regime diferenciado ──────────────────────────
  '2710': { categoria: 'Combustíveis (regime diferenciado)', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 0.10, baseLegal: 'LC 214/2025 art. 139 (monofásico)', observacao: 'Tributação monofásica IBS/CBS + IS. Crédito vedado na saída.' },
  '2711': { categoria: 'Gás natural/GLP', reducaoAliqIBSCBS: 0.6, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 art. 120, Anexo I' },
  // ── Energia elétrica ─────────────────────────────────────────────
  '2716': { categoria: 'Energia Elétrica', reducaoAliqIBSCBS: 0.6, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 art. 120, Anexo I' },
  // ── Serviços de saúde ────────────────────────────────────────────
  '8713': { categoria: 'Equipamentos para deficientes físicos', reducaoAliqIBSCBS: 0.6, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 art. 120, Anexo I' },
  // ── Insumos agropecuários ────────────────────────────────────────
  '3101': { categoria: 'Fertilizantes (Insumos Agro)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 art. 107 (Agropec.), Anexo III' },
  '3102': { categoria: 'Adubos nitrogenados (Insumos Agro)', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 art. 107, Anexo III' },
  '3808': { categoria: 'Defensivos Agrícolas', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 Anexo III', observacao: 'Verificar exclusões de IS se vetor contaminante' },
  // ── Educação ─────────────────────────────────────────────────────
  '4901': { categoria: 'Livros', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 art. 107 (Educação), CF art. 150 VI d' },
  '4902': { categoria: 'Jornais/Periódicos', reducaoAliqIBSCBS: 1.0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 Anexo III' },
  // ── Veículos — IS ────────────────────────────────────────────────
  '8703': { categoria: 'Automóveis', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 0.07, baseLegal: 'LC 214/2025 art. 413 Anexo IV', observacao: 'IS 7% + desconto por eficiência energética possível' },
  '8704': { categoria: 'Veículos comerciais', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 0.07, baseLegal: 'LC 214/2025 art. 413 Anexo IV' },
  // ── Mineração / Extração ─────────────────────────────────────────
  '2601': { categoria: 'Minério de Ferro', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 0.04, baseLegal: 'LC 214/2025 art. 413 §2º (extração mineral)', observacao: 'IS sobre bens minerais' },
  '2701': { categoria: 'Carvão mineral', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 0.20, baseLegal: 'LC 214/2025 Anexo IV (poluição)' },
  // ── Serviços financeiros ─────────────────────────────────────────
  '9999': { categoria: 'Serviços Financeiros (regime específico)', reducaoAliqIBSCBS: 0, impostoSeletivoAliq: 0, baseLegal: 'LC 214/2025 art. 183-201 (regime específico)' },
};

// ── Regra default para NCMs não mapeados ─────────────────────────
const REGRA_DEFAULT: RegraNCM = {
  categoria: 'Produto/Serviço Geral',
  reducaoAliqIBSCBS: 0,
  impostoSeletivoAliq: 0,
  baseLegal: 'LC 214/2025 art. 9 (alíquota referência)',
};

export function buscarRegraNCM(ncm: string): RegraNCM {
  // Tentativa por 8, 6, 4, 2 dígitos em cadência
  for (const len of [8, 6, 4, 2]) {
    const prefixo = ncm.replace(/\D/g, '').slice(0, len);
    if (MATRIZ_NCM[prefixo]) return MATRIZ_NCM[prefixo];
  }
  return REGRA_DEFAULT;
}

export { ALIQ_REFERENCIA_IBS, ALIQ_REFERENCIA_CBS };

// ============================================================
// [2] MAPA DE CST INVÁLIDOS / INCOMPATÍVEIS NA TRANSIÇÃO
// Referência: EFD Contribuições — Tabela de CST PIS/COFINS
// ============================================================

// CSTs que deixam de existir ou mudam de lógica na Reforma
const CST_VIGILANCIA_CONTRIB: Record<string, string> = {
  '06': 'Operação tributável com alíquota zero — revisar tratamento IBS/CBS (crédito zero vs. isenção)',
  '07': 'Operação isenta — confirmar se NCM consta no Anexo III (LC 214/2025) para manter isenção plena',
  '08': 'Sem incidência — verificar se o código de exclusão subsiste com a LC 214/2025',
  '09': 'Operação sem incidência (outras) — caso por caso na transição',
  '49': 'Outras operações de saída — risco de reclassificação; auditar CFOP vs. NCM',
  '99': 'Outras operações — risco alto de inconsistência; requisito de nota explicativa na reforma',
};

const CST_VIGILANCIA_ICMS: Record<string, string> = {
  '020': 'Tributação com redução de base — verificar equivalência na alíquota reduzida de IBS',
  '030': 'Não-tributado com cobrança diferenciada — revisar se o NCM ainda gera IS',
  '040': 'Isento de ICMS — sem correspondência direta na Reforma; avaliar NCM no Anexo III',
  '041': 'Não tributado (ICMS) — analisar NCM para IS ou alíquota normal IBS',
  '060': 'ICMS cobrado por substituição tributária — ST não existe no IBS/CBS; regularizar',
  '070': 'Com redução e ST — transição dupla: cobr. monofásica ou ST eliminar',
};

// ============================================================
// [3] PARSING DE BLOCO 0200 — CADASTRO DE PRODUTOS
// ============================================================

interface Produto0200 {
  codItem: string;
  descItem: string;
  unidInv: string;
  tipo: string;
  codNcm: string;
  exIpi: string;
  codGen: string;
  codLst: string;
  aliqIcms: number;
  cest?: string;
}

function parseBloco0200(lines: string[]): Map<string, Produto0200> {
  const map = new Map<string, Produto0200>();
  for (const line of lines) {
    const f = line.split('|');
    if (f[1] !== '0200') continue;
    const p: Produto0200 = {
      codItem: f[2] || '',
      descItem: f[3] || '',
      unidInv: f[4] || '',
      tipo: f[5] || '',
      codNcm: (f[6] || '').replace(/\D/g, ''),
      exIpi: f[7] || '',
      codGen: f[8] || '',
      codLst: f[9] || '',
      aliqIcms: parseDecimal(f[10]),
      cest: f[11] || undefined,
    };
    map.set(p.codItem, p);
  }
  return map;
}

// ============================================================
// [4] PARSING DE C100/C170 — DOCUMENTOS E ITENS
// ============================================================

interface DocumentoC100 {
  chaveNfe: string;
  ind_oper: string; // 0=Ent, 1=Saída
  ind_emit: string;
  codPart: string;
  cfop: string;
  valorTotal: number;
  dtDoc: string;
}

interface ItemC170 {
  docKey: string;
  numItem: number;
  codItem: string;
  descCompl: string;
  qtd: number;
  valorItem: number;
  valorDesconto: number;
  cfop: string;
  cstIcms: string;
  aliqIcms: number;
  valorIcms: number;
  aliqIpi: number;
  valorIpi: number;
  cstPis: string;
  aliqPis: number;
  valorPis: number;
  cstCofins: string;
  aliqCofins: number;
  valorCofins: number;
}

function parseBloco0000(lines: string[]): string {
  for (const line of lines) {
    const f = line.split('|');
    if (f[1] === '0000') {
      const di = f[4] || '';
      const df = f[5] || '';
      return `${di.slice(0, 2)}/${di.slice(2, 4)}/${di.slice(4)} a ${df.slice(0, 2)}/${df.slice(2, 4)}/${df.slice(4)}`;
    }
  }
  return '';
}

function parseBlocoC100(lines: string[]): Map<string, DocumentoC100> {
  const map = new Map<string, DocumentoC100>();
  for (const line of lines) {
    const f = line.split('|');
    if (f[1] !== 'C100') continue;
    const key = f[9] || `doc_${Math.random()}`;
    map.set(key, {
      chaveNfe: f[9] || '',
      ind_oper: f[3] || '0',
      ind_emit: f[4] || '0',
      codPart: f[5] || '',
      cfop: f[6] || '',
      valorTotal: parseDecimal(f[12]),
      dtDoc: f[11] || '',
    });
  }
  return map;
}

function parseBlocoC170(lines: string[], docKeys: string[]): ItemC170[] {
  const items: ItemC170[] = [];
  let currentDoc = '';
  for (const line of lines) {
    const f = line.split('|');
    if (f[1] === 'C100') {
      currentDoc = f[9] || '';
    }
    if (f[1] !== 'C170') continue;
    items.push({
      docKey: currentDoc,
      numItem: parseInt(f[2] || '0'),
      codItem: f[3] || '',
      descCompl: f[4] || '',
      qtd: parseDecimal(f[5]),
      valorItem: parseDecimal(f[7]),
      valorDesconto: parseDecimal(f[8]),
      cfop: f[10] || '',
      cstIcms: f[11] || '',
      aliqIcms: parseDecimal(f[14]),
      valorIcms: parseDecimal(f[15]),
      aliqIpi: parseDecimal(f[24]),
      valorIpi: parseDecimal(f[25]),
      cstPis: f[26] || '',
      aliqPis: parseDecimal(f[27]),
      valorPis: parseDecimal(f[28]),
      cstCofins: f[29] || '',
      aliqCofins: parseDecimal(f[30]),
      valorCofins: parseDecimal(f[31]),
    });
  }
  return items;
}

// ============================================================
// [5] PARSING DE APURAÇÃO
// ============================================================

interface Apuracao {
  pis: number;
  cofins: number;
  icms: number;
  ipi: number;
  creditosAproveitados: number;
}

function parseApuracao(lines: string[]): Apuracao {
  const ap: Apuracao = { pis: 0, cofins: 0, icms: 0, ipi: 0, creditosAproveitados: 0 };
  for (const line of lines) {
    const f = line.split('|');
    switch (f[1]) {
      case 'M210': ap.pis = parseDecimal(f[11]); break;
      case 'M610': ap.cofins = parseDecimal(f[11]); break;
      case 'E110': ap.icms = parseDecimal(f[13]); break;
      case 'E520': ap.ipi = parseDecimal(f[7]); break;
    }
  }
  return ap;
}

// ============================================================
// [6] FUNÇÃO PRINCIPAL: parseSped
// ============================================================

export interface ParsedSpedResult {
  fonte: FonteIngestao;
  parseLog: ParseLog;
  periodo: string;
  produtos: Map<string, Produto0200>;
  documentosC100: Map<string, DocumentoC100>;
  itensC170: ItemC170[];
  apuracao: Apuracao;
}

export function parseSped(content: string): ParsedSpedResult {
  const lines = content.split(/\r?\n/);
  const msgs: string[] = [];
  const blocos = new Set<string>();

  for (const line of lines) {
    const f = line.split('|');
    if (f.length >= 2 && f[1]) blocos.add(f[1]);
  }

  const blocosArr = Array.from(blocos);
  msgs.push(`Blocos encontrados: ${blocosArr.join(', ')}`);

  // Detectar tipo de SPED (EFD Contrib vs EFD ICMS/IPI)
  let fonte: FonteIngestao = 'SPED_EFD_ICMS_IPI';
  if (blocosArr.includes('M210') || blocosArr.includes('M610')) {
    fonte = 'SPED_EFD_CONTRIB';
    msgs.push('Tipo identificado: EFD Contribuições (PIS/COFINS)');
  } else if (blocosArr.includes('E110') || blocosArr.includes('E520')) {
    msgs.push('Tipo identificado: EFD ICMS/IPI');
  }

  const produtos = parseBloco0200(lines);
  const documentosC100 = parseBlocoC100(lines);
  const itensC170 = parseBlocoC170(lines, Array.from(documentosC100.keys()));
  const apuracao = parseApuracao(lines);
  const periodo = parseBloco0000(lines);

  msgs.push(`Produtos cadastrados (Bloco 0200): ${produtos.size}`);
  msgs.push(`Documentos (C100): ${documentosC100.size}`);
  msgs.push(`Itens (C170): ${itensC170.length}`);

  let anomaliaCount = 0;
  // Verificar anomalias rápidas durante parsing
  for (const item of itensC170) {
    if (CST_VIGILANCIA_CONTRIB[item.cstPis]) {
      anomaliaCount++;
      msgs.push(`⚠ CST PIS ${item.cstPis} sob vigilância — item ${item.codItem}`);
    }
    if (CST_VIGILANCIA_ICMS[item.cstIcms]) {
      anomaliaCount++;
    }
  }

  const integridade = itensC170.length > 0 ? 'ok' : produtos.size > 0 ? 'parcial' : 'corrompido';

  const parseLog: ParseLog = {
    fonte,
    integridade,
    totalLinhas: lines.length,
    blocosEncontrados: blocosArr,
    totalItens: itensC170.length,
    anomaliasEncontradas: anomaliaCount,
    mensagens: msgs,
    timestamp: new Date().toISOString(),
  };

  return { fonte, parseLog, periodo, produtos, documentosC100, itensC170, apuracao };
}

// ============================================================
// [7] MOTOR DE REGRAS: processarDiagnostico
// Gera: Diagnóstico, Simulação, Insights, Action Items, Itens De/Para
// ============================================================

export function processarDiagnostico(
  parsed: ParsedSpedResult,
  empresaId: string,
  regimeTributario: RegimeTributario = 'lucro_real'
): {
  diagnostico: DiagnosticoTributario;
  simulacao: SimulacaoReforma;
  insights: InsightTributario[];
  actionItems: ActionItem[];
  produtos: import('./tributarioStore').ProdutoCadastrado[];
} {
  const { fonte, parseLog, periodo, produtos, itensC170, apuracao } = parsed;
  const anomalias: AnomaliaCST[] = [];
  const itensAnalisados: ItemAnalisado[] = [];
  const itensPorCategoria: Record<string, number> = {};

  // ── Totalização regime antigo ──────────────────────────────────
  let receitaTotal = 0;
  let tributosAtuaisTotal = 0;
  let creditosAproveitados = 0;
  let creditosNaoAproveitados = 0;
  let debitoIBSCBSTotal = 0;
  let creditoIBSCBSTotal = 0;
  let impostoSeletivoTotal = 0;

  const saidas = itensC170.filter(i => i.cfop?.startsWith('5') || i.cfop?.startsWith('6'));
  const entradas = itensC170.filter(i => i.cfop?.startsWith('1') || i.cfop?.startsWith('2'));

  // Receita total de saídas
  if (saidas.length > 0) {
    receitaTotal = saidas.reduce((acc, i) => acc + i.valorItem, 0);
  } else {
    // Fallback: somar C100 de saídas
    for (const [, doc] of parsed.documentosC100) {
      if (doc.ind_oper === '1') receitaTotal += doc.valorTotal;
    }
  }

  // Tributos regime antigo
  const tributosAtuaisSPED = apuracao.pis + apuracao.cofins + apuracao.icms + apuracao.ipi;
  // Se a apuração não capturou por ausência de blocos, estima dos itens
  tributosAtuaisTotal = tributosAtuaisSPED > 0
    ? tributosAtuaisSPED
    : saidas.reduce((acc, i) => acc + i.valorPis + i.valorCofins + i.valorIcms + i.valorIpi, 0);

  // ── Processar cada item de saída → De/Para ────────────────────
  let itemSeq = 0;
  for (const item of saidas) {
    itemSeq++;
    const produto = produtos.get(item.codItem);
    const ncm = produto?.codNcm || item.codItem;
    const cest = produto?.cest;
    const regra = buscarRegraNCM(ncm);
    const efAliqIBS = ALIQ_REFERENCIA_IBS * (1 - regra.reducaoAliqIBSCBS);
    const efAliqCBS = ALIQ_REFERENCIA_CBS * (1 - regra.reducaoAliqIBSCBS);
    const isAliq = regra.impostoSeletivoAliq;

    const tributosItem = item.valorPis + item.valorCofins + item.valorIcms + item.valorIpi;
    const debitoIBS = item.valorItem * efAliqIBS;
    const debitoCBS = item.valorItem * efAliqCBS;
    const isValor = item.valorItem * isAliq;
    const debitoReforma = debitoIBS + debitoCBS;

    // Crédito financeiro de entradas correspondentes (simplificado — proporcional)
    const proporcaoEntrada = receitaTotal > 0 ? item.valorItem / receitaTotal : 0;
    const insumosProporcional = entradas.reduce((acc, e) => acc + e.valorItem, 0) * proporcaoEntrada;
    const creditoReforma = insumosProporcional * (efAliqIBS + efAliqCBS);

    const impostoDevidoReforma = Math.max(0, debitoReforma - creditoReforma);
    const variacaoValor = impostoDevidoReforma - tributosItem;

    debitoIBSCBSTotal += debitoReforma;
    creditoIBSCBSTotal += creditoReforma;
    impostoSeletivoTotal += isValor;

    const ia: ItemAnalisado = {
      id: `item_${itemSeq}`,
      ncm: ncm || '0000.00.00',
      cest,
      cfop: item.cfop,
      descricao: produto?.descItem || item.descCompl || item.codItem,
      valorOperacao: item.valorItem,
      cstPis: item.cstPis,
      cstCofins: item.cstCofins,
      cstIcms: item.cstIcms,
      aliqPisAtual: item.aliqPis / 100,
      aliqCofinsAtual: item.aliqCofins / 100,
      aliqIcmsAtual: item.aliqIcms / 100,
      aliqIpiAtual: item.aliqIpi / 100,
      tributosAtuais: tributosItem,
      aliqIBS: efAliqIBS,
      aliqCBS: efAliqCBS,
      aliqIS: isAliq,
      reducaoAliq: regra.reducaoAliqIBSCBS,
      creditoIBSCBS: creditoReforma,
      debitoIBSCBS: debitoReforma,
      impostoDevidoReforma,
      variacaoValor,
      variacaoPercent: tributosItem > 0 ? variacaoValor / tributosItem : 0,
      ncmCategoria: regra.categoria,
      baseLegal: regra.baseLegal,
      observacao: regra.observacao,
    };

    itensAnalisados.push(ia);

    // Acumular por categoria
    itensPorCategoria[regra.categoria] = (itensPorCategoria[regra.categoria] || 0) + item.valorItem;

    // Anomalias de CST
    const msgContrib = CST_VIGILANCIA_CONTRIB[item.cstPis];
    if (msgContrib) {
      const anomId = `anom_cst_pis_${itemSeq}`;
      if (!anomalias.find(a => a.id === anomId)) {
        anomalias.push({
          id: anomId,
          tipo: 'cst_invalido',
          severidade: 'media',
          descricao: `CST PIS "${item.cstPis}" na saída: ${msgContrib}`,
          ncm,
          cst: item.cstPis,
          cfop: item.cfop,
          valor: item.valorItem,
          orientacao: `Reclassifique o item ${item.codItem} no ERP. Regra: ${regra.baseLegal}`,
        });
      }
    }

    const msgIcms = CST_VIGILANCIA_ICMS[item.cstIcms];
    if (msgIcms) {
      anomalias.push({
        id: `anom_icms_${itemSeq}`,
        tipo: 'cst_invalido',
        severidade: 'alta',
        descricao: `CST ICMS "${item.cstIcms}" incompatível com Reforma: ${msgIcms}`,
        ncm,
        cst: item.cstIcms,
        cfop: item.cfop,
        valor: item.valorItem,
        orientacao: `Elimine o regime de ST ou redução de base. IBS/CBS não admite ST. Bloco C170 Item ${item.numItem}.`,
      });
    }

    // IS incidente
    if (isAliq > 0) {
      anomalias.push({
        id: `anom_is_${itemSeq}`,
        tipo: 'is_incidente',
        severidade: 'alta',
        descricao: `Imposto Seletivo de ${(isAliq * 100).toFixed(0)}% incide sobre NCM ${ncm} (${regra.categoria})`,
        ncm,
        valor: isValor,
        orientacao: `Cadastrar IS no ERP como tributo autônomo (não compensa crédito IBS/CBS). ${regra.baseLegal}`,
      });
    }

    // NCM ausente ou genérico
    if (!ncm || ncm === '00000000') {
      anomalias.push({
        id: `anom_ncm_${itemSeq}`,
        tipo: 'ncm_incompativel',
        severidade: 'alta',
        descricao: `Produto "${item.codItem}" sem NCM no Bloco 0200. Impede classificação na Reforma.`,
        ncm,
        cfop: item.cfop,
        valor: item.valorItem,
        orientacao: `Atualize o cadastro do produto no ERP com NCM válido (8 dígitos). Requisito obrigatório para IBS/CBS.`,
      });
    }
  }

  // Créditos de entradas
  for (const item of entradas) {
    const produto = produtos.get(item.codItem);
    const ncm = produto?.codNcm || '';
    const regra = buscarRegraNCM(ncm);
    const efAliq = (ALIQ_REFERENCIA_IBS + ALIQ_REFERENCIA_CBS) * (1 - regra.reducaoAliqIBSCBS);
    const credPot = item.valorItem * efAliq;

    // Se no regime antigo não havia crédito (CST 07,08,09...), marca como não aproveitado
    if (item.cstPis && (item.aliqPis === 0 && item.aliqCofins === 0 && item.aliqIcms === 0)) {
      creditosNaoAproveitados += item.valorItem;
    } else {
      creditosAproveitados += item.valorPis + item.valorCofins;
    }
  }

  // ── [DIAGNÓSTICO] ──────────────────────────────────────────────
  const diagnostico: DiagnosticoTributario = {
    empresaId,
    periodo,
    fonte,
    parseLog,
    receitaTotal,
    tributosApurados: tributosAtuaisTotal,
    cargaTributariaEfetiva: receitaTotal > 0 ? tributosAtuaisTotal / receitaTotal : 0,
    creditosAproveitados,
    creditosNaoAproveitados,
    itensPorCategoria,
  };

  // ── [SIMULAÇÃO] ────────────────────────────────────────────────
  const impostoDevido = Math.max(0, debitoIBSCBSTotal - creditoIBSCBSTotal);
  const totalReforma = impostoDevido + impostoSeletivoTotal;

  const simulacao: SimulacaoReforma = {
    empresaId,
    periodo,
    regimeTributario,
    aliquotaReferenciaIBS: ALIQ_REFERENCIA_IBS,
    aliquotaReferenciaCBS: ALIQ_REFERENCIA_CBS,
    debitoTotal: debitoIBSCBSTotal,
    creditoTotal: creditoIBSCBSTotal,
    impostoDevido,
    impostoSeletivo: impostoSeletivoTotal,
    totalReforma,
    cargaTributariaEfetiva: receitaTotal > 0 ? totalReforma / receitaTotal : 0,
    itens: itensAnalisados,
    anomalias,
  };

  // ── [INSIGHTS] ─────────────────────────────────────────────────
  const insights: InsightTributario[] = [];
  const diffValor = totalReforma - tributosAtuaisTotal;
  const diffPct = receitaTotal > 0 ? diffValor / receitaTotal : 0;

  if (diffValor > 0) {
    insights.push({
      id: 'ins_1', empresaId,
      tipo: 'alerta',
      prioridade: 1,
      titulo: 'Aumento de Carga Tributária Projetado',
      texto: `A Reforma implica acréscimo de R$ ${fmt.currency(diffValor)} (${(diffPct * 100).toFixed(2)} p.p.) frente ao regime atual. Planeje fluxo de caixa para Split Payment.`,
      impactoEstimado: diffValor,
      baseLegal: 'LC 214/2025 art. 58 (split payment obrigatório)',
    });
  } else {
    insights.push({
      id: 'ins_1', empresaId,
      tipo: 'oportunidade',
      prioridade: 1,
      titulo: 'Redução de Carga Tributária Projetada',
      texto: `A Reforma gera economia de R$ ${fmt.currency(Math.abs(diffValor))} pelo crédito financeiro amplo do IBS/CBS. Monitore acúmulo de créditos para solicitação de ressarcimento.`,
      impactoEstimado: Math.abs(diffValor),
      baseLegal: 'LC 214/2025 art. 29 (não cumulatividade plena)',
    });
  }

  if (creditosNaoAproveitados > receitaTotal * 0.1) {
    insights.push({
      id: 'ins_2', empresaId,
      tipo: 'risco',
      prioridade: 1,
      titulo: 'Créditos Represados — Risco de Passivo',
      texto: `Identificados R$ ${fmt.currency(creditosNaoAproveitados)} de insumos sem crédito no regime atual. Com a não-cumulatividade plena da Reforma, esses itens gerarão crédito — mas exigem reclassificação do cadastro no ERP.`,
      impactoEstimado: creditosNaoAproveitados * (ALIQ_REFERENCIA_IBS + ALIQ_REFERENCIA_CBS),
      baseLegal: 'LC 214/2025 art. 28-45 (crédito financeiro amplo)',
    });
  }

  if (impostoSeletivoTotal > 0) {
    insights.push({
      id: 'ins_3', empresaId,
      tipo: 'alerta',
      prioridade: 2,
      titulo: 'Imposto Seletivo Identificado',
      texto: `Detectado IS de R$ ${fmt.currency(impostoSeletivoTotal)} sobre ${anomalias.filter(a => a.tipo === 'is_incidente').length} NCMs. O IS não gera crédito de IBS/CBS e incide sobre o valor sem dedução.`,
      impactoEstimado: impostoSeletivoTotal,
      baseLegal: 'LC 214/2025 art. 413-435 (Imposto Seletivo)',
    });
  }

  if (anomalias.filter(a => a.severidade === 'alta').length > 0) {
    insights.push({
      id: 'ins_4', empresaId,
      tipo: 'risco',
      prioridade: 1,
      titulo: `${anomalias.filter(a => a.severidade === 'alta').length} Anomalias de Alta Severidade`,
      texto: `Foram detectadas inconsistências de CST/NCM/CFOP que, se não corrigidas, podem gerar autuação na transição. Acesse a aba "Anomalias" para detalhamento.`,
      baseLegal: 'LC 214/2025 art. 348 (infrações e penalidades)',
    });
  }

  // Simples como fornecedor
  if (regimeTributario === 'simples_nacional') {
    insights.push({
      id: 'ins_5', empresaId,
      tipo: 'estrategia',
      prioridade: 2,
      titulo: 'Simples Nacional — Restrição de Crédito IBS/CBS',
      texto: `Empresas no Simples Nacional transferem crédito IBS/CBS apenas parcialmente aos tomadores (proporção via PGDAS). Avalie se a migração para Lucro Presumido melhora a cadeia de crédito de seus clientes.`,
      baseLegal: 'LC 214/2025 art. 130 (Simples Nacional e crédito IBS/CBS)',
    });
  }

  if (itensAnalisados.filter(i => i.reducaoAliq === 1.0).length > 0) {
    const valorIsentos = itensAnalisados.filter(i => i.reducaoAliq === 1.0).reduce((a, i) => a + i.valorOperacao, 0);
    insights.push({
      id: 'ins_6', empresaId,
      tipo: 'oportunidade',
      prioridade: 2,
      titulo: 'Itens com Isenção Plena (100% Redução)',
      texto: `Identificados R$ ${fmt.currency(valorIsentos)} em operações com isenção plena de IBS/CBS (cesta básica, insumos agro, educação). Certifique-se de que os NCMs estão no Anexo III da LC 214/2025 para garantia do benefício.`,
      baseLegal: 'LC 214/2025 Anexo III',
    });
  }

  // ── [ACTION ITEMS] ─────────────────────────────────────────────
  const actionItems: ActionItem[] = [];

  if (anomalias.some(a => a.tipo === 'ncm_incompativel')) {
    actionItems.push({
      id: 'act_1', empresaId,
      prioridade: 'critica',
      area: 'ncm',
      titulo: 'Completar NCMs faltantes no cadastro de produtos',
      descricao: 'Produtos sem NCM no Bloco 0200 impedem a classificação correta de IBS/CBS/IS. Atualize o ERP com NCM de 8 dígitos via tabela NCM da RFB.',
      prazo: '30 dias antes do início do período de transição',
      baseLegal: 'LC 214/2025 art. 9 §1º',
    });
  }

  if (anomalias.some(a => a.cst?.startsWith('06') || a.cst?.startsWith('07'))) {
    actionItems.push({
      id: 'act_2', empresaId,
      prioridade: 'alta',
      area: 'cadastro_erp',
      titulo: 'Reclassificar CSTs de PIS/COFINS que não têm equivalência na Reforma',
      descricao: 'Os CSTs 06-09 do PIS/COFINS serão substituídos pelo IBS/CBS com crédito financeiro amplo. Configure o ERP para emitir NF-e/NFS-e com código de tributação IBS/CBS a partir de 2026.',
      prazo: 'Até 01/01/2026 (1ª fase de transição)',
      baseLegal: 'LC 214/2025 art. 347-350 (disposições transitórias)',
    });
  }

  if (anomalias.some(a => a.tipo === 'is_incidente')) {
    actionItems.push({
      id: 'act_3', empresaId,
      prioridade: 'critica',
      area: 'cadastro_erp',
      titulo: 'Cadastrar Imposto Seletivo como tributo autônomo no ERP',
      descricao: 'O IS deve ser destacado separadamente na NF-e (campo próprio). Não compensa crédito IBS/CBS. Configure tabela de IS por NCM no ERP e treine equipe fiscal.',
      prazo: 'Antes do primeiro faturamento com IS vigente',
      baseLegal: 'LC 214/2025 art. 413-435',
    });
  }

  actionItems.push({
    id: 'act_4', empresaId,
    prioridade: 'alta',
    area: 'split_payment',
    titulo: 'Preparar fluxo de caixa para o Split Payment automático',
    descricao: 'O split payment (LC 227/2026) retém IBS/CBS diretamente na liquidação financeira. A empresa não receberá o valor integral do imposto — antecipe o impacto no capital de giro.',
    prazo: 'Imediato — planejamento financeiro 2026/2027',
    baseLegal: 'LC 227/2026 art. 12-28 (Split Payment e compensação)',
  });

  if (regimeTributario === 'simples_nacional') {
    actionItems.push({
      id: 'act_5', empresaId,
      prioridade: 'media',
      area: 'regime',
      titulo: 'Avaliar migração de regime tributário para Lucro Presumido',
      descricao: 'O Simples Nacional limita o crédito IBS/CBS transferido ao tomador. Se seus clientes forem Lucro Real, a migração pode aumentar competitividade e reduzir carga total da cadeia.',
      baseLegal: 'LC 214/2025 art. 130; LC 123/2006',
    });
  }

  // ── [PRODUTOS CADASTRADOS] Bloco 0200 enriquecido com regras da Reforma ──
  const produtosCadastrados: import('./tributarioStore').ProdutoCadastrado[] = [];
  for (const [, p] of produtos) {
    const regra = buscarRegraNCM(p.codNcm);
    const efIBS = ALIQ_REFERENCIA_IBS * (1 - regra.reducaoAliqIBSCBS);
    const efCBS = ALIQ_REFERENCIA_CBS * (1 - regra.reducaoAliqIBSCBS);
    produtosCadastrados.push({
      codItem: p.codItem,
      descricao: p.descItem,
      ncm: p.codNcm,
      unidade: p.unidInv,
      tipo: p.tipo,
      cest: p.cest,
      aliqIcmsCadastro: p.aliqIcms,
      // Reforma
      categoria: regra.categoria,
      tratamento: regra.reducaoAliqIBSCBS === 1.0 ? 'isencao_plena'
        : regra.reducaoAliqIBSCBS === 0.6 ? 'reducao_60'
        : regra.impostoSeletivoAliq > 0 ? 'imposto_seletivo'
        : 'normal',
      aliqIBS: efIBS,
      aliqCBS: efCBS,
      aliqIS: regra.impostoSeletivoAliq,
      reducaoAliq: regra.reducaoAliqIBSCBS,
      baseLegal: regra.baseLegal,
      observacao: regra.observacao,
    });
  }

  return { diagnostico, simulacao, insights, actionItems, produtos: produtosCadastrados };
}

// ── Helper ───────────────────────────────────────────────────────
function parseDecimal(val?: string): number {
  if (!val) return 0;
  return parseFloat(val.replace(',', '.')) || 0;
}

// ── Import de fmt (evitar circular) ─────────────────────────────
import { fmt } from './reports';