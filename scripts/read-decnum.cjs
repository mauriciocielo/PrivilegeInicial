async function readDecNum() {
  for (const f of ['consultar_declaracao_numero_request.dart', 'consultar_declaracao_numero_response.dart']) {
    const res = await fetch(`https://raw.githubusercontent.com/MarlonSantosDev/serpro_integra_contador_api/main/lib/src/services/pgdasd/model/${f}`);
    const text = await res.text();
    console.log(`=== ${f} ===`);
    console.log(text.slice(0, 2000));
  }
}

readDecNum().catch(console.error);

