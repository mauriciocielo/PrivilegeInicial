async function testHeaders() {
  const tokenRes = await fetch('https://gateway.apiserpro.serpro.gov.br/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic Y21iTjByV2JKdnMxclJ3eEhYZ3R6UHhVM2pFYTpxOTBOM2ZXdkQ5ZXVJV3BERW9aTmRhaEZmVTBh',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const { access_token: token } = await tokenRes.json();

  const basePayload = {
    contratante: { numero: '29679048000150', tipo: 2 },
    autorPedidoDados: { numero: '29679048000150', tipo: 2 },
    contribuinte: { numero: '29679048000150', tipo: 2 },
    pedidoDados: {
      idSistema: 'PGDASD',
      idServico: 'CONSDECLARACAO13',
      versaoSistema: '1.0',
      dados: JSON.stringify({ pa: 202601 })
    }
  };

  const variations = [
    { name: 'jwt_token = token', headers: { 'Authorization': `Bearer ${token}`, 'jwt_token': token, 'Content-Type': 'application/json' } },
    { name: 'jwt_token = Bearer token', headers: { 'Authorization': `Bearer ${token}`, 'jwt_token': `Bearer ${token}`, 'Content-Type': 'application/json' } },
    { name: 'only jwt_token', headers: { 'jwt_token': token, 'Content-Type': 'application/json' } },
    { name: 'JWT_TOKEN uppercase', headers: { 'Authorization': `Bearer ${token}`, 'JWT_TOKEN': token, 'Content-Type': 'application/json' } },
    { name: 'X-JWT-Token', headers: { 'Authorization': `Bearer ${token}`, 'X-JWT-Token': token, 'Content-Type': 'application/json' } }
  ];

  for (const v of variations) {
    console.log(`\nTesting variation: ${v.name}`);
    const res = await fetch('https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Consultar', {
      method: 'POST',
      headers: v.headers,
      body: JSON.stringify(basePayload)
    });
    console.log('Status:', res.status);
    const json = await res.json().catch(() => null);
    console.log('Response:', JSON.stringify(json, null, 2));
  }
}

testHeaders().catch(console.error);
