const fs = require('fs');

async function testIntegra() {
  // 1. Get token
  const tokenRes = await fetch('https://gateway.apiserpro.serpro.gov.br/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic Y21iTjByV2JKdnMxclJ3eEhYZ3R6UHhVM2pFYTpxOTBOM2ZXdkQ5ZXVJV3BERW9aTmRhaEZmVTBh',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const tokenData = await tokenRes.json();
  console.log('Token response:', tokenData.access_token ? 'Got access token' : tokenData);
  const token = tokenData.access_token;

  // Let's test a sample query to Consultar
  // Let's see what happens when calling Consultar
  const testPayload = {
    contratante: {
      numero: '00000000000000',
      tipo: 2
    },
    autorPedidoDados: {
      numero: '00000000000000',
      tipo: 2
    },
    contribuinte: {
      numero: '00000000000000',
      tipo: 2
    },
    pedidoDados: {
      idSistema: 'PGDASD',
      idServico: 'CONSDECLARACAO13',
      versaoSistema: '1.0',
      dados: JSON.stringify({ pa: 202601 })
    }
  };

  const res = await fetch('https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Consultar', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testPayload)
  });

  console.log('Consultar status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Consultar body:', text.slice(0, 1000));
}

testIntegra().catch(console.error);

