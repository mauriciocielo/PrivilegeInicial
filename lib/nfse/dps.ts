// ============================================================
// NFS-e NACIONAL — montagem da DPS e do pedido de cancelamento
// ============================================================
// Regras puras (sem banco nem rede). A ordem dos elementos é a do XSD do Sefin:
// trocar a ordem resulta em E1235. O XML é gerado já na forma canônica (C14N),
// sem espaços entre tags, para que o que é assinado seja o que é enviado.

import { SEM_RETENCAO, tipoRetencaoPisCofins, totalRetidoFederal, type ValoresRetidos } from './retencao';

export const NS_NFSE = 'http://www.sped.fazenda.gov.br/nfse';
const VERSAO_XML = '1.01';
const VER_APLIC = 'CashflowNFSe-1.0'; // máximo de 20 caracteres (E1235)

export type AmbienteNfse = 'homologacao' | 'producao';

// Os dois pacotes de esquemas têm o mesmo versao="1.01"; quem define qual vale é
// o ambiente. A produção restrita já aplica a NT 009 (20/10/2026). `leiaute` na
// configuração permite forçar o pacote no dia em que a produção virar.
export const LEIAUTE_PRODUCAO = '20260209';
export const LEIAUTE_NT009 = '20261020';
export type LeiauteNfse = typeof LEIAUTE_PRODUCAO | typeof LEIAUTE_NT009;

export function leiauteDoAmbiente(ambiente: AmbienteNfse, forcado?: string | null): LeiauteNfse {
  if (forcado === LEIAUTE_PRODUCAO || forcado === LEIAUTE_NT009) return forcado;
  return ambiente === 'producao' ? LEIAUTE_PRODUCAO : LEIAUTE_NT009;
}

export interface ConfigFiscalNfse {
  cnpj: string;
  codigoMunicipio: string;
  inscricaoMunicipal?: string | null;
  opSimpNac: number; // 1 = Não Optante, 2 = MEI, 3 = ME/EPP
  regApTribSN?: number | null;
  regEspTrib: number;
  pTotTribSN?: number | null;
  piscofinsCst: string;
  tpRetPisCofins?: string | null;
  pTotTribFed?: number | null;
  pTotTribEst?: number | null;
  pTotTribMun?: number | null;
  convenioAtivo: boolean;
  ibsCbsCIndOp?: string | null;
  ibsCbsCst?: string | null;
  ibsCbsCClassTrib?: string | null;
  ibsCbsIndFinal?: string | null;
  leiaute?: string | null;
}

export interface DadosDps {
  ambiente: AmbienteNfse;
  serie: string;
  nDps: string;
  dataCompetencia: string; // AAAA-MM
  descricao: string;
  valorServicos: number;
  cTribNac: string;
  cTribMun?: string | null;
  cNbs?: string | null;
  municipioPrestacao: string;
  issRetido: boolean;
  aliquotaIss?: number | null;
  /** Tributos federais retidos, em reais. */
  retencao?: ValoresRetidos;
  tomadorDocumento: string;
  tomadorNome: string;
  tomadorInscricaoMunicipal?: string | null;
  tomadorEmail?: string | null;
  tomadorCodigoMunicipio?: string | null;
  tomadorCep?: string | null;
  tomadorLogradouro?: string | null;
  tomadorNumero?: string | null;
  tomadorBairro?: string | null;
}

export const apenasDigitos = (v?: string | null) => (v || '').replace(/\D/g, '');

function digitoVerificadorOk(doc: string, pesos: number[], posicao: number): boolean {
  const soma = pesos.reduce((acc, peso, i) => acc + Number(doc[i]) * peso, 0);
  const resto = soma % 11;
  return Number(doc[posicao]) === (resto < 2 ? 0 : 11 - resto);
}

export function cnpjValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  return digitoVerificadorOk(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], 12)
    && digitoVerificadorOk(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], 13);
}

export function cpfValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  return digitoVerificadorOk(d, [10, 9, 8, 7, 6, 5, 4, 3, 2], 9)
    && digitoVerificadorOk(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2], 10);
}

// ------------------------------------------------------------
// Datas — sempre no horário de Brasília (E0008)
// ------------------------------------------------------------

const MARGEM_E0008_MS = 5000;

function partesBrasilia(momento: Date) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(momento);
  const p = (tipo: string) => partes.find(x => x.type === tipo)?.value || '';
  return {
    data: `${p('year')}-${p('month')}-${p('day')}`,
    hora: `${p('hour')}:${p('minute')}:${p('second')}`,
    offset: p('timeZoneName').replace('GMT', '') || '-03:00',
  };
}

/**
 * `dhEmi`/`dhEvento`, recuado 5s: o relógio do Sefin corre até ~1s atrás e um
 * dhEmi "no futuro" dele é rejeitado com E0008. O recuo não atravessa a
 * meia-noite, para não trocar a competência da nota.
 */
export function dataHoraFiscal(agora: Date = new Date()): string {
  const atual = partesBrasilia(agora);
  const recuado = partesBrasilia(new Date(agora.getTime() - MARGEM_E0008_MS));
  const p = recuado.data === atual.data ? recuado : { ...atual, hora: '00:00:00' };
  return `${p.data}T${p.hora}${p.offset}`;
}

/**
 * `dCompet` (AAAA-MM-DD) a partir do mês de competência. O Sefin não aceita
 * competência posterior à emissão: no mês corrente usa o dia de hoje e em mês
 * passado usa o último dia.
 */
export function dataCompetenciaFiscal(competencia: string, agora: Date = new Date()): string {
  const hoje = partesBrasilia(agora).data;
  if (competencia === hoje.slice(0, 7)) return hoje;
  const [ano, mes] = competencia.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${competencia}-${String(ultimoDia).padStart(2, '0')}`;
}

export function hojeBrasilia(agora: Date = new Date()): string {
  return partesBrasilia(agora).data;
}

// ------------------------------------------------------------
// Regras do regime tributário
// ------------------------------------------------------------

/** A alíquota vai na DPS? Enviá-la quando não deve e omiti-la quando deve são ambos rejeição. */
export function exigeAliquotaNaDps(cfg: ConfigFiscalNfse, issRetido: boolean): boolean {
  if (cfg.opSimpNac === 1) return !cfg.convenioAtivo && cfg.regEspTrib === 0; // E0617 / E0619
  if (cfg.opSimpNac === 3) {
    if ((cfg.regApTribSN ?? 1) === 1) return issRetido; // E0621 / E0625
    return !cfg.convenioAtivo; // E0635 / E0640
  }
  return false;
}

export function enderecoTomadorCompleto(d: Pick<DadosDps, 'tomadorCodigoMunicipio' | 'tomadorCep' | 'tomadorLogradouro' | 'tomadorBairro'>): boolean {
  return apenasDigitos(d.tomadorCodigoMunicipio).length === 7
    && apenasDigitos(d.tomadorCep).length === 8
    && !!(d.tomadorLogradouro || '').trim()
    && !!(d.tomadorBairro || '').trim();
}

function grupoIbsCbsCompleto(cfg: ConfigFiscalNfse): boolean {
  return !!(cfg.ibsCbsCIndOp && cfg.ibsCbsCst && cfg.ibsCbsCClassTrib);
}

/** Problemas que fariam o Sefin rejeitar a DPS (ou gerar nota em desconformidade), checados antes de assinar. */
export function validarEmissao(cfg: ConfigFiscalNfse, d: DadosDps, agora: Date = new Date()): string[] {
  const problemas: string[] = [];
  const doc = apenasDigitos(d.tomadorDocumento);

  if (!cnpjValido(cfg.cnpj)) problemas.push('CNPJ da empresa inválido.');
  if (apenasDigitos(cfg.codigoMunicipio).length !== 7) problemas.push('Informe o código IBGE do município da empresa (7 dígitos) na configuração.');
  if (apenasDigitos(d.municipioPrestacao).length !== 7) problemas.push('Código IBGE do município da prestação deve ter 7 dígitos.');
  if (!/^\d{6}$/.test(d.cTribNac)) problemas.push('Código de Tributação Nacional deve ter 6 dígitos.');
  if (d.cNbs && !/^\d{9}$/.test(apenasDigitos(d.cNbs))) problemas.push('Código NBS deve ter 9 dígitos.');
  if (!d.descricao.trim()) problemas.push('Informe a descrição do serviço.');
  if (!(d.valorServicos > 0)) problemas.push('O valor do serviço deve ser maior que zero.');
  if (!/^\d{1,5}$/.test(d.serie)) problemas.push('A série da DPS deve ter de 1 a 5 dígitos.');
  if (!d.tomadorNome.trim()) problemas.push('Informe o nome do tomador.');
  if (doc.length === 14 ? !cnpjValido(doc) : !cpfValido(doc)) problemas.push('CPF/CNPJ do tomador inválido.');

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(d.dataCompetencia)) {
    problemas.push('Competência inválida.');
  } else if (d.dataCompetencia > hojeBrasilia(agora).slice(0, 7)) {
    problemas.push('A competência não pode ser posterior ao mês atual.');
  }

  if (cfg.opSimpNac === 3 && cfg.pTotTribSN == null) {
    problemas.push('Informe a alíquota do Simples Nacional na nota ou na configuração do emissor (pTotTribSN).');
  }

  if (d.issRetido) {
    if (cfg.opSimpNac === 2) problemas.push('MEI não sofre retenção de ISS (E0583).');
    if (cfg.regEspTrib !== 0) problemas.push('Prestador com regime especial não sofre retenção de ISS (E0588).');
    if (!enderecoTomadorCompleto(d)) problemas.push('Com ISS retido, o endereço completo do tomador é obrigatório: código IBGE, CEP, logradouro e bairro (E0237).');
  }

  const retido = totalRetidoFederal(d.retencao || SEM_RETENCAO);
  if (retido > 0) {
    if (cfg.opSimpNac === 2) problemas.push('MEI não pode informar tributos federais na nota (E0676).');
    const issRetido = d.issRetido ? d.valorServicos * (Number(d.aliquotaIss) || 0) / 100 : 0;
    if (retido + issRetido >= d.valorServicos) problemas.push('As retenções não podem alcançar o valor do serviço (E0428).');
  }

  if (exigeAliquotaNaDps(cfg, d.issRetido) && !(Number(d.aliquotaIss) > 0)) {
    problemas.push('Neste regime a alíquota de ISS é obrigatória na DPS.');
  }

  if (grupoIbsCbsCompleto(cfg) && !apenasDigitos(d.cNbs)) {
    problemas.push('O grupo IBS/CBS exige o código NBS do serviço (E0322).');
  }
  if (!grupoIbsCbsCompleto(cfg) && d.dataCompetencia >= '2027-01') {
    problemas.push('A partir da competência 01/2027 o grupo IBS/CBS é obrigatório: preencha cIndOp, CST e cClassTrib na configuração.');
  }

  return problemas;
}

/** Avisos que não impedem a emissão, mas que o usuário precisa ver. */
export function alertasEmissao(cfg: ConfigFiscalNfse, d: DadosDps): string[] {
  const alertas: string[] = [];
  if (cfg.opSimpNac === 1 && !grupoIbsCbsCompleto(cfg)) {
    alertas.push('Regime Regular sem o grupo IBS/CBS: o Sefin ainda autoriza, mas a nota fica em desconformidade. Preencha o grupo na configuração.');
  }
  const algumEndereco = d.tomadorCodigoMunicipio || d.tomadorCep || d.tomadorLogradouro || d.tomadorBairro;
  if (algumEndereco && !enderecoTomadorCompleto(d)) {
    alertas.push('Endereço do tomador incompleto: ele foi omitido da nota.');
  }
  return alertas;
}

// ------------------------------------------------------------
// Serialização
// ------------------------------------------------------------

/** Remove o que é inválido em XML 1.0 e normaliza quebras de linha (o parser faria isso e quebraria o digest). */
function limparTexto(valor: string): string {
  return valor
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .trim();
}

function escapar(valor: string): string {
  return valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type Filho = string | false | null | undefined;

const tag = (nome: string, ...filhos: Filho[]) => `<${nome}>${filhos.filter(Boolean).join('')}</${nome}>`;
const txt = (nome: string, valor: string | number) => `<${nome}>${escapar(limparTexto(String(valor)))}</${nome}>`;
const dec2 = (valor: number) => (Math.round((valor + Number.EPSILON) * 100) / 100).toFixed(2);

/** `Id` da DPS: "DPS" + IBGE(7) + tipo(2=CNPJ) + CNPJ(14) + série(5) + nDPS(15). É a base da idempotência. */
export function idDps(cfg: Pick<ConfigFiscalNfse, 'cnpj' | 'codigoMunicipio'>, serie: string, nDps: string): string {
  return `DPS${apenasDigitos(cfg.codigoMunicipio)}2${apenasDigitos(cfg.cnpj)}${serie.padStart(5, '0')}${nDps.padStart(15, '0')}`;
}

function montarEnderecoTomador(d: DadosDps): string {
  if (!enderecoTomadorCompleto(d)) return '';
  return tag('end',
    tag('endNac', txt('cMun', apenasDigitos(d.tomadorCodigoMunicipio)), txt('CEP', apenasDigitos(d.tomadorCep))),
    txt('xLgr', limparTexto(d.tomadorLogradouro || '').slice(0, 255)),
    txt('nro', limparTexto(d.tomadorNumero || '').slice(0, 60) || 'S/N'),
    txt('xBairro', limparTexto(d.tomadorBairro || '').slice(0, 60)),
  );
}

function montarIbsCbs(cfg: ConfigFiscalNfse, nt009: boolean): string {
  if (!grupoIbsCbsCompleto(cfg)) return '';
  const classificacao = [txt('CST', cfg.ibsCbsCst!), txt('cClassTrib', cfg.ibsCbsCClassTrib!)].join('');
  return tag('IBSCBS',
    !nt009 && txt('finNFSe', '0'),
    !!cfg.ibsCbsIndFinal && txt('indFinal', cfg.ibsCbsIndFinal),
    txt('cIndOp', cfg.ibsCbsCIndOp!),
    txt('indDest', '0'),
    tag('valores', tag('trib', nt009 ? classificacao : tag('gIBSCBS', classificacao))),
  );
}

function montarTotTrib(cfg: ConfigFiscalNfse): string {
  // ME/EPP: pTotTribSN (indTotTrib dá E0712). MEI: isento, indTotTrib=0.
  if (cfg.opSimpNac === 3) return tag('totTrib', txt('pTotTribSN', dec2(cfg.pTotTribSN ?? 0)));
  if (cfg.opSimpNac === 1 && cfg.pTotTribFed != null && cfg.pTotTribEst != null && cfg.pTotTribMun != null) {
    return tag('totTrib', tag('pTotTrib',
      txt('pTotTribFed', dec2(cfg.pTotTribFed)),
      txt('pTotTribEst', dec2(cfg.pTotTribEst)),
      txt('pTotTribMun', dec2(cfg.pTotTribMun)),
    ));
  }
  return tag('totTrib', txt('indTotTrib', '0'));
}

export function montarDps(cfg: ConfigFiscalNfse, d: DadosDps, agora: Date = new Date()): { id: string; xml: string; leiaute: LeiauteNfse } {
  const leiaute = leiauteDoAmbiente(d.ambiente, cfg.leiaute);
  const nt009 = leiaute === LEIAUTE_NT009;
  const id = idDps(cfg, d.serie, d.nDps);
  const doc = apenasDigitos(d.tomadorDocumento);
  // cTribMun: Código de Tributação Municipal. No padrão NFS-e Nacional (TCCodTribMun),
  // se informado, deve ser um subcódigo de até 3 dígitos (ex: "001"). Se o usuário ou emissor
  // informar o mesmo código nacional (ex: 6 dígitos "171901"), NÃO deve ser enviado na tag <cTribMun>,
  // pois causa o erro de esquema [E1235]: The value '171901' is invalid according to datatype 'TCCodTribMun'.
  // Quando o município não adota subcódigo próprio (o código é o mesmo nacional), a tag <cTribMun> deve ser omitida.
  const rawMun = (d.cTribMun || '').trim();
  const cTribMun = rawMun && rawMun !== d.cTribNac && /^\d{1,3}$/.test(rawMun)
    ? rawMun.padStart(3, '0')
    : null;
  const cNbs = apenasDigitos(d.cNbs);
  const descricao = txt('xDescServ', limparTexto(d.descricao).slice(0, 2000));
  const im = apenasDigitos(cfg.inscricaoMunicipal);
  const imTomador = apenasDigitos(d.tomadorInscricaoMunicipal);
  const email = limparTexto(d.tomadorEmail || '');
  const retencao = d.retencao || SEM_RETENCAO;
  const tipoRetencao = tipoRetencaoPisCofins(retencao);
  // Sem retenção, a configuração só pode declarar códigos de "não retido": os demais exigem vRetCSLL (E0724).
  const tipoSemRetencao = cfg.tpRetPisCofins === '0' || cfg.tpRetPisCofins === '2' ? cfg.tpRetPisCofins : null;
  const somaContribuicoes = retencao.pis + retencao.cofins + retencao.csll;

  const infDps = [
    txt('tpAmb', d.ambiente === 'producao' ? '1' : '2'),
    txt('dhEmi', dataHoraFiscal(agora)),
    txt('verAplic', VER_APLIC),
    txt('serie', d.serie),
    txt('nDPS', d.nDps),
    txt('dCompet', dataCompetenciaFiscal(d.dataCompetencia, agora)),
    txt('tpEmit', '1'),
    nt009 && txt('finNFSe', '0'),
    txt('cLocEmi', apenasDigitos(cfg.codigoMunicipio)),
    // Com tpEmit=1 o Sefin puxa nome e endereço do cadastro: enviá-los dá E0128/E0121.
    tag('prest',
      txt('CNPJ', apenasDigitos(cfg.cnpj)),
      !!im && txt('IM', im),
      tag('regTrib',
        txt('opSimpNac', cfg.opSimpNac),
        // regApTribSN é exclusivo de ME/EPP (E0162).
        cfg.opSimpNac === 3 && txt('regApTribSN', cfg.regApTribSN ?? 1),
        txt('regEspTrib', cfg.regEspTrib),
      ),
    ),
    tag('toma',
      txt(doc.length === 14 ? 'CNPJ' : 'CPF', doc),
      !!imTomador && txt('IM', imTomador),
      txt('xNome', limparTexto(d.tomadorNome).slice(0, 300)),
      montarEnderecoTomador(d),
      !!email && txt('email', email.slice(0, 80)),
    ),
    tag('serv',
      tag('locPrest', txt('cLocPrestacao', apenasDigitos(d.municipioPrestacao))),
      tag('cServ',
        txt('cTribNac', d.cTribNac),
        !!cTribMun && txt('cTribMun', cTribMun),
        !nt009 && descricao,
        !!cNbs && txt('cNBS', cNbs),
        nt009 && descricao,
      ),
    ),
    tag('valores',
      tag('vServPrest', txt('vServ', dec2(d.valorServicos))),
      tag('trib',
        tag('tribMun',
          txt('tribISSQN', '1'),
          txt('tpRetISSQN', d.issRetido ? '2' : '1'),
          exigeAliquotaNaDps(cfg, d.issRetido) && txt('pAliq', dec2(Number(d.aliquotaIss))),
        ),
        // MEI recolhe no DAS-SIMEI: enviar tribFed dá E0676.
        cfg.opSimpNac !== 2 && tag('tribFed',
          tag('piscofins',
            txt('CST', cfg.piscofinsCst || '08'),
            (tipoRetencao || tipoSemRetencao) && txt('tpRetPisCofins', (tipoRetencao || tipoSemRetencao)!),
          ),
          retencao.cp > 0 && txt('vRetCP', dec2(retencao.cp)),
          retencao.irrf > 0 && txt('vRetIRRF', dec2(retencao.irrf)),
          somaContribuicoes > 0 && txt('vRetCSLL', dec2(somaContribuicoes)),
        ),
        montarTotTrib(cfg),
      ),
    ),
    montarIbsCbs(cfg, nt009),
  ].filter(Boolean).join('');

  return {
    id,
    leiaute,
    xml: `<DPS xmlns="${NS_NFSE}" versao="${VERSAO_XML}"><infDPS Id="${id}">${infDps}</infDPS></DPS>`,
  };
}

// ------------------------------------------------------------
// Cancelamento
// ------------------------------------------------------------

export const MOTIVOS_CANCELAMENTO: Record<number, string> = {
  1: 'Erro na Emissão',
  2: 'Serviço não Prestado',
  9: 'Outros',
};

// O xDesc é uma enumeração e o Sefin exige o texto acentuado, mesmo o XSD listando sem acento (E1235).
const EVENTOS_CANCELAMENTO = {
  direto: { codigo: '101101', descricao: 'Cancelamento de NFS-e' },
  analise: { codigo: '101103', descricao: 'Solicitação de Análise Fiscal para Cancelamento de NFS-e' },
} as const;

export type ModoCancelamento = keyof typeof EVENTOS_CANCELAMENTO;

export function validarCancelamento(chave: string, motivo: number, justificativa: string): string[] {
  const problemas: string[] = [];
  if (chave.length !== 50) problemas.push('Chave de acesso inválida.');
  if (!MOTIVOS_CANCELAMENTO[motivo]) problemas.push('Motivo de cancelamento inválido.');
  const tamanho = justificativa.trim().length;
  if (tamanho < 15 || tamanho > 200) problemas.push('A justificativa deve ter entre 15 e 200 caracteres.');
  return problemas;
}

export function montarCancelamento(params: {
  chave: string;
  cnpjAutor: string;
  motivo: number;
  justificativa: string;
  ambiente: AmbienteNfse;
  modo: ModoCancelamento;
  agora?: Date;
}): { id: string; xml: string } {
  const evento = EVENTOS_CANCELAMENTO[params.modo];
  const id = `PRE${params.chave}${evento.codigo}`;
  const inf = [
    txt('tpAmb', params.ambiente === 'producao' ? '1' : '2'),
    txt('verAplic', VER_APLIC),
    txt('dhEvento', dataHoraFiscal(params.agora)),
    txt('CNPJAutor', apenasDigitos(params.cnpjAutor)),
    txt('chNFSe', params.chave),
    tag(`e${evento.codigo}`,
      txt('xDesc', evento.descricao),
      txt('cMotivo', params.motivo),
      txt('xMotivo', params.justificativa),
    ),
  ].join('');
  return {
    id,
    xml: `<pedRegEvento xmlns="${NS_NFSE}" versao="${VERSAO_XML}"><infPedReg Id="${id}">${inf}</infPedReg></pedRegEvento>`,
  };
}
