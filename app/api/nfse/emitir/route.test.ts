import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  empresa: { findUnique: vi.fn(), findFirst: vi.fn() },
  nfseConfig: { findUnique: vi.fn() },
  nfsE: { findUnique: vi.fn() },
}));
const credencial = vi.hoisted(() => ({ abrir: vi.fn() }));

vi.mock('../../../../lib/prisma', () => ({ default: db }));
vi.mock('../../../../lib/sentry-helper', () => ({ captureError: vi.fn() }));
vi.mock('../../../../lib/session', () => ({ getSessionFromRequest: () => ({ userId: 'u1', email: 'a@x.com', role: 'administrador', empresaIds: [] }) }));
vi.mock('../../../../lib/nfse/servidor', async (original) => ({
  ...(await original<typeof import('../../../../lib/nfse/servidor')>()),
  abrirCredencial: credencial.abrir,
}));

import { POST } from './route';

const CONFIG = {
  empresaId: 'e1', ambiente: 'homologacao', serie: '10', opSimpNac: 3, regApTribSN: 1, regEspTrib: 0, pTotTribSN: null, piscofinsCst: '08',
  codigoMunicipio: '4106902', convenioAtivo: true, usarProcuracao: true,
};
const NOTA = {
  id: 'n1', valorServicos: 100, dataCompetencia: '2026-10', discriminacao: 'Consultoria', codigoServico: '010101',
  municipioPrestacao: '4106902', tomadorCnpjCpf: '11222333000181', tomadorRazaoSocial: 'Cliente',
};
const emitir = (extra: object = {}) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ empresaId: 'e1', nota: NOTA, ...extra }) }));

beforeEach(() => {
  db.empresa.findUnique.mockReset().mockResolvedValue({ cnpj: '04252011000110', razaoSocial: 'Prestador' });
  db.nfseConfig.findUnique.mockReset().mockResolvedValue(CONFIG);
  db.nfsE.findUnique.mockReset().mockResolvedValue(null);
  // Para o teste logo depois da validação: nada é reservado nem enviado ao Sefin.
  credencial.abrir.mockReset().mockResolvedValue({ erro: 'parou aqui' });
});

describe('alíquota do Simples na emissão', () => {
  it('sem alíquota na nota nem na configuração, barra antes de abrir o certificado', async () => {
    const res = await emitir();
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/alíquota do Simples/);
    expect(credencial.abrir).not.toHaveBeenCalled();
  });

  it('a alíquota digitada na nota passa pela validação', async () => {
    const res = await emitir({ pTotTribSN: 6.5 });
    expect((await res.json()).error).toBe('parou aqui');
    expect(credencial.abrir).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, 101, 'abc'])('recusa a alíquota inválida %s', async (valor) => {
    const res = await emitir({ pTotTribSN: valor });
    expect((await res.json()).error).toMatch(/alíquota do Simples/);
  });

  it('a alíquota salva continua valendo sem nada na nota', async () => {
    db.nfseConfig.findUnique.mockResolvedValue({ ...CONFIG, pTotTribSN: 8 });
    expect((await (await emitir()).json()).error).toBe('parou aqui');
  });
});
