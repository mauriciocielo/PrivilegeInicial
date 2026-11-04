async function listModelo() {
  const res = await fetch('https://api.github.com/repos/MarlonSantosDev/serpro_integra_contador_api/contents/modelo_serpro', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.json();
  console.log('modelo_serpro contents:', data.map(d => `${d.type}: ${d.name}`));
}

listModelo().catch(console.error);

