async function readDoc() {
  const res = await fetch(`https://raw.githubusercontent.com/mcp-dir/consultas-mcp/main/docs/ferramentas.md`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const text = await res.text();
  console.log(text.slice(0, 3000));
}
readDoc().catch(console.error);

