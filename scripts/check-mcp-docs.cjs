async function checkConsultasMcpDocs() {
  const res = await fetch(`https://api.github.com/repos/mcp-dir/consultas-mcp/contents/docs`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.json();
  console.log('docs files:', data.map(d => d.name));

  const resSkills = await fetch(`https://api.github.com/repos/mcp-dir/consultas-mcp/contents/skills`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const dataSkills = await resSkills.json();
  console.log('skills files:', dataSkills.map(d => d.name));
}

checkConsultasMcpDocs().catch(console.error);

