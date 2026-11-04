async function readSitfisModels() {
  for (const m of ['solicitar_protocolo_request.dart', 'emitir_relatorio_request.dart']) {
    const res = await fetch(`https://raw.githubusercontent.com/MarlonSantosDev/serpro_integra_contador_api/main/lib/src/services/sitfis/model/${m}`);
    console.log(`=== ${m} ===`);
    console.log(await res.text());
  }
}

readSitfisModels().catch(console.error);

