async function searchIdSistema() {
  const res = await fetch('https://api.github.com/search/code?q=idSistema+repo:MarlonSantosDev/serpro_integra_contador_api', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.json();
  if (data.items) {
    console.log('Matches:');
    for (const item of data.items) {
      console.log(`- ${item.path}`);
    }
  } else {
    console.log('No items or rate limit:', data);
  }
}

searchIdSistema().catch(console.error);

