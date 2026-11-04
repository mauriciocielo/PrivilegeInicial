import { randomUUID } from 'crypto';
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

  it('o cookie nunca passa do limite do navegador, com qualquer quantidade de empresas', async () => {
    const { createSessionToken, sessionCookieHeader, verifySessionToken, impressaoCarteira } = await import('./session');
    for (const quantidade of [0, 1, 14, 50, 60, 65, 70, 75, 80, 100, 428, 3000]) {
      const empresaIds = Array.from({ length: quantidade }, () => randomUUID());
      const token = createSessionToken({ userId: 'u1', email: 'alguem.com.email.longo@escritorio.com.br', role: 'consultor', empresaIds });
      expect(sessionCookieHeader(token).split(';')[0].length).toBeLessThanOrEqual(4096);

      const decoded = verifySessionToken(token)!;
      if (decoded.carteiraNoBanco) {
        expect(decoded.empresaIds).toEqual([]);
        expect(decoded.carteiraNoBanco).toBe(impressaoCarteira(empresaIds));
      } else {
        expect(decoded.empresaIds).toEqual(empresaIds);
      }
    }
  });

  it('mantém no cookie a lista que cabe e só tira a que não cabe', async () => {
    const { createSessionToken, verifySessionToken } = await import('./session');
    const comEmpresas = (quantidade: number) => verifySessionToken(createSessionToken({
      userId: 'u1', email: 'a@b.com', role: 'consultor', empresaIds: Array.from({ length: quantidade }, () => randomUUID()),
    }))!;
    expect(comEmpresas(14).carteiraNoBanco).toBeUndefined();
    expect(comEmpresas(428).carteiraNoBanco).toBeTruthy();
  });

  it('a impressão digital da lista ignora a ordem e muda quando a lista muda', async () => {
    const { impressaoCarteira } = await import('./session');
    expect(impressaoCarteira(['a', 'b'])).toBe(impressaoCarteira(['b', 'a']));
    expect(impressaoCarteira(['a', 'b'])).not.toBe(impressaoCarteira(['a', 'b', 'c']));
  });

  it('clearSessionCookieHeader zera o Max-Age (efetivamente apaga o cookie)', async () => {
    const { clearSessionCookieHeader } = await import('./session');
    expect(clearSessionCookieHeader()).toContain('Max-Age=0');
  });
});
