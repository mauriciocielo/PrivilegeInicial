async function check() {
  for (const dir of ['core', 'services']) {
    const res = await fetch(`https://api.github.com/repos/MarlonSantosDev/serpro_integra_contador_api/contents/lib/src/${dir}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    console.log(`dir ${dir}:`, data.map(d => `${d.type}: ${d.name}`));
  }
}

check().catch(console.error);

