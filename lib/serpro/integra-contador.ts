// ============================================================
// SERPRO INTEGRA CONTADOR — Integração Oficial com Receita Federal
// ============================================================
// Suporta:
// 1. Consulta automática de Alíquota Efetiva do Simples Nacional (PGDAS-D)
// 2. Consulta e Emissão de Certidão Negativa Federal / Situação Fiscal (SITFIS)
// ============================================================

import https from 'https';
import zlib from 'zlib';
import db from '../prisma';
import { ID_CERT_ESCRITORIO, ESCOPO_CERT_ESCRITORIO } from '../nfse/servidor';
import { decifrar } from '../nfse/cofre';
import { lerCertificadoA1 } from '../nfse/assinatura';
import { classificarRelatorioSitfis, type SituacaoFederal } from '../certidoes/situacao';

// Cada consulta faz duas chamadas: precisa caber nos 60 s da função.
const TIMEOUT_GATEWAY_MS = 25_000;

// Credenciais fornecidas pelo cliente (podem ser sobrescritas por variáveis de ambiente)
const CONSUMER_KEY_PADRAO = 'cmbN0rWbJvs1rRwxHXgtzPxU3jEa';
const CONSUMER_SECRET_PADRAO = 'q90N3fWvD9euIWpDEoZNdahFfU0a';

export const SERPRO_CONFIG = {
  consumerKey: process.env.SERPRO_CONSUMER_KEY || CONSUMER_KEY_PADRAO,
  consumerSecret: process.env.SERPRO_CONSUMER_SECRET || CONSUMER_SECRET_PADRAO,
  authUrl: 'https://autenticacao.sapi.serpro.gov.br/authenticate',
  gatewayUrl: 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1',
};

interface TokenCache {
  accessToken: string;
  jwtToken: string;
  expiresAt: number;
  contratanteCnpj: string;
}

let tokenCache: TokenCache | null = null;

/**
 * Remove formatação de CNPJ/CPF (somente dígitos).
 */
export function apenasDigitos(val: string | null | undefined): string {
  return (val || '').replace(/\D/g, '');
}

/**
 * Carrega a credencial A1 do escritório de contabilidade para mTLS.
 */
async function obterAgenteMtls(): Promise<{ agent: https.Agent; cnpjContratante: string }> {
  const cert = await db.nfseCertificadoEscritorio.findUnique({ where: { id: ID_CERT_ESCRITORIO } });
  if (!cert) {
    throw new Error('Certificado do contador não configurado. Envie o certificado digital do escritório.');
  }

  const pfx = decifrar(cert.certPfxCifrado, ESCOPO_CERT_ESCRITORIO);
  const senha = decifrar(cert.certSenhaCifrada, ESCOPO_CERT_ESCRITORIO).toString('utf8');
  const credencial = lerCertificadoA1(pfx, senha);

  const cnpj = apenasDigitos(credencial.documento || credencial.cnpj || '');
  if (!cnpj) {
    throw new Error('Não foi possível identificar o CNPJ do titular no certificado do escritório.');
  }

  const agent = new https.Agent({
    key: credencial.chavePem,
    cert: credencial.certificadosPem,
    rejectUnauthorized: false,
  });

  return { agent, cnpjContratante: cnpj };
}

/**
 * Obtém tokens OAuth2 e JWT junto ao SERPRO via mTLS com cache inteligente.
 */
export async function obterTokensSerpro(forcarRenovacao = false): Promise<{ accessToken: string; jwtToken: string; cnpjContratante: string }> {
  const agora = Date.now();
  if (!forcarRenovacao && tokenCache && tokenCache.expiresAt > agora + 60000) {
    return {
      accessToken: tokenCache.accessToken,
      jwtToken: tokenCache.jwtToken,
      cnpjContratante: tokenCache.contratanteCnpj,
    };
  }

  const { agent, cnpjContratante } = await obterAgenteMtls();
  const basicAuth = Buffer.from(`${SERPRO_CONFIG.consumerKey}:${SERPRO_CONFIG.consumerSecret}`).toString('base64');

  const authData = await new Promise<any>((resolve, reject) => {
    const req = https.request(SERPRO_CONFIG.authUrl, {
      method: 'POST',
      agent,
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Role-Type': 'TERCEIROS',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        if (resp.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Erro ao interpretar retorno JSON do SERPRO: ${data}`));
          }
        } else {
          reject(new Error(`Falha na autenticação SERPRO (${resp.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write('grant_type=client_credentials');
    req.end();
  });

  const expiresInSec = Number(authData.expires_in) || 1800;
  tokenCache = {
    accessToken: authData.access_token,
    jwtToken: authData.jwt_token,
    expiresAt: agora + (expiresInSec * 1000) - 120000, // renova 2 min antes
    contratanteCnpj: cnpjContratante,
  };

  return {
    accessToken: tokenCache.accessToken,
    jwtToken: tokenCache.jwtToken,
    cnpjContratante,
  };
}

/**
 * Realiza uma requisição genérica ao gateway do Integra Contador.
 */
export async function chamarIntegraContador(
  endpoint: 'Consultar' | 'Apoiar' | 'Emitir' | 'Declarar',
  contribuinteCnpj: string,
  pedidoDados: {
    idSistema: string;
    idServico: string;
    versaoSistema: string;
    dados: string;
  }
): Promise<{ status: number; dados: any; mensagens: any[]; headers: Record<string, any> }> {
  const { accessToken, jwtToken, cnpjContratante } = await obterTokensSerpro();
  const cnpjLimpo = apenasDigitos(contribuinteCnpj);

  const payload = JSON.stringify({
    contratante: { numero: cnpjContratante, tipo: 2 },
    autorPedidoDados: { numero: cnpjContratante, tipo: 2 },
    contribuinte: { numero: cnpjLimpo, tipo: 2 },
    pedidoDados,
  });

  return new Promise((resolve, reject) => {
    const url = `${SERPRO_CONFIG.gatewayUrl}/${endpoint}`;
    const req = https.request(url, {
      method: 'POST',
      timeout: TIMEOUT_GATEWAY_MS,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'jwt_token': jwtToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (resp) => {
      let body = '';
      resp.on('data', chunk => body += chunk);
      resp.on('end', () => {
        // Se 304, protocolo pode estar no header etag
        let parsedDados: any = null;
        let mensagens: any[] = [];
        if (body.trim().length > 0) {
          try {
            const json = JSON.parse(body);
            parsedDados = json.dados ? (typeof json.dados === 'string' ? JSON.parse(json.dados) : json.dados) : null;
            mensagens = json.mensagens || [];
          } catch {
            parsedDados = body;
          }
        }
        resolve({
          status: resp.statusCode || 200,
          dados: parsedDados,
          mensagens,
          headers: resp.headers,
        });
      });
    });

    req.on('timeout', () => req.destroy(new Error('O Integra Contador não respondeu a tempo. Tente de novo.')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Extrai texto legível de streams comprimidos de um PDF em formato Buffer.
 */
function extrairTextoPdf(pdfBuf: Buffer): string[] {
  const pdfStr = pdfBuf.toString('binary');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  let allText = '';

  while ((match = streamRegex.exec(pdfStr)) !== null) {
    try {
      const decompressed = zlib.inflateSync(Buffer.from(match[1], 'binary'));
      allText += '\n' + decompressed.toString('latin1');
    } catch {
      // Ignora streams que não usam Deflate ou que são imagens binárias
    }
  }

  const out: string[] = [];
  const tjRegex = /\(([^()]*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tjRegex.exec(allText)) !== null) {
    const t = m[1].replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\').trim();
    if (t) out.push(t);
  }
  return out;
}

export interface AliquotaSimplesResult {
  sucesso: boolean;
  aliquota: number;
  /** Alíquota efetiva do ISS na partilha do Simples Nacional (2% a 5%), usada quando há ISS retido. */
  aliquotaIss?: number;
  valorIss?: number;
  rbt12?: number;
  rpa?: number;
  valorDevido?: number;
  periodoApuracao?: string;
  dataApuracao?: string;
  numeroDas?: string;
  numeroDeclaracao?: string;
  pdfBase64?: string;
  detalhes?: string;
  aviso?: string;
}

/**
 * Calcula a partilha oficial do ISS no Anexo III (Serviços) a partir da alíquota efetiva e da RBT12,
 * usado como fallback caso a linha de ISS não esteja legível no PDF do extrato PGDAS-D.
 */
function estimarAliquotaIssAnexoIII(aliquotaEfetiva: number, rbt12: number): number | undefined {
  if (!(aliquotaEfetiva > 0)) return undefined;
  let percentualPartilhaIss = 0.335; // Faixa 1 (até 180k): 33,5%
  if (rbt12 > 3600000) percentualPartilhaIss = 0; // Acima do sublimite (ISS fora do SN)
  else if (rbt12 > 1800000) percentualPartilhaIss = 0.335;
  else if (rbt12 > 720000) percentualPartilhaIss = 0.335;
  else if (rbt12 > 360000) percentualPartilhaIss = 0.325;
  else if (rbt12 > 180000) percentualPartilhaIss = 0.32;
  if (percentualPartilhaIss === 0) return undefined;
  const calc = Number((aliquotaEfetiva * percentualPartilhaIss).toFixed(4));
  return Math.min(5, Math.max(2, calc));
}

function parseNumeroBr(valor: string): number {
  const limpo = (valor || '').replace(/[^\d.,]/g, '');
  if (!limpo) return 0;
  return parseFloat(limpo.replace(/\./g, '').replace(',', '.')) || 0;
}

function extrairIssDoTextoPdf(textoPipe: string, rpa: number, aliquotaEfetiva: number, rbt12: number): {
  aliquotaIss?: number;
  valorIss?: number;
} {
  // 1) Seção do DAS Gerado (formato oficial PGDAS-D): "... | IPI | 0,00 | ISS | 668,17 | Principal | 2.088,00"
  const dasIssMatch = textoPipe.match(
    /IPI\s*\|\s*[0-9\.\,]+\s*\|\s*ISS\s*\|\s*([0-9\.\,]+)\s*\|\s*Principal/i
  ) || textoPipe.match(/\|\s*ISS\s*\|\s*([0-9\.\,]+)\s*\|\s*Principal/i);
  if (dasIssMatch && rpa > 0) {
    const valorIss = parseNumeroBr(dasIssMatch[1]);
    if (valorIss > 0) {
      const aliq = Number(((valorIss / rpa) * 100).toFixed(4));
      if (aliq >= 1.5 && aliq <= 5.5) {
        return { aliquotaIss: Math.min(5, Math.max(2, aliq)), valorIss };
      }
    }
  }

  // 2) Linha da tabela de tributos do PGDAS-D: IRPJ | CSLL | COFINS | PIS/Pasep | INSS/CPP | ICMS | IPI | ISS | Total
  const tabelaMatch = textoPipe.match(
    /IRPJ\s*\|\s*CSLL\s*\|\s*COFINS\s*\|\s*PIS\/Pasep\s*\|\s*INSS\/CPP\s*\|\s*ICMS\s*\|\s*IPI\s*\|\s*ISS\s*\|\s*Total\s*\|\s*(?:[0-9\.\,]+\s*\|\s*){7}([0-9\.\,]+)\s*\|\s*([0-9\.\,]+)/i
  );
  if (tabelaMatch && rpa > 0) {
    const valorIss = parseNumeroBr(tabelaMatch[1]);
    if (valorIss > 0) {
      const aliq = Number(((valorIss / rpa) * 100).toFixed(4));
      if (aliq >= 1.5 && aliq <= 5.5) {
        return { aliquotaIss: Math.min(5, Math.max(2, aliq)), valorIss };
      }
    }
  }

  // 3) Fallback oficial pela partilha do Anexo III com base na alíquota efetiva e RBT12
  const estimada = estimarAliquotaIssAnexoIII(aliquotaEfetiva, rbt12);
  return { aliquotaIss: estimada };
}

/**
 * Consulta a Alíquota Efetiva do Simples Nacional via Integra Contador (PGDAS-D).
 */
export async function buscarAliquotaSimplesNacional(cnpj: string): Promise<AliquotaSimplesResult> {
  const cnpjLimpo = apenasDigitos(cnpj);
  if (cnpjLimpo.length !== 14) {
    throw new Error('CNPJ inválido para consulta do Simples Nacional.');
  }

  const anoAtual = new Date().getFullYear();
  const anosParaBuscar = [anoAtual, anoAtual - 1];

  // Reúne TODAS as competências entregues (com operações) dos dois anos. A alíquota deve vir
  // sempre da última competência entregue, então a escolha é pela maior competência (AAAAMM),
  // e não pela ordem da lista: o Sefin não garante a ordenação dos períodos.
  const entregues: { periodo: any; operacoes: any[] }[] = [];
  for (const ano of anosParaBuscar) {
    try {
      const res = await chamarIntegraContador('Consultar', cnpjLimpo, {
        idSistema: 'PGDASD',
        idServico: 'CONSDECLARACAO13',
        versaoSistema: '1.0',
        dados: JSON.stringify({ anoCalendario: String(ano) }),
      });
      const periodos = res.status === 200 && Array.isArray(res.dados?.periodos) ? res.dados.periodos : [];
      for (const periodo of periodos) {
        const operacoes = Array.isArray(periodo?.operacoes) ? periodo.operacoes : [];
        if (operacoes.length > 0) entregues.push({ periodo, operacoes });
      }
    } catch (err) {
      console.warn(`[Integra Contador] Tentativa de consulta PGDASD para o ano ${ano} retornou erro:`, err);
    }
  }

  // periodoApuracao vem como AAAAMM: só dígitos e comparação numérica já dão a ordem correta.
  const competencia = (p: any) => Number(String(p?.periodoApuracao ?? '').replace(/\D/g, '')) || 0;
  entregues.sort((a, b) => competencia(b.periodo) - competencia(a.periodo));

  const escolhido = entregues[0] || null;
  if (!escolhido) {
    return {
      sucesso: false,
      aliquota: 0,
      aviso: 'Nenhuma competência do PGDAS-D entregue foi encontrada para este CNPJ na Receita Federal.',
    };
  }
  // Percorre as competências entregues (da mais recente para a mais antiga, até 6 períodos)
  // até encontrar uma apuração com DAS emitido e receita/imposto > 0 (evita cair em mês sem movimento).
  let fallbackComDeclaracao: { periodo: any; numeroDeclaracao?: string } | null = null;

  for (const item of entregues.slice(0, 6)) {
    const ultimoPeriodoEncontrado = item.periodo;
    const ultimasOperacoes = item.operacoes;
    const dasOp = ultimasOperacoes.find(o => o.indiceDas?.numeroDas);
    const numeroDas = dasOp?.indiceDas?.numeroDas;
    const decOp = ultimasOperacoes.find(o => o.indiceDeclaracao?.numeroDeclaracao);
    const numeroDeclaracao = decOp?.indiceDeclaracao?.numeroDeclaracao;

    if (!fallbackComDeclaracao) {
      fallbackComDeclaracao = { periodo: ultimoPeriodoEncontrado, numeroDeclaracao };
    }

    if (!numeroDas) continue;

    try {
      const resExtrato = await chamarIntegraContador('Consultar', cnpjLimpo, {
        idSistema: 'PGDASD',
        idServico: 'CONSEXTRATO16',
        versaoSistema: '1.0',
        dados: JSON.stringify({ numeroDas }),
      });

      if (resExtrato.status === 200 && resExtrato.dados?.extrato?.pdf) {
        const pdfB64 = resExtrato.dados.extrato.pdf;
        const pdfBuf = Buffer.from(pdfB64, 'base64');
        const linhas = extrairTextoPdf(pdfBuf);
        const textoPipe = linhas.join(' | ');

        // 1. Busca RPA (Receita Bruta do PA):
        // Formato real do extrato PGDAS-D:
        // "Mercado Interno | Mercado Externo | Total | 26.816,50 | 0,00 | 26.816,50"
        // ou "Receita Bruta Informada: R$ 26.816,50"
        let rpa = 0;
        const rpaDiscMatch = textoPipe.match(
          /Mercado Interno\s*\|\s*Mercado Externo\s*\|\s*Total\s*\|\s*[0-9\.\,]+\s*\|\s*[0-9\.\,]+\s*\|\s*([0-9\.\,]+)/i
        );
        const rpaInfMatch = textoPipe.match(/Receita Bruta Informada:\s*R?\$?\s*([0-9\.\,]+)/i);
        const rpaAntigoMatch = textoPipe.match(/Receita Bruta do PA[^0-9]*([0-9\.\,]+)/i);
        if (rpaDiscMatch) rpa = parseNumeroBr(rpaDiscMatch[1]);
        else if (rpaInfMatch) rpa = parseNumeroBr(rpaInfMatch[1]);
        else if (rpaAntigoMatch) rpa = parseNumeroBr(rpaAntigoMatch[1]);

        // 2. Busca RBT12 (Receita bruta acumulada nos doze meses anteriores ao PA):
        // Formato real: "Receita bruta acumulada nos doze meses anteriores ao PA | 274.206,50 | 0,00 | 274.206,50"
        let rbt12 = 0;
        const rbt12DiscMatch = textoPipe.match(
          /doze meses anteriores ao PA[^\|]*\|\s*[0-9\.\,]+\s*\|\s*[0-9\.\,]+\s*\|\s*([0-9\.\,]+)/i
        );
        const rbt12AntigoMatch = textoPipe.match(/RBT12[^0-9]*([0-9\.\,]+)/i);
        if (rbt12DiscMatch) rbt12 = parseNumeroBr(rbt12DiscMatch[1]);
        else if (rbt12AntigoMatch) rbt12 = parseNumeroBr(rbt12AntigoMatch[1]);

        // 3. Busca Valor Total do Imposto (Principal do DAS Gerado ou coluna Total da tabela de tributos)
        let valorDevido = 0;
        const principalMatch = textoPipe.match(/\|\s*Principal\s*\|\s*([0-9\.\,]+)/i);
        const tabelaTotalMatch = textoPipe.match(
          /IRPJ\s*\|\s*CSLL\s*\|\s*COFINS\s*\|\s*PIS\/Pasep\s*\|\s*INSS\/CPP\s*\|\s*ICMS\s*\|\s*IPI\s*\|\s*ISS\s*\|\s*Total\s*\|\s*(?:[0-9\.\,]+\s*\|\s*){8}([0-9\.\,]+)/i
        );
        if (principalMatch) valorDevido = parseNumeroBr(principalMatch[1]);
        else if (tabelaTotalMatch) valorDevido = parseNumeroBr(tabelaTotalMatch[1]);

        // 4. Alíquota efetiva exata do Simples Nacional (preserva 4 casas decimais)
        let aliquotaEfetiva = 0;
        if (rpa > 0 && valorDevido > 0) {
          aliquotaEfetiva = Number(((valorDevido / rpa) * 100).toFixed(4));
        }

        // Se este período não teve faturamento/imposto, continua tentando a competência anterior
        if (!(aliquotaEfetiva > 0)) continue;

        const { aliquotaIss, valorIss } = extrairIssDoTextoPdf(textoPipe, rpa, aliquotaEfetiva, rbt12);

        // Período de apuração formatado (MM/AAAA)
        const paRaw = String(ultimoPeriodoEncontrado.periodoApuracao || '');
        const periodoApuracao = /^\d{6}$/.test(paRaw) ? `${paRaw.slice(4, 6)}/${paRaw.slice(0, 4)}` : paRaw;

        return {
          sucesso: true,
          aliquota: aliquotaEfetiva,
          aliquotaIss,
          valorIss,
          rbt12,
          rpa,
          valorDevido,
          periodoApuracao,
          numeroDas,
          numeroDeclaracao,
          pdfBase64: pdfB64,
          detalhes: `Alíquota Simples: ${aliquotaEfetiva}%${aliquotaIss ? ` · ISS: ${aliquotaIss}%` : ''} (Imposto: R$ ${valorDevido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / RPA: R$ ${rpa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) - PA: ${periodoApuracao}`,
        };
      }
    } catch (err) {
      console.warn('[Integra Contador] Erro ao buscar extrato do DAS:', err);
    }
  }

  // Fallback: consulta última declaração via CONSULTIMADECREC14
  const paString = String((fallbackComDeclaracao?.periodo || escolhido.periodo).periodoApuracao);
  const resUltima = await chamarIntegraContador('Consultar', cnpjLimpo, {
    idSistema: 'PGDASD',
    idServico: 'CONSULTIMADECREC14',
    versaoSistema: '1.0',
    dados: JSON.stringify({ periodoApuracao: paString }),
  });

  if (resUltima.status === 200) {
    return {
      sucesso: true,
      aliquota: 6.00,
      aliquotaIss: 2.01,
      periodoApuracao: paString,
      numeroDeclaracao: resUltima.dados?.numeroDeclaracao,
      aviso: 'Declaração localizada sem DAS calculado; sugerida alíquota inicial de referência (Anexo III).',
    };
  }

  return {
    sucesso: false,
    aliquota: 0,
    aviso: 'Não foi possível extrair a alíquota da apuração do Simples Nacional.',
  };
}

export interface CertidaoFederalResult {
  sucesso: boolean;
  situacao: SituacaoFederal;
  protocolo?: string;
  pdfBase64?: string;
  mensagem: string;
  detalhes?: any;
}

/**
 * Emite o Relatório de Situação Fiscal (SITFIS) pelo Integra Contador.
 * É um relatório, não uma certidão: a CND é emitida pela Receita, em serviço próprio.
 */
export async function consultarCertidaoNegativaFederal(cnpj: string): Promise<CertidaoFederalResult> {
  const cnpjLimpo = apenasDigitos(cnpj);
  if (cnpjLimpo.length !== 14) {
    throw new Error('CNPJ inválido para consulta de Certidão Negativa Federal.');
  }

  // 1. Solicitar Protocolo em /Apoiar
  const resApoiar = await chamarIntegraContador('Apoiar', cnpjLimpo, {
    idSistema: 'SITFIS',
    idServico: 'SOLICITARPROTOCOLO91',
    versaoSistema: '2.0',
    dados: '',
  });

  let protocolo = '';
  let tempoEsperaMs = 3000;

  if (resApoiar.status === 200 && resApoiar.dados?.protocoloRelatorio) {
    protocolo = resApoiar.dados.protocoloRelatorio;
    tempoEsperaMs = (resApoiar.dados.tempoEspera || 3000);
  } else if (resApoiar.status === 304 || (resApoiar.headers && resApoiar.headers.etag)) {
    // Protocolo retornado no header etag quando em cache
    const etag = String(resApoiar.headers.etag || '');
    const cleanEtag = etag.replace(/"/g, '').replace('protocoloRelatorio:', '').trim();
    if (cleanEtag) {
      protocolo = cleanEtag;
      tempoEsperaMs = 1500;
    }
  }

  if (!protocolo) {
    const msgErro = resApoiar.mensagens?.[0]?.texto || 'Não foi possível gerar protocolo de consulta no SITFIS.';
    return {
      sucesso: false,
      situacao: 'ERRO',
      mensagem: msgErro,
      detalhes: resApoiar.mensagens,
    };
  }

  // Aguarda tempo de processamento estipulado pelo SERPRO
  await new Promise(r => setTimeout(r, Math.min(tempoEsperaMs, 5000)));

  // 2. Emitir Relatório em /Emitir
  const resEmitir = await chamarIntegraContador('Emitir', cnpjLimpo, {
    idSistema: 'SITFIS',
    idServico: 'RELATORIOSITFIS92',
    versaoSistema: '2.0',
    dados: JSON.stringify({ protocoloRelatorio: protocolo }),
  });

  if (resEmitir.status === 200 && resEmitir.dados?.pdf) {
    const pdfB64 = resEmitir.dados.pdf;
    const pdfBuf = Buffer.from(pdfB64, 'base64');
    const situacao = classificarRelatorioSitfis(extrairTextoPdf(pdfBuf).join(' '));

    return {
      sucesso: true,
      situacao,
      protocolo,
      pdfBase64: pdfB64,
      mensagem: situacao === 'INDETERMINADA'
        ? 'Relatório emitido, mas o resultado não pôde ser lido automaticamente. Abra o PDF para conferir.'
        : 'Relatório de Situação Fiscal emitido pela Receita Federal e PGFN.',
    };
  }

  if (resEmitir.dados?.tempoEspera) {
    return {
      sucesso: true,
      situacao: 'PROCESSANDO',
      protocolo,
      mensagem: `A Receita Federal está consolidando o relatório de situação fiscal. Tente novamente em alguns segundos (Protocolo: ${protocolo.slice(0, 16)}...).`,
    };
  }

  const msgEmitir = resEmitir.mensagens?.[0]?.texto || 'Erro ao emitir o relatório no Integra Contador.';
  return {
    sucesso: false,
    situacao: 'ERRO',
    protocolo,
    mensagem: msgEmitir,
    detalhes: resEmitir.mensagens,
  };
}
