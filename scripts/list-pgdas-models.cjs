async function listPgdasModels() {
  const res = await fetch(`https://api.github.com/repos/MarlonSantosDev/serpro_integra_contador_api/contents/lib/src/services/pgdasd/model`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.json();
  console.log(data.map(d => d.name));
}

listPgdasModels().catch(console.error);
