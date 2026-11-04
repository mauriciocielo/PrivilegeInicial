import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
vi.mock('./prisma', () => ({ default: db }));

beforeAll(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-nao-usar-em-producao';
});

beforeEach(() => {
  db.user.findUnique.mockReset();
});

describe('requireAuth', () => {
  it('rejeita (401) uma requisição sem cookie de sessão', async () => {
    const { requireAuth } = await import('./api-auth');
    const req = new Request('http://localhost/api/qualquer');
    const result = await requireAuth(req);
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
    const result = await requireAuth(req);

    expect(result.error).toBeUndefined();
    expect(result.session).toMatchObject(payload);
    // Quem cabe no cookie não paga uma consulta ao banco a cada requisição.
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejeita um cookie de sessão adulterado', async () => {
    const { requireAuth } = await import('./api-auth');
    const req = new Request('http://localhost/api/qualquer', { headers: { cookie: 'cf_session=token-forjado-invalido' } });
    const result = await requireAuth(req);
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(401);
  });

  describe('com a lista de empresas fora do cookie', () => {
    const requisicao = async (empresaIds: string[]) => {
      const { createSessionToken, sessionCookieHeader } = await import('./session');
      const token = createSessionToken({ userId: 'fiscal', email: 'f@x.com', role: 'consultor', empresaIds });
      return new Request('http://localhost/api/qualquer', { headers: { cookie: sessionCookieHeader(token).split(';')[0] } });
    };

    it('devolve a lista completa lida do banco', async () => {
      const { requireAuth } = await import('./api-auth');
      const empresaIds = Array.from({ length: 428 }, () => randomUUID());
      db.user.findUnique.mockResolvedValue({ empresaIds });

      const result = await requireAuth(await requisicao(empresaIds));

      expect(result.error).toBeUndefined();
      expect(result.session!.empresaIds).toEqual(empresaIds);
      expect(db.user.findUnique).toHaveBeenCalledWith({ where: { id: 'fiscal' }, select: { empresaIds: true } });
    });

    it('não libera nenhuma empresa se o usuário não existe mais', async () => {
      const { requireAuth } = await import('./api-auth');
      db.user.findUnique.mockResolvedValue(null);

      const result = await requireAuth(await requisicao(Array.from({ length: 428 }, () => randomUUID())));

      expect(result.session!.empresaIds).toEqual([]);
    });

    it('não abre acesso se o banco falhar: o erro sobe em vez de virar sessão', async () => {
      const { requireAuth } = await import('./api-auth');
      db.user.findUnique.mockRejectedValue(new Error('banco fora'));

      await expect(requireAuth(await requisicao(Array.from({ length: 428 }, () => randomUUID())))).rejects.toThrow('banco fora');
    });
  });
});
