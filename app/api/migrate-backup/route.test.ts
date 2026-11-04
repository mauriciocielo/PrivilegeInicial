import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  empresa: { findMany: vi.fn() },
  user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
}));
const sessao = vi.hoisted(() => ({
  atual: { userId: 'consultor-1', email: 'c@x.com', role: 'consultor', empresaIds: ['atendida'] } as Record<string, unknown>,
}));

vi.mock('../../../lib/prisma', () => ({ default: db }));
vi.mock('../../../lib/sentry-helper', () => ({ captureError: vi.fn() }));
vi.mock('../../../lib/api-auth', () => ({ requireAuth: () => ({ session: sessao.atual }) }));

import { GET, POST } from './route';

const salvar = (usuario: Record<string, unknown>) =>
  POST(new Request('http://x/api/migrate-backup', {
    method: 'POST',
    body: JSON.stringify({ collection: 'cf_users', data: [usuario] }),
  }));

const cliente = (empresaIds: string[]) => ({
  id: 'cliente-1', email: 'cliente@x.com', name: 'Cliente', password: 'senha', role: 'cliente', empresaIds, allowedRoutes: ['/cliente/nfse'],
});

describe('consultor vinculando cliente a empresa por procuração', () => {
  beforeEach(() => {
    Object.values(db.user).forEach(fn => fn.mockReset());
    db.empresa.findMany.mockReset();
    db.empresa.findMany.mockResolvedValue([{ id: 'emissora' }]);
    db.user.findUnique.mockResolvedValue(null);
    db.user.findFirst.mockResolvedValue(null);
  });

  it('grava o vínculo com a emissora, mesmo fora das empresas que atende', async () => {
    const res = await salvar(cliente(['emissora']));
    expect(await res.json()).toEqual({ success: true, ignorados: 0 });
    expect(db.user.upsert.mock.calls[0][0].create.empresaIds).toEqual(['emissora']);
  });

  it('recusa empresa de terceiro e avisa, em vez de responder sucesso sem gravar', async () => {
    const res = await salvar(cliente(['de-outro']));
    expect(await res.json()).toEqual({ success: true, ignorados: 1 });
    expect(db.user.upsert).not.toHaveBeenCalled();
  });

  it('não grava o vínculo com terceiro quando vem junto de um permitido', async () => {
    await salvar(cliente(['emissora', 'de-outro']));
    expect(db.user.upsert.mock.calls[0][0].create.empresaIds).toEqual(['emissora']);
  });

  it('preserva vínculos do cliente que o consultor não enxerga', async () => {
    db.user.findUnique.mockResolvedValue({ ...cliente(['oculta', 'emissora']), role: 'cliente' });
    await salvar(cliente(['atendida']));
    expect(db.user.upsert.mock.calls[0][0].update.empresaIds.sort()).toEqual(['atendida', 'oculta']);
  });

  it('continua sem deixar o consultor criar outro consultor', async () => {
    const res = await salvar({ ...cliente(['emissora']), role: 'consultor' });
    expect(await res.json()).toEqual({ success: true, ignorados: 1 });
    expect(db.user.upsert).not.toHaveBeenCalled();
  });

  it('lista o cliente da emissora com o vínculo, sem expor os demais', async () => {
    db.user.findMany.mockResolvedValue([{ ...cliente(['emissora', 'oculta']), password: 'hash' }]);
    const res = await GET(new Request('http://x/api/migrate-backup?collection=cf_users'));
    const { data } = await res.json();
    expect(db.user.findMany.mock.calls[0][0].where.OR[1].empresaIds.hasSome).toEqual(['atendida', 'emissora']);
    expect(data.cf_users[0].empresaIds).toEqual(['emissora']);
    expect(data.cf_users[0].password).toBe('');
  });
});
