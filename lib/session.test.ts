import { describe, it, expect, beforeAll } from 'vitest';

// SESSION_SECRET precisa existir ANTES do módulo ser importado (é lido no
// escopo do módulo), então setamos antes do import dinâmico.
beforeAll(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-nao-usar-em-producao';
});

describe('session', () => {
  it('cria e verifica um token válido, com os dados corretos', async () => {
    const { createSessionToken, verifySessionToken } = await import('./session');
    const payload = { userId: 'u1', email: 'a@b.com', role: 'consultor', empresaIds: ['e1', 'e2'] };
    const token = createSessionToken(payload);
    const decoded = verifySessionToken(token);
    expect(decoded).toMatchObject(payload);
  });

  it('rejeita um token adulterado', async () => {
    const { createSessionToken, verifySessionToken } = await import('./session');
    const token = createSessionToken({ userId: 'u1', email: 'a@b.com', role: 'cliente', empresaIds: [] });
    const adulterado = token.slice(0, -5) + 'XXXXX';
    expect(verifySessionToken(adulterado)).toBeNull();
  });

  it('rejeita string vazia ou lixo', async () => {
    const { verifySessionToken } = await import('./session');
    expect(verifySessionToken('')).toBeNull();
    expect(verifySessionToken('nao-e-um-jwt')).toBeNull();
  });

  it('lê a sessão a partir do header Cookie de uma Request', async () => {
    const { createSessionToken, getSessionFromRequest, sessionCookieHeader, SESSION_COOKIE_NAME } = await import('./session');
    const payload = { userId: 'u2', email: 'c@d.com', role: 'administrador', empresaIds: [] };
    const token = createSessionToken(payload);
    const cookieHeaderValue = sessionCookieHeader(token);

    // O header Set-Cookie tem atributos (Path, HttpOnly, ...) — extrai só o par nome=valor.
    const cookiePair = cookieHeaderValue.split(';')[0];
    expect(cookiePair.startsWith(`${SESSION_COOKIE_NAME}=`)).toBe(true);

    const request = new Request('http://localhost/api/teste', {
      headers: { cookie: cookiePair },
    });
    const session = getSessionFromRequest(request);
    expect(session).toMatchObject(payload);
  });

  it('getSessionFromRequest retorna null sem cookie nenhum', async () => {
    const { getSessionFromRequest } = await import('./session');
    const request = new Request('http://localhost/api/teste');
    expect(getSessionFromRequest(request)).toBeNull();
  });

  it('clearSessionCookieHeader zera o Max-Age (efetivamente apaga o cookie)', async () => {
    const { clearSessionCookieHeader } = await import('./session');
    expect(clearSessionCookieHeader()).toContain('Max-Age=0');
  });
});
