async function testIntegra() {
  const tokenRes = await fetch('https://gateway.apiserpro.serpro.gov.br/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic Y21iTjByV2JKdnMxclJ3eEhYZ3R6UHhVM2pFYTpxOTBOM2ZXdkQ5ZXVJV3BERW9aTmRhaEZmVTBh',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  console.log('Token obtido com sucesso!');

  const testPayload = {
    contratante: {
      numero: '29679048000150',
      tipo: 2
    },
    autorPedidoDados: {
      numero: '29679048000150',
      tipo: 2
    },
    contribuinte: {
      numero: '29679048000150',
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
  const json = await res.json();
  console.log('Consultar response:', JSON.stringify(json, null, 2));
}

testIntegra().catch(console.error);
