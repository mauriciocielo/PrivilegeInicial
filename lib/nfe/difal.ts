// ============================================================
// NF-e DESTINADAS — Cálculo e Relatório do DIFAL (Diferencial de Alíquota)
// ============================================================
// O DIFAL incide nas aquisições interestaduais de mercadorias.
// Compara a alíquota interestadual destacada na nota (4%, 7% ou 12%)
// com a alíquota interna do estado de destino.

export const ALIQUOTAS_INTERNAS_PADRAO: Record<string, number> = {
  AC: 19.0,
  AL: 19.0,
  AM: 20.0,
  AP: 18.0,
  BA: 20.5,
  CE: 20.0,
  DF: 20.0,
  ES: 17.0,
  GO: 19.0,
  MA: 22.0,
  MG: 18.0,
  MS: 17.0,
  MT: 17.0,
  PA: 19.0,
  PB: 20.0,
  PE: 20.5,
  PI: 21.0,
  PR: 19.5,
  RJ: 22.0,
  RN: 18.0,
  RO: 19.5,
  RR: 20.0,
  RS: 17.0,
  SC: 17.0,
  SE: 19.0,
  SP: 18.0,
  TO: 20.0,
};

export const CODIGO_UF_PARA_SIGLA: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

export interface ItemCalculoDifal {
  id: string;
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  emitenteNome: string;
  emitenteCnpj: string;
  destinatarioNome: string;
  destinatarioCnpj: string;
  ufOrigem: string;
  ufDestino: string;
  isInterestadual: boolean;
  valorProdutos: number;
  valorTotalNf: number;
  baseCalculoIcms: number;
  aliquotaInterestadual: number;
  aliquotaInterna: number;
  diferencialAliquota: number;
  valorDifalEstimado: number;
  valorDifalXml: number | null;
  possuiXml: boolean;
  origemCalculo: 'xml_partilha' | 'estimado_icms' | 'aliquota_padrao';
}

export interface RelatorioDifalResultado {
  empresaId: string;
  ufEmpresa: string;
  aliquotaInternaPadrao: number;
  periodo: { de?: string; ate?: string; mes?: string };
  totais: {
    totalNotas: number;
    totalInterestaduais: number;
    valorTotalNotas: number;
    valorTotalProdutos: number;
    baseCalculoTotal: number;
    difalTotalEstimado: number;
  };
  itens: ItemCalculoDifal[];
}

const tag = (xml: string, nome: string): string | null => {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([^<]*)</${nome}>`));
  return m ? m[1].trim() : null;
};

const bloco = (xml: string, nome: string): string => {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`));
  return m ? m[1] : '';
};

const num = (v: string | null | undefined): number => {
  if (!v) return 0;
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

/**
 * Extrai UF da chave de acesso (primeiros 2 dígitos)
 */
export function ufDaChave(chave: string): string {
  if (!chave || chave.length < 2) return '';
  const cod = chave.slice(0, 2);
  return CODIGO_UF_PARA_SIGLA[cod] || '';
}

/**
 * Estima a alíquota interestadual com base na UF de origem e destino
 */
export function estimarAliquotaInterestadual(ufOrigem: string, ufDestino: string): number {
  if (!ufOrigem || !ufDestino || ufOrigem === ufDestino) return 0;
  const sulSudesteSemEs = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS'];
  if (sulSudesteSemEs.includes(ufOrigem) && !sulSudesteSemEs.includes(ufDestino)) {
    return 7.0; // Sul/Sudeste para Norte/Nordeste/Centro-Oeste e ES
  }
  return 12.0;
}

/**
 * Calcula o DIFAL para uma única nota fiscal
 */
export function calcularDifalNota(
  nota: {
    id: string;
    chaveAcesso: string;
    numero?: string | null;
    serie?: string | null;
    dataEmissao: string;
    emitenteNome: string;
    emitenteCnpj: string;
    valorNf: number;
    xml?: string | null;
    possuiXml?: boolean;
  },
  ufDestinoPadrao: string,
): ItemCalculoDifal {
  const chave = nota.chaveAcesso;
  let ufOrigem = ufDaChave(chave);
  let ufDestino = ufDestinoPadrao || 'PR';
  let destinatarioNome = '';
  let destinatarioCnpj = '';
  let valorProdutos = nota.valorNf;
  let baseCalculoIcms = nota.valorNf;
  let aliquotaInterestadual = 0;
  let valorDifalXml: number | null = null;
  let origemCalculo: ItemCalculoDifal['origemCalculo'] = 'aliquota_padrao';

  if (nota.xml) {
    const xml = nota.xml;
    const emit = bloco(xml, 'emit');
    const dest = bloco(xml, 'dest');
    const total = bloco(xml, 'ICMSTot');

    const ufEmit = tag(bloco(emit, 'enderEmit'), 'UF');
    if (ufEmit) ufOrigem = ufEmit.toUpperCase();

    const ufDest = tag(bloco(dest, 'enderDest'), 'UF');
    if (ufDest) ufDestino = ufDest.toUpperCase();

    destinatarioNome = tag(dest, 'xNome') || '';
    destinatarioCnpj = tag(dest, 'CNPJ') || tag(dest, 'CPF') || '';

    const vProd = num(tag(total, 'vProd'));
    if (vProd > 0) valorProdutos = vProd;

    const vBC = num(tag(total, 'vBC'));
    if (vBC > 0) baseCalculoIcms = vBC;

    const vICMS = num(tag(total, 'vICMS'));
    if (baseCalculoIcms > 0 && vICMS > 0) {
      const aliqCalc = (vICMS / baseCalculoIcms) * 100;
      if (aliqCalc > 3 && aliqCalc < 5) aliquotaInterestadual = 4.0;
      else if (aliqCalc > 6 && aliqCalc < 8.5) aliquotaInterestadual = 7.0;
      else if (aliqCalc > 11 && aliqCalc < 13.5) aliquotaInterestadual = 12.0;
      else aliquotaInterestadual = Math.round(aliqCalc * 10) / 10;
      origemCalculo = 'estimado_icms';
    }

    // Verifica se há partilha expressa do DIFAL (EC 87/2015)
    const vICMSUFDest = num(tag(total, 'vICMSUFDest'));
    if (vICMSUFDest > 0) {
      valorDifalXml = vICMSUFDest;
      origemCalculo = 'xml_partilha';
    }
  }

  const isInterestadual = Boolean(ufOrigem && ufDestino && ufOrigem !== ufDestino);

  if (isInterestadual && aliquotaInterestadual === 0) {
    aliquotaInterestadual = estimarAliquotaInterestadual(ufOrigem, ufDestino);
  }

  const aliquotaInterna = ALIQUOTAS_INTERNAS_PADRAO[ufDestino] || 19.5;
  const diferencialAliquota = isInterestadual ? Math.max(0, aliquotaInterna - aliquotaInterestadual) : 0;
  
  let valorDifalEstimado = valorDifalXml != null && valorDifalXml > 0
    ? valorDifalXml
    : (isInterestadual ? Math.round(baseCalculoIcms * (diferencialAliquota / 100) * 100) / 100 : 0);

  return {
    id: nota.id,
    chaveAcesso: chave,
    numero: nota.numero || (chave.length === 44 ? String(Number(chave.slice(25, 34))) : '-'),
    serie: nota.serie || (chave.length === 44 ? String(Number(chave.slice(22, 25))) : '-'),
    dataEmissao: nota.dataEmissao,
    emitenteNome: nota.emitenteNome,
    emitenteCnpj: nota.emitenteCnpj,
    destinatarioNome,
    destinatarioCnpj,
    ufOrigem,
    ufDestino,
    isInterestadual,
    valorProdutos,
    valorTotalNf: nota.valorNf,
    baseCalculoIcms,
    aliquotaInterestadual,
    aliquotaInterna,
    diferencialAliquota,
    valorDifalEstimado,
    valorDifalXml,
    possuiXml: Boolean(nota.possuiXml || nota.xml),
    origemCalculo,
  };
}

