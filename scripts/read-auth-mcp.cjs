async function readAuth() {
  const res = await fetch('https://raw.githubusercontent.com/mcp-dir/consultas-mcp/main/docs/autenticacao.md');
  console.log(await res.text());
}

readAuth().catch(console.error);

