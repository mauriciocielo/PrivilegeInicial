async function readCode() {
  const urls = [
    'https://raw.githubusercontent.com/MarlonSantosDev/serpro_integra_contador_api/main/lib/src/services/pgdasd/pgdasd_service.dart',
    'https://raw.githubusercontent.com/MarlonSantosDev/serpro_integra_contador_api/main/lib/src/services/sitfis/sitfis_service.dart'
  ];

  for (const url of urls) {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`\n=================== ${url} ===================`);
    console.log(text);
  }
}

readCode().catch(console.error);
