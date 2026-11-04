import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  empresa: { findMany: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  nfseCertificadoEscritorio: { findUnique: vi.fn() },
}));
const sessao = vi.hoisted(() => ({
  atual: { userId: 'fiscal', email: 'f@x.com', role: 'consultor', empresaIds: [] as string[] },
}));

vi.mock('../../../../lib/prisma', () => ({ default: db }));
vi.mock('../../../../lib/sentry-helper', () => ({ captureError: vi.fn() }));
vi.mock('../../../../lib/api-auth', () => ({ requireAuth: () => ({ session: sessao.atual }) }));

import { GET } from './route';

const listar = () => GET(new Request('http://x/api/nfse/emissores'));

const CNPJ_VALIDO = '11.222.333/0001-81';

describe('empresas listadas na emissão', () => {
  beforeEach(() => {
    sessao.atual = { userId: 'fiscal', email: 'f@x.com', role: 'consultor', empresaIds: [] };
    db.empresa.findMany.mockReset().mockResolvedValue([]);
    db.user.findUnique.mockReset().mockResolvedValue({ allowedRoutes: ['/consultor/nfse'] });
    db.user.findMany.mockReset().mockResolvedValue([]);
    db.nfseCertificadoEscritorio.findUnique.mockReset().mockResolvedValue(null);
  });

  it('mostra ao setor fiscal as empresas do certificado, mesmo sem vínculo no cadastro', async () => {
    db.empresa.findMany.mockResolvedValue([{ id: 'c1', razaoSocial: 'Do Certificado', nomeFantasia: '', cnpj: CNPJ_VALIDO, tipo: 'emissor_nfse', nfseConfig: null }]);
    const res = await listar();
    const dados = await res.json();
    expect(res.status).toBe(200);
    expect(dados.empresas.map((e: { id: string }) => e.id)).toEqual(['c1']);
    const { where } = db.empresa.findMany.mock.calls[0][0];
    expect(where.OR[0]).toEqual({ id: { in: [] } });
    expect(JSON.stringify(where.OR[1])).toContain('emissor_nfse');
  });

  it('não abre as outras empresas: o filtro nunca fica vazio para consultor', async () => {
    await listar();
    expect(db.empresa.findMany.mock.calls[0][0].where).not.toEqual({});
  });

  it('continua sem liberar para consultor sem a tela de NFS-e', async () => {
    db.user.findUnique.mockResolvedValue({ allowedRoutes: ['/consultor/dashboard'] });
    sessao.atual.empresaIds = ['e1'];
    await listar();
    expect(db.empresa.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['e1'] } });
  });

  it('continua fechado para o cliente', async () => {
    sessao.atual = { ...sessao.atual, role: 'cliente' };
    expect((await listar()).status).toBe(403);
    expect(db.empresa.findMany).not.toHaveBeenCalled();
  });

  it('o administrador segue vendo todas', async () => {
    sessao.atual = { ...sessao.atual, role: 'administrador' };
    await listar();
    expect(db.empresa.findMany.mock.calls[0][0].where).toEqual({});
  });
});
