import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
vi.mock('../prisma', () => ({ default: { nfseConfig: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

import { acessoEmissaoNegado, acessoNegado } from './servidor';

const sessao = (role: string, empresaIds: string[]) => ({ userId: 'u', email: 'u@x.com', role, empresaIds });

describe('emissão pelo cliente', () => {
  beforeEach(() => findUnique.mockReset());

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
  it('seguem fechados para o cliente, mesmo na própria empresa', () => {
    expect(acessoNegado(sessao('cliente', ['e1']), 'e1')?.status).toBe(403);
    expect(acessoNegado(sessao('consultor', ['e1']), 'e1')).toBeNull();
  });
});
