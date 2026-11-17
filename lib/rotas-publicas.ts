/**
 * Rotas abertas sem login. Fora delas, o TransitionProvider sincroniza com o banco
 * e manda para /login quem não tem sessão.
 *
 * Regra: só abrem sem login as páginas institucionais listadas aqui (serviços, blog,
 * contato, termos, privacidade) e o link público do perfil (/perfil/<token>).
 * Qualquer outra rota, inclusive uma nova, exige sessão até ser incluída nesta lista.
 */
const ROTAS_PUBLICAS_EXPLICITAS = [
  '/',
  '/login',
  '/contato',
  '/privacidade',
  '/termos',
  '/planejamento-tributario',
  '/bpo-financeiro-francisco-beltrao',
  '/abertura-de-empresa-francisco-beltrao',
  '/contabilidade-agronegocio',
];

export function ehRotaPublica(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    ROTAS_PUBLICAS_EXPLICITAS.includes(pathname) ||
    pathname.startsWith('/novo-layout') ||
    pathname.startsWith('/perfil/') ||
    pathname.startsWith('/planejamento-tributario') ||
    pathname.startsWith('/bpo-financeiro-francisco-beltrao') ||
    pathname.startsWith('/abertura-de-empresa-francisco-beltrao') ||
    pathname.startsWith('/contabilidade-agronegocio') ||
    pathname.startsWith('/contato') ||
    pathname.startsWith('/privacidade') ||
    pathname.startsWith('/termos') ||
    pathname.startsWith('/blog')
  );
}
