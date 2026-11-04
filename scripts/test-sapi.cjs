async function testAuthSapi() {
  const basicAuth = 'Y21iTjByV2JKdnMxclJ3eEhYZ3R6UHhVM2pFYTpxOTBOM2ZXdkQ5ZXVJV3BERW9aTmRhaEZmVTBh';
  
  try {
    const res = await fetch('https://autenticacao.sapi.serpro.gov.br/authenticate', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Role-Type': 'TERCEIROS',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Body:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testAuthSapi();

