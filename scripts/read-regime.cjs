async function readRegimeApuracao() {
  const res = await fetch(`https://api.github.com/repos/MarlonSantosDev/serpro_integra_contador_api/contents/lib/src/services/regime_apuracao`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.json();
  console.log('regime_apuracao files:', data.map(d => d.name));

  const codeRes = await fetch(`https://raw.githubusercontent.com/MarlonSantosDev/serpro_integra_contador_api/main/lib/src/services/regime_apuracao/regime_apuracao_service.dart`);
  console.log(await codeRes.text());
}

readRegimeApuracao().catch(console.error);
