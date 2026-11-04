async function listSrc() {
  const res = await fetch('https://api.github.com/repos/MarlonSantosDev/serpro_integra_contador_api/contents/lib/src', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.json();
  console.log('src files:', data.map(d => `${d.type}: ${d.name}`));
}

listSrc().catch(console.error);
