// ============================================================
// INTEGRAÇÃO PIX DIRETA — API SICOOB (mTLS + OAuth2 BACEN v2)
// Reutiliza o Certificado A1 da Privilege já salvo no cofre.
// ============================================================

import https from 'https';
import db from './prisma';
import { decifrar } from './nfse/cofre';
import { lerCertificadoA1 } from './nfse/assinatura';

const DEFAULT_SICOOB_CLIENT_ID = '35fcd9a6-cf4b-470d-a665-9785af693fd5';
const DEFAULT_SICOOB_CHAVE_PIX = '58033979000184';
const DEFAULT_SICOOB_CERT_CNPJ = '58033979000184';

let tabelaPixGarantida = false;

export async function ensureFinancasPixTable() {
  if (tabelaPixGarantida) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financas_pessoais_cobrancas_pix (
      txid TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      nome TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      plano TEXT NOT NULL DEFAULT 'mensal',
      valor DOUBLE PRECISION NOT NULL DEFAULT 29.9,
      brcode TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ATIVA',
      paid_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_fp_pix_user ON financas_pessoais_cobrancas_pix(user_id, created_at DESC)`
  );
  tabelaPixGarantida = true;
}

interface HttpResult {
  status: number;
  body: string;
}

function httpsMtls(
  urlStr: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    body?: string;
    certPem: string;
    keyPem: string;
  }
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const agent = new https.Agent({
      cert: options.certPem,
      key: options.keyPem,
      keepAlive: true,
      rejectUnauthorized: false,
    });

    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: options.method,
        agent,
        timeout: 20000,
        headers: {
          Accept: 'application/json',
          ...(options.headers || {}),
          ...(options.body ? { 'Content-Length': String(Buffer.byteLength(options.body)) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('Tempo limite esgotado na comunicação com a API Pix Sicoob.')));
    req.on('error', (err) => reject(err));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function carregarCredenciaisSicoob(): Promise<{
  certPem: string;
  keyPem: string;
  clientId: string;
  chavePix: string;
}> {
  const targetCnpj = (process.env.SICOOB_CERT_CNPJ || DEFAULT_SICOOB_CERT_CNPJ).replace(/\D/g, '');
  const cfg =
    (await db.nfseConfig.findFirst({
      where: { certCnpj: targetCnpj, certPfxCifrado: { not: null }, certSenhaCifrada: { not: null } },
    })) ||
    (await db.nfseConfig.findFirst({
      where: { certPfxCifrado: { not: null }, certSenhaCifrada: { not: null } },
    }));

  if (!cfg?.certPfxCifrado || !cfg?.certSenhaCifrada) {
    throw new Error('Certificado Digital A1 (mTLS) da Privilege não encontrado no cofre para autenticar no Sicoob.');
  }

  const pfxBuf = decifrar(cfg.certPfxCifrado, cfg.empresaId);
  const senhaStr = decifrar(cfg.certSenhaCifrada, cfg.empresaId).toString('utf8');
  const cred = lerCertificadoA1(pfxBuf, senhaStr);

  return {
    certPem: cred.certificadosPem,
    keyPem: cred.chavePem,
    clientId: (process.env.SICOOB_CLIENT_ID || DEFAULT_SICOOB_CLIENT_ID).trim(),
    chavePix: (process.env.SICOOB_PIX_CHAVE || DEFAULT_SICOOB_CHAVE_PIX).trim(),
  };
}

async function obterTokenSicoobPix(certPem: string, keyPem: string, clientId: string): Promise<string> {
  const scopes = [
    'cob.write cob.read pix.read',
    'cob.write cob.read cobv.write cobv.read pix.write pix.read',
    'cob.write cob.read',
  ];

  let lastError = '';
  for (const sc of scopes) {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      scope: sc,
    }).toString();

    const res = await httpsMtls(
      'https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        certPem,
        keyPem,
      }
    );

    if (res.status >= 200 && res.status < 300) {
      const parsed = JSON.parse(res.body || '{}');
      if (parsed.access_token) return String(parsed.access_token);
    } else {
      lastError = `HTTP ${res.status}: ${res.body.slice(0, 180)}`;
    }
  }

  throw new Error(`Falha ao autenticar na API Pix Sicoob (${lastError}).`);
}

export async function criarCobrancaPixSicoob(params: {
  valor: number;
  descricao: string;
  pagadorNome?: string;
  pagadorCpf?: string;
  expiracaoSegundos?: number;
}): Promise<{
  txid: string;
  brcode: string;
  status: string;
  valor: number;
  expiracaoSegundos: number;
}> {
  const { certPem, keyPem, clientId, chavePix } = await carregarCredenciaisSicoob();
  const accessToken = await obterTokenSicoobPix(certPem, keyPem, clientId);

  const randomHex = Array.from({ length: 20 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const txid = `PRIVPF${Date.now()}${randomHex}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32).padEnd(28, '0');
  const expiracao = params.expiracaoSegundos || 86400; // 24h

  const doc = String(params.pagadorCpf || '').replace(/\D/g, '');
  const devedor =
    (doc.length === 11 || doc.length === 14) && params.pagadorNome?.trim()
      ? doc.length === 14
        ? { cnpj: doc, nome: params.pagadorNome.trim().slice(0, 80) }
        : { cpf: doc, nome: params.pagadorNome.trim().slice(0, 80) }
      : undefined;

  const payload = {
    calendario: { expiracao },
    ...(devedor ? { devedor } : {}),
    valor: { original: Number(params.valor).toFixed(2) },
    chave: chavePix,
    solicitacaoPagador: (params.descricao || 'Assinatura Privilege Finanças PF').slice(0, 140),
  };

  const cobRes = await httpsMtls(`https://api.sicoob.com.br/pix/api/v2/cob/${txid}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      client_id: clientId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    certPem,
    keyPem,
  });

  if (cobRes.status < 200 || cobRes.status >= 300) {
    throw new Error(`Sicoob API Pix retornou HTTP ${cobRes.status}: ${cobRes.body.slice(0, 260)}`);
  }

  const data = JSON.parse(cobRes.body || '{}');
  const brcode = String(data.brcode || data.pixCopiaECola || '');
  if (!brcode) {
    throw new Error('O Sicoob criou a cobrança, mas não retornou o código Pix Copia e Cola (brcode).');
  }

  return {
    txid: String(data.txid || txid),
    brcode,
    status: String(data.status || 'ATIVA'),
    valor: Number(params.valor),
    expiracaoSegundos: expiracao,
  };
}

export async function consultarCobrancaPixSicoob(txid: string): Promise<{
  txid: string;
  status: string;
  pago: boolean;
  brcode: string;
  valor: number;
}> {
  const { certPem, keyPem, clientId } = await carregarCredenciaisSicoob();
  const accessToken = await obterTokenSicoobPix(certPem, keyPem, clientId);

  const cobRes = await httpsMtls(`https://api.sicoob.com.br/pix/api/v2/cob/${encodeURIComponent(txid)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      client_id: clientId,
      Accept: 'application/json',
    },
    certPem,
    keyPem,
  });

  if (cobRes.status < 200 || cobRes.status >= 300) {
    throw new Error(`Erro ao consultar Pix Sicoob (HTTP ${cobRes.status}).`);
  }

  const data = JSON.parse(cobRes.body || '{}');
  const status = String(data.status || 'ATIVA').toUpperCase();
  const temPixLiquidado = Array.isArray(data.pix) && data.pix.length > 0;

  return {
    txid: String(data.txid || txid),
    status,
    pago: status === 'CONCLUIDA' || temPixLiquidado,
    brcode: String(data.brcode || data.pixCopiaECola || ''),
    valor: Number(data.valor?.original || 0),
  };
}
