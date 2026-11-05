// ============================================================
// CT-e DESTINADOS & EMITIDOS — Distribuição DF-e da SEFAZ / SVRS
// ============================================================
// Protocolo oficial NT 2015.003 / SVRS: SOAP 1.2 com mTLS (certificado A1),
// consulta por último NSU, e documentos devolvidos em docZip (gzip + base64).
// Abrange fretes onde a empresa é Tomadora, Remetente, Destinatária,
// Recebedora ou Expedidora.

import https from 'https';
import tls from 'tls';
import fs from 'fs';
import { gunzipSync } from 'zlib';
import type { CredencialA1 } from '../nfse/assinatura';

export type AmbienteCte = 'producao' | 'homologacao';

const ENDPOINTS: Record<AmbienteCte, string> = {
  producao: 'https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx',
  homologacao: 'https://hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx',
};

const TIMEOUT_MS = 40_000;
const NS_WSDL = 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe';

export class SefazCteIndisponivelError extends Error {}

export const padNsu = (nsu: string | number) => String(nsu || '0').replace(/\D/g, '').padStart(15, '0');

export function montarEnvelopeDistribuicaoCte(p: { ambiente: AmbienteCte; cnpj: string; ultNsu: string; cUfAutor?: string }): string {
  const cnpj = p.cnpj.replace(/\D/g, '');
  const uf = p.cUfAutor && /^\d{2}$/.test(p.cUfAutor) ? `<cUFAutor>${p.cUfAutor}</cUFAutor>` : '<cUFAutor>91</cUFAutor>';
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">'
    + '<soap12:Body>'
    + `<cteDistDFeInteresse xmlns="${NS_WSDL}"><cteDadosMsg>`
    + '<distDFeInt xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00">'
    + `<tpAmb>${p.ambiente === 'producao' ? 1 : 2}</tpAmb>${uf}<CNPJ>${cnpj}</CNPJ>`
    + `<distNSU><ultNSU>${padNsu(p.ultNsu)}</ultNSU></distNSU>`
    + '</distDFeInt></cteDadosMsg></cteDistDFeInteresse>'
    + '</soap12:Body></soap12:Envelope>';
}

function raizesConfiaveis(): string[] | undefined {
  const caminho = process.env.NFE_CA_PEM_PATH;
  if (!caminho) return undefined;
  try {
    return [...tls.rootCertificates, fs.readFileSync(caminho, 'utf8')];
  } catch {
    throw new SefazCteIndisponivelError(`Não foi possível ler NFE_CA_PEM_PATH (${caminho}).`);
  }
}

export function enviarDistribuicaoCte(
  credencial: CredencialA1,
  ambiente: AmbienteCte,
  envelope: string,
  timeoutMs = TIMEOUT_MS
): Promise<{ status: number; corpo: string }> {
  const url = new URL(ENDPOINTS[ambiente]);
  const ca = raizesConfiaveis();
  const agent = new https.Agent({
    key: credencial.chavePem,
    cert: credencial.certificadosPem,
    keepAlive: false,
    ...(ca ? { ca } : { rejectUnauthorized: false }),
  });
  const corpo = Buffer.from(envelope, 'utf8');

  return new Promise((resolve, reject) => {
    const req = https.request({
      agent,
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname,
      timeout: timeoutMs,
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${NS_WSDL}/cteDistDFeInteresse"`,
        'Content-Length': corpo.length,
      },
    }, res => {
      const partes: Buffer[] = [];
      res.on('data', parte => partes.push(parte));
      res.on('end', () => resolve({ status: res.statusCode || 0, corpo: Buffer.concat(partes).toString('utf8') }));
      res.on('error', erro => reject(new SefazCteIndisponivelError(`Conexão interrompida com SVRS: ${erro.message}`)));
    });

    req.on('timeout', () => req.destroy(new Error('tempo esgotado')));
    req.on('error', (erro: NodeJS.ErrnoException) => {
      const cadeia = erro.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || erro.code === 'SELF_SIGNED_CERT_IN_CHAIN' || erro.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY';
      reject(new SefazCteIndisponivelError(cadeia
        ? 'O servidor da SEFAZ/SVRS usa cadeia ICP-Brasil não reconhecida. Configure NFE_CA_PEM_PATH.'
        : `Falha de comunicação com SEFAZ CT-e (SVRS): ${erro.message}`));
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

export interface DocZipCte {
  nsu: string;
  schema: string;
  xml: string;
}

export interface RespostaDistribuicaoCte {
  cStat: string;
  xMotivo: string;
  ultNsu: string;
  maxNsu: string;
  documentos: DocZipCte[];
}

export function lerRespostaDistribuicaoCte(soap: string): RespostaDistribuicaoCte {
  const ret = soap.match(/<retDistDFeInt[\s\S]*?<\/retDistDFeInt>/)?.[0];
  if (!ret) {
    const falha = tag(soap, 'Text') || tag(soap, 'faultstring') || tag(soap, 'Reason');
    throw new SefazCteIndisponivelError(`Resposta inesperada da SEFAZ CT-e${falha ? `: ${falha}` : '.'}`);
  }

  const documentos: DocZipCte[] = [];
  for (const m of ret.matchAll(/<docZip\s+([^>]*)>([^<]*)<\/docZip>/g)) {
    const nsu = m[1].match(/NSU="(\d+)"/)?.[1];
    const schema = m[1].match(/schema="([^"]+)"/)?.[1];
    if (!nsu || !schema) continue;
    try {
      documentos.push({ nsu, schema, xml: gunzipSync(Buffer.from(m[2].trim(), 'base64')).toString('utf8') });
    } catch {
      // docZip corrompido: continua os demais
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

export interface DadosCte {
  chave: string;
  emitenteCnpj: string;
  emitenteNome: string;
  emitenteIe: string | null;
  dataEmissao: string;
  tipoOperacao: number | null; // null ou 1
  valorNf: number;
  situacao: 'autorizada' | 'cancelada';
  protocolo: string | null;
  numero: string | null;
  serie: string | null;
}

export type DocumentoCteDfe =
  | { tipo: 'resumo'; nota: DadosCte }
  | { tipo: 'completa'; nota: DadosCte; xml: string }
  | { tipo: 'evento'; chave: string; tpEvento: string; descricao: string | null; protocolo: string | null };

const numero = (t: string | null) => {
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
};

export function interpretarDocumentoCte(schema: string, xml: string): DocumentoCteDfe | null {
  // 1. Resumo de CT-e (resCTe)
  if (schema.toLowerCase().includes('rescte')) {
    const chave = tag(xml, 'chCTe');
    if (!chave) return null;
    const sit = tag(xml, 'cSitCTe') === '2' ? 'cancelada' : 'autorizada';
    return {
      tipo: 'resumo',
      nota: {
        chave,
        emitenteCnpj: tag(xml, 'CNPJ') || tag(xml, 'CPF') || '',
        emitenteNome: tag(xml, 'xNome') || 'TRANSPORTADORA',
        emitenteIe: tag(xml, 'IE'),
        dataEmissao: (tag(xml, 'dhEmi') || '').slice(0, 10),
        tipoOperacao: 1, // CT-e de frete é despesa/aquisição de serviço de transporte
        valorNf: numero(tag(xml, 'vTPrest') || tag(xml, 'vRec')),
        situacao: sit,
        protocolo: tag(xml, 'nProt'),
        numero: chave.length === 44 ? String(Number(chave.slice(25, 34))) : null,
        serie: chave.length === 44 ? String(Number(chave.slice(22, 25))) : null,
      },
    };
  }

  // 2. CT-e Completo com XML (procCTe)
  if (schema.toLowerCase().includes('proccte') || xml.includes('<cteProc') || xml.includes('<CTe')) {
    const chave = (xml.match(/<infCte[^>]*\sId="CTe(\d{44})"/) || [])[1] || tag(xml, 'chCTe');
    if (!chave) return null;
    const ide = bloco(xml, 'ide');
    const emit = bloco(xml, 'emit');
    const vPrest = bloco(xml, 'vPrest');
    const infProt = bloco(xml, 'infProt');
    const cStatProt = tag(infProt, 'cStat');
    const situacao = cStatProt === '101' || cStatProt === '135' ? 'cancelada' : 'autorizada';

    return {
      tipo: 'completa',
      xml,
      nota: {
        chave,
        emitenteCnpj: tag(emit, 'CNPJ') || tag(emit, 'CPF') || '',
        emitenteNome: tag(emit, 'xNome') || 'TRANSPORTADORA',
        emitenteIe: tag(emit, 'IE'),
        dataEmissao: (tag(ide, 'dhEmi') || '').slice(0, 10),
        tipoOperacao: 1,
        valorNf: numero(tag(vPrest, 'vTPrest') || tag(vPrest, 'vRec')),
        situacao,
        protocolo: tag(infProt, 'nProt'),
        numero: tag(ide, 'nCT') || (chave.length === 44 ? String(Number(chave.slice(25, 34))) : null),
        serie: tag(ide, 'serie') || (chave.length === 44 ? String(Number(chave.slice(22, 25))) : null),
      },
    };
  }

  // 3. Eventos de CT-e (cancelamento etc.)
  if (schema.toLowerCase().includes('evento') || xml.includes('<procEventoCTe') || xml.includes('<retEventoCTe')) {
    const chave = tag(xml, 'chCTe');
    const tpEvento = tag(xml, 'tpEvento');
    if (!chave || !tpEvento) return null;
    return {
      tipo: 'evento',
      chave,
      tpEvento,
      descricao: tag(xml, 'xEvento') || tag(xml, 'descEvento'),
      protocolo: tag(xml, 'nProt'),
    };
  }

  return null;
}
