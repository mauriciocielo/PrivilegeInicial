// ============================================================
// NFS-e NACIONAL — empresas emissoras por procuração
// ============================================================
// Nenhuma API lista quem outorgou procuração, e a procuração não traz IBGE nem
// códigos de serviço. Por isso os dados saem das notas que a empresa já emitiu,
// que são o que o município de fato aceitou, com o cadastro público do CNPJ como
// alternativa para quem nunca emitiu. Regras puras, sem banco nem rede.

import { apenasDigitos, cnpjValido } from './dps';
import { dividirRetencaoAgrupada } from './retencao';

/** Empresa que só emite nota: não é cliente e fica fora das demais telas. */
export const TIPO_EMPRESA_SO_EMISSOR = 'emissor_nfse';

/** Mesma condição de acessoEmissaoNegado: fora dela, o cliente vinculado não consegue emitir. */
export function emiteViaProcuracao(
  config?: { usarProcuracao?: boolean | null; procuracaoStatus?: string | null } | null,
): boolean {
  return !!config && config.usarProcuracao !== false && config.procuracaoStatus === 'ativa';
}

export const SERIE_PADRAO = 10;

export function extrairCnpjs(texto: string): { validos: string[]; invalidos: string[] } {
  // Só o formato exato de CNPJ: separadores soltos emendariam números de linhas diferentes.
  const candidatos = texto.match(/(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/g) || [];
  const validos = new Set<string>();
  const invalidos = new Set<string>();
  for (const candidato of candidatos) {
    const digitos = apenasDigitos(candidato);
    if (cnpjValido(digitos)) validos.add(digitos);
    else invalidos.add(candidato.trim());
  }
  return { validos: [...validos], invalidos: [...invalidos] };
}

export function formatarCnpj(cnpj: string): string {
  return apenasDigitos(cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export interface ServicoConhecido {
  cTribNac: string;
  cTribMun: string | null;
  cNbs: string | null;
  descricao: string;
  quantidade: number;
}

export interface DadosEmissor {
  notasEmitidas: number;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  codigoMunicipio: string | null;
  inscricaoMunicipal: string | null;
  opSimpNac: number | null;
  regApTribSN: number | null;
  regEspTrib: number | null;
  piscofinsCst: string | null;
  tpRetPisCofins: string | null;
  pTotTribSN: number | null;
  seriesUsadas: string[];
  servicos: ServicoConhecido[];
}

const desescapar = (v: string) => v
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function tag(xml: string, nome: string): string | null {
  const achado = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([^<]*)</${nome}>`));
  return achado?.[1].trim() ? desescapar(achado[1].trim()) : null;
}

const bloco = (xml: string, nome: string) => xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>[\\s\\S]*?</${nome}>`))?.[0] || '';

const inteiro = (v: string | null) => (v !== null && /^\d+$/.test(v) ? Number(v) : null);

/**
 * Lê os XMLs de NFS-e, do mais recente para o mais antigo. A caixa traz também o
 * que a empresa recebeu como tomador: só contam as notas em que ela é a prestadora.
 */
export function extrairDadosEmissor(xmlsDoMaisRecente: string[], cnpj: string): DadosEmissor {
  const doc = apenasDigitos(cnpj);
  const dados: DadosEmissor = {
    notasEmitidas: 0, razaoSocial: null, nomeFantasia: null, codigoMunicipio: null, inscricaoMunicipal: null,
    opSimpNac: null, regApTribSN: null, regEspTrib: null, piscofinsCst: null, tpRetPisCofins: null, pTotTribSN: null,
    seriesUsadas: [], servicos: [],
  };
  const series = new Set<string>();
  const servicos = new Map<string, ServicoConhecido>();

  for (const xml of xmlsDoMaisRecente) {
    const emit = bloco(xml, 'emit');
    const inf = bloco(xml, 'infDPS');
    const prest = bloco(inf, 'prest');
    if ((tag(prest, 'CNPJ') || tag(emit, 'CNPJ')) !== doc) continue;

    // A nota mais recente define o estado atual: é a primeira a passar por aqui.
    if (dados.notasEmitidas === 0) {
      const regTrib = bloco(prest, 'regTrib');
      const piscofins = bloco(inf, 'piscofins');
      const pTotTribSN = tag(inf, 'pTotTribSN');
      dados.razaoSocial = tag(emit, 'xNome');
      dados.nomeFantasia = tag(emit, 'xFant');
      dados.codigoMunicipio = tag(inf, 'cLocEmi') || tag(bloco(emit, 'enderNac'), 'cMun');
      dados.inscricaoMunicipal = tag(prest, 'IM');
      dados.opSimpNac = inteiro(tag(regTrib, 'opSimpNac'));
      dados.regApTribSN = inteiro(tag(regTrib, 'regApTribSN'));
      dados.regEspTrib = inteiro(tag(regTrib, 'regEspTrib'));
      dados.piscofinsCst = tag(piscofins, 'CST');
      dados.tpRetPisCofins = tag(piscofins, 'tpRetPisCofins');
      dados.pTotTribSN = pTotTribSN !== null && !Number.isNaN(Number(pTotTribSN)) ? Number(pTotTribSN) : null;
    }
    dados.notasEmitidas++;

    const serie = tag(inf, 'serie');
    if (serie) series.add(String(Number(serie)));

    const cServ = bloco(inf, 'cServ');
    const cTribNac = tag(cServ, 'cTribNac');
    if (cTribNac) {
      const cTribMun = tag(cServ, 'cTribMun');
      const cNbs = tag(cServ, 'cNBS');
      const chave = [cTribNac, cTribMun, cNbs].join('|');
      const existente = servicos.get(chave);
      if (existente) existente.quantidade++;
      else servicos.set(chave, { cTribNac, cTribMun, cNbs, descricao: tag(cServ, 'xDescServ') || '', quantidade: 1 });
    }
  }

  dados.seriesUsadas = [...series];
  dados.servicos = [...servicos.values()].sort((a, b) => b.quantidade - a.quantidade);
  return dados;
}

export function mesclarServicos(atuais: ServicoConhecido[], novos: ServicoConhecido[]): ServicoConhecido[] {
  const chave = (s: ServicoConhecido) => [s.cTribNac, s.cTribMun, s.cNbs].join('|');
  const mapa = new Map(atuais.map(s => [chave(s), { ...s }]));
  for (const s of novos) {
    const existente = mapa.get(chave(s));
    if (existente) existente.quantidade += s.quantidade;
    else mapa.set(chave(s), { ...s });
  }
  return [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade);
}

export interface NotaEmitida {
  chaveAcesso: string;
  ambiente: 'producao' | 'homologacao';
  numero: string;
  serie: string;
  nDps: string | null;
  idDps: string | null;
  dataEmissao: string;
  dataCompetencia: string;
  prestadorRazaoSocial: string | null;
  prestadorInscricaoMunicipal: string | null;
  tomadorDocumento: string;
  tomadorRazaoSocial: string;
  tomadorEmail: string | null;
  tomadorInscricaoMunicipal: string | null;
  tomadorCodigoMunicipio: string | null;
  tomadorCep: string | null;
  tomadorEndereco: string | null;
  tomadorNumero: string | null;
  tomadorBairro: string | null;
  codigoServico: string;
  cTribMun: string | null;
  cNbs: string | null;
  discriminacao: string;
  municipioPrestacao: string | null;
  valorServicos: number;
  valorBaseCalculo: number;
  aliquotaIss: number;
  valorIss: number;
  valorLiquido: number;
  issRetido: boolean;
  valorIr: number;
  valorInss: number;
  valorPis: number;
  valorCofins: number;
  valorCsll: number;
}

const valorDe = (xml: string, nome: string) => {
  const v = Number(tag(xml, nome));
  return Number.isFinite(v) ? v : 0;
};

export interface NotaLida extends NotaEmitida {
  prestadorDocumento: string;
  papel: 'prestado' | 'tomado';
}

/**
 * Lê uma NFS-e autorizada do ADN e identifica se a empresa é a prestadora
 * ("prestado") ou a tomadora ("tomado"). Devolve null se não for nenhuma das duas
 * ou se faltar o que identifica a nota.
 */
export function lerNotaAdn(xml: string, cnpj: string): NotaLida | null {
  const doc = apenasDigitos(cnpj);
  const emit = bloco(xml, 'emit');
  const inf = bloco(xml, 'infDPS');
  const prest = bloco(inf, 'prest');
  const toma = bloco(inf, 'toma');

  const prestDoc = apenasDigitos(tag(prest, 'CNPJ') || tag(emit, 'CNPJ') || tag(prest, 'CPF') || tag(emit, 'CPF') || '');
  const tomaDoc = apenasDigitos(tag(toma, 'CNPJ') || tag(toma, 'CPF') || '');

  const papel: 'prestado' | 'tomado' | null = prestDoc === doc ? 'prestado' : tomaDoc === doc ? 'tomado' : null;
  if (!papel) return null;

  const chaveAcesso = tag(xml, 'chNFSe') || xml.match(/<infNFSe[^>]*\sId="NFS(\d{50})"/)?.[1] || null;
  const dhEmi = tag(inf, 'dhEmi');
  const dCompet = tag(inf, 'dCompet');
  const cServ = bloco(inf, 'cServ');
  const cTribNac = tag(cServ, 'cTribNac');
  if (!chaveAcesso || !dhEmi || !dCompet || !cTribNac) return null;

  // Os valores calculados ficam no <valores> da NFS-e, antes do bloco da DPS.
  const antesDaDps = xml.slice(0, xml.indexOf('<DPS') >= 0 ? xml.indexOf('<DPS') : xml.length);
  const valoresNfse = bloco(antesDaDps, 'valores');
  const endereco = bloco(toma, 'end');
  const tribMun = bloco(inf, 'tribMun');
  const tribFed = bloco(inf, 'tribFed');
  const valorServicos = valorDe(inf, 'vServ');
  const grupo = dividirRetencaoAgrupada(valorDe(tribFed, 'vRetCSLL'), tag(tribFed, 'tpRetPisCofins'));

  return {
    papel,
    prestadorDocumento: prestDoc ? formatarCnpj(prestDoc) : '',
    chaveAcesso,
    ambiente: tag(inf, 'tpAmb') === '2' ? 'homologacao' : 'producao',
    numero: tag(xml, 'nNFSe') || '',
    serie: tag(inf, 'serie') || '',
    nDps: tag(inf, 'nDPS'),
    idDps: inf.match(/<infDPS[^>]*\sId="([^"]+)"/)?.[1] || null,
    dataEmissao: dhEmi.slice(0, 10),
    dataCompetencia: dCompet.slice(0, 7),
    prestadorRazaoSocial: tag(emit, 'xNome') || tag(prest, 'xNome'),
    prestadorInscricaoMunicipal: tag(prest, 'IM') || tag(emit, 'IM'),
    tomadorDocumento: tomaDoc,
    tomadorRazaoSocial: tag(toma, 'xNome') || '',
    tomadorEmail: tag(toma, 'email'),
    tomadorInscricaoMunicipal: tag(toma, 'IM'),
    tomadorCodigoMunicipio: tag(endereco, 'cMun'),
    tomadorCep: tag(endereco, 'CEP'),
    tomadorEndereco: tag(endereco, 'xLgr'),
    tomadorNumero: tag(endereco, 'nro'),
    tomadorBairro: tag(endereco, 'xBairro'),
    codigoServico: cTribNac,
    cTribMun: tag(cServ, 'cTribMun'),
    cNbs: tag(cServ, 'cNBS'),
    discriminacao: tag(cServ, 'xDescServ') || '',
    municipioPrestacao: tag(inf, 'cLocPrestacao'),
    valorServicos,
    valorBaseCalculo: tag(valoresNfse, 'vBC') !== null ? valorDe(valoresNfse, 'vBC') : valorServicos,
    aliquotaIss: valorDe(valoresNfse, 'pAliqAplic'),
    valorIss: valorDe(valoresNfse, 'vISSQN'),
    valorLiquido: tag(valoresNfse, 'vLiq') !== null ? valorDe(valoresNfse, 'vLiq') : valorServicos,
    issRetido: tag(tribMun, 'tpRetISSQN') === '2',
    valorIr: valorDe(tribFed, 'vRetIRRF'),
    valorInss: valorDe(tribFed, 'vRetCP'),
    valorPis: grupo.pis,
    valorCofins: grupo.cofins,
    valorCsll: grupo.csll,
  };
}

/**
 * Lê uma NFS-e autorizada para guardá-la como base. Devolve null se a empresa
 * não for a prestadora ou se faltar o que identifica a nota.
 */
export function lerNotaEmitida(xml: string, cnpj: string): NotaEmitida | null {
  const lida = lerNotaAdn(xml, cnpj);
  if (!lida || lida.papel !== 'prestado') return null;
  const { papel: _papel, prestadorDocumento: _prestDoc, ...resto } = lida;
  return resto;
}

/**
 * O evento cancela a nota? A solicitação de análise fiscal (e101103) cita
 * "Cancelamento" no texto, mas não cancela: por isso a checagem é pela tag.
 */
export function eventoCancelaNota(xmlEvento: string): boolean {
  return /<e(101101|105102|105104|305101)[\s/>]/.test(xmlEvento);
}

/** Série que a empresa ainda não usa: repetir uma série de outro sistema colide com as DPS dele. */
export function escolherSerie(usadas: string[]): string {
  const ocupadas = new Set(usadas.map(s => Number(s)));
  let serie = SERIE_PADRAO;
  while (ocupadas.has(serie)) serie++;
  return String(serie);
}

export interface CnpjPublico {
  razaoSocial: string | null;
  nomeFantasia: string | null;
  codigoMunicipio: string | null;
  opSimpNac: number | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
}

export function mapearCnpjPublico(json: Record<string, unknown>): CnpjPublico {
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const estab = (json.estabelecimento && typeof json.estabelecimento === 'object' ? json.estabelecimento : {}) as Record<string, unknown>;
  const cidadeObj = (estab.cidade && typeof estab.cidade === 'object' ? estab.cidade : {}) as Record<string, unknown>;
  const estadoObj = (estab.estado && typeof estab.estado === 'object' ? estab.estado : {}) as Record<string, unknown>;
  const simplesObj = (json.simples && typeof json.simples === 'object' ? json.simples : null) as Record<string, unknown> | null;

  const ibge = json.codigo_municipio_ibge ?? cidadeObj.ibge_id;
  const temRegimeBool = typeof json.opcao_pelo_mei === 'boolean' && typeof json.opcao_pelo_simples === 'boolean';
  let opSimpNac: number | null = null;
  if (temRegimeBool) {
    opSimpNac = json.opcao_pelo_mei ? 2 : json.opcao_pelo_simples ? 3 : 1;
  } else if (simplesObj) {
    const isMei = simplesObj.mei === 'Sim' || simplesObj.mei === true;
    const isSimples = simplesObj.simples === 'Sim' || simplesObj.simples === true;
    opSimpNac = isMei ? 2 : isSimples ? 3 : 1;
  }

  return {
    razaoSocial: texto(json.razao_social) || texto( json.nome ),
    nomeFantasia: texto(json.nome_fantasia) || texto(estab.nome_fantasia) || texto(json.fantasia),
    codigoMunicipio: ibge !== null && ibge !== undefined && /^\d{7}$/.test(String(ibge)) ? String(ibge) : null,
    opSimpNac,
    cidade: texto(json.municipio) || texto(cidadeObj.nome),
    uf: texto(json.uf) || texto(estadoObj.sigla),
    cep: texto(json.cep) || texto(estab.cep),
  };
}

export async function consultarCnpjPublico(cnpj: string): Promise<CnpjPublico | null> {
  const doc = apenasDigitos(cnpj);
  const urls = [
    `https://brasilapi.com.br/api/cnpj/v1/${doc}`,
    `https://minhareceita.org/${doc}`,
    `https://publica.cnpj.ws/cnpj/${doc}`,
  ];
  let acumulado: CnpjPublico | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const mapeado = mapearCnpjPublico(await res.json());
      if (!acumulado) {
        acumulado = mapeado;
      } else {
        acumulado = {
          razaoSocial: acumulado.razaoSocial || mapeado.razaoSocial,
          nomeFantasia: acumulado.nomeFantasia || mapeado.nomeFantasia,
          codigoMunicipio: acumulado.codigoMunicipio || mapeado.codigoMunicipio,
          opSimpNac: acumulado.opSimpNac ?? mapeado.opSimpNac,
          cidade: acumulado.cidade || mapeado.cidade,
          uf: acumulado.uf || mapeado.uf,
          cep: acumulado.cep || mapeado.cep,
        };
      }
      if (acumulado.razaoSocial && acumulado.codigoMunicipio) return acumulado;
    } catch {
      // Tenta o próximo provedor público
    }
  }
  return acumulado;
}
