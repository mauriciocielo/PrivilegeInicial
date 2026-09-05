// ============================================================
// CURVA ABC — Importação de arquivos (XLS, TXT, PDF) e classificação
// ============================================================
// Regra de negócio: os itens são ordenados do maior para o menor valor
// faturado; a classificação A/B/C é feita pelo percentual acumulado sobre o
// total, usando os cortes configuráveis por empresa (padrão 80% / 95%).

import { uid, type ClassificacaoAbc, type CurvaAbcItemEntry } from './store';

export interface ItemBruto {
  nome: string;
  valorFaturado: number;
}

const NOME_KEYWORDS = ['nome', 'cliente', 'produto', 'descricao', 'item', 'fornecedor', 'servico'];
const VALOR_KEYWORDS = ['valor', 'faturamento', 'faturado', 'total', 'venda', 'montante', 'receita'];

function normalizeText(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\x00-\x7F]/g, '')
    .trim();
}

/** Converte um texto numérico em formato BR ("1.234,56") ou padrão ("1234.56") para número. */
function parseNumeroBR(raw: string): number | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().replace(/[^\d.,-]/g, '');
  if (!s || s === '-') return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && !hasDot) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Recebe uma matriz de linhas/colunas já extraída do arquivo (planilha, texto
 * delimitado ou texto reconstruído de um PDF) e tenta identificar a coluna de
 * nome e a coluna de valor faturado, tolerando variações comuns de cabeçalho.
 */
export function parseRowsToItens(rows: (string | number)[][]): ItemBruto[] {
  if (!rows || rows.length === 0) return [];

  let startIdx = 0;
  let nomeCol = -1;
  let valorCol = -1;

  const header = rows[0].map(c => normalizeText(String(c ?? '')));
  header.forEach((h, i) => {
    if (nomeCol === -1 && NOME_KEYWORDS.some(k => h.includes(k))) nomeCol = i;
    if (valorCol === -1 && VALOR_KEYWORDS.some(k => h.includes(k))) valorCol = i;
  });
  if (nomeCol !== -1 || valorCol !== -1) startIdx = 1;

  const itens: ItemBruto[] = [];
  for (let r = startIdx; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every(c => c === '' || c === undefined || c === null)) continue;

    let valor: number | null = null;
    let nome: string | null = null;

    if (valorCol !== -1 && row[valorCol] !== undefined) {
      const cell = row[valorCol];
      valor = typeof cell === 'number' ? cell : parseNumeroBR(String(cell));
    }
    if (nomeCol !== -1 && row[nomeCol] !== undefined) {
      nome = String(row[nomeCol]).trim();
    }

    // Sem cabeçalho reconhecido (ou coluna não encontrada): varre a linha da
    // direita para a esquerda em busca do valor, e usa a primeira célula
    // textual (não numérica) restante como nome.
    if (valor === null) {
      for (let i = row.length - 1; i >= 0; i--) {
        const cell = row[i];
        const n = typeof cell === 'number' ? cell : parseNumeroBR(String(cell ?? ''));
        if (n !== null && n !== 0) { valor = n; break; }
      }
    }
    if (nome === null) {
      for (const cell of row) {
        const s = String(cell ?? '').trim();
        if (s && parseNumeroBR(s) === null && Number.isNaN(Number(s))) { nome = s; break; }
      }
    }

    if (nome && valor !== null && valor > 0) {
      itens.push({ nome, valorFaturado: valor });
    }
  }
  return itens;
}

export async function parseXlsFile(file: File): Promise<ItemBruto[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as (string | number)[][];
  return parseRowsToItens(rows);
}

export async function parseTxtFile(file: File): Promise<ItemBruto[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  const rows = lines.map(line => {
    const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : line.includes(',') ? ',' : /\s{2,}/;
    return line.split(delimiter as string | RegExp).map(c => c.trim());
  });
  return parseRowsToItens(rows);
}

export async function parsePdfFile(file: File): Promise<ItemBruto[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    // Reconstrói "linhas" agrupando os fragmentos de texto por coordenada Y
    // aproximada (PDFs não têm noção nativa de linha/tabela).
    const byY = new Map<number, { x: number; str: string }[]>();
    (content.items as any[]).forEach(item => {
      const y = Math.round(item.transform[5]);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push({ x: item.transform[4], str: item.str });
    });
    const sortedYs = Array.from(byY.keys()).sort((a, b) => b - a);
    sortedYs.forEach(y => {
      const cells = byY.get(y)!.sort((a, b) => a.x - b.x);
      const linha = cells.map(c => c.str).join(' ').trim();
      if (linha) lines.push(linha);
    });
  }

  const rows = lines.map(l => l.split(/\s{2,}/).map(c => c.trim()));
  return parseRowsToItens(rows);
}

export async function parseCurvaAbcFile(file: File): Promise<ItemBruto[]> {
  const nome = file.name.toLowerCase();
  if (nome.endsWith('.xlsx') || nome.endsWith('.xls') || nome.endsWith('.csv')) {
    return parseXlsFile(file);
  }
  if (nome.endsWith('.pdf')) {
    return parsePdfFile(file);
  }
  if (nome.endsWith('.txt')) {
    return parseTxtFile(file);
  }
  throw new Error('Formato de arquivo não suportado. Envie um arquivo .xlsx, .xls, .csv, .txt ou .pdf.');
}

/** Ordena por valor faturado (desc), calcula % individual/acumulado e classifica em A/B/C. */
export function classificarAbc(itensBrutos: ItemBruto[], percentualA: number, percentualB: number): CurvaAbcItemEntry[] {
  const ordenados = [...itensBrutos].sort((a, b) => b.valorFaturado - a.valorFaturado);
  const total = ordenados.reduce((sum, i) => sum + i.valorFaturado, 0);

  let acumulado = 0;
  return ordenados.map((item, idx) => {
    const percentualIndividual = total > 0 ? (item.valorFaturado / total) * 100 : 0;
    acumulado += percentualIndividual;
    const classificacao: ClassificacaoAbc = acumulado <= percentualA ? 'A' : acumulado <= percentualB ? 'B' : 'C';
    return {
      id: uid(),
      nome: item.nome,
      valorFaturado: item.valorFaturado,
      percentualIndividual,
      percentualAcumulado: Math.min(acumulado, 100),
      classificacao,
      ordem: idx,
    };
  });
}
