import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  certidaoFiscal: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  empresa: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const sessao = vi.hoisted(() => ({ atual: null as null | { userId: string; email: string; role: string; empresaIds: string[] } }));

vi.mock('../../../../lib/prisma', () => ({ default: db }));
vi.mock('../../../../lib/sentry-helper', () => ({ captureError: vi.fn() }));
vi.mock('../../../../lib/session', () => ({ getSessionFromRequest: () => sessao.atual }));

import { POST } from './route';
import { DELETE } from '../[id]/route';
import { GET as baixar } from '../[id]/download/route';

const PDF = Buffer.from('%PDF-1.7 conteudo').toString('base64');
const CONSULTOR = { userId: 'u1', email: 'fiscal@x.com', role: 'consultor', empresaIds: ['e1'] };
const valido = { empresaId: 'e1', uf: 'pr', situacao: 'NEGATIVA', validoAte: '2099-01-31', pdfBase64: PDF, nomeArquivo: 'cnd.pdf' };
const anexar = (corpo: object) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(corpo) }));
const contexto = { params: Promise.resolve({ id: 'c1' }) };

beforeEach(() => {
  sessao.atual = CONSULTOR;
  db.certidaoFiscal.create.mockReset().mockResolvedValue({ id: 'novo' });
  db.certidaoFiscal.findUnique.mockReset();
  db.certidaoFiscal.delete.mockReset().mockResolvedValue({});
  db.empresa.findFirst.mockReset().mockResolvedValue(null);
  db.user.findUnique.mockReset().mockResolvedValue({ allowedRoutes: [] });
});

describe('anexar certidão', () => {
  it('guarda com a marca de anexo, quem enviou e a data sem mudar de dia', async () => {
    const res = await anexar(valido);
    expect(res.status).toBe(200);
    const { data } = db.certidaoFiscal.create.mock.calls[0][0];
    expect(data).toMatchObject({ tipo: 'ESTADUAL', uf: 'PR', situacao: 'NEGATIVA', observacoes: 'Anexada por fiscal@x.com', pendencias: { origem: 'anexo_manual', usuarioId: 'u1' } });
    expect(data.validoAte.toISOString().slice(0, 10)).toBe('2099-01-31');
  });

  it('exige login e recusa empresa fora da carteira e cliente', async () => {
    sessao.atual = null;
    expect((await anexar(valido)).status).toBe(401);
    sessao.atual = CONSULTOR;
    expect((await anexar({ ...valido, empresaId: 'e9' })).status).toBe(403);
    sessao.atual = { ...CONSULTOR, role: 'cliente' };
    expect((await anexar(valido)).status).toBe(403);
    expect(db.certidaoFiscal.create).not.toHaveBeenCalled();
  });

  it.each([
    ['estado inexistente', { uf: 'XX' }],
    ['situação inventada', { situacao: 'REGULAR' }],
    ['negativa sem validade', { validoAte: '' }],
    ['data inválida', { validoAte: '31/01/2099' }],
    ['certidão vencida', { validoAte: '2020-01-01' }],
    ['arquivo que não é PDF', { pdfBase64: Buffer.from('<html>falso</html>').toString('base64') }],
    ['sem arquivo', { pdfBase64: '' }],
  ])('recusa %s', async (_nome, mudanca) => {
    expect((await anexar({ ...valido, ...mudanca })).status).toBe(422);
    expect(db.certidaoFiscal.create).not.toHaveBeenCalled();
  });

  it('recusa PDF acima de 3 MB', async () => {
    const grande = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(3 * 1024 * 1024)]).toString('base64');
    expect((await anexar({ ...valido, pdfBase64: grande })).status).toBe(413);
  });

  it('certidão positiva pode vir sem validade', async () => {
    expect((await anexar({ ...valido, situacao: 'POSITIVA', validoAte: '' })).status).toBe(200);
    expect(db.certidaoFiscal.create.mock.calls[0][0].data.validoAte).toBeNull();
  });
});

describe('baixar e remover', () => {
  const registro = (over = {}) => ({ id: 'c1abcdefgh', empresaId: 'e1', tipo: 'ESTADUAL', pdfBase64: PDF, pendencias: { origem: 'anexo_manual' }, empresa: { cnpj: '11222333000181' }, ...over });

  it('a anexada abre; a antiga, gerada pelo sistema, continua bloqueada', async () => {
    db.certidaoFiscal.findUnique.mockResolvedValue(registro());
    expect((await baixar(new Request('http://x'), contexto)).status).toBe(200);
    db.certidaoFiscal.findUnique.mockResolvedValue(registro({ pendencias: null }));
    expect((await baixar(new Request('http://x'), contexto)).status).toBe(410);
  });

  it('remove só o que foi anexado', async () => {
    db.certidaoFiscal.findUnique.mockResolvedValue(registro());
    expect((await DELETE(new Request('http://x'), contexto)).status).toBe(200);
    expect(db.certidaoFiscal.delete).toHaveBeenCalledTimes(1);
  });

  it('não remove consulta federal nem registro antigo', async () => {
    db.certidaoFiscal.findUnique.mockResolvedValue(registro({ tipo: 'FEDERAL', pendencias: { classificador: 2 } }));
    expect((await DELETE(new Request('http://x'), contexto)).status).toBe(409);
    db.certidaoFiscal.findUnique.mockResolvedValue(registro({ pendencias: null }));
    expect((await DELETE(new Request('http://x'), contexto)).status).toBe(409);
    expect(db.certidaoFiscal.delete).not.toHaveBeenCalled();
  });

  it('não remove de empresa fora da carteira', async () => {
    db.certidaoFiscal.findUnique.mockResolvedValue(registro({ empresaId: 'e9' }));
    expect((await DELETE(new Request('http://x'), contexto)).status).toBe(403);
  });
});
