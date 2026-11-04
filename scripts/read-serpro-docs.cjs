async function readDocs() {
  for (const doc of ['pgdasd_service.md', 'sitfis_service.md']) {
    const res = await fetch(`https://raw.githubusercontent.com/MarlonSantosDev/serpro_integra_contador_api/main/doc/${doc}`);
    console.log(`\n=================== ${doc} ===================`);
    console.log(await res.text());
  }
}

readDocs().catch(console.error);

