// ============================================================
// CT-e — DACTE simplificado em PDF, a partir do XML completo (procCTe)
// ============================================================
// Representação do Conhecimento de Transporte recebido, para consulta e
// arquivo. O documento fiscal continua sendo o XML. Regras puras: não
// acessa banco nem rede. Reaproveita formatadores e o código de barras do DANFE.

import { jsPDF } from 'jspdf';
import { code128C, formatarDocumento, formatarNumero } from '../nfe/danfe';

export class XmlCteInvalidoError extends Error {}

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

interface EnderecoCte {
  logradouro: string; numero: string; bairro: string; municipio: string; uf: string; cep: string; fone: string;
}

interface ParteCte {
  nome: string; documento: string; ie: string; endereco: EnderecoCte;
}

export interface DadosDacte {
  chave: string; numero: string; serie: string; natureza: string; cfop: string; modal: string;
  tipoCte: string; tipoServico: string; emissao: string; homologacao: boolean;
  protocolo: string; dataProtocolo: string;
  origem: string; destino: string;
  emitente: ParteCte;
  remetente: ParteCte;
  destinatario: ParteCte;
  tomador: string;
  valores: { total: string; receber: string; componentes: Array<{ nome: string; valor: string }> };
  icms: { cst: string; baseCalculo: string; aliquota: string; valor: string };
  carga: { valor: string; produtoPredominante: string; quantidades: Array<{ unidade: string; tipo: string; quantidade: string }> };
  observacoes: string;
}

const MODAL: Record<string, string> = {
  '01': 'Rodoviário', '02': 'Aéreo', '03': 'Aquaviário', '04': 'Ferroviário', '05': 'Dutoviário', '06': 'Multimodal',
};
const TIPO_CTE: Record<string, string> = {
  '0': 'Normal', '1': 'Complemento de valores', '2': 'Anulação', '3': 'Substituto',
};
const TIPO_SERVICO: Record<string, string> = {
  '0': 'Normal', '1': 'Subcontratação', '2': 'Redespacho', '3': 'Redespacho intermediário', '4': 'Vinculado a multimodal',
};
const TIPO_MEDIDA: Record<string, string> = {
  '00': 'M³', '01': 'KG', '02': 'TON', '03': 'UNIDADE', '04': 'LITROS', '05': 'MMBTU',
};

const lerEndereco = (xml: string): EnderecoCte => ({
  logradouro: tag(xml, 'xLgr'), numero: tag(xml, 'nro'), bairro: tag(xml, 'xBairro'),
  municipio: tag(xml, 'xMun'), uf: tag(xml, 'UF'), cep: tag(xml, 'CEP'), fone: tag(xml, 'fone'),
});

const lerParte = (xml: string, enderNome: string): ParteCte => ({
  nome: tag(xml, 'xNome'),
  documento: tag(xml, 'CNPJ') || tag(xml, 'CPF'),
  ie: tag(xml, 'IE'),
  endereco: lerEndereco(bloco(xml, enderNome)),
});

/** Lê o grupo ICMS, que vem com nome variável (ICMS00, ICMS20, ICMS45, ICMSOutraUF, ICMSSN). */
function lerIcms(imp: string): DadosDacte['icms'] {
  const m = imp.match(/<(ICMS(?:00|20|45|60|90|OutraUF|SN))>([\s\S]*?)<\/\1>/);
  const grupo = m ? m[2] : '';
  const cst = m ? (m[1] === 'ICMSSN' ? 'SN' : m[1].replace('ICMS', '')) : '';
  return {
    cst,
    baseCalculo: tag(grupo, 'vBC'),
    aliquota: tag(grupo, 'pICMS'),
    valor: tag(grupo, 'vICMS'),
  };
}

function lerTomador(inf: string): string {
  // toma3: 0=Remetente,1=Expedidor,2=Recebedor,3=Destinatário. toma4: dados próprios no XML.
  const toma3 = tag(bloco(inf, 'toma3'), 'toma');
  const toma4 = bloco(inf, 'toma4');
  if (toma4) return tag(toma4, 'xNome') || 'Outro (toma4)';
  const mapa: Record<string, string> = { '0': 'Remetente', '1': 'Expedidor', '2': 'Recebedor', '3': 'Destinatário' };
  return mapa[toma3] || '—';
}

export function lerDadosDacte(xml: string): DadosDacte {
  const inf = xml.match(/<infCte\s[^>]*>[\s\S]*<\/infCte>/)?.[0];
  if (!inf) throw new XmlCteInvalidoError('O XML não traz um CT-e completo.');

  const ide = bloco(inf, 'ide');
  const emit = bloco(inf, 'emit');
  const rem = bloco(inf, 'rem');
  const dest = bloco(inf, 'dest');
  const vPrest = bloco(inf, 'vPrest');
  const imp = bloco(inf, 'imp');
  const infCarga = bloco(inf, 'infCarga');
  const prot = bloco(xml, 'infProt');
  const chave = (inf.match(/Id="CTe(\d{44})"/)?.[1]) || tag(prot, 'chCTe') || '';

  const componentes = blocos(vPrest, 'Comp').map(c => ({ nome: tag(c, 'xNome'), valor: tag(c, 'vComp') }));
  const quantidades = blocos(infCarga, 'infQ').map(q => ({
    unidade: tag(q, 'cUnid'),
    tipo: TIPO_MEDIDA[tag(q, 'tpMed')] || tag(q, 'tpMed'),
    quantidade: tag(q, 'qCarga'),
  }));

  return {
    chave,
    numero: tag(ide, 'nCT'), serie: tag(ide, 'serie'), natureza: tag(ide, 'natOp'), cfop: tag(ide, 'CFOP'),
    modal: MODAL[tag(ide, 'modal')] || tag(ide, 'modal'),
    tipoCte: TIPO_CTE[tag(ide, 'tpCTe')] || tag(ide, 'tpCTe'),
    tipoServico: TIPO_SERVICO[tag(ide, 'tpServ')] || tag(ide, 'tpServ'),
    emissao: tag(ide, 'dhEmi'),
    homologacao: tag(ide, 'tpAmb') === '2',
    protocolo: tag(prot, 'nProt'), dataProtocolo: tag(prot, 'dhRecbto'),
    origem: [tag(ide, 'xMunIni'), tag(ide, 'UFIni')].filter(Boolean).join(' - '),
    destino: [tag(ide, 'xMunFim'), tag(ide, 'UFFim')].filter(Boolean).join(' - '),
    emitente: lerParte(emit, 'enderEmit'),
    remetente: lerParte(rem, 'enderReme'),
    destinatario: lerParte(dest, 'enderDest'),
    tomador: lerTomador(inf),
    valores: {
      total: tag(vPrest, 'vTPrest'),
      receber: tag(vPrest, 'vRec'),
      componentes,
    },
    icms: lerIcms(imp),
    carga: {
      valor: tag(infCarga, 'vCarga'),
      produtoPredominante: tag(infCarga, 'proPred'),
      quantidades,
    },
    observacoes: [tag(bloco(inf, 'compl'), 'xObs'), tag(bloco(inf, 'infAdic'), 'infCpl')].filter(Boolean).join(' '),
  };
}

// ---------- Formatação ----------

function formatarData(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
const formatarHora = (iso: string) => iso.match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? '';
const formatarChave = (c: string) => c.replace(/(\d{4})(?=\d)/g, '$1 ');
const formatarNumeroDoc = (n: string) => (n || '').padStart(9, '0').replace(/^(\d{3})(\d{3})(\d{3})$/, '$1.$2.$3');
const formatarCep = (c: string) => c.replace(/^(\d{5})(\d{3})$/, '$1-$2');

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

const enderecoLinha = (e: EnderecoCte) => [
  [e.logradouro, e.numero].filter(Boolean).join(', '),
  e.bairro,
  [e.municipio, e.uf].filter(Boolean).join('/'),
  e.cep ? `CEP ${formatarCep(e.cep)}` : '',
].filter(Boolean).join(' - ');

function cabecalho(pdf: Pdf, d: DadosDacte, y: number): number {
  const h = 34;
  const wEmit = 90;
  const wDacte = 28;
  const xDacte = M + wEmit;
  const xChave = xDacte + wDacte;
  const wChave = CW - wEmit - wDacte;
  const e = d.emitente.endereco;

  pdf.setDrawColor(0);
  pdf.setLineWidth(0.15);
  pdf.rect(M, y, wEmit, h);
  pdf.setTextColor(0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  const nome = pdf.splitTextToSize(d.emitente.nome || 'TRANSPORTADORA', wEmit - 4) as string[];
  pdf.text(nome.slice(0, 2), M + wEmit / 2, y + 6, { align: 'center', lineHeightFactor: 1.05 });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  const linhasEmit = [
    enderecoLinha(e),
    [`CNPJ ${formatarDocumento(d.emitente.documento)}`, d.emitente.ie ? `IE ${d.emitente.ie}` : ''].filter(Boolean).join('  '),
    e.fone ? `Fone: ${e.fone}` : '',
  ].filter(Boolean);
  pdf.text(linhasEmit.flatMap(l => pdf.splitTextToSize(l, wEmit - 4) as string[]).slice(0, 5), M + wEmit / 2, y + 16, { align: 'center', lineHeightFactor: 1.2 });

  pdf.rect(xDacte, y, wDacte, h);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('DACTE', xDacte + wDacte / 2, y + 6, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5);
  pdf.text(['Documento Auxiliar do', 'Conhecimento de', 'Transporte Eletrônico'], xDacte + wDacte / 2, y + 9.5, { align: 'center', lineHeightFactor: 1.1 });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text(`Nº ${formatarNumeroDoc(d.numero)}`, xDacte + wDacte / 2, y + 20, { align: 'center' });
  pdf.text(`SÉRIE ${d.serie}`, xDacte + wDacte / 2, y + 25, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  pdf.text(`MODAL: ${d.modal}`, xDacte + wDacte / 2, y + 30, { align: 'center' });

  pdf.rect(xChave, y, wChave, 15);
  codigoDeBarras(pdf, d.chave, xChave + 2, y + 2, wChave - 4, 11);
  caixa(pdf, xChave, y + 15, wChave, 9, 'CHAVE DE ACESSO', formatarChave(d.chave), { alinhar: 'center', tamanho: 7, negrito: true });
  pdf.rect(xChave, y + 24, wChave, 10);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(0);
  pdf.text(['Consulta de autenticidade no portal nacional do CT-e', 'www.cte.fazenda.gov.br ou no site da SEFAZ autorizadora'], xChave + wChave / 2, y + 28, { align: 'center' });

  y += h;
  caixa(pdf, M, y, 70, 7, 'NATUREZA DA OPERAÇÃO', d.natureza);
  caixa(pdf, M + 70, y, 18, 7, 'CFOP', d.cfop, { alinhar: 'center' });
  caixa(pdf, M + 88, y, 40, 7, 'TIPO DO CT-e', d.tipoCte);
  caixa(pdf, M + 128, y, CW - 128, 7, 'TIPO DO SERVIÇO', d.tipoServico);
  y += 7;
  caixa(pdf, M, y, 70, 7, 'PROTOCOLO DE AUTORIZAÇÃO', [d.protocolo, formatarData(d.dataProtocolo), formatarHora(d.dataProtocolo)].filter(Boolean).join(' - '));
  caixa(pdf, M + 70, y, CW - 70, 7, 'DATA E HORA DA EMISSÃO', [formatarData(d.emissao), formatarHora(d.emissao)].filter(Boolean).join(' '), { alinhar: 'center' });
  return y + 7;
}

function blocoPercurso(pdf: Pdf, d: DadosDacte, y: number): number {
  caixa(pdf, M, y, CW / 2, 8, 'ORIGEM DA PRESTAÇÃO', d.origem, { negrito: true });
  caixa(pdf, M + CW / 2, y, CW / 2, 8, 'DESTINO DA PRESTAÇÃO', d.destino, { negrito: true });
  return y + 8;
}

function blocoParte(pdf: Pdf, rotulo: string, p: ParteCte, y: number): number {
  titulo(pdf, y, rotulo);
  y += 3;
  caixa(pdf, M, y, 120, 7, 'NOME / RAZÃO SOCIAL', p.nome);
  caixa(pdf, M + 120, y, 48, 7, 'CNPJ / CPF', formatarDocumento(p.documento));
  caixa(pdf, M + 168, y, CW - 168, 7, 'INSC. ESTADUAL', p.ie, { alinhar: 'center' });
  y += 7;
  caixa(pdf, M, y, CW, 7, 'ENDEREÇO', enderecoLinha(p.endereco));
  return y + 7;
}

function blocoValores(pdf: Pdf, d: DadosDacte, y: number): number {
  titulo(pdf, y, 'VALORES DA PRESTAÇÃO DO SERVIÇO');
  y += 3;
  const v = d.valores;
  const w = CW / 4;
  const comps = v.componentes.slice(0, 2);
  caixa(pdf, M, y, w, 8, 'VALOR TOTAL DA PRESTAÇÃO', formatarNumero(v.total), { alinhar: 'right', negrito: true });
  caixa(pdf, M + w, y, w, 8, 'VALOR A RECEBER', formatarNumero(v.receber), { alinhar: 'right' });
  caixa(pdf, M + w * 2, y, w, 8, comps[0] ? comps[0].nome.toUpperCase().slice(0, 22) : 'COMPONENTE', comps[0] ? formatarNumero(comps[0].valor) : '', { alinhar: 'right' });
  caixa(pdf, M + w * 3, y, w, 8, comps[1] ? comps[1].nome.toUpperCase().slice(0, 22) : 'COMPONENTE', comps[1] ? formatarNumero(comps[1].valor) : '', { alinhar: 'right' });
  return y + 8;
}

function blocoImposto(pdf: Pdf, d: DadosDacte, y: number): number {
  titulo(pdf, y, 'INFORMAÇÕES RELATIVAS AO IMPOSTO (ICMS)');
  y += 3;
  const w = CW / 4;
  const i = d.icms;
  caixa(pdf, M, y, w, 7, 'SITUAÇÃO TRIBUTÁRIA (CST)', i.cst, { alinhar: 'center' });
  caixa(pdf, M + w, y, w, 7, 'BASE DE CÁLCULO', formatarNumero(i.baseCalculo), { alinhar: 'right' });
  caixa(pdf, M + w * 2, y, w, 7, 'ALÍQUOTA ICMS %', formatarNumero(i.aliquota), { alinhar: 'right' });
  caixa(pdf, M + w * 3, y, w, 7, 'VALOR DO ICMS', formatarNumero(i.valor), { alinhar: 'right' });
  return y + 7;
}

function blocoCarga(pdf: Pdf, d: DadosDacte, y: number): number {
  titulo(pdf, y, 'INFORMAÇÕES DA CARGA');
  y += 3;
  caixa(pdf, M, y, 50, 7, 'VALOR TOTAL DA CARGA', formatarNumero(d.carga.valor), { alinhar: 'right' });
  caixa(pdf, M + 50, y, 40, 7, 'TOMADOR DO SERVIÇO', d.tomador);
  caixa(pdf, M + 90, y, CW - 90, 7, 'PRODUTO PREDOMINANTE', d.carga.produtoPredominante);
  y += 7;
  const qs = d.carga.quantidades.slice(0, 4);
  if (qs.length) {
    const w = CW / 4;
    qs.forEach((q, idx) => caixa(pdf, M + idx * w, y, w, 7, q.tipo || 'QTD', [formatarNumero(q.quantidade), q.unidade].filter(Boolean).join(' '), { alinhar: 'right' }));
    y += 7;
  }
  return y;
}

function blocoObservacoes(pdf: Pdf, d: DadosDacte, y: number): number {
  titulo(pdf, y, 'OBSERVAÇÕES');
  y += 3;
  const altura = 22;
  caixa(pdf, M, y, CW, altura, '');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  pdf.setTextColor(0);
  const linhas = (pdf.splitTextToSize(d.observacoes || '—', CW - 2) as string[]).slice(0, 7);
  pdf.text(linhas, M + 0.8, y + 4, { lineHeightFactor: 1.25 });
  return y + altura;
}

function marcaDagua(pdf: Pdf, texto: string) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(texto.length > 12 ? 40 : 60);
  pdf.setTextColor(205, 60, 60);
  const estado = new (pdf as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.22 });
  (pdf as unknown as { saveGraphicsState: () => void }).saveGraphicsState();
  (pdf as unknown as { setGState: (g: unknown) => void }).setGState(estado);
  pdf.text(texto, W / 2, H / 2, { align: 'center', angle: 45 });
  (pdf as unknown as { restoreGraphicsState: () => void }).restoreGraphicsState();
  pdf.setTextColor(0);
}

function desenharDacte(pdf: Pdf, d: DadosDacte, situacao: string) {
  let y = M;
  y = cabecalho(pdf, d, y);
  y = blocoPercurso(pdf, d, y + 1);
  y = blocoParte(pdf, 'REMETENTE', d.remetente, y + 1);
  y = blocoParte(pdf, 'DESTINATÁRIO', d.destinatario, y + 1);
  y = blocoValores(pdf, d, y + 2);
  y = blocoImposto(pdf, d, y + 2);
  y = blocoCarga(pdf, d, y + 2);
  blocoObservacoes(pdf, d, y + 2);

  if (situacao === 'cancelada') marcaDagua(pdf, 'CANCELADO');
  else if (situacao === 'denegada') marcaDagua(pdf, 'DENEGADO');
  else if (d.homologacao) marcaDagua(pdf, 'SEM VALOR FISCAL');
}

const novoPdf = () => new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

export function gerarDactePdf(xml: string, situacao = 'autorizada'): Buffer {
  const pdf = novoPdf();
  desenharDacte(pdf, lerDadosDacte(xml), situacao);
  return Buffer.from(pdf.output('arraybuffer'));
}
