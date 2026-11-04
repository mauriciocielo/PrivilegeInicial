require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');
const crypto = require('crypto');
const forge = require('node-forge');

const CHAVE_PADRAO_SERVIDOR = 'ju/TFQ2O8/gqb22ntB/3NJmz7l2JvMyogELE5gJzfto=';

function obterChave() {
  const bruta = (process.env.NFSE_CERT_KEY || CHAVE_PADRAO_SERVIDOR).trim().replace(/^["']+|["']+$/g, '').trim();
  return Buffer.from(bruta, 'base64');
}

function decifrar(valor, empresaId) {
  const [versao, iv, tag, cifrado] = valor.split('.');
  if (versao !== 'v1' || !iv || !tag || !cifrado) throw new Error('Formato de certificado cifrado desconhecido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', obterChave(), Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(empresaId, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(cifrado, 'base64')), decipher.final()]);
}

function lerCertificado(pfxBuf, senha) {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuf.toString('binary')), false);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
  const getBags = (tipo) => p12.getBags({ bagType: tipo })[tipo] || [];
  const bagChave = [...getBags(forge.pki.oids.pkcs8ShroudedKeyBag), ...getBags(forge.pki.oids.keyBag)].find(b => b.key)?.key;
  const certs = getBags(forge.pki.oids.certBag).map(b => b.cert).filter(Boolean);
  const chavePem = forge.pki.privateKeyToPem(bagChave);
  const certsPem = certs.map(c => forge.pki.certificateToPem(c)).join('\n');
  return { chavePem, certsPem, subject: certs[0]?.subject?.attributes };
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const res = await pool.query('SELECT * FROM "NfseCertificadoEscritorio" WHERE id = \'padrao\' LIMIT 1;');
  await pool.end();

  if (res.rows.length === 0) {
    console.log('Nenhum certificado do escritório encontrado');
    return;
  }

  const row = res.rows[0];
  console.log('Certificado titular:', row.titular, 'documento:', row.documento, 'validoAte:', row.validoAte);

  const pfx = decifrar(row.certPfxCifrado, 'escritorio');
  const senha = decifrar(row.certSenhaCifrada, 'escritorio').toString('utf8');
  const { chavePem, certsPem } = lerCertificado(pfx, senha);
  console.log('Certificado decifrado com sucesso! Chave privada e certs extraídos.');

  const agent = new https.Agent({
    key: chavePem,
    cert: certsPem,
    rejectUnauthorized: false
  });

  const basicAuth = 'Y21iTjByV2JKdnMxclJ3eEhYZ3R6UHhVM2pFYTpxOTBOM2ZXdkQ5ZXVJV3BERW9aTmRhaEZmVTBh';

  console.log('\nEnviando POST para https://autenticacao.sapi.serpro.gov.br/authenticate com mTLS...');
  
  const req = https.request('https://autenticacao.sapi.serpro.gov.br/authenticate', {
    method: 'POST',
    agent: agent,
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Role-Type': 'TERCEIROS',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, (resp) => {
    let data = '';
    resp.on('data', chunk => data += chunk);
    resp.on('end', () => {
      console.log('Status code:', resp.statusCode);
      console.log('Response body:', data);
    });
  });

  req.on('error', (e) => console.error('Req error:', e));
  req.write('grant_type=client_credentials');
  req.end();
}

main().catch(console.error);
