async function inspectRepo(repo) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    console.log(`Repo: ${repo}`);
    if (Array.isArray(data)) {
      console.log(data.map(f => `${f.type}: ${f.path}`));
    } else {
      console.log('Response:', data);
    }
  } catch (err) {
    console.error(`Error ${repo}:`, err);
  }
}

async function main() {
  await inspectRepo('mcp-dir/consultas-mcp');
  await inspectRepo('MarlonSantosDev/serpro_integra_contador_api');
}

main();

