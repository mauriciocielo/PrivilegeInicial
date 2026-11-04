async function checkAuthService() {
  const url = 'https://raw.githubusercontent.com/MarlonSantosDev/serpro_integra_contador_api/main/lib/src/core/auth/auth_service.dart';
  const res = await fetch(url);
  const text = await res.text();
  console.log(text);
}

checkAuthService().catch(console.error);
