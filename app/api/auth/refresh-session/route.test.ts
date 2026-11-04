import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-nao-usar-em-producao';
  return { user: { findUnique: vi.fn() } };
});

vi.mock('../../../../lib/prisma', () => ({ default: db }));
vi.mock('../../../../lib/sentry-helper', () => ({ captureError: vi.fn() }));

import { GET } from './route';
import { createSessionToken, sessionCookieHeader, verifySessionToken } from '../../../../lib/session';

const LIMITE_NAVEGADOR = 4096;
const empresas = (quantidade: number) => Array.from({ length: quantidade }, () => randomUUID());

const usuario = (empresaIds: string[]) => ({
  id: 'fiscal', email: 'f@x.com', role: 'consultor', empresaIds, password: 'hash', twoFactorSecret: null, twoFactorBackupCodes: [],
});

/** Chama a rota com a sessão que o navegador guardou, com o banco já na lista atual. */
const atualizar = async (naSessao: string[], noBanco: string[]) => {
  db.user.findUnique.mockResolvedValue(usuario(noBanco));
  const token = createSessionToken({ userId: 'fiscal', email: 'f@x.com', role: 'consultor', empresaIds: naSessao });
  const cookie = sessionCookieHeader(token).split(';')[0];
  const res = await GET(new Request('http://x/api/auth/refresh-session', { headers: { cookie } }));
  return { res, dados: await res.json(), novoCookie: res.headers.get('set-cookie') };
};

const parDoCookie = (setCookie: string) => setCookie.split(';')[0];
const tokenDoCookie = (setCookie: string) => decodeURIComponent(parDoCookie(setCookie).replace('cf_session=', ''));

describe('refresh-session', () => {
  beforeEach(() => {
    db.user.findUnique.mockReset();
  });

  it('não emite cookie novo quando nada mudou', async () => {
    const lista = empresas(3);
    const { dados, novoCookie } = await atualizar(lista, [...lista].reverse());
    expect(dados.changed).toBe(false);
    expect(novoCookie).toBeNull();
  });

  it('emite um cookie que o navegador aceita quando a lista cresce além do limite', async () => {
    const { dados, novoCookie } = await atualizar([], empresas(428));
    expect(dados.changed).toBe(true);
    expect(parDoCookie(novoCookie!).length).toBeLessThanOrEqual(LIMITE_NAVEGADOR);
    expect(verifySessionToken(tokenDoCookie(novoCookie!))!.carteiraNoBanco).toBeTruthy();
  });

  it('com a lista fora do cookie e sem mudança, não fica recarregando os dados a cada 15s', async () => {
    const lista = empresas(428);
    const { dados, novoCookie } = await atualizar(lista, lista);
    expect(dados.changed).toBe(false);
    expect(novoCookie).toBeNull();
  });

  it('com a lista fora do cookie, ainda percebe quando o administrador muda as empresas', async () => {
    const lista = empresas(428);
    const { dados, novoCookie } = await atualizar(lista, [...lista, randomUUID()]);
    expect(dados.changed).toBe(true);
    expect(parDoCookie(novoCookie!).length).toBeLessThanOrEqual(LIMITE_NAVEGADOR);
  });

  it('devolve a lista para o cookie quando ela volta a caber', async () => {
    const pequena = empresas(3);
    const { dados, novoCookie } = await atualizar(empresas(428), pequena);
    expect(dados.changed).toBe(true);
    const decodificado = verifySessionToken(tokenDoCookie(novoCookie!))!;
    expect(decodificado.carteiraNoBanco).toBeUndefined();
    expect(decodificado.empresaIds).toEqual(pequena);
  });

  it('não devolve dados sensíveis do usuário', async () => {
    const { dados } = await atualizar([], empresas(428));
    expect(dados.user.password).toBeUndefined();
    expect(dados.user.twoFactorSecret).toBeUndefined();
  });
});
