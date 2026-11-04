// ============================================================
// NF-e DESTINADAS — Distribuição DF-e (NT 2014.002) da SEFAZ / Ambiente Nacional
// ============================================================
// Mesmo protocolo da biblioteca node-mde: SOAP 1.2 com mTLS (certificado A1),
// consulta por último NSU, e documentos devolvidos em docZip (gzip + base64).
// Não registrar payloads em log: os XMLs trazem dados fiscais de terceiros.

import https from 'https';
import tls from 'tls';
import fs from 'fs';
import { gunzipSync } from 'zlib';
import type { CredencialA1 } from '../nfse/assinatura';

export type AmbienteNfe = 'producao' | 'homologacao';

const ENDPOINTS: Record<AmbienteNfe, string> = {
  producao: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const TIMEOUT_MS = 40_000;
const NS_WSDL = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe';

/** SEFAZ fora do ar, rede, timeout ou cadeia TLS não confiada. */
export class SefazIndisponivelError extends Error {}

// ---------- Montagem do pedido ----------

export const padNsu = (nsu: string | number) => String(nsu || '0').replace(/\D/g, '').padStart(15, '0');

export function montarEnvelopeDistribuicao(p: { ambiente: AmbienteNfe; cnpj: string; ultNsu: string; cUfAutor?: string }): string {
  const cnpj = p.cnpj.replace(/\D/g, '');
  const uf = p.cUfAutor && /^\d{2}$/.test(p.cUfAutor) ? `<cUFAutor>${p.cUfAutor}</cUFAutor>` : '';
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">'
    + '<soap12:Body>'
    + `<nfeDistDFeInteresse xmlns="${NS_WSDL}"><nfeDadosMsg>`
    + '<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">'
    + `<tpAmb>${p.ambiente === 'producao' ? 1 : 2}</tpAmb>${uf}<CNPJ>${cnpj}</CNPJ>`
    + `<distNSU><ultNSU>${padNsu(p.ultNsu)}</ultNSU></distNSU>`
    + '</distDFeInt></nfeDadosMsg></nfeDistDFeInteresse>'
    + '</soap12:Body></soap12:Envelope>';
}

// ---------- Transporte (mTLS) ----------

/**
 * A cadeia do servidor da SEFAZ é ICP-Brasil, que o Node pode não ter na lista
 * de raízes. A verificação nunca é desligada: aponte NFE_CA_PEM_PATH para um
 * arquivo .pem com a cadeia ICP-Brasil para acrescentá-la às raízes confiáveis.
 */
function raizesConfiaveis(): string[] | undefined {
  const caminho = process.env.NFE_CA_PEM_PATH;
  if (!caminho) return undefined;
  try {
    return [...tls.rootCertificates, fs.readFileSync(caminho, 'utf8')];
  } catch {
    throw new SefazIndisponivelError(`Não foi possível ler NFE_CA_PEM_PATH (${caminho}).`);
  }
}

export function enviarDistribuicao(credencial: CredencialA1, ambiente: AmbienteNfe, envelope: string, timeoutMs = TIMEOUT_MS): Promise<{ status: number; corpo: string }> {
  return enviarSoap(credencial, ENDPOINTS[ambiente], `${NS_WSDL}/nfeDistDFeInteresse`, envelope, timeoutMs);
}

/** POST SOAP 1.2 com mTLS: mesmo transporte para a distribuição e para os eventos. */
export function enviarSoap(credencial: CredencialA1, endereco: string, acao: string, envelope: string, timeoutMs = TIMEOUT_MS): Promise<{ status: number; corpo: string }> {
  const url = new URL(endereco);
  const ca = raizesConfiaveis();
  const agent = new https.Agent({ key: credencial.chavePem, cert: credencial.certificadosPem, keepAlive: false, ...(ca ? { ca } : {}) });
  const corpo = Buffer.from(envelope, 'utf8');

  return new Promise((resolve, reject) => {
    const req = https.request({
      agent,
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname,
      timeout: timeoutMs,
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${acao}"`,
        'Content-Length': corpo.length,
      },
    }, res => {
      const partes: Buffer[] = [];
      res.on('data', parte => partes.push(parte));
      res.on('end', () => resolve({ status: res.statusCode || 0, corpo: Buffer.concat(partes).toString('utf8') }));
      res.on('error', erro => reject(new SefazIndisponivelError(`Conexão interrompida: ${erro.message}`)));
    });
    req.on('timeout', () => req.destroy(new Error('tempo esgotado')));
    req.on('error', (erro: NodeJS.ErrnoException) => {
      const cadeia = erro.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || erro.code === 'SELF_SIGNED_CERT_IN_CHAIN' || erro.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY';
      reject(new SefazIndisponivelError(cadeia
        ? 'O servidor da SEFAZ usa uma cadeia ICP-Brasil que este servidor não reconhece. Configure NFE_CA_PEM_PATH com a cadeia de certificados ICP-Brasil.'
        : `Falha de comunicação com a SEFAZ: ${erro.message}`));
    });
    req.write(corpo);
    req.end();
  });
}

// ---------- Leitura da resposta ----------

const tag = (xml: string, nome: string): string | null => {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([^<]*)</${nome}>`));
  return m ? m[1].trim() : null;
};

const bloco = (xml: string, nome: string): string => {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`));
  return m ? m[1] : '';
};

export interface DocZip {
  nsu: string;
  schema: string;
  xml: string;
}

export interface RespostaDistribuicao {
  cStat: string;
  xMotivo: string;
  ultNsu: string;
  maxNsu: string;
  documentos: DocZip[];
}

export function lerRespostaDistribuicao(soap: string): RespostaDistribuicao {
  const ret = soap.match(/<retDistDFeInt[\s\S]*?<\/retDistDFeInt>/)?.[0];
  if (!ret) {
    const falha = tag(soap, 'Text') || tag(soap, 'faultstring') || tag(soap, 'Reason');
    throw new SefazIndisponivelError(`Resposta inesperada da SEFAZ${falha ? `: ${falha}` : '.'}`);
  }

  const documentos: DocZip[] = [];
  for (const m of ret.matchAll(/<docZip\s+([^>]*)>([^<]*)<\/docZip>/g)) {
    const nsu = m[1].match(/NSU="(\d+)"/)?.[1];
    const schema = m[1].match(/schema="([^"]+)"/)?.[1];
    if (!nsu || !schema) continue;
    try {
      documentos.push({ nsu, schema, xml: gunzipSync(Buffer.from(m[2].trim(), 'base64')).toString('utf8') });
    } catch {
      // docZip corrompido: o NSU ainda avança, o documento pode ser buscado depois pela chave.
    }
  }

  return {
    cStat: tag(ret, 'cStat') || '',
    xMotivo: tag(ret, 'xMotivo') || '',
    ultNsu: tag(ret, 'ultNSU') || '0',
    maxNsu: tag(ret, 'maxNSU') || '0',
    documentos,
  };
}

// ---------- Classificação dos documentos ----------

export type SituacaoNfe = 'autorizada' | 'denegada' | 'cancelada';
export type Manifestacao = 'ciencia' | 'confirmada' | 'desconhecida' | 'nao_realizada';

export interface DadosNota {
  chave: string;
  emitenteCnpj: string;
  emitenteNome: string;
  emitenteIe: string | null;
  dataEmissao: string;
  tipoOperacao: number | null;
  valorNf: number;
  situacao: SituacaoNfe;
  protocolo: string | null;
  numero: string | null;
  serie: string | null;
}

export type DocumentoDfe =
  | { tipo: 'resumo'; nota: DadosNota }
  | { tipo: 'completa'; nota: DadosNota; xml: string }
  | { tipo: 'evento'; chave: string; tpEvento: string; descricao: string | null; protocolo: string | null };

export const EVENTO_CANCELAMENTO = '110111';

export const MANIFESTACAO_POR_EVENTO: Record<string, Manifestacao> = {
  '210200': 'confirmada',
  '210210': 'ciencia',
  '210220': 'desconhecida',
  '210240': 'nao_realizada',
};

function situacaoPorCodigo(cSitNFe: string | null): SituacaoNfe {
  if (cSitNFe === '2') return 'denegada';
  if (cSitNFe === '3') return 'cancelada';
  return 'autorizada';
}

const numero = (t: string | null) => {
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
};

export function interpretarDocumento(schema: string, xml: string): DocumentoDfe | null {
  if (schema.startsWith('resNFe')) {
    const chave = tag(xml, 'chNFe');
    if (!chave) return null;
    return {
      tipo: 'resumo',
      nota: {
        chave,
        emitenteCnpj: tag(xml, 'CNPJ') || tag(xml, 'CPF') || '',
        emitenteNome: tag(xml, 'xNome') || '',
        emitenteIe: tag(xml, 'IE'),
        dataEmissao: (tag(xml, 'dhEmi') || '').slice(0, 10),
        tipoOperacao: tag(xml, 'tpNF') === null ? null : numero(tag(xml, 'tpNF')),
        valorNf: numero(tag(xml, 'vNF')),
        situacao: situacaoPorCodigo(tag(xml, 'cSitNFe')),
        protocolo: tag(xml, 'nProt'),
        // O resumo não traz número e série: só a nota completa.
        numero: chave.length === 44 ? String(Number(chave.slice(25, 34))) : null,
        serie: chave.length === 44 ? String(Number(chave.slice(22, 25))) : null,
      },
    };
  }

  if (schema.startsWith('procNFe')) {
    const chave = (xml.match(/<infNFe[^>]*\sId="NFe(\d{44})"/) || [])[1];
    if (!chave) return null;
    const ide = bloco(xml, 'ide');
    const emit = bloco(xml, 'emit');
    const infProt = bloco(xml, 'infProt');
    const cStatProt = tag(infProt, 'cStat');
    return {
      tipo: 'completa',
      xml,
      nota: {
        chave,
        emitenteCnpj: tag(emit, 'CNPJ') || tag(emit, 'CPF') || '',
        emitenteNome: tag(emit, 'xNome') || '',
        emitenteIe: tag(emit, 'IE'),
        dataEmissao: (tag(ide, 'dhEmi') || tag(ide, 'dEmi') || '').slice(0, 10),
        tipoOperacao: tag(ide, 'tpNF') === null ? null : numero(tag(ide, 'tpNF')),
        valorNf: numero(tag(bloco(xml, 'ICMSTot'), 'vNF')),
        // 100/150 autorizada; 110/301/302 uso denegado.
        situacao: cStatProt && ['110', '301', '302'].includes(cStatProt) ? 'denegada' : 'autorizada',
        protocolo: tag(infProt, 'nProt'),
        numero: tag(ide, 'nNF'),
        serie: tag(ide, 'serie'),
      },
    };
  }

  if (schema.startsWith('resEvento') || schema.startsWith('procEventoNFe')) {
    const chave = tag(xml, 'chNFe');
    const tpEvento = tag(xml, 'tpEvento');
    if (!chave || !tpEvento) return null;
    return { tipo: 'evento', chave, tpEvento, descricao: tag(xml, 'xEvento') || tag(xml, 'descEvento'), protocolo: tag(xml, 'nProt') };
  }

  return null;
}

