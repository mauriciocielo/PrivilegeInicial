// ============================================================
// NFS-e NACIONAL — transporte ao Sefin (mTLS) e fluxo de emissão
// ============================================================
// Não registrar payloads em log: o XML traz dados do tomador. O certificado do
// servidor é sempre conferido (a cadeia do Sefin é pública).

import https from 'https';
import { gunzipSync, gzipSync } from 'zlib';
import type { CredencialA1 } from './assinatura';
import type { AmbienteNfse } from './dps';

const ENDPOINTS: Record<AmbienteNfse, string> = {
  producao: 'https://sefin.nfse.gov.br/SefinNacional',
  homologacao: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
};

// Ambiente de Dados Nacional: distribuição de documentos, também aberta a procuradores.
const ENDPOINTS_ADN: Record<AmbienteNfse, string> = {
  producao: 'https://adn.nfse.gov.br',
  homologacao: 'https://adn.producaorestrita.nfse.gov.br',
};

const TIMEOUT_MS = 20_000;
const MAX_NUMEROS_PULADOS = 20;

export interface RespostaHttp {
  status: number;
  corpo: string;
}

export type Transporte = (metodo: 'GET' | 'HEAD' | 'POST', caminho: string, corpoJson?: unknown) => Promise<RespostaHttp>;

export interface ErroSefin {
  codigo: string | null;
  descricao: string | null;
  complemento: string | null;
}

/**
 * Não há como saber se o Sefin processou o pedido (rede, timeout, 5xx). A nota
 * fica como rascunho com o mesmo nDPS: o reenvio consulta a DPS antes de
 * transmitir e recupera a nota caso ela tenha saído, sem duplicar.
 */
export class SefinIndisponivelError extends Error {}

const EXPLICACOES_HTTP: Record<number, string> = {
  401: 'acesso recusado: verifique se o certificado A1 é válido e da empresa',
  403: 'acesso recusado: verifique se o certificado A1 é válido e da empresa',
  429: 'muitas requisições: aguarde um pouco e tente de novo',
  500: 'erro interno do Sefin',
  502: 'Sefin fora do ar',
  503: 'Sefin fora do ar',
  504: 'Sefin fora do ar',
};

function explicarHttp(status: number): string {
  return `Sefin respondeu HTTP ${status}${EXPLICACOES_HTTP[status] ? ` (${EXPLICACOES_HTTP[status]})` : ''}.`;
}

export function criarTransporteMtls(ambiente: AmbienteNfse, credencial: CredencialA1, servico: 'sefin' | 'adn' = 'sefin'): Transporte {
  const base = new URL((servico === 'adn' ? ENDPOINTS_ADN : ENDPOINTS)[ambiente]);
  const agent = new https.Agent({ key: credencial.chavePem, cert: credencial.certificadosPem, keepAlive: false });

  return (metodo, caminho, corpoJson) => new Promise((resolve, reject) => {
    const corpo = corpoJson === undefined ? undefined : JSON.stringify(corpoJson);
    const req = https.request({
      agent,
      method: metodo,
      hostname: base.hostname,
      path: `${base.pathname.replace(/\/$/, '')}/${caminho}`,
      timeout: TIMEOUT_MS,
      headers: {
        Accept: 'application/json',
        ...(corpo ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) } : {}),
      },
    }, res => {
      const partes: Buffer[] = [];
      res.on('data', parte => partes.push(parte));
      res.on('end', () => resolve({ status: res.statusCode || 0, corpo: Buffer.concat(partes).toString('utf8') }));
      res.on('error', erro => reject(new SefinIndisponivelError(`Conexão interrompida: ${erro.message}`)));
    });
    req.on('timeout', () => req.destroy(new Error('tempo esgotado')));
    req.on('error', erro => reject(new SefinIndisponivelError(`Falha de comunicação com o Sefin: ${erro.message}`)));
    if (corpo) req.write(corpo);
    req.end();
  });
}

const comprimir = (xml: string) => gzipSync(Buffer.from(xml, 'utf8')).toString('base64');
const descomprimir = (b64: string) => gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');

function lerJson(corpo: string): Record<string, unknown> | null {
  try {
    const dados = JSON.parse(corpo);
    return dados && typeof dados === 'object' ? dados : null;
  } catch {
    return null;
  }
}

/** O Sefin alterna `erros`/`erro`, lista/objeto e maiúsculas/minúsculas nos subcampos. */
export function lerErros(dados: Record<string, unknown>): ErroSefin[] {
  const brutos = dados.erros ?? dados.erro ?? dados.Erros ?? dados.Erro ?? [];
  const lista = Array.isArray(brutos) ? brutos : [brutos];
  return lista
    .filter((e): e is Record<string, string> => !!e && typeof e === 'object')
    .map(e => ({
      codigo: e.codigo || e.Codigo || null,
      descricao: e.descricao || e.Descricao || e.mensagem || e.Mensagem || null,
      complemento: e.complemento || e.Complemento || null,
    }));
}

function lerAlertas(dados: Record<string, unknown>): string[] {
  const brutos = Array.isArray(dados.alertas) ? dados.alertas : [];
  return brutos
    .map((a: Record<string, string>) => a?.descricao || a?.Descricao || a?.mensagem || a?.Mensagem)
    .filter((a): a is string => !!a);
}

export function lerTag(xml: string, nome: string): string | null {
  const achado = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([^<]*)</${nome}>`));
  return achado?.[1].trim() || null;
}

export interface ValoresNfse {
  numeroNfse: string | null;
  chaveAcesso: string | null;
  valorLiquido: number | null;
  valorIss: number | null;
  valorBaseCalculo: number | null;
  aliquotaIss: number | null;
}

const numeroDaTag = (xml: string, nome: string) => {
  const valor = lerTag(xml, nome);
  return valor === null || Number.isNaN(Number(valor)) ? null : Number(valor);
};

/** Os valores fiscais oficiais são os do XML autorizado, não os calculados na tela. */
export function lerValoresNfse(xml: string): ValoresNfse {
  return {
    numeroNfse: lerTag(xml, 'nNFSe'),
    chaveAcesso: lerTag(xml, 'chNFSe') || xml.match(/<infNFSe[^>]*\sId="NFS(\d{50})"/)?.[1] || null,
    valorLiquido: numeroDaTag(xml, 'vLiq'),
    valorIss: numeroDaTag(xml, 'vISSQN'),
    valorBaseCalculo: numeroDaTag(xml, 'vBC'),
    aliquotaIss: numeroDaTag(xml, 'pAliqAplic'),
  };
}

// ------------------------------------------------------------
// Fluxo de emissão
// ------------------------------------------------------------

export type ResultadoEmissao =
  | { ok: true; recuperada: boolean; nDps: string; idDps: string; chaveAcesso: string | null; nfseXml: string; dpsXml: string | null; valores: ValoresNfse; alertas: string[] }
  | { ok: false; nDps: string; idDps: string; erros: ErroSefin[]; mensagem: string };

export interface PedidoEmissao {
  nDps: string;
  /** True se este nDPS já foi enviado por esta nota antes (a resposta pode ter se perdido). */
  retomada: boolean;
  valorServicos: number;
  tomadorDocumento: string;
  /** Monta e assina a DPS só na hora do envio: dhEmi precisa estar fresco. */
  gerarDps: (nDps: string) => { id: string; xmlAssinado: string };
  idDoNumero: (nDps: string) => string;
  /** Reserva o próximo nDPS quando o atual já pertence a outra nota. */
  proximoNumero: () => Promise<string>;
}

async function dpsJaExiste(transporte: Transporte, id: string): Promise<boolean> {
  const r = await transporte('HEAD', `dps/${id}`);
  if (r.status === 200) return true;
  if (r.status === 404) return false;
  throw new SefinIndisponivelError(explicarHttp(r.status));
}

async function buscarNotaDaDps(transporte: Transporte, id: string): Promise<{ chave: string; xml: string }> {
  const r = await transporte('GET', `dps/${id}`);
  const chave = lerJson(r.corpo)?.chaveAcesso;
  if (r.status !== 200 || typeof chave !== 'string') throw new SefinIndisponivelError(explicarHttp(r.status));
  const nota = await transporte('GET', `nfse/${chave}`);
  const b64 = lerJson(nota.corpo)?.nfseXmlGZipB64;
  if (nota.status !== 200 || typeof b64 !== 'string') throw new SefinIndisponivelError(explicarHttp(nota.status));
  return { chave, xml: descomprimir(b64) };
}

function ehMesmaNota(xml: string, pedido: PedidoEmissao): boolean {
  const toma = xml.match(/<toma>([\s\S]*?)<\/toma>/)?.[1] || '';
  const documento = lerTag(toma, 'CNPJ') || lerTag(toma, 'CPF') || '';
  const valor = numeroDaTag(xml, 'vServ');
  return documento === pedido.tomadorDocumento && valor !== null && Math.abs(valor - pedido.valorServicos) < 0.005;
}

export async function emitirNfse(transporte: Transporte, pedido: PedidoEmissao): Promise<ResultadoEmissao> {
  let nDps = pedido.nDps;

  // Idempotência. Em uma retomada, a DPS existente é a nota desta tentativa anterior:
  // recupera, ou para se os dados mudaram (emitir de novo duplicaria a nota).
  if (pedido.retomada && await dpsJaExiste(transporte, pedido.idDoNumero(nDps))) {
    const id = pedido.idDoNumero(nDps);
    const existente = await buscarNotaDaDps(transporte, id);
    if (!ehMesmaNota(existente.xml, pedido)) {
      return {
        ok: false, nDps, idDps: id, erros: [],
        mensagem: `A tentativa anterior desta nota já foi autorizada pelo Sefin com outro valor ou tomador (chave ${existente.chave}). Cancele essa nota no portal ou restaure os dados originais antes de transmitir.`,
      };
    }
    return {
      ok: true, recuperada: true, nDps, idDps: id, chaveAcesso: existente.chave,
      nfseXml: existente.xml, dpsXml: null, valores: lerValoresNfse(existente.xml), alertas: [],
    };
  }

  // Número novo que já existe no Sefin é de outra nota (contador atrasado ou emissão
  // pelo portal na mesma série), mesmo com valor e tomador iguais, como em mensalidades.
  if (!pedido.retomada) {
    for (let tentativa = 0; await dpsJaExiste(transporte, pedido.idDoNumero(nDps)); tentativa++) {
      if (tentativa >= MAX_NUMEROS_PULADOS) {
        throw new Error('O contador de DPS está muito atrás das notas já emitidas. Ajuste o próximo número na configuração ou use outra série.');
      }
      nDps = await pedido.proximoNumero();
    }
  }

  const { id, xmlAssinado } = pedido.gerarDps(nDps);
  const r = await transporte('POST', 'nfse', { dpsXmlGZipB64: comprimir(xmlAssinado) });
  const dados = lerJson(r.corpo);

  if (dados) {
    const erros = lerErros(dados);
    if (erros.length > 0) {
      if (r.status >= 500) throw new SefinIndisponivelError(explicarHttp(r.status));
      return { ok: false, nDps, idDps: id, erros, mensagem: 'O Sefin rejeitou a nota.' };
    }
    if (typeof dados.nfseXmlGZipB64 === 'string') {
      const nfseXml = descomprimir(dados.nfseXmlGZipB64);
      const valores = lerValoresNfse(nfseXml);
      const chave = typeof dados.chaveAcesso === 'string' ? dados.chaveAcesso : valores.chaveAcesso;
      return {
        ok: true, recuperada: false, nDps, idDps: id, chaveAcesso: chave,
        nfseXml, dpsXml: xmlAssinado, valores: { ...valores, chaveAcesso: chave }, alertas: lerAlertas(dados),
      };
    }
  }

  if (r.status >= 500 || r.status === 429 || r.status === 0) throw new SefinIndisponivelError(explicarHttp(r.status));
  return { ok: false, nDps, idDps: id, erros: [], mensagem: explicarHttp(r.status) };
}

export type StatusProcuracao = 'ativa' | 'sem_procuracao' | 'indeterminada';

const CODIGO_SEM_DOCUMENTOS = 'E2230';

/**
 * Não há API para listar quem outorgou procuração. O que dá para saber é, CNPJ a
 * CNPJ, se o certificado pode agir em nome dele: a distribuição devolve E2245 se
 * não houver vínculo. "Não deu para saber" nunca vira "sem procuração".
 */
export async function verificarProcuracao(transporteAdn: Transporte, cnpj: string): Promise<{ status: StatusProcuracao; mensagem: string | null }> {
  const r = await transporteAdn('GET', `contribuintes/DFe/0?cnpjConsulta=${cnpj}&lote=false`);
  const dados = lerJson(r.corpo);
  const erros = dados ? lerErros(dados) : [];
  if (erros.some(e => e.codigo === 'E2245')) {
    return { status: 'sem_procuracao', mensagem: erros.find(e => e.codigo === 'E2245')?.descricao || null };
  }
  // E2230 é "nenhum documento": sem procuração a resposta teria sido E2245, então o acesso existe.
  if (erros.some(e => e.codigo === CODIGO_SEM_DOCUMENTOS)) return { status: 'ativa', mensagem: null };
  if (erros.length > 0) return { status: 'indeterminada', mensagem: erros.map(e => [e.codigo, e.descricao].filter(Boolean).join(' ')).join(' | ') };
  // Caixa vazia pode voltar como 404, com o corpo JSON normal: a consulta foi aceita.
  if (r.status === 200 || (r.status === 404 && dados)) return { status: 'ativa', mensagem: null };
  return { status: 'indeterminada', mensagem: explicarHttp(r.status) };
}

// Pouco por chamada: as funções na Netlify têm tempo curto. Quem chama continua pelo último NSU.
const MAX_PAGINAS_DFE = 3;
const MAX_TENTATIVAS_429 = 1;

export interface CaixaDfe {
  status: StatusProcuracao;
  mensagem: string | null;
  /** Como o ADN autorizou: Procuracao, CnpjBase ou InscricaoCertificado. */
  tipoConsulta: string | null;
  /** XMLs de NFS-e, do mais recente para o mais antigo. */
  xmls: string[];
  /** Eventos lidos (cancelamentos etc.), com a chave da nota a que se referem. */
  eventos: { chave: string; xml: string }[];
  /** Maior NSU lido: a próxima leitura continua daqui. */
  ultimoNsu: number;
  /** A leitura parou antes do fim: os dados são válidos, mas podem estar incompletos. */
  parcial: boolean;
}

/** Lê a caixa de documentos do CNPJ. A primeira resposta também diz se há procuração. */
export async function lerCaixaDfe(
  transporteAdn: Transporte,
  cnpj: string,
  esperar: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms)),
  nsuInicial = 0,
): Promise<CaixaDfe> {
  const notas: { xml: string; nsu: number }[] = [];
  const eventos: { chave: string; xml: string }[] = [];
  let nsu = nsuInicial;
  let tipoConsulta: string | null = null;
  let tentativas429 = 0;
  const vazia = { tipoConsulta: null, xmls: [], eventos: [], ultimoNsu: nsuInicial, parcial: false };

  for (let pagina = 0; pagina < MAX_PAGINAS_DFE;) {
    const r = await transporteAdn('GET', `contribuintes/DFe/${nsu}?cnpjConsulta=${cnpj}&lote=true`);
    if (r.status === 429 && tentativas429 < MAX_TENTATIVAS_429) {
      tentativas429++;
      await esperar(2000 * tentativas429);
      continue;
    }
    tentativas429 = 0;

    const dados = lerJson(r.corpo);
    const erros = dados ? lerErros(dados) : [];
    const e2245 = erros.find(e => e.codigo === 'E2245');
    if (e2245) return { ...vazia, status: 'sem_procuracao', mensagem: e2245.descricao };

    const lote = dados && Array.isArray(dados.LoteDFe) ? dados.LoteDFe as Record<string, unknown>[] : [];
    const statusLido = String(dados?.StatusProcessamento ?? '').replace(/_/g, '').toLowerCase();
    // O fim da caixa pode vir como status ou como o erro E2230, conforme a resposta.
    const caixaVazia = statusLido === 'nenhumdocumentolocalizado' || erros.some(e => e.codigo === CODIGO_SEM_DOCUMENTOS);
    const aceita = caixaVazia || (r.status === 200 && erros.length === 0);

    if (!aceita) {
      // Já lemos algo: o que veio segue válido. Sem nada lido, não dá para concluir.
      const mensagem = erros.length > 0 ? erros.map(e => [e.codigo, e.descricao].filter(Boolean).join(' ')).join(' | ') : explicarHttp(r.status);
      if (pagina > 0) break;
      return { ...vazia, status: 'indeterminada', mensagem };
    }

    if (typeof dados?.TipoConsulta === 'string') tipoConsulta = dados.TipoConsulta;
    if (caixaVazia || lote.length === 0) return montarCaixa(notas, eventos, nsu, tipoConsulta, false);

    for (const doc of lote) {
      const nsuDoc = Number(doc.NSU);
      if (Number.isFinite(nsuDoc) && nsuDoc > nsu) nsu = nsuDoc;
      if (typeof doc.ArquivoXml !== 'string') continue;
      try {
        const xml = descomprimir(doc.ArquivoXml);
        const tipo = String(doc.TipoDocumento).toUpperCase();
        if (tipo === 'NFSE') notas.push({ xml, nsu: nsuDoc });
        else if (tipo === 'EVENTO' && typeof doc.ChaveAcesso === 'string') eventos.push({ chave: doc.ChaveAcesso, xml });
      } catch {
        // Documento ilegível não impede o aproveitamento dos demais.
      }
    }
    pagina++;
    if (pagina < MAX_PAGINAS_DFE) await esperar(1000);
  }
  return montarCaixa(notas, eventos, nsu, tipoConsulta, true);
}

function montarCaixa(
  notas: { xml: string; nsu: number }[],
  eventos: { chave: string; xml: string }[],
  ultimoNsu: number,
  tipoConsulta: string | null,
  parcial: boolean,
): CaixaDfe {
  const xmls = [...notas].sort((a, b) => b.nsu - a.nsu).map(n => n.xml);
  return { status: 'ativa', mensagem: null, tipoConsulta, xmls, eventos, ultimoNsu, parcial };
}

export type ResultadoEvento =
  | { ok: true; eventoXml: string }
  | { ok: false; erros: ErroSefin[]; mensagem: string };

export async function registrarEvento(transporte: Transporte, chave: string, xmlAssinado: string): Promise<ResultadoEvento> {
  const r = await transporte('POST', `nfse/${chave}/eventos`, { pedidoRegistroEventoXmlGZipB64: comprimir(xmlAssinado) });
  const dados = lerJson(r.corpo);
  if (dados) {
    const erros = lerErros(dados);
    if (erros.length > 0) return { ok: false, erros, mensagem: 'O Sefin recusou o cancelamento.' };
    if (typeof dados.eventoXmlGZipB64 === 'string') return { ok: true, eventoXml: descomprimir(dados.eventoXmlGZipB64) };
  }
  if (r.status >= 500 || r.status === 429) throw new SefinIndisponivelError(explicarHttp(r.status));
  return { ok: false, erros: [], mensagem: explicarHttp(r.status) };
}
