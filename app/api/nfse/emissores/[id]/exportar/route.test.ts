import { randomBytes } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  empresa: { findUnique: vi.fn() },
  nfsE: { findMany: vi.fn() },
  nfseConfig: { findUnique: vi.fn() },
}));

vi.mock('../../../../../../lib/prisma', () => ({ default: db }));
vi.mock('../../../../../../lib/sentry-helper', () => ({ captureError: vi.fn() }));
vi.mock('../../../../../../lib/session', () => ({ getSessionFromRequest: () => ({ userId: 'u1', email: 'a@x.com', role: 'administrador', empresaIds: [] }) }));

import { GET } from './route';

const contexto = { params: Promise.resolve({ id: 'e1' }) };
const exportar = (query: string) => GET(new Request(`http://x/?${query}`), contexto);
const nota = (id: string, over = {}) => ({
  id, numero: '1', status: 'emitida', dataEmissao: '2026-10-01', dataCompetencia: '2026-10', prestadorCnpj: '04252011000110',
  prestadorRazaoSocial: 'P', tomadorRazaoSocial: 'T', documento: { nfseXml: '<NFSe/>', eventoXml: null }, ...over,
});

beforeEach(() => {
  db.empresa.findUnique.mockReset().mockResolvedValue({ cnpj: '04252011000110', razaoSocial: 'Empresa', nomeFantasia: '' });
  db.nfsE.findMany.mockReset().mockResolvedValue([nota('a'), nota('b')]);
});

describe('exportar notas selecionadas', () => {
  it('busca só os ids pedidos, sempre dentro da empresa, e aceita canceladas', async () => {
    const res = await exportar('formato=xml&ids=a,b');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Notas-Exportadas')).toBe('2');
    const { where } = db.nfsE.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ empresaId: 'e1', id: { in: ['a', 'b'] }, status: { in: ['emitida', 'cancelada'] } });
  });

  it('com seleção, ignora o filtro de mês e de papel', async () => {
    db.nfsE.findMany.mockResolvedValue([nota('a', { dataEmissao: '2020-01-01', dataCompetencia: '2020-01', prestadorCnpj: '11222333000181' })]);
    const res = await exportar('formato=xml&ids=a&mes=2026-10&papel=prestadas');
    expect(res.headers.get('X-Notas-Exportadas')).toBe('1');
  });

  it('sem seleção, o filtro de mês continua igual', async () => {
    const res = await exportar('formato=xml&mes=2019-01');
    expect(res.status).toBe(404);
    expect(db.nfsE.findMany.mock.calls[0][0].where.id).toBeUndefined();
  });

  it('recusa seleção grande demais', async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `n${i}`).join(',');
    expect((await exportar(`formato=xml&ids=${ids}`)).status).toBe(400);
    expect(db.nfsE.findMany).not.toHaveBeenCalled();
  });

  it('responde 413 com mensagem quando o arquivo passa do limite', async () => {
    // Aleatório: precisa continuar grande depois de comprimido.
    const grande = randomBytes(6_000_000).toString('base64');
    db.nfsE.findMany.mockResolvedValue([nota('a', { documento: { nfseXml: grande, eventoXml: null } })]);
    const res = await exportar('formato=xml&ids=a');
    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/limite/);
  });
});
