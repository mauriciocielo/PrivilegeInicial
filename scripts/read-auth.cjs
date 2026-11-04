async function checkFiles() {
  const urls = [
    'https://raw.githubusercontent.com/MarlonSantosDev/serpro_integra_contador_api/main/lib/src/core/api_client.dart',
    'https://raw.githubusercontent.com/MarlonSantosDev/serpro_integra_contador_api/main/lib/src/core/auth/auth_service.dart',
  ];

  for (const url of urls) {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`=== ${url} ===`);
    console.log(text.slice(0, 1500));
  }
}

checkFiles().catch(console.error);

