// ============================================================
// NF-e — DANFE em PDF, gerado a partir do XML completo (procNFe)
// ============================================================
// Representação da nota recebida, para consulta e arquivo. O documento fiscal
// continua sendo o XML. Regras puras: não acessa banco nem rede.

import { jsPDF } from 'jspdf';

export class XmlNfeInvalidoError extends Error {}

// ---------- Leitura do XML ----------

const decodificar = (t: string) => t
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function tag(xml: string, nome: string): string {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([^<]*)</${nome}>`));
  return m ? decodificar(m[1].trim()) : '';
}

function bloco(xml: string, nome: string): string {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`));
  return m ? m[1] : '';
}

function blocos(xml: string, nome: string): string[] {
  return [...xml.matchAll(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, 'g'))].map(m => m[1]);
}

export interface ItemDanfe {
  codigo: string; descricao: string; ncm: string; cst: string; cfop: string; unidade: string;
  quantidade: string; valorUnitario: string; valorTotal: string;
  baseIcms: string; valorIcms: string; valorIpi: string; aliqIcms: string; aliqIpi: string;
}

export interface EnderecoDanfe {
  logradouro: string; numero: string; complemento: string; bairro: string; municipio: string; uf: string; cep: string; fone: string;
}

export interface DadosDanfe {
  chave: string; numero: string; serie: string; natureza: string; tipo: string; emissao: string; saida: string;
  homologacao: boolean; protocolo: string; dataProtocolo: string;
  emitente: { nome: string; fantasia: string; documento: string; ie: string; ieSt: string; im: string; endereco: EnderecoDanfe };
  destinatario: { nome: string; documento: string; ie: string; endereco: EnderecoDanfe };
  totais: Record<'vBC' | 'vICMS' | 'vBCST' | 'vST' | 'vProd' | 'vFrete' | 'vSeg' | 'vDesc' | 'vOutro' | 'vIPI' | 'vTotTrib' | 'vNF', string>;
  transporte: { frete: string; nome: string; documento: string; ie: string; endereco: string; municipio: string; uf: string; placa: string; quantidade: string; especie: string; marca: string; numeracao: string; pesoBruto: string; pesoLiquido: string };
  duplicatas: Array<{ numero: string; vencimento: string; valor: string }>;
  itens: ItemDanfe[];
  informacoes: string;
}

const lerEndereco = (xml: string): EnderecoDanfe => ({
  logradouro: tag(xml, 'xLgr'), numero: tag(xml, 'nro'), complemento: tag(xml, 'xCpl'), bairro: tag(xml, 'xBairro'),
  municipio: tag(xml, 'xMun'), uf: tag(xml, 'UF'), cep: tag(xml, 'CEP'), fone: tag(xml, 'fone'),
});

const FRETE: Record<string, string> = {
  0: '0 - Por conta do emitente', 1: '1 - Por conta do destinatário', 2: '2 - Por conta de terceiros',
  3: '3 - Próprio, por conta do remetente', 4: '4 - Próprio, por conta do destinatário', 9: '9 - Sem transporte',
};

export function lerDadosDanfe(xml: string): DadosDanfe {
  const inf = xml.match(/<infNFe\s[^>]*>[\s\S]*<\/infNFe>/)?.[0];
  if (!inf) throw new XmlNfeInvalidoError('O XML não traz uma NF-e completa.');

  const ide = bloco(inf, 'ide');
  const emit = bloco(inf, 'emit');
  const dest = bloco(inf, 'dest');
  const total = bloco(inf, 'ICMSTot');
  const transp = bloco(inf, 'transp');
  const transporta = bloco(transp, 'transporta');
  const veic = bloco(transp, 'veicTransp');
  const vol = bloco(transp, 'vol');
  const prot = bloco(xml, 'infProt');
  const chave = tag(prot, 'chNFe') || (inf.match(/Id="NFe(\d{44})"/)?.[1] ?? '');

  const itens = blocos(inf, 'det').map((det): ItemDanfe => {
    const prod = bloco(det, 'prod');
    const icms = det.match(/<ICMS(?:\d+|Part|ST|SN\d+)>([\s\S]*?)<\/ICMS(?:\d+|Part|ST|SN\d+)>/)?.[1] ?? '';
    const ipi = bloco(det, 'IPITrib');
    return {
      codigo: tag(prod, 'cProd'), descricao: tag(prod, 'xProd'), ncm: tag(prod, 'NCM'),
      cst: `${tag(icms, 'orig')}${tag(icms, 'CST') || tag(icms, 'CSOSN')}`, cfop: tag(prod, 'CFOP'), unidade: tag(prod, 'uCom'),
      quantidade: tag(prod, 'qCom'), valorUnitario: tag(prod, 'vUnCom'), valorTotal: tag(prod, 'vProd'),
      baseIcms: tag(icms, 'vBC'), valorIcms: tag(icms, 'vICMS'), valorIpi: tag(ipi, 'vIPI'), aliqIcms: tag(icms, 'pICMS'), aliqIpi: tag(ipi, 'pIPI'),
    };
  });

  return {
    chave,
    numero: tag(ide, 'nNF'), serie: tag(ide, 'serie'), natureza: tag(ide, 'natOp'), tipo: tag(ide, 'tpNF'),
    emissao: tag(ide, 'dhEmi') || tag(ide, 'dEmi'), saida: tag(ide, 'dhSaiEnt') || tag(ide, 'dSaiEnt'),
    homologacao: tag(ide, 'tpAmb') === '2',
    protocolo: tag(prot, 'nProt'), dataProtocolo: tag(prot, 'dhRecbto'),
    emitente: {
      nome: tag(emit, 'xNome'), fantasia: tag(emit, 'xFant'), documento: tag(emit, 'CNPJ') || tag(emit, 'CPF'),
      ie: tag(emit, 'IE'), ieSt: tag(emit, 'IEST'), im: tag(emit, 'IM'), endereco: lerEndereco(bloco(emit, 'enderEmit')),
    },
    destinatario: {
      nome: tag(dest, 'xNome'), documento: tag(dest, 'CNPJ') || tag(dest, 'CPF') || tag(dest, 'idEstrangeiro'),
      ie: tag(dest, 'IE'), endereco: lerEndereco(bloco(dest, 'enderDest')),
    },
    totais: {
      vBC: tag(total, 'vBC'), vICMS: tag(total, 'vICMS'), vBCST: tag(total, 'vBCST'), vST: tag(total, 'vST'), vProd: tag(total, 'vProd'),
      vFrete: tag(total, 'vFrete'), vSeg: tag(total, 'vSeg'), vDesc: tag(total, 'vDesc'), vOutro: tag(total, 'vOutro'),
      vIPI: tag(total, 'vIPI'), vTotTrib: tag(total, 'vTotTrib'), vNF: tag(total, 'vNF'),
    },
    transporte: {
      frete: FRETE[tag(transp, 'modFrete')] ?? tag(transp, 'modFrete'),
      nome: tag(transporta, 'xNome'), documento: tag(transporta, 'CNPJ') || tag(transporta, 'CPF'), ie: tag(transporta, 'IE'),
      endereco: tag(transporta, 'xEnder'), municipio: tag(transporta, 'xMun'), uf: tag(transporta, 'UF') || tag(veic, 'UF'), placa: tag(veic, 'placa'),
      quantidade: tag(vol, 'qVol'), especie: tag(vol, 'esp'), marca: tag(vol, 'marca'), numeracao: tag(vol, 'nVol'),
      pesoBruto: tag(vol, 'pesoB'), pesoLiquido: tag(vol, 'pesoL'),
    },
    duplicatas: blocos(inf, 'dup').map(d => ({ numero: tag(d, 'nDup'), vencimento: tag(d, 'dVenc'), valor: tag(d, 'vDup') })),
    itens,
    informacoes: [tag(bloco(inf, 'infAdic'), 'infAdFisco'), tag(bloco(inf, 'infAdic'), 'infCpl')].filter(Boolean).join(' '),
  };
}

// ---------- Formatação ----------

export function formatarDocumento(d: string): string {
  const n = d.replace(/\D/g, '');
  if (n.length === 14) return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (n.length === 11) return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
}

export function formatarNumero(v: string, casas = 2): string {
  if (v === '' || Number.isNaN(Number(v))) return '';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Quantidade e valor unitário têm até 4 e 10 casas no XML: mostra o que a nota traz, com pelo menos 2. */
function formatarDecimalVariavel(v: string, maximo: number): string {
  if (v === '' || Number.isNaN(Number(v))) return '';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: maximo });
}

function formatarData(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const formatarHora = (iso: string) => iso.match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? '';
const formatarChave = (c: string) => c.replace(/(\d{4})(?=\d)/g, '$1 ');
const formatarNumeroNota = (n: string) => n.padStart(9, '0').replace(/^(\d{3})(\d{3})(\d{3})$/, '$1.$2.$3');
const formatarCep = (c: string) => c.replace(/^(\d{5})(\d{3})$/, '$1-$2');

// ---------- Código de barras Code 128 (conjunto C), o padrão da chave no DANFE ----------

const PADROES_128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232',
];
const INICIO_C = 105;
const PARADA = '2331112';

/** Larguras de barras e espaços, alternadas e começando em barra. */
export function code128C(digitos: string): number[] {
  if (!/^\d+$/.test(digitos) || digitos.length % 2 !== 0) throw new Error('O conjunto C do Code 128 exige um número par de dígitos.');
  const valores = digitos.match(/\d{2}/g)!.map(Number);
  const soma = valores.reduce((total, v, i) => total + v * (i + 1), INICIO_C);
  const codigos = [INICIO_C, ...valores, soma % 103];
  return (codigos.map(c => PADROES_128[c]).join('') + PARADA).split('').map(Number);
}

// ---------- Desenho ----------

const M = 6;
const W = 210;
const H = 297;
const CW = W - M * 2;

type Pdf = jsPDF;

function caixa(pdf: Pdf, x: number, y: number, w: number, h: number, rotulo: string, valor = '', op: { alinhar?: 'left' | 'right' | 'center'; tamanho?: number; negrito?: boolean } = {}) {
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.15);
  pdf.rect(x, y, w, h);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5);
  pdf.setTextColor(60);
  pdf.text(rotulo, x + 0.8, y + 2);
  if (!valor) return;

  pdf.setFont('helvetica', op.negrito ? 'bold' : 'normal');
  pdf.setTextColor(0);
  let tamanho = op.tamanho ?? 7.5;
  pdf.setFontSize(tamanho);
  // Encolhe em vez de invadir a caixa ao lado.
  while (tamanho > 4.5 && pdf.getTextWidth(valor) > w - 1.6) {
    tamanho -= 0.25;
    pdf.setFontSize(tamanho);
  }
  const alinhar = op.alinhar ?? 'left';
  const xTexto = alinhar === 'right' ? x + w - 0.8 : alinhar === 'center' ? x + w / 2 : x + 0.8;
  pdf.text(valor, xTexto, y + h - 1.2, { align: alinhar });
}

function titulo(pdf: Pdf, y: number, texto: string) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6);
  pdf.setTextColor(0);
  pdf.text(texto, M, y + 2.2);
}

function codigoDeBarras(pdf: Pdf, chave: string, x: number, y: number, w: number, h: number) {
  if (!/^\d{44}$/.test(chave)) return;
  const larguras = code128C(chave);
  const unidade = w / larguras.reduce((a, b) => a + b, 0);
  pdf.setFillColor(0, 0, 0);
  let cursor = x;
  larguras.forEach((l, i) => {
    if (i % 2 === 0) pdf.rect(cursor, y, l * unidade, h, 'F');
    cursor += l * unidade;
  });
}

function cabecalho(pdf: Pdf, d: DadosDanfe, y: number, folha: number, totalFolhas: number): number {
  const h = 34;
  const wEmit = 76;
  const wDanfe = 32;
  const xDanfe = M + wEmit;
  const xChave = xDanfe + wDanfe;
  const wChave = CW - wEmit - wDanfe;
  const e = d.emitente.endereco;

  pdf.setDrawColor(0);
  pdf.setLineWidth(0.15);
  pdf.rect(M, y, wEmit, h);
  pdf.setTextColor(0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  const nome = pdf.splitTextToSize(d.emitente.nome, wEmit - 4) as string[];
  pdf.text(nome.slice(0, 3), M + wEmit / 2, y + 6, { align: 'center', lineHeightFactor: 1.05 });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  const endereco = [
    [e.logradouro, e.numero, e.complemento].filter(Boolean).join(', '),
    [e.bairro, formatarCep(e.cep)].filter(Boolean).join(' - '),
    [e.municipio, e.uf].filter(Boolean).join(' - ') + (e.fone ? ` - Fone: ${e.fone}` : ''),
  ].filter(Boolean);
  pdf.text(endereco.flatMap(l => pdf.splitTextToSize(l, wEmit - 4) as string[]).slice(0, 4), M + wEmit / 2, y + 19, { align: 'center', lineHeightFactor: 1.15 });

  pdf.rect(xDanfe, y, wDanfe, h);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('DANFE', xDanfe + wDanfe / 2, y + 5, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.5);
  pdf.text(['Documento Auxiliar da', 'Nota Fiscal Eletrônica'], xDanfe + wDanfe / 2, y + 8, { align: 'center' });
  pdf.setFontSize(6);
  pdf.text(['0 - ENTRADA', '1 - SAÍDA'], xDanfe + 3, y + 14);
  pdf.rect(xDanfe + 22, y + 12.5, 5, 5);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(d.tipo, xDanfe + 24.5, y + 16.3, { align: 'center' });
  pdf.setFontSize(8);
  pdf.text(`Nº ${formatarNumeroNota(d.numero)}`, xDanfe + wDanfe / 2, y + 22.5, { align: 'center' });
  pdf.text(`SÉRIE ${d.serie}`, xDanfe + wDanfe / 2, y + 26.5, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text(`FOLHA ${folha}/${totalFolhas}`, xDanfe + wDanfe / 2, y + 31, { align: 'center' });

  pdf.rect(xChave, y, wChave, 15);
  codigoDeBarras(pdf, d.chave, xChave + 2, y + 2, wChave - 4, 11);
  caixa(pdf, xChave, y + 15, wChave, 9, 'CHAVE DE ACESSO', formatarChave(d.chave), { alinhar: 'center', tamanho: 7, negrito: true });
  pdf.rect(xChave, y + 24, wChave, 10);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(0);
  pdf.text(['Consulta de autenticidade no portal nacional da NF-e', 'www.nfe.fazenda.gov.br/portal'], xChave + wChave / 2, y + 28, { align: 'center' });

  y += h;
  caixa(pdf, M, y, 110, 7, 'NATUREZA DA OPERAÇÃO', d.natureza);
  caixa(pdf, M + 110, y, CW - 110, 7, 'PROTOCOLO DE AUTORIZAÇÃO DE USO', [d.protocolo, formatarData(d.dataProtocolo), formatarHora(d.dataProtocolo)].filter(Boolean).join(' - '), { alinhar: 'center' });
  y += 7;
  caixa(pdf, M, y, 66, 7, 'INSCRIÇÃO ESTADUAL', d.emitente.ie);
  caixa(pdf, M + 66, y, 66, 7, 'INSCRIÇÃO ESTADUAL DO SUBST. TRIBUTÁRIO', d.emitente.ieSt);
  caixa(pdf, M + 132, y, CW - 132, 7, 'CNPJ / CPF', formatarDocumento(d.emitente.documento));
  return y + 7;
}

const COLUNAS_ITENS: Array<{ titulo: string; w: number; alinhar: 'left' | 'right' | 'center'; campo: (i: ItemDanfe) => string }> = [
  { titulo: 'CÓDIGO', w: 15, alinhar: 'left', campo: i => i.codigo },
  { titulo: 'DESCRIÇÃO DO PRODUTO / SERVIÇO', w: 55, alinhar: 'left', campo: i => i.descricao },
  { titulo: 'NCM/SH', w: 12, alinhar: 'center', campo: i => i.ncm },
  { titulo: 'CST', w: 7, alinhar: 'center', campo: i => i.cst },
  { titulo: 'CFOP', w: 7, alinhar: 'center', campo: i => i.cfop },
  { titulo: 'UN', w: 7, alinhar: 'center', campo: i => i.unidade },
  { titulo: 'QTD', w: 13, alinhar: 'right', campo: i => formatarDecimalVariavel(i.quantidade, 4) },
  { titulo: 'V. UNIT.', w: 14, alinhar: 'right', campo: i => formatarDecimalVariavel(i.valorUnitario, 4) },
  { titulo: 'V. TOTAL', w: 14, alinhar: 'right', campo: i => formatarNumero(i.valorTotal) },
  { titulo: 'BC ICMS', w: 13, alinhar: 'right', campo: i => formatarNumero(i.baseIcms) },
  { titulo: 'V. ICMS', w: 12, alinhar: 'right', campo: i => formatarNumero(i.valorIcms) },
  { titulo: 'V. IPI', w: 10, alinhar: 'right', campo: i => formatarNumero(i.valorIpi) },
  { titulo: '% ICMS', w: 9, alinhar: 'right', campo: i => formatarNumero(i.aliqIcms) },
  { titulo: '% IPI', w: 10, alinhar: 'right', campo: i => formatarNumero(i.aliqIpi) },
];

function cabecalhoItens(pdf: Pdf, y: number): number {
  titulo(pdf, y, 'DADOS DOS PRODUTOS / SERVIÇOS');
  y += 3;
  let x = M;
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.15);
  for (const c of COLUNAS_ITENS) {
    // A cor do texto também é a de preenchimento no PDF: precisa ser redefinida a cada caixa.
    pdf.setFillColor(238, 238, 238);
    pdf.rect(x, y, c.w, 5, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(4.8);
    pdf.setTextColor(0);
    pdf.text(c.titulo, x + c.w / 2, y + 3.2, { align: 'center', maxWidth: c.w - 0.6 });
    x += c.w;
  }
  return y + 5;
}

function alturaItem(pdf: Pdf, item: ItemDanfe): number {
  const descricao = COLUNAS_ITENS[1];
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  const linhas = (pdf.splitTextToSize(item.descricao, descricao.w - 1.2) as string[]).length;
  return Math.max(4, linhas * 2.6 + 1.4);
}

function desenharItem(pdf: Pdf, item: ItemDanfe, y: number, altura: number) {
  let x = M;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  pdf.setTextColor(0);
  pdf.setDrawColor(170);
  pdf.setLineWidth(0.1);
  for (const c of COLUNAS_ITENS) {
    const valor = c.campo(item);
    if (c.titulo.startsWith('DESCRIÇÃO')) {
      pdf.text(pdf.splitTextToSize(valor, c.w - 1.2) as string[], x + 0.6, y + 2.8, { lineHeightFactor: 1.2 });
    } else {
      let tamanho = 6;
      pdf.setFontSize(tamanho);
      while (tamanho > 4 && pdf.getTextWidth(valor) > c.w - 1) {
        tamanho -= 0.25;
        pdf.setFontSize(tamanho);
      }
      const xTexto = c.alinhar === 'right' ? x + c.w - 0.5 : c.alinhar === 'center' ? x + c.w / 2 : x + 0.5;
      pdf.text(valor, xTexto, y + 2.8, { align: c.alinhar });
      pdf.setFontSize(6);
    }
    x += c.w;
  }
  pdf.line(M, y + altura, M + CW, y + altura);
}

function canhoto(pdf: Pdf, d: DadosDanfe, y: number): number {
  const texto = `RECEBEMOS DE ${d.emitente.nome} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO`;
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.15);
  pdf.rect(M, y, CW - 34, 7);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.5);
  pdf.setTextColor(0);
  pdf.text(pdf.splitTextToSize(texto, CW - 36) as string[], M + 0.8, y + 2.4);
  caixa(pdf, M, y + 7, 40, 8, 'DATA DE RECEBIMENTO');
  caixa(pdf, M + 40, y + 7, CW - 74, 8, 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR');
  pdf.rect(M + CW - 34, y, 34, 15);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('NF-e', M + CW - 17, y + 4, { align: 'center' });
  pdf.setFontSize(7.5);
  pdf.text(`Nº ${formatarNumeroNota(d.numero)}`, M + CW - 17, y + 8.5, { align: 'center' });
  pdf.text(`SÉRIE ${d.serie}`, M + CW - 17, y + 12.5, { align: 'center' });

  pdf.setDrawColor(120);
  pdf.setLineDashPattern([1, 1], 0);
  pdf.line(M, y + 17, M + CW, y + 17);
  pdf.setLineDashPattern([], 0);
  return y + 19;
}

function blocoDestinatario(pdf: Pdf, d: DadosDanfe, y: number): number {
  const e = d.destinatario.endereco;
  titulo(pdf, y, 'DESTINATÁRIO / REMETENTE');
  y += 3;
  caixa(pdf, M, y, 120, 7, 'NOME / RAZÃO SOCIAL', d.destinatario.nome);
  caixa(pdf, M + 120, y, 50, 7, 'CNPJ / CPF', formatarDocumento(d.destinatario.documento));
  caixa(pdf, M + 170, y, CW - 170, 7, 'DATA DA EMISSÃO', formatarData(d.emissao), { alinhar: 'center' });
  y += 7;
  caixa(pdf, M, y, 90, 7, 'ENDEREÇO', [e.logradouro, e.numero, e.complemento].filter(Boolean).join(', '));
  caixa(pdf, M + 90, y, 50, 7, 'BAIRRO / DISTRITO', e.bairro);
  caixa(pdf, M + 140, y, 30, 7, 'CEP', formatarCep(e.cep));
  caixa(pdf, M + 170, y, CW - 170, 7, 'DATA DA SAÍDA/ENTRADA', formatarData(d.saida), { alinhar: 'center' });
  y += 7;
  caixa(pdf, M, y, 80, 7, 'MUNICÍPIO', e.municipio);
  caixa(pdf, M + 80, y, 30, 7, 'FONE / FAX', e.fone);
  caixa(pdf, M + 110, y, 10, 7, 'UF', e.uf, { alinhar: 'center' });
  caixa(pdf, M + 120, y, 50, 7, 'INSCRIÇÃO ESTADUAL', d.destinatario.ie);
  caixa(pdf, M + 170, y, CW - 170, 7, 'HORA DA SAÍDA', formatarHora(d.saida), { alinhar: 'center' });
  return y + 7;
}

function blocoFaturas(pdf: Pdf, d: DadosDanfe, y: number): number {
  if (d.duplicatas.length === 0) return y;
  titulo(pdf, y, 'FATURA / DUPLICATAS');
  y += 3;
  const porLinha = 6;
  const w = CW / porLinha;
  d.duplicatas.slice(0, 18).forEach((dup, i) => {
    const x = M + (i % porLinha) * w;
    const yLinha = y + Math.floor(i / porLinha) * 8;
    caixa(pdf, x, yLinha, w, 8, `Nº ${dup.numero}  VENC. ${formatarData(dup.vencimento)}`, formatarNumero(dup.valor), { alinhar: 'right' });
  });
  return y + Math.ceil(Math.min(d.duplicatas.length, 18) / porLinha) * 8;
}

function blocoImpostos(pdf: Pdf, d: DadosDanfe, y: number): number {
  const t = d.totais;
  titulo(pdf, y, 'CÁLCULO DO IMPOSTO');
  y += 3;
  const w = CW / 6;
  const primeira: Array<[string, string]> = [
    ['BASE DE CÁLCULO DO ICMS', t.vBC], ['VALOR DO ICMS', t.vICMS], ['BASE DE CÁLC. ICMS S.T.', t.vBCST],
    ['VALOR DO ICMS SUBST.', t.vST], ['V. APROX. TRIBUTOS', t.vTotTrib], ['VALOR TOTAL DOS PRODUTOS', t.vProd],
  ];
  const segunda: Array<[string, string]> = [
    ['VALOR DO FRETE', t.vFrete], ['VALOR DO SEGURO', t.vSeg], ['DESCONTO', t.vDesc],
    ['OUTRAS DESPESAS', t.vOutro], ['VALOR TOTAL DO IPI', t.vIPI], ['VALOR TOTAL DA NOTA', t.vNF],
  ];
  primeira.forEach(([r, v], i) => caixa(pdf, M + i * w, y, w, 7, r, formatarNumero(v), { alinhar: 'right' }));
  y += 7;
  segunda.forEach(([r, v], i) => caixa(pdf, M + i * w, y, w, 7, r, formatarNumero(v), { alinhar: 'right', negrito: r === 'VALOR TOTAL DA NOTA' }));
  return y + 7;
}

function blocoTransporte(pdf: Pdf, d: DadosDanfe, y: number): number {
  const t = d.transporte;
  titulo(pdf, y, 'TRANSPORTADOR / VOLUMES TRANSPORTADOS');
  y += 3;
  caixa(pdf, M, y, 70, 7, 'NOME / RAZÃO SOCIAL', t.nome);
  caixa(pdf, M + 70, y, 40, 7, 'FRETE', t.frete);
  caixa(pdf, M + 110, y, 22, 7, 'PLACA DO VEÍCULO', t.placa);
  caixa(pdf, M + 132, y, 8, 7, 'UF', t.uf, { alinhar: 'center' });
  caixa(pdf, M + 140, y, CW - 140, 7, 'CNPJ / CPF', formatarDocumento(t.documento));
  y += 7;
  caixa(pdf, M, y, 80, 7, 'ENDEREÇO', t.endereco);
  caixa(pdf, M + 80, y, 52, 7, 'MUNICÍPIO', t.municipio);
  caixa(pdf, M + 132, y, 8, 7, 'UF', t.uf, { alinhar: 'center' });
  caixa(pdf, M + 140, y, CW - 140, 7, 'INSCRIÇÃO ESTADUAL', t.ie);
  y += 7;
  const w = CW / 6;
  const volumes: Array<[string, string]> = [
    ['QUANTIDADE', t.quantidade], ['ESPÉCIE', t.especie], ['MARCA', t.marca], ['NUMERAÇÃO', t.numeracao],
    ['PESO BRUTO', formatarDecimalVariavel(t.pesoBruto, 3)], ['PESO LÍQUIDO', formatarDecimalVariavel(t.pesoLiquido, 3)],
  ];
  volumes.forEach(([r, v], i) => caixa(pdf, M + i * w, y, w, 7, r, v));
  return y + 7;
}

function blocoInformacoes(pdf: Pdf, d: DadosDanfe, y: number): number {
  titulo(pdf, y, 'DADOS ADICIONAIS');
  y += 3;
  const altura = 26;
  caixa(pdf, M, y, CW, altura, 'INFORMAÇÕES COMPLEMENTARES');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  pdf.setTextColor(0);
  const linhas = (pdf.splitTextToSize(d.informacoes, CW - 2) as string[]).slice(0, 8);
  pdf.text(linhas, M + 0.8, y + 4.8, { lineHeightFactor: 1.25 });
  return y + altura;
}

function marcaDagua(pdf: Pdf, texto: string) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(texto.length > 12 ? 40 : 66);
  pdf.setTextColor(205, 60, 60);
  const estado = new (pdf as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.22 });
  (pdf as unknown as { saveGraphicsState: () => void; setGState: (g: unknown) => void; restoreGraphicsState: () => void }).saveGraphicsState();
  (pdf as unknown as { setGState: (g: unknown) => void }).setGState(estado);
  pdf.text(texto, W / 2, H / 2, { align: 'center', angle: 45 });
  (pdf as unknown as { restoreGraphicsState: () => void }).restoreGraphicsState();
  pdf.setTextColor(0);
}

/** Distribui os itens: a 1ª folha tem os blocos fiscais; as demais, só o cabeçalho e os itens. */
function paginarItens(pdf: Pdf, itens: ItemDanfe[], espacoPrimeira: number, espacoDemais: number): ItemDanfe[][] {
  const folhas: ItemDanfe[][] = [[]];
  let restante = espacoPrimeira;
  for (const item of itens) {
    const altura = alturaItem(pdf, item);
    if (altura > restante && folhas[folhas.length - 1].length > 0) {
      folhas.push([]);
      restante = espacoDemais;
    }
    folhas[folhas.length - 1].push(item);
    restante -= altura;
  }
  return folhas;
}

const LIMITE_INFERIOR = H - 6;
const ALTURA_CABECALHO = 34 + 7 + 7;

/** Desenha a nota a partir da página atual, que já deve estar em branco. */
function desenharDanfe(pdf: Pdf, d: DadosDanfe, situacao: string) {
  // Medidas fixas dos blocos da primeira folha, para saber quanto sobra para os itens.
  const linhasFatura = Math.ceil(Math.min(d.duplicatas.length, 18) / 6);
  const alturaFatura = linhasFatura > 0 ? 3 + linhasFatura * 8 : 0;
  const yInicioItens = M + 19 + ALTURA_CABECALHO + 24 + alturaFatura + 17 + 24 + 3 + 5;
  const espacoPrimeira = LIMITE_INFERIOR - yInicioItens - 29;
  const espacoDemais = LIMITE_INFERIOR - (M + ALTURA_CABECALHO + 3 + 5);

  const folhas = paginarItens(pdf, d.itens, espacoPrimeira, espacoDemais);

  folhas.forEach((itens, i) => {
    if (i > 0) pdf.addPage();
    let y = M;
    if (i === 0) y = canhoto(pdf, d, y);
    y = cabecalho(pdf, d, y, i + 1, folhas.length);
    if (i === 0) {
      y = blocoDestinatario(pdf, d, y);
      y = blocoFaturas(pdf, d, y);
      y = blocoImpostos(pdf, d, y);
      y = blocoTransporte(pdf, d, y);
    }
    y = cabecalhoItens(pdf, y);
    for (const item of itens) {
      const altura = alturaItem(pdf, item);
      desenharItem(pdf, item, y, altura);
      y += altura;
    }
    if (i === 0) blocoInformacoes(pdf, d, LIMITE_INFERIOR - 29);

    if (situacao === 'cancelada') marcaDagua(pdf, 'CANCELADA');
    else if (situacao === 'denegada') marcaDagua(pdf, 'DENEGADA');
    else if (d.homologacao) marcaDagua(pdf, 'SEM VALOR FISCAL');
  });
}

const novoPdf = () => new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

export function gerarDanfePdf(xml: string, situacao = 'autorizada'): Buffer {
  const pdf = novoPdf();
  desenharDanfe(pdf, lerDadosDanfe(xml), situacao);
  return Buffer.from(pdf.output('arraybuffer'));
}

/** Várias notas num só arquivo. Nota com XML ilegível derruba só ela: quem chama decide o que fazer. */
export function gerarDanfePdfUnico(notas: Array<{ dados: DadosDanfe; situacao: string }>): Buffer {
  const pdf = novoPdf();
  notas.forEach((n, i) => {
    if (i > 0) pdf.addPage();
    desenharDanfe(pdf, n.dados, n.situacao);
  });
  return Buffer.from(pdf.output('arraybuffer'));
}
