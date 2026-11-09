/**
 * Rotas abertas sem login. Fora delas, o TransitionProvider sincroniza com o banco
 * e manda para /login quem não tem sessão.
 *
 * Regra: Apenas as áreas logadas (/consultor, /cliente e /reset-dados) exigem sessão.
 * Todas as páginas institucionais, serviços, blog, contato, termos e privacidade são públicas.
 */
const ROTAS_PRIVADAS_PREFIXOS = ['/consultor', '/cliente', '/reset-dados'];

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
  if (!pathname) return true;
  if (
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
  ) {
    return true;
  }

  const ehPrivada = ROTAS_PRIVADAS_PREFIXOS.some(
    prefixo => pathname === prefixo || pathname.startsWith(`${prefixo}/`)
  );
  return !ehPrivada;
}
