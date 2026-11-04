async function listDoc() {
  const res = await fetch('https://api.github.com/repos/MarlonSantosDev/serpro_integra_contador_api/contents/doc', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.json();
  console.log('doc contents:', data.map(d => `${d.type}: ${d.name}`));
}

listDoc().catch(console.error);

