// ============================================================
// NFS-e NACIONAL — DANFSe v2.0 (Nota Técnica 008, v1.02)
// ============================================================
// A norma manda imprimir só o que consta no XML da NFS-e, em uma única página A4,
// com a disposição do Anexo I. Medidas em centímetros, como na tabela do item 2.4.5.
// Campos sem informação levam um traço. A API oficial de DANFSe foi suspensa em
// 03/08/2026: o documento é responsabilidade do sistema emissor.

import { jsPDF } from 'jspdf';
import municipios from './dados/municipios-ibge.json';

export type MarcaDagua = 'CANCELADA' | 'SUBSTITUÍDA' | null;

const TRACO = '-';

const desescapar = (v: string) => v
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function tag(xml: string, nome: string): string {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([^<]*)</${nome}>`));
  return m ? desescapar(m[1].trim()) : '';
}

const bloco = (xml: string, nome: string) => xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>[\\s\\S]*?</${nome}>`))?.[0] || '';

const ou = (...valores: string[]) => valores.find(Boolean) || TRACO;

const nomeMunicipio = (cod: string): string => (municipios as Record<string, string>)[cod] || '';

function formatarDocumento(d: string): string {
  if (/^\d{14}$/.test(d)) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (/^\d{11}$/.test(d)) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
}

const formatarCep = (c: string) => (/^\d{8}$/.test(c) ? c.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2-$3') : c);

function formatarDataHora(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : TRACO;
}

function formatarData(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : TRACO;
}

function numeroBr(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const moeda = (v: string) => (v !== '' && Number.isFinite(Number(v)) ? `R$ ${numeroBr(Number(v))}` : TRACO);
const percentual = (v: string) => (v !== '' && Number.isFinite(Number(v)) ? `${numeroBr(Number(v))}%` : TRACO);

const DESCRICOES = {
  tpEmit: { 1: 'Prestador', 2: 'Tomador', 3: 'Intermediário' } as Record<string, string>,
  cStat: { 100: 'NFS-e Gerada', 102: 'NFS-e de Decisão Judicial ou Administrativa', 103: 'NFS-e Avulsa', 107: 'NFS-e MEI' } as Record<string, string>,
  ambGer: { 1: 'Sistema Próprio do Município', 2: 'Sefin Nacional NFS-e' } as Record<string, string>,
  tpAmb: { 1: 'Produção', 2: 'Homologação' } as Record<string, string>,
  opSimpNac: { 1: 'Não Optante', 2: 'Optante - Microempreendedor Individual (MEI)', 3: 'Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)' } as Record<string, string>,
  regApTribSN: {
    1: 'Regime de apuração dos tributos federais e municipal pelo Simples Nacional',
    2: 'Regime de apuração dos tributos federais pelo SN e o ISSQN pela NFS-e conforme legislação municipal',
    3: 'Regime de apuração dos tributos federais e municipal pela NFS-e conforme legislações federal e municipal',
  } as Record<string, string>,
  regEspTrib: { 0: 'Nenhum', 1: 'Ato Cooperado (Cooperativa)', 2: 'Estimativa', 3: 'Microempresa Municipal', 4: 'Notário ou Registrador', 5: 'Profissional Autônomo', 6: 'Sociedade de Profissionais', 9: 'Outros' } as Record<string, string>,
  tribISSQN: { 1: 'Operação Tributável', 2: 'Imunidade', 3: 'Exportação de Serviço', 4: 'Não Incidência' } as Record<string, string>,
  tpRetISSQN: { 1: 'Não Retido', 2: 'Retido pelo Tomador', 3: 'Retido pelo Intermediário' } as Record<string, string>,
  tpSusp: { 1: 'Exigibilidade Suspensa por Decisão Judicial', 2: 'Exigibilidade Suspensa por Processo Administrativo' } as Record<string, string>,
  tpBM: { 1: 'Isenção', 2: 'Redução da BC em (%)', 3: 'Redução da BC em (R$)', 4: 'Alíquota Diferenciada' } as Record<string, string>,
  tpRetPisCofins: {
    0: 'PIS/COFINS/CSLL Não Retidos', 1: 'PIS/COFINS Retido', 2: 'PIS/COFINS Não Retido', 3: 'PIS/COFINS/CSLL Retidos',
    4: 'PIS/COFINS Retidos, CSLL Não Retido', 5: 'PIS Retido, COFINS/CSLL Não Retido', 6: 'COFINS Retido, PIS/CSLL Não Retido',
    7: 'PIS Não Retido, COFINS/CSLL Retidos', 8: 'PIS/COFINS Não Retidos, CSLL Retido', 9: 'COFINS Não Retido, PIS/CSLL Retidos',
  } as Record<string, string>,
  finNFSe: { 0: 'NFS-e regular' } as Record<string, string>,
};

const descricao = (mapa: Record<string, string>, codigo: string) => mapa[codigo] || (codigo ? codigo : TRACO);

export interface ParteDanfse {
  documento: string;
  inscricao: string;
  telefone: string;
  nome: string;
  municipio: string;
  ibgeCep: string;
  endereco: string;
  email: string;
}

export interface DadosDanfse {
  chave: string;
  semValidade: boolean;
  municipioEmissor: string;
  exibirMunicipio: boolean;
  ambienteGerador: string;
  tipoAmbiente: string;
  numero: string;
  competencia: string;
  dhProc: string;
  nDps: string;
  serie: string;
  dhEmi: string;
  emitente: string;
  situacao: string;
  finalidade: string;
  prestador: ParteDanfse;
  simplesNacional: string;
  regimeApuracao: string;
  tomador: ParteDanfse | null;
  destinatario: ParteDanfse | null;
  intermediario: ParteDanfse | null;
  codigoTributacao: string;
  nbs: string;
  localPrestacao: string;
  descricaoTributacao: string;
  descricaoServico: string;
  tipoTributacao: string;
  incidencia: string;
  regimeEspecial: string;
  tipoImunidade: string;
  suspensao: string;
  processoSuspensao: string;
  temBeneficio: boolean;
  beneficio: string;
  calculoBm: string;
  deducoes: string;
  descontoIncondicionado: string;
  bcIssqn: string;
  aliquota: string;
  retencaoIssqn: string;
  issqn: string;
  irrf: string;
  cp: string;
  contribuicoes: string;
  exibirApuracaoPropria: boolean;
  pis: string;
  cofins: string;
  descricaoContribuicoes: string;
  ibs: { rotulo: string; valor: string }[];
  ibsLinhas: { rotulo: string; valor: string }[][];
  valorServico: string;
  descontoCondicionado: string;
  totalRetencoes: string;
  valorLiquido: string;
  totalIbsCbs: string;
  valorLiquidoTotal: string;
  informacoes: string;
}

function lerParte(xml: string, alternativoEnd = ''): ParteDanfse {
  const end = bloco(xml, 'end') || alternativoEnd;
  const cMun = tag(end, 'cMun');
  const cep = tag(end, 'CEP') || tag(end, 'cEndPost');
  const cidadeExterior = tag(end, 'xCidade');
  const partes = [tag(end, 'xLgr'), tag(end, 'nro'), tag(end, 'xCpl'), tag(end, 'xBairro')].filter(Boolean);
  const documento = tag(xml, 'CNPJ') || tag(xml, 'CPF') || tag(xml, 'NIF');
  return {
    documento: documento ? formatarDocumento(documento) : TRACO,
    inscricao: ou(tag(xml, 'IM')),
    telefone: ou(tag(xml, 'fone')),
    nome: ou(tag(xml, 'xNome')),
    municipio: ou(nomeMunicipio(cMun), cidadeExterior),
    ibgeCep: [cMun, formatarCep(cep)].filter(Boolean).join(' / ') || TRACO,
    endereco: partes.join(', ') || TRACO,
    email: ou(tag(xml, 'email')),
  };
}

function montarTotaisAproximados(totTrib: string): string {
  const prefixo = 'Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012:';
  const pct = bloco(totTrib, 'pTotTrib');
  if (pct) return `${prefixo} Federais: ${percentual(tag(pct, 'pTotTribFed'))}; Estaduais: ${percentual(tag(pct, 'pTotTribEst'))}; Municipais: ${percentual(tag(pct, 'pTotTribMun'))}`;
  const val = bloco(totTrib, 'vTotTrib');
  if (val) return `${prefixo} Federais: ${moeda(tag(val, 'vTotTribFed'))}; Estaduais: ${moeda(tag(val, 'vTotTribEst'))}; Municipais: ${moeda(tag(val, 'vTotTribMun'))}`;
  const sn = tag(totTrib, 'pTotTribSN');
  if (sn) return `${prefixo} Simples Nacional: ${percentual(sn)}`;
  return `${prefixo} Federais: ${TRACO}; Estaduais: ${TRACO}; Municipais: ${TRACO}`;
}

/** Interpreta a NFS-e autorizada. Só usa o que está no XML. */
export function lerDadosDanfse(xml: string): DadosDanfse {
  const antesDaDps = xml.slice(0, Math.max(xml.indexOf('<DPS'), 0) || xml.length);
  const inf = bloco(xml, 'infDPS');
  const emit = bloco(antesDaDps, 'emit');
  const valoresNfse = bloco(antesDaDps, 'valores');
  const ibsNfse = bloco(xml.slice(xml.indexOf('</DPS>') >= 0 ? xml.indexOf('</DPS>') : xml.length), 'IBSCBS') || bloco(antesDaDps, 'IBSCBS');
  const ibsDps = bloco(inf, 'IBSCBS');
  const valoresDps = inf.slice(inf.lastIndexOf('<vServPrest>') >= 0 ? inf.lastIndexOf('<vServPrest>') : 0);
  const tribMun = bloco(inf, 'tribMun');
  const tribFed = bloco(inf, 'tribFed');
  const piscofins = bloco(tribFed, 'piscofins');
  const prest = bloco(inf, 'prest');
  const regTrib = bloco(prest, 'regTrib');
  const serv = bloco(inf, 'serv');
  const cServ = bloco(serv, 'cServ');
  const infoCompl = bloco(serv, 'infoCompl');
  const desconto = bloco(inf, 'vDescCondIncond');

  // Com tpEmit=1 a DPS não traz nome nem endereço: eles vêm do grupo emit da NFS-e.
  const parteEmit = lerParte(emit, bloco(emit, 'enderNac'));
  const partePrest = lerParte(prest);
  const prestador: ParteDanfse = {
    documento: partePrest.documento !== TRACO ? partePrest.documento : parteEmit.documento,
    inscricao: partePrest.inscricao !== TRACO ? partePrest.inscricao : parteEmit.inscricao,
    telefone: partePrest.telefone !== TRACO ? partePrest.telefone : parteEmit.telefone,
    nome: partePrest.nome !== TRACO ? partePrest.nome : parteEmit.nome,
    municipio: partePrest.municipio !== TRACO ? partePrest.municipio : parteEmit.municipio,
    ibgeCep: partePrest.ibgeCep !== TRACO ? partePrest.ibgeCep : parteEmit.ibgeCep,
    endereco: partePrest.endereco !== TRACO ? partePrest.endereco : parteEmit.endereco,
    email: partePrest.email !== TRACO ? partePrest.email : parteEmit.email,
  };

  const toma = bloco(inf, 'toma');
  const interm = bloco(inf, 'interm');
  const dest = bloco(ibsDps, 'dest');

  const cTribNac = tag(cServ, 'cTribNac');
  const cTribMun = tag(cServ, 'cTribMun');
  const codigoNac = cTribNac.replace(/^(\d{2})(\d{2})(\d{2})$/, '$1.$2.$3');
  const nbs = tag(cServ, 'cNBS');
  const cLocPrestacao = tag(serv, 'cLocPrestacao');
  const cLocIncid = tag(antesDaDps, 'cLocIncid');
  const ufDe = (cod: string) => nomeMunicipio(cod).split(' / ')[1] || '';
  const juntarLocal = (nome: string, cod: string, pais: string) => {
    const uf = ufDe(cod);
    if (!nome && !pais) return TRACO;
    return [nome, uf, pais || 'BR'].filter(Boolean).join(' / ');
  };

  const tpRet = tag(piscofins, 'tpRetPisCofins');
  const vRetCsll = tag(tribFed, 'vRetCSLL');
  const vPis = tag(piscofins, 'vPis');
  const vCofins = tag(piscofins, 'vCofins');
  // O código 1 é de transição: nele vPis/vCofins eram os valores retidos (item 2.4.5).
  const contribuicoes = tpRet === '1'
    ? moeda(String(Number(vRetCsll || 0) + Number(vPis || 0) + Number(vCofins || 0)))
    : moeda(vRetCsll);

  const competencia = tag(inf, 'dCompet');
  const vIbs = bloco(ibsNfse, 'valores');
  const uf = bloco(vIbs, 'uf');
  const mun = bloco(vIbs, 'mun');
  const fed = bloco(vIbs, 'fed');
  const tot = bloco(ibsNfse, 'totCIBS');
  const gIbs = bloco(tot, 'gIBS');
  const cbsTotal = tag(bloco(tot, 'gCBS'), 'vCBS');
  const ibsTotal = tag(gIbs, 'vIBSTot');
  const classe = bloco(ibsDps, 'trib');
  const cst = tag(classe, 'CST');
  const cClassTrib = tag(classe, 'cClassTrib');
  const cLocalidade = tag(ibsNfse, 'cLocalidadeIncid');
  const xLocalidade = tag(ibsNfse, 'xLocalidadeIncid');
  const operacao = [tag(ibsDps, 'cIndOp'), cLocalidade, xLocalidade && [xLocalidade, ufDe(cLocalidade)].filter(Boolean).join(' / ')].filter(Boolean).join(' / ');
  const temIbs = !!vIbs;
  const exclusoes = temIbs
    ? moeda(String(Number(tag(desconto, 'vDescIncond') || 0) + Number(tag(vIbs, 'vCalcReeRepRes') || 0) + Number(tag(valoresNfse, 'vISSQN') || 0) + Number(vPis || 0) + Number(vCofins || 0)))
    : TRACO;
  const barra = (...p: string[]) => (p.every(x => x === '') ? TRACO : p.map(x => (x === '' ? TRACO : percentual(x))).join(' / '));

  const info = [
    tag(infoCompl, 'xInfComp') && `Inf. Cont.: ${tag(infoCompl, 'xInfComp')}`,
    tag(inf, 'chSubstda') && `NFS-e Subst.: ${tag(inf, 'chSubstda')}`,
    tag(serv, 'docRef') && `Doc. Ref.: ${tag(serv, 'docRef')}`,
    tag(serv, 'cObra') && `Cod. Obra: ${tag(serv, 'cObra')}`,
    tag(ibsDps, 'inscImobFisc') && `Insc. Imob.: ${tag(ibsDps, 'inscImobFisc')}`,
    tag(serv, 'idAtvEvt') && `Cod. Evt.: ${tag(serv, 'idAtvEvt')}`,
    tag(infoCompl, 'idDocTec') && `Doc. Tec.: ${tag(infoCompl, 'idDocTec')}`,
    tag(infoCompl, 'xPed') && `Núm. Ped.: ${tag(infoCompl, 'xPed')}`,
    tag(infoCompl, 'xItemPed') && `Item Ped.: ${tag(infoCompl, 'xItemPed')}`,
    tag(antesDaDps, 'xOutInf') && `Inf. A. T. Mun.: ${tag(antesDaDps, 'xOutInf')}`,
  ].filter(Boolean).join(' | ');

  const totTrib = bloco(inf, 'totTrib');
  const totais = montarTotaisAproximados(totTrib);

  const descIncond = moeda(tag(desconto, 'vDescIncond'));
  const chave = xml.match(/<infNFSe[^>]*\sId="NFS(\d{50})"/)?.[1] || tag(xml, 'chNFSe');
  const tpAmb = tag(inf, 'tpAmb');
  const cEmit = tag(bloco(emit, 'enderNac'), 'cMun');
  const ufEmit = tag(bloco(emit, 'enderNac'), 'UF') || ufDe(tag(inf, 'cLocEmi') || cEmit);

  return {
    chave: chave || TRACO,
    semValidade: tpAmb === '2',
    municipioEmissor: [tag(antesDaDps, 'xLocEmi'), ufEmit].filter(Boolean).join(' / ') || TRACO,
    // A norma manda não exibir o município quando o item do código nacional for 99.
    exibirMunicipio: !cTribNac.startsWith('99'),
    ambienteGerador: descricao(DESCRICOES.ambGer, tag(antesDaDps, 'ambGer')),
    tipoAmbiente: descricao(DESCRICOES.tpAmb, tpAmb),
    numero: ou(tag(antesDaDps, 'nNFSe')),
    competencia: formatarData(competencia),
    dhProc: formatarDataHora(tag(antesDaDps, 'dhProc')),
    nDps: ou(tag(inf, 'nDPS')),
    serie: ou(tag(inf, 'serie')),
    dhEmi: formatarDataHora(tag(inf, 'dhEmi')),
    emitente: descricao(DESCRICOES.tpEmit, tag(inf, 'tpEmit')),
    situacao: descricao(DESCRICOES.cStat, tag(antesDaDps, 'cStat')),
    finalidade: descricao(DESCRICOES.finNFSe, tag(inf, 'finNFSe') || '0'),
    prestador,
    simplesNacional: descricao(DESCRICOES.opSimpNac, tag(regTrib, 'opSimpNac')),
    regimeApuracao: descricao(DESCRICOES.regApTribSN, tag(regTrib, 'regApTribSN')),
    tomador: toma ? lerParte(toma) : null,
    destinatario: dest ? lerParte(dest) : null,
    intermediario: interm ? lerParte(interm) : null,
    codigoTributacao: [codigoNac, cTribMun].filter(Boolean).join(' / ') || TRACO,
    nbs: nbs ? nbs.replace(/^(\d)(\d{4})(\d{2})(\d{2})$/, '$1.$2.$3.$4') : TRACO,
    localPrestacao: juntarLocal(tag(antesDaDps, 'xLocPrestacao'), cLocPrestacao, tag(serv, 'cPaisPrestacao')),
    descricaoTributacao: tag(antesDaDps, 'xTribMun') || tag(antesDaDps, 'xTribNac') || TRACO,
    descricaoServico: ou(tag(cServ, 'xDescServ')),
    tipoTributacao: descricao(DESCRICOES.tribISSQN, tag(tribMun, 'tribISSQN')),
    incidencia: juntarLocal(tag(antesDaDps, 'xLocIncid'), cLocIncid, tag(tribMun, 'cPaisResult')),
    regimeEspecial: descricao(DESCRICOES.regEspTrib, tag(regTrib, 'regEspTrib')),
    tipoImunidade: ou(tag(tribMun, 'tpImunidade')),
    suspensao: descricao(DESCRICOES.tpSusp, tag(bloco(tribMun, 'exigSusp'), 'tpSusp')),
    processoSuspensao: ou(tag(bloco(tribMun, 'exigSusp'), 'nProcesso')),
    temBeneficio: !!(tag(valoresNfse, 'tpBM') || tag(valoresNfse, 'vCalcBM') || tag(bloco(tribMun, 'BM'), 'vRedBCBM') || tag(valoresDps, 'vDR') || tag(valoresNfse, 'vCalcDR') || tag(desconto, 'vDescIncond')),
    beneficio: descricao(DESCRICOES.tpBM, tag(valoresNfse, 'tpBM')),
    calculoBm: moeda(tag(valoresNfse, 'vCalcBM') || tag(bloco(tribMun, 'BM'), 'vRedBCBM')),
    deducoes: moeda(tag(valoresDps, 'vDR') || tag(valoresNfse, 'vCalcDR')),
    descontoIncondicionado: descIncond,
    bcIssqn: moeda(tag(valoresNfse, 'vBC')),
    aliquota: percentual(tag(valoresNfse, 'pAliqAplic')),
    retencaoIssqn: descricao(DESCRICOES.tpRetISSQN, tag(tribMun, 'tpRetISSQN')),
    issqn: moeda(tag(valoresNfse, 'vISSQN')),
    irrf: moeda(tag(tribFed, 'vRetIRRF')),
    cp: moeda(tag(tribFed, 'vRetCP')),
    contribuicoes,
    // Nota 6 da NT 008: esta linha só vale para competências até o fim de 2026.
    exibirApuracaoPropria: !competencia || competencia < '2027-01-01',
    pis: tpRet === '1' ? moeda('0') : moeda(vPis),
    cofins: tpRet === '1' ? moeda('0') : moeda(vCofins),
    descricaoContribuicoes: descricao(DESCRICOES.tpRetPisCofins, tpRet),
    ibs: [
      { rotulo: 'CST / cClassTrib', valor: [cst, cClassTrib].filter(Boolean).join(' / ') || TRACO },
      { rotulo: 'Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF', valor: operacao || TRACO },
    ],
    ibsLinhas: [
      [
        { rotulo: 'Exclusões e Reduções da Base de Cálculo', valor: exclusoes },
        { rotulo: 'Base de Cálculo Após Exclusões e Reduções', valor: moeda(tag(vIbs, 'vBC')) },
        { rotulo: 'Red. Alíquota IBS / Red. Alíquota CBS', valor: barra(tag(uf, 'pRedAliqUF'), tag(mun, 'pRedAliqMun'), tag(fed, 'pRedAliqCBS')) },
        { rotulo: 'Alíquota-IBS UF / IBS Mun', valor: barra(tag(uf, 'pIBSUF'), tag(mun, 'pIBSMun')) },
      ],
      [
        { rotulo: 'Alíq. Efetiva Municipal-IBS', valor: percentual(tag(mun, 'pAliqEfetMun')) },
        { rotulo: 'Valor Apurado Municipal-IBS', valor: moeda(tag(bloco(gIbs, 'gIBSMunTot'), 'vIBSMun')) },
        { rotulo: 'Alíq. Efetiva Estadual-IBS', valor: percentual(tag(uf, 'pAliqEfetUF')) },
        { rotulo: 'Valor Apurado Estadual-IBS', valor: moeda(tag(bloco(gIbs, 'gIBSUFTot'), 'vIBSUF')) },
      ],
      [
        { rotulo: 'Valor Total Apurado-IBS', valor: moeda(ibsTotal) },
        { rotulo: 'Alíquota-CBS', valor: percentual(tag(fed, 'pCBS')) },
        { rotulo: 'Alíquota Efetiva-CBS', valor: percentual(tag(fed, 'pAliqEfetCBS')) },
        { rotulo: 'Valor Total Apurado-CBS', valor: moeda(cbsTotal) },
      ],
    ],
    valorServico: moeda(tag(valoresDps, 'vServ')),
    descontoCondicionado: moeda(tag(desconto, 'vDescCond')),
    totalRetencoes: moeda(tag(valoresNfse, 'vTotalRet')),
    valorLiquido: moeda(tag(valoresNfse, 'vLiq')),
    totalIbsCbs: ibsTotal || cbsTotal ? moeda(String(Number(ibsTotal || 0) + Number(cbsTotal || 0))) : TRACO,
    valorLiquidoTotal: moeda(tag(tot, 'vTotNF')),
    informacoes: [info.slice(0, 1997) + (info.length > 1997 ? '...' : ''), totais].filter(Boolean).join('\n'),
  };
}

// ------------------------------------------------------------
// Desenho
// ------------------------------------------------------------

const X = [0.3, 5.41, 10.51, 15.62];
const LARGURA = 20.4;
const COL = 5.09;
const ESQ = 0.3;
const DIR = ESQ + LARGURA;
const CINZA_5 = 242; // 5% de densidade
const ALTURA_LINHA = 0.63;
const Y_CANHOTO = 28.1;
const ALTURA_CANHOTO = 0.67;

/**
 * Helvetica é a fonte padrão do PDF, com as mesmas métricas da Arial. A norma pede
 * Arial nos títulos e Microsoft Sans Serif nos conteúdos, que não podem ser embutidas
 * sem licença; o desenho é o mesmo.
 */
export function gerarDanfsePdf(d: DadosDanfse, opcoes: { logoPng: Buffer; qrPng: Buffer; marcaDagua: MarcaDagua }): Buffer {
  const pdf = new jsPDF({ unit: 'cm', format: 'a4', orientation: 'portrait', compress: true });
  const PT = 0.03528; // 1 ponto em centímetros

  const texto = (t: string, x: number, y: number, pts: number, estilo: 'bold' | 'normal' = 'normal', opc?: { align?: 'center' | 'left' | 'right'; maxWidth?: number }) => {
    pdf.setFont('helvetica', estilo);
    pdf.setFontSize(pts);
    pdf.text(t, x, y, opc?.align ? { align: opc.align } : undefined);
  };

  /** Corta em uma linha, com reticências, como a norma orienta. */
  const caber = (t: string, largura: number, pts: number, estilo: 'bold' | 'normal' = 'normal') => {
    pdf.setFont('helvetica', estilo);
    pdf.setFontSize(pts);
    if (pdf.getTextWidth(t) <= largura) return t;
    let s = t;
    while (s.length > 1 && pdf.getTextWidth(`${s}...`) > largura) s = s.slice(0, -1);
    return `${s}...`;
  };

  const linhaH = (y: number) => {
    pdf.setLineWidth(0.5 * PT);
    pdf.setDrawColor(0);
    pdf.line(ESQ, y, DIR, y);
  };

  const sombra = (x: number, y: number, l: number, a: number) => {
    pdf.setFillColor(CINZA_5, CINZA_5, CINZA_5);
    pdf.rect(x, y, l, a, 'F');
  };

  const campo = (rotulo: string, valor: string, x: number, y: number, largura = COL) => {
    pdf.setTextColor(0);
    texto(caber(rotulo, largura - 0.1, 6, 'bold'), x + 0.05, y + 0.23, 6, 'bold');
    texto(caber(valor, largura - 0.1, 7), x + 0.05, y + 0.51, 7);
  };

  const tituloBloco = (titulo: string, y: number) => {
    sombra(ESQ, y, COL, ALTURA_LINHA - 0.02);
    pdf.setTextColor(0);
    texto(caber(titulo, COL - 0.1, 7, 'bold'), ESQ + 0.05, y + 0.27, 7, 'bold');
  };

  const aviso = (mensagem: string, y: number) => {
    sombra(ESQ, y, LARGURA, 0.32);
    pdf.setTextColor(0);
    texto(mensagem, ESQ + LARGURA / 2, y + 0.23, 7, 'bold', { align: 'center' });
    linhaH(y + 0.32);
    return y + 0.32;
  };

  // A marca d'água vem primeiro para ficar atrás do texto.
  if (opcoes.marcaDagua) {
    pdf.setTextColor(166); // K35
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(90);
    pdf.text(opcoes.marcaDagua, 10.5, 16.5, { align: 'center', angle: 55 });
    pdf.setTextColor(0);
  }

  // Borda da página: 1 ponto, dentro da margem de 0,15 a 0,20 cm.
  pdf.setLineWidth(1 * PT);
  pdf.setDrawColor(0);
  pdf.rect(0.2, 0.2, 20.6, 29.3);

  // Cabeçalho
  sombra(ESQ, 0.3, LARGURA, 1.16);
  pdf.addImage(opcoes.logoPng, 'PNG', 0.49, 0.44, 4.0, 0.81);
  pdf.setTextColor(0);
  const centro = 5.41 + 10.19 / 2;
  texto('DANFSe v2.0', centro, d.semValidade ? 0.62 : 0.72, 9, 'bold', { align: 'center' });
  texto('Documento Auxiliar da NFS-e', centro, d.semValidade ? 0.98 : 1.1, 9, 'bold', { align: 'center' });
  if (d.semValidade) {
    pdf.setTextColor(255, 0, 0);
    texto('NFS-e SEM VALIDADE JURÍDICA', centro, 1.34, 9, 'bold', { align: 'center' });
    pdf.setTextColor(0);
  }
  if (d.exibirMunicipio) texto(caber(`Município: ${d.municipioEmissor}`, 5.0, 8), 15.62, 0.67, 8);
  texto(caber(`Ambiente Gerador: ${d.ambienteGerador}`, 5.0, 6), 15.62, 1.1, 6);
  texto(caber(`Tipo de Ambiente: ${d.tipoAmbiente}`, 5.0, 6), 15.62, 1.34, 6);
  linhaH(1.46);

  // Identificação: títulos com 7 pontos, em caixa alta (item 2.4.2).
  const identificacao = (rotulo: string, valor: string, x: number, y: number, largura = COL) => {
    texto(rotulo, x + 0.05, y + 0.26, 7, 'bold');
    texto(caber(valor, largura - 0.1, 7), x + 0.05, y + 0.56, 7);
  };
  identificacao('CHAVE DE ACESSO DA NFS-E', d.chave, ESQ, 1.48, 15.3);
  identificacao('NÚMERO DA NFS-E', d.numero, X[0], 2.27);
  identificacao('COMPETÊNCIA DA NFS-E', d.competencia, X[1], 2.27);
  identificacao('DATA E HORA DA EMISSÃO DA NFS-E', d.dhProc, X[2], 2.27);
  identificacao('NÚMERO DA DPS', d.nDps, X[0], 2.96);
  identificacao('SÉRIE DA DPS', d.serie, X[1], 2.96);
  identificacao('DATA E HORA DA EMISSÃO DA DPS', d.dhEmi, X[2], 2.96);
  sombra(ESQ, 3.65, COL, 0.67);
  pdf.setTextColor(0);
  identificacao('EMITENTE DA NFS-E', d.emitente, X[0], 3.65);
  identificacao('SITUAÇÃO DA NFS-E', d.situacao, X[1], 3.65);
  identificacao('FINALIDADE', d.finalidade, X[2], 3.65);
  pdf.addImage(opcoes.qrPng, 'PNG', 17.48, 1.55, 1.7, 1.7);
  ['A autenticidade desta NFS-e pode ser verificada', 'pela leitura deste código QR ou pela consulta da', 'chave de acesso no portal nacional da NFS-e']
    .forEach((l, i) => texto(l, 15.8, 3.5 + i * 0.25, 6));
  linhaH(4.34);

  let y = 4.34;

  const parte = (titulo: string, p: ParteDanfse, comInscricao: boolean) => {
    tituloBloco(titulo, y);
    campo('CNPJ / CPF / NIF', p.documento, X[1], y);
    if (comInscricao) campo('Indicador Municipal (Inscrição)', p.inscricao, X[2], y);
    campo('Telefone', p.telefone, X[3], y);
    y += ALTURA_LINHA;
    campo('Nome / Nome Empresarial', p.nome, X[0], y, 10.19);
    campo('Município / Sigla UF', p.municipio, X[2], y);
    campo('Código IBGE / CEP', p.ibgeCep, X[3], y);
    y += ALTURA_LINHA;
    campo('Endereço', p.endereco, X[0], y, 10.19);
    campo('E-mail', p.email, X[2], y, 10.19);
    y += ALTURA_LINHA;
  };

  parte('PRESTADOR / FORNECEDOR', d.prestador, true);
  campo('Simples Nacional na Data de Competência', d.simplesNacional, X[0], y);
  campo('Regime de Apuração Tributária pelo SN', d.regimeApuracao, X[1], y, 15.3);
  y += ALTURA_LINHA;
  linhaH(y);

  if (d.tomador) { parte('TOMADOR / ADQUIRENTE', d.tomador, true); linhaH(y); }
  else y = aviso('TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e', y);

  if (d.destinatario) { parte('DESTINATÁRIO DA OPERAÇÃO', d.destinatario, false); linhaH(y); }
  else y = aviso(d.tomador ? 'O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO' : 'DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e', y);

  if (d.intermediario) { parte('INTERMEDIÁRIO DA OPERAÇÃO', d.intermediario, true); linhaH(y); }
  else y = aviso('INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e', y);

  tituloBloco('SERVIÇO PRESTADO', y);
  campo('Código de Tributação Nacional / Municipal', d.codigoTributacao, X[1], y);
  campo('Código da NBS', d.nbs, X[2], y);
  campo('Local da Prestação / Sigla UF / País', d.localPrestacao, X[3], y);
  y += ALTURA_LINHA;
  pdf.setTextColor(0);
  texto(caber(d.descricaoTributacao, LARGURA - 0.1, 7), ESQ + 0.05, y + 0.25, 7);
  y += 0.38;

  // Blocos de altura fixa abaixo da descrição: o espaço que sobra vai para a descrição.
  const alturaMunicipal = ALTURA_LINHA * (d.temBeneficio ? 4 : 3);
  const alturaFederal = ALTURA_LINHA * (d.exibirApuracaoPropria ? 2 : 1);
  const alturaIbs = ALTURA_LINHA * 4;
  const alturaTotal = 0.67 * 2;
  const fixos = alturaMunicipal + alturaFederal + alturaIbs + alturaTotal;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  const larguraTexto = LARGURA - 0.1;
  const linhasInfo: string[] = pdf.splitTextToSize(d.informacoes, larguraTexto);
  const ALT_LINHA_TEXTO = 0.27;
  const alturaInfo = Math.max(0.39 + linhasInfo.length * ALT_LINHA_TEXTO + 0.1, 1.0);
  const disponivel = Y_CANHOTO - y - fixos - alturaInfo;

  texto('Descrição do Serviço', ESQ + 0.05, y + 0.23, 6, 'bold');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  const descricaoCortada = d.descricaoServico.length > 1297 ? `${d.descricaoServico.slice(0, 1297)}...` : d.descricaoServico;
  const linhasDescricao: string[] = pdf.splitTextToSize(descricaoCortada, larguraTexto);
  const cabem = Math.max(1, Math.floor((disponivel - 0.32) / ALT_LINHA_TEXTO));
  const visiveis = linhasDescricao.slice(0, cabem);
  if (linhasDescricao.length > cabem) visiveis[cabem - 1] = caber(`${visiveis[cabem - 1]}...`, larguraTexto, 7);
  visiveis.forEach((l, i) => texto(l, ESQ + 0.05, y + 0.5 + i * ALT_LINHA_TEXTO, 7));
  y += Math.max(disponivel, 0.63);
  linhaH(y);

  // Tributação municipal
  tituloBloco('TRIBUTAÇÃO MUNICIPAL (ISSQN)', y);
  campo('Tipo de Tributação do ISSQN', d.tipoTributacao, X[1], y);
  campo('Município / Sigla UF / País de Incidência do ISSQN', d.incidencia, X[2], y, 10.19);
  y += ALTURA_LINHA;
  campo('Regime Especial de Tributação do ISSQN', d.regimeEspecial, X[0], y);
  campo('Tipo de Imunidade do ISSQN', d.tipoImunidade, X[1], y);
  campo('Suspensão da Exigibilidade do ISSQN', d.suspensao, X[2], y);
  campo('Número Processo Suspensão', d.processoSuspensao, X[3], y);
  y += ALTURA_LINHA;
  if (d.temBeneficio) {
    campo('Benefício Municipal', d.beneficio, X[0], y);
    campo('Cálculo do BM', d.calculoBm, X[1], y);
    campo('Total Deduções/Reduções', d.deducoes, X[2], y);
    campo('Desconto Incondicionado', d.descontoIncondicionado, X[3], y);
    y += ALTURA_LINHA;
  }
  campo('BC ISSQN', d.bcIssqn, X[0], y);
  campo('Alíquota Aplicada', d.aliquota, X[1], y);
  campo('Retenção do ISSQN', d.retencaoIssqn, X[2], y);
  campo('ISSQN Apurado', d.issqn, X[3], y);
  y += ALTURA_LINHA;
  linhaH(y);

  // Tributação federal
  tituloBloco('TRIBUTAÇÃO FEDERAL (EXCETO CBS)', y);
  campo('IRRF', d.irrf, X[1], y);
  campo('Contribuição Previdenciária-Retida', d.cp, X[2], y);
  campo('Contribuições Sociais-Retidas', d.contribuicoes, X[3], y);
  y += ALTURA_LINHA;
  if (d.exibirApuracaoPropria) {
    campo('PIS-Débito Apuração Própria', d.pis, X[0], y);
    campo('COFINS-Débito Apuração Própria', d.cofins, X[1], y);
    campo('Descrição Contrib. Sociais-Retidas', d.descricaoContribuicoes, X[2], y, 10.19);
    y += ALTURA_LINHA;
  }
  linhaH(y);

  // IBS/CBS
  tituloBloco('TRIBUTAÇÃO IBS / CBS', y);
  campo(d.ibs[0].rotulo, d.ibs[0].valor, X[1], y);
  campo(d.ibs[1].rotulo, d.ibs[1].valor, X[2], y, 10.19);
  y += ALTURA_LINHA;
  for (const linha of d.ibsLinhas) {
    linha.forEach((c, i) => campo(c.rotulo, c.valor, X[i], y));
    y += ALTURA_LINHA;
  }
  linhaH(y);

  // Valor total: títulos de destaque com 7 pontos, como no Anexo I.
  const destaque = (rotulo: string, valor: string, x: number, yy: number) => {
    texto(caber(rotulo, COL - 0.1, 7, 'bold'), x + 0.05, yy + 0.26, 7, 'bold');
    texto(caber(valor, COL - 0.1, 7), x + 0.05, yy + 0.55, 7);
  };
  sombra(ESQ, y, COL, 0.65);
  pdf.setTextColor(0);
  texto('VALOR TOTAL DA NFS-E', ESQ + 0.05, y + 0.27, 7, 'bold');
  destaque('VALOR DA OPERAÇÃO / SERVIÇO', d.valorServico, X[1], y);
  campo('Desconto Incondicionado', d.descontoIncondicionado, X[2], y);
  campo('Desconto Condicionado', d.descontoCondicionado, X[3], y);
  y += 0.67;
  campo('Total das Retenções (ISSQN / Federais)', d.totalRetencoes, X[0], y);
  destaque('VALOR LÍQUIDO DA NFS-e', d.valorLiquido, X[1], y);
  campo('Total do IBS/CBS', d.totalIbsCbs, X[2], y);
  sombra(X[3], y, DIR - X[3], 0.65);
  pdf.setTextColor(0);
  destaque('VALOR LÍQUIDO DA NFS-e + IBS/CBS', d.valorLiquidoTotal, X[3], y);
  y += 0.67;
  linhaH(y);

  // Informações complementares
  texto('INFORMAÇÕES COMPLEMENTARES', ESQ + 0.05, y + 0.28, 7, 'bold');
  linhasInfo.forEach((l, i) => texto(l, ESQ + 0.05, y + 0.58 + i * ALT_LINHA_TEXTO, 7));

  // Canhoto
  linhaH(Y_CANHOTO);
  pdf.setLineWidth(0.5 * PT);
  pdf.rect(ESQ, Y_CANHOTO, LARGURA, ALTURA_CANHOTO);
  pdf.line(X[1], Y_CANHOTO, X[1], Y_CANHOTO + ALTURA_CANHOTO);
  pdf.line(X[2], Y_CANHOTO, X[2], Y_CANHOTO + ALTURA_CANHOTO);
  texto('DATA CIENTIFICAÇÃO:', X[0] + 0.05, Y_CANHOTO + 0.26, 7, 'bold');
  texto('IDENTIFICAÇÃO E ASSINATURA', X[1] + 0.05, Y_CANHOTO + 0.26, 7, 'bold');
  texto('Nº NFS-e / CHAVE NFS-e', X[2] + 0.05, Y_CANHOTO + 0.26, 7, 'bold');
  texto(caber(`${d.numero} / ${d.chave}`, 10.1, 7), X[2] + 0.05, Y_CANHOTO + 0.56, 7);

  return Buffer.from(pdf.output('arraybuffer'));
}

export const urlConsultaPublica = (chave: string) => `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${chave}`;

/** O evento e105102 é o cancelamento por substituição: a norma manda outra marca d'água. */
export function marcaDaguaDaNota(status: string, eventoXml: string | null | undefined): MarcaDagua {
  if (status !== 'cancelada') return null;
  return eventoXml && /<e105102[\s/>]/.test(eventoXml) ? 'SUBSTITUÍDA' : 'CANCELADA';
}
