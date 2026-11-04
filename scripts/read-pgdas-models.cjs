async function readPgdasModels() {
  const models = [
    'consultar_ultima_declaracao_request.dart',
    'consultar_ultima_declaracao_response.dart',
    'consultar_extrato_das_request.dart',
    'consultar_extrato_das_response.dart',
  ];
  for (const m of models) {
    const url = `https://raw.githubusercontent.com/MarlonSantosDev/serpro_integra_contador_api/main/lib/src/services/pgdasd/model/${m}`;
    const res = await fetch(url);
    const text = await res.text();
    console.log(`=== ${m} ===`);
    console.log(text.slice(0, 1500));
  }
}

readPgdasModels().catch(console.error);
