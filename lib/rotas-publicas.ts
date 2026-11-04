/**
 * Rotas abertas sem login. Fora delas, o TransitionProvider sincroniza com o banco
 * e manda para /login quem não tem sessão.
 */
export function ehRotaPublica(pathname: string | null | undefined): boolean {
  return pathname === '/login'
    || pathname === '/'
    || !!pathname?.startsWith('/novo-layout')
    || !!pathname?.startsWith('/perfil/');
}
