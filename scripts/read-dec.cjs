async function readDec() {
  const url = `https://raw.githubusercontent.com/MarlonSantosDev/serpro_integra_contador_api/main/lib/src/services/pgdasd/model/consultar_declaracoes_request.dart`;
  const res = await fetch(url);
  const text = await res.text();
  console.log(text);
}

readDec().catch(console.error);
