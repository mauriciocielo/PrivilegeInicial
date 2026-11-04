async function inspectServices() {
  for (const svc of ['pgdasd', 'sitfis']) {
    const res = await fetch(`https://api.github.com/repos/MarlonSantosDev/serpro_integra_contador_api/contents/lib/src/services/${svc}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    console.log(`=== Service ${svc} files ===`);
    console.log(data.map(d => `${d.type}: ${d.name}`));
  }
}

inspectServices().catch(console.error);

