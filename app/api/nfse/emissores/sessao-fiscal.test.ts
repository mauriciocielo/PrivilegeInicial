import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Cookie real e requireAuth real: só o banco é simulado. As 428 empresas do setor
// fiscal geravam um cookie de 21 KB, que o navegador descartava sem nenhum aviso.

const db = vi.hoisted(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-nao-usar-em-producao';
  return {
    empresa: { findMany: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    nfseCertificadoEscritorio: { findUnique: vi.fn() },
  };
});

vi.mock('../../../../lib/prisma', () => ({ default: db }));
vi.mock('../../../../lib/sentry-helper', () => ({ captureError: vi.fn() }));

import { GET } from './route';
import { createSessionToken, sessionCookieHeader } from '../../../../lib/session';

const LIMITE_NAVEGADOR = 4096;

describe('usuário do setor fiscal, com todas as empresas vinculadas', () => {
  const empresaIds = Array.from({ length: 428 }, () => randomUUID());

  beforeEach(() => {
    db.user.findUnique.mockReset().mockResolvedValue({ empresaIds, allowedRoutes: ['/consultor/dashboard', '/consultor/nfse'] });
    db.user.findMany.mockReset().mockResolvedValue([]);
    db.nfseCertificadoEscritorio.findUnique.mockReset().mockResolvedValue(null);
    db.empresa.findMany.mockReset().mockResolvedValue(
      empresaIds.map(id => ({ id, razaoSocial: 'Empresa', nomeFantasia: '', cnpj: '11.222.333/0001-81', tipo: 'emissor_nfse', nfseConfig: null })),
    );
  });

  it('a sessão cabe no navegador e a lista de emissores vem completa', async () => {
    const token = createSessionToken({ userId: 'fiscal', email: 'f@x.com', role: 'consultor', empresaIds });
    const cookie = sessionCookieHeader(token).split(';')[0];
    expect(cookie.length).toBeLessThanOrEqual(LIMITE_NAVEGADOR);

    const res = await GET(new Request('http://x/api/nfse/emissores', { headers: { cookie } }));
    const dados = await res.json();

    expect(res.status).toBe(200);
    expect(dados.empresas).toHaveLength(428);
    const { where } = db.empresa.findMany.mock.calls[0][0];
    expect(where.OR[0]).toEqual({ id: { in: empresaIds } });
  });

  it('sem cookie continua fechado', async () => {
    const res = await GET(new Request('http://x/api/nfse/emissores'));
    expect(res.status).toBe(401);
    expect(db.empresa.findMany).not.toHaveBeenCalled();
  });
});
