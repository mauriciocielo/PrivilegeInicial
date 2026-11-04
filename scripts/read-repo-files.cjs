async function fetchFile(repo, path) {
  const url = `https://raw.githubusercontent.com/${repo}/main/${path}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) {
    const resMaster = await fetch(`https://raw.githubusercontent.com/${repo}/master/${path}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resMaster.ok) return `Failed to fetch ${path}: ${res.status}`;
    return await resMaster.text();
  }
  return await res.text();
}

async function main() {
  const readmeMcp = await fetchFile('mcp-dir/consultas-mcp', 'README.md');
  console.log('=== consultas-mcp README.md ===');
  console.log(readmeMcp.slice(0, 2000));

  const serverJson = await fetchFile('mcp-dir/consultas-mcp', 'server.json');
  console.log('=== consultas-mcp server.json ===');
  console.log(serverJson.slice(0, 2000));

  // Let's also inspect lib in MarlonSantosDev
  const resLib = await fetch(`https://api.github.com/repos/MarlonSantosDev/serpro_integra_contador_api/contents/lib`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const libFiles = await resLib.json();
  console.log('=== MarlonSantosDev lib contents ===');
  console.log(libFiles.map(f => `${f.type}: ${f.path}`));
}

main().catch(console.error);

