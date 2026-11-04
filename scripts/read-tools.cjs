async function readTools() {
  const res = await fetch('https://raw.githubusercontent.com/mcp-dir/consultas-mcp/main/docs/ferramentas.md');
  const text = await res.text();
  console.log(text.slice(0, 4000));
}

readTools().catch(console.error);

