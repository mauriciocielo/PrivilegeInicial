import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-nao-usar-em-producao';
});

describe('requireAuth', () => {
  it('rejeita (401) uma requisição sem cookie de sessão', async () => {
    const { requireAuth } = await import('./api-auth');
    const req = new Request('http://localhost/api/qualquer');
    const result = requireAuth(req);
    expect(result.session).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(401);
  });

  it('aceita uma requisição com cookie de sessão válido e expõe os dados da sessão', async () => {
    const { createSessionToken, sessionCookieHeader } = await import('./session');
    const { requireAuth } = await import('./api-auth');

    const payload = { userId: 'u1', email: 'x@y.com', role: 'consultor', empresaIds: ['e1'] };
    const token = createSessionToken(payload);
    const cookiePair = sessionCookieHeader(token).split(';')[0];

    const req = new Request('http://localhost/api/qualquer', { headers: { cookie: cookiePair } });
    const result = requireAuth(req);

    expect(result.error).toBeUndefined();
    expect(result.session).toMatchObject(payload);
  });

  it('rejeita um cookie de sessão adulterado', async () => {
    const { requireAuth } = await import('./api-auth');
    const req = new Request('http://localhost/api/qualquer', { headers: { cookie: 'cf_session=token-forjado-invalido' } });
    const result = requireAuth(req);
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(401);
  });
});
