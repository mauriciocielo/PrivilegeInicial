async function readDeclaracaoCompleta() {
  const res = await fetch(`https://raw.githubusercontent.com/MarlonSantosDev/serpro_integra_contador_api/main/lib/src/services/pgdasd/model/declarar_response.dart`);
  const text = await res.text();
  console.log(text.slice(0, 3000));
}

readDeclaracaoCompleta().catch(console.error);
