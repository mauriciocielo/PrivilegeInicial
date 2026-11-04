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
  return { chavePem, certsPem };
}

async function autenticarSerpro(agent) {
  const basicAuth = 'Y21iTjByV2JKdnMxclJ3eEhYZ3R6UHhVM2pFYTpxOTBOM2ZXdkQ5ZXVJV3BERW9aTmRhaEZmVTBh';
  return new Promise((resolve, reject) => {
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
      resp.on('end', () => resolve(JSON.parse(data)));
    });
    req.write('grant_type=client_credentials');
    req.end();
  });
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const res = await pool.query('SELECT * FROM "NfseCertificadoEscritorio" WHERE id = \'padrao\' LIMIT 1;');
  await pool.end();

  const row = res.rows[0];
  const pfx = decifrar(row.certPfxCifrado, 'escritorio');
  const senha = decifrar(row.certSenhaCifrada, 'escritorio').toString('utf8');
  const { chavePem, certsPem } = lerCertificado(pfx, senha);
  const agent = new https.Agent({ key: chavePem, cert: certsPem, rejectUnauthorized: false });

  const auth = await autenticarSerpro(agent);

  console.log('1. Solicitando protocolo SITFIS v2.0 em /Apoiar...');
  const resApoiar = await fetch('https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Apoiar', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${auth.access_token}`,
      'jwt_token': auth.jwt_token,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    },
    body: JSON.stringify({
      contratante: { numero: '29679048000150', tipo: 2 },
      autorPedidoDados: { numero: '29679048000150', tipo: 2 },
      contribuinte: { numero: '29679048000150', tipo: 2 },
      pedidoDados: {
        idSistema: 'SITFIS',
        idServico: 'SOLICITARPROTOCOLO91',
        versaoSistema: '2.0',
        dados: ''
      }
    })
  });

  console.log('Status Apoiar:', resApoiar.status);
  const jsonApoiar = await resApoiar.json();
  console.log('JSON Apoiar:', JSON.stringify(jsonApoiar, null, 2));

  if (jsonApoiar.dados) {
    const dados = JSON.parse(jsonApoiar.dados);
    console.log('Protocolo:', dados.protocoloRelatorio);
    console.log('Tempo espera:', dados.tempoEspera);

    console.log('Aguardando tempo de espera...');
    await new Promise(r => setTimeout(r, (dados.tempoEspera || 3000) + 1000));

    console.log('\n2. Chamando /Emitir...');
    const resEmitir = await fetch('https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Emitir', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${auth.access_token}`,
        'jwt_token': auth.jwt_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contratante: { numero: '29679048000150', tipo: 2 },
        autorPedidoDados: { numero: '29679048000150', tipo: 2 },
        contribuinte: { numero: '29679048000150', tipo: 2 },
        pedidoDados: {
          idSistema: 'SITFIS',
          idServico: 'RELATORIOSITFIS92',
          versaoSistema: '2.0',
          dados: JSON.stringify({ protocoloRelatorio: dados.protocoloRelatorio })
        }
      })
    });

    console.log('Status Emitir:', resEmitir.status);
    const jsonEmitir = await resEmitir.json();
    console.log('Mensagens Emitir:', jsonEmitir.mensagens);
    if (jsonEmitir.dados) {
      const dadosEmit = typeof jsonEmitir.dados === 'string' ? JSON.parse(jsonEmitir.dados) : jsonEmitir.dados;
      console.log('Dados emitir chaves:', Object.keys(dadosEmit));
      if (dadosEmit.pdf) {
        console.log('PDF gerado com sucesso! Bytes:', dadosEmit.pdf.length);
      }
    }
  }
}

main().catch(console.error);
