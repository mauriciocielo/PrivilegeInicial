import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const usuario = vi.fn();
const empresaFindFirst = vi.fn();
const empresaFindMany = vi.fn();
vi.mock('../prisma', () => ({
  default: {
    nfseConfig: { findUnique: (...a: unknown[]) => findUnique(...a) },
    user: { findUnique: (...a: unknown[]) => usuario(...a) },
    empresa: {
      findFirst: (...a: unknown[]) => empresaFindFirst(...a),
      findMany: (...a: unknown[]) => empresaFindMany(...a),
    },
  },
}));

import { acessoEmissaoNegado, acessoNegado } from './servidor';
import { filtroEmpresasNfse, idsEmpresasDoCertificado } from './escopo';

const sessao = (role: string, empresaIds: string[]) => ({ userId: 'u', email: 'u@x.com', role, empresaIds });

const COM_TELA_NFSE = { allowedRoutes: ['/consultor/dashboard', '/consultor/nfse'] };
const SEM_TELA_NFSE = { allowedRoutes: ['/consultor/dashboard'] };

beforeEach(() => {
  findUnique.mockReset();
  usuario.mockReset().mockResolvedValue(SEM_TELA_NFSE);
  empresaFindFirst.mockReset().mockResolvedValue(null);
  empresaFindMany.mockReset().mockResolvedValue([]);
});

describe('emissão pelo cliente', () => {

  it('libera o cliente na própria empresa com procuração ativa', async () => {
    findUnique.mockResolvedValue({ usarProcuracao: true, procuracaoStatus: 'ativa' });
    await expect(acessoEmissaoNegado(sessao('cliente', ['e1']), 'e1')).resolves.toBeNull();
  });

  it.each([
    ['sem procuração', { usarProcuracao: true, procuracaoStatus: 'sem_procuracao' }],
    ['procuração não confirmada', { usarProcuracao: true, procuracaoStatus: 'indeterminada' }],
    ['nunca verificada', { usarProcuracao: true, procuracaoStatus: null }],
    ['empresa com certificado próprio', { usarProcuracao: false, procuracaoStatus: 'ativa' }],
    ['sem configuração', null],
  ])('bloqueia o cliente: %s', async (_nome, config) => {
    findUnique.mockResolvedValue(config);
    const r = await acessoEmissaoNegado(sessao('cliente', ['e1']), 'e1');
    expect(r?.status).toBe(403);
  });

  it('bloqueia o cliente em empresa de outro, mesmo com procuração ativa', async () => {
    findUnique.mockResolvedValue({ usarProcuracao: true, procuracaoStatus: 'ativa' });
    const r = await acessoEmissaoNegado(sessao('cliente', ['e1']), 'e2');
    expect(r?.status).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('mantém escritório como antes, sem depender da procuração', async () => {
    await expect(acessoEmissaoNegado(sessao('administrador', []), 'e1')).resolves.toBeNull();
    await expect(acessoEmissaoNegado(sessao('consultor', ['e1']), 'e1')).resolves.toBeNull();
    expect((await acessoEmissaoNegado(sessao('consultor', ['e2']), 'e1'))?.status).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe('certificado e configuração', () => {
  it('seguem fechados para o cliente, mesmo na própria empresa', async () => {
    expect((await acessoNegado(sessao('cliente', ['e1']), 'e1'))?.status).toBe(403);
    await expect(acessoNegado(sessao('consultor', ['e1']), 'e1')).resolves.toBeNull();
  });
});

describe('empresas do certificado do escritório', () => {
  it('abre para o consultor com a tela de NFS-e, mesmo fora da carteira', async () => {
    usuario.mockResolvedValue(COM_TELA_NFSE);
    empresaFindFirst.mockResolvedValue({ id: 'certificado' });
    await expect(acessoNegado(sessao('consultor', []), 'certificado')).resolves.toBeNull();
    await expect(acessoEmissaoNegado(sessao('consultor', []), 'certificado')).resolves.toBeNull();
  });

  it('não abre empresa de terceiro que não é do certificado', async () => {
    usuario.mockResolvedValue(COM_TELA_NFSE);
    empresaFindFirst.mockResolvedValue(null);
    expect((await acessoNegado(sessao('consultor', ['e1']), 'de-outro'))?.status).toBe(403);
  });

  it('não abre para consultor sem a tela de NFS-e', async () => {
    usuario.mockResolvedValue(SEM_TELA_NFSE);
    empresaFindFirst.mockResolvedValue({ id: 'certificado' });
    expect((await acessoNegado(sessao('consultor', []), 'certificado'))?.status).toBe(403);
    expect(empresaFindFirst).not.toHaveBeenCalled();
  });

  it('não abre para usuário apagado com a sessão ainda válida', async () => {
    usuario.mockResolvedValue(null);
    expect((await acessoNegado(sessao('consultor', []), 'certificado'))?.status).toBe(403);
  });

  it('nunca abre para o cliente por esse caminho', async () => {
    usuario.mockResolvedValue(COM_TELA_NFSE);
    empresaFindFirst.mockResolvedValue({ id: 'certificado' });
    expect((await acessoNegado(sessao('cliente', []), 'certificado'))?.status).toBe(403);
    expect((await acessoEmissaoNegado(sessao('cliente', []), 'certificado'))?.status).toBe(403);
  });

  it('procura a empresa junto com a regra do certificado, nunca só pelo id', async () => {
    usuario.mockResolvedValue(COM_TELA_NFSE);
    await acessoNegado(sessao('consultor', []), 'qualquer');
    const { where } = empresaFindFirst.mock.calls[0][0];
    expect(where.id).toBe('qualquer');
    expect(where.OR).toBeDefined();
  });

  it('lista carteira e certificado para quem tem a tela', async () => {
    usuario.mockResolvedValue(COM_TELA_NFSE);
    const filtro = await filtroEmpresasNfse(sessao('consultor', ['e1']));
    expect(filtro.OR).toHaveLength(2);
    expect(filtro.OR?.[0]).toEqual({ id: { in: ['e1'] } });
    expect(JSON.stringify(filtro.OR?.[1])).toContain('emissor_nfse');
    expect(JSON.stringify(filtro.OR?.[1])).toContain('dadosImportadosEm');
  });

  it('lista só a carteira para quem não tem a tela', async () => {
    usuario.mockResolvedValue(SEM_TELA_NFSE);
    await expect(filtroEmpresasNfse(sessao('consultor', ['e1']))).resolves.toEqual({ id: { in: ['e1'] } });
  });

  it('lista tudo para o administrador, sem consultar as telas', async () => {
    await expect(filtroEmpresasNfse(sessao('administrador', []))).resolves.toEqual({});
    expect(usuario).not.toHaveBeenCalled();
  });

  it('devolve os ids só para quem tem a tela', async () => {
    empresaFindMany.mockResolvedValue([{ id: 'certificado' }]);
    usuario.mockResolvedValue(SEM_TELA_NFSE);
    await expect(idsEmpresasDoCertificado('u')).resolves.toEqual([]);
    usuario.mockResolvedValue(COM_TELA_NFSE);
    await expect(idsEmpresasDoCertificado('u')).resolves.toEqual(['certificado']);
  });
});
