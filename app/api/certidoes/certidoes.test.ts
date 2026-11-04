import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  empresa: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
  certidaoFiscal: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  certidaoConfig: { findFirst: vi.fn(), upsert: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const sessao = vi.hoisted(() => ({ atual: null as null | { userId: string; email: string; role: string; empresaIds: string[] } }));
const federal = vi.hoisted(() => ({ consultar: vi.fn() }));

vi.mock('../../../lib/prisma', () => ({ default: db }));
vi.mock('../../../lib/sentry-helper', () => ({ captureError: vi.fn() }));
vi.mock('../../../lib/session', () => ({ getSessionFromRequest: () => sessao.atual }));
vi.mock('../../../lib/serpro/integra-contador', () => ({
  consultarCertidaoNegativaFederal: federal.consultar,
  apenasDigitos: (v: string) => (v || '').replace(/\D/g, ''),
}));

import { GET as listar } from './route';
import { POST as consultar } from './consultar/route';
import { GET as baixar } from './[id]/download/route';
import { GET as cron } from '../cron/certidoes-mensal/route';

const CONSULTOR = { userId: 'u1', email: 'c@x.com', role: 'consultor', empresaIds: ['e1'] };
const ADMIN = { userId: 'a', email: 'a@x.com', role: 'administrador', empresaIds: [] };
const CNPJ = '11.222.333/0001-81';

const pedirConsulta = (empresaId?: string) => consultar(new Request('http://x', { method: 'POST', body: JSON.stringify({ empresaId, todas: true }) }));
const download = (id = 'c1') => baixar(new Request('http://x'), { params: Promise.resolve({ id }) });

beforeEach(() => {
  sessao.atual = CONSULTOR;
  vi.unstubAllEnvs();
  db.user.findUnique.mockReset().mockResolvedValue({ allowedRoutes: [] });
  db.empresa.findMany.mockReset().mockResolvedValue([{ id: 'e1', razaoSocial: 'E', nomeFantasia: '', cnpj: CNPJ, uf: 'PR', cidade: 'C' }]);
  db.empresa.findUnique.mockReset().mockResolvedValue({ id: 'e1', razaoSocial: 'E', nomeFantasia: '', cnpj: CNPJ });
  db.empresa.findFirst.mockReset().mockResolvedValue(null);
  db.certidaoFiscal.findMany.mockReset().mockResolvedValue([]);
  db.certidaoFiscal.findUnique.mockReset();
  db.certidaoFiscal.create.mockReset().mockResolvedValue({ id: 'novo' });
  db.certidaoConfig.findFirst.mockReset().mockResolvedValue(null);
  federal.consultar.mockReset().mockResolvedValue({ sucesso: true, situacao: 'NEGATIVA', mensagem: 'ok', pdfBase64: 'QQ==' });
});

describe('lista', () => {
  it('exige login e fecha para o cliente', async () => {
    sessao.atual = null;
    expect((await listar(new Request('http://x'))).status).toBe(401);
    sessao.atual = { ...CONSULTOR, role: 'cliente' };
    expect((await listar(new Request('http://x'))).status).toBe(403);
  });

  it('pedir outra empresa pela URL não abre a carteira de ninguém', async () => {
    await listar(new Request('http://x?empresaId=e9'));
    const where = db.empresa.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual([{ id: { in: ['e1'] } }, { id: 'e9' }]);
  });

  it('só traz registros federais: os estaduais antigos não vieram de consulta real', async () => {
    await listar(new Request('http://x'));
    expect(db.certidaoFiscal.findMany.mock.calls[0][0].where.tipo).toBe('FEDERAL');
  });

  it('um "sem pendências" antigo aparece como conferência, não como regular', async () => {
    db.certidaoFiscal.findMany.mockResolvedValue([{ id: 'c', empresaId: 'e1', situacao: 'NEGATIVA', pendencias: null, createdAt: new Date() }]);
    const dados = await (await listar(new Request('http://x'))).json();
    expect(dados.empresas[0].categoria).toBe('atencao');
    expect(dados.metricas).toMatchObject({ sem_pendencias: 0, atencao: 1 });
  });
});

describe('consulta', () => {
  it('recusa empresa fora da carteira e nem chega ao SERPRO', async () => {
    expect((await pedirConsulta('e9')).status).toBe(403);
    expect(federal.consultar).not.toHaveBeenCalled();
  });

  it('cliente não dispara consulta', async () => {
    sessao.atual = { ...CONSULTOR, role: 'cliente' };
    expect((await pedirConsulta('e1')).status).toBe(403);
  });

  it('o pedido em lote foi retirado: sem empresa, nada é consultado', async () => {
    expect((await pedirConsulta()).status).toBe(400);
    expect(federal.consultar).not.toHaveBeenCalled();
  });

  it('grava só o registro federal, com a versão do classificador', async () => {
    const res = await pedirConsulta('e1');
    expect((await res.json()).resultado).toMatchObject({ certidaoId: 'novo', situacao: 'NEGATIVA' });
    expect(db.certidaoFiscal.create).toHaveBeenCalledTimes(1);
    expect(db.certidaoFiscal.create.mock.calls[0][0].data).toMatchObject({ tipo: 'FEDERAL', pendencias: { classificador: 2 } });
  });

  it('falha do SERPRO fica registrada como erro, nunca como regular', async () => {
    federal.consultar.mockRejectedValue(new Error('fora do ar'));
    const res = await pedirConsulta('e1');
    expect((await res.json()).resultado).toMatchObject({ situacao: 'ERRO', mensagem: 'fora do ar' });
    expect(db.certidaoFiscal.create.mock.calls[0][0].data.situacao).toBe('ERRO');
  });
});

describe('download', () => {
  const registro = (over = {}) => ({ id: 'c1abcdefgh', empresaId: 'e1', tipo: 'FEDERAL', pdfBase64: 'QQ==', empresa: { cnpj: CNPJ }, ...over });

  it('recusa empresa fora da carteira', async () => {
    db.certidaoFiscal.findUnique.mockResolvedValue(registro({ empresaId: 'e9' }));
    expect((await download()).status).toBe(403);
  });

  it('não entrega o PDF estadual gerado pelo sistema', async () => {
    db.certidaoFiscal.findUnique.mockResolvedValue(registro({ tipo: 'ESTADUAL' }));
    const res = await download();
    expect(res.status).toBe(410);
    expect((await res.json()).error).toMatch(/SEFAZ/);
  });

  it('entrega o relatório sem cache compartilhado', async () => {
    db.certidaoFiscal.findUnique.mockResolvedValue(registro());
    const res = await download();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });
});

describe('rotina mensal', () => {
  const chamar = (query = '', auth?: string) => cron(new Request(`http://x/${query}`, auth ? { headers: { authorization: auth } } : undefined));

  it('forcar=true sem login não roda mais', async () => {
    sessao.atual = null;
    expect((await chamar('?forcar=true')).status).toBe(401);
    expect(db.empresa.findMany).not.toHaveBeenCalled();
  });

  it('segredo errado e usuário comum não rodam', async () => {
    vi.stubEnv('CRON_SECRET', 'certo');
    sessao.atual = null;
    expect((await chamar('?forcar=true', 'Bearer errado')).status).toBe(401);
    sessao.atual = CONSULTOR;
    expect((await chamar('?forcar=true')).status).toBe(401);
  });

  it('o segredo do agendador e o administrador são aceitos', async () => {
    vi.stubEnv('CRON_SECRET', 'certo');
    sessao.atual = null;
    expect((await chamar('', 'Bearer certo')).status).toBe(200);
    sessao.atual = ADMIN;
    expect((await chamar()).status).toBe(200);
  });
});
