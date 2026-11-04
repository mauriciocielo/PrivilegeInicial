import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  empresa: { findUnique: vi.fn() },
  perfilDiscAvaliacao: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn((operacoes: unknown[]) => Promise.all(operacoes)),
}));
const sessao = vi.hoisted(() => ({
  atual: null as null | { userId: string; email: string; role: string; empresaIds: string[] },
}));

vi.mock('../../../lib/prisma', () => ({ default: db }));
vi.mock('../../../lib/sentry-helper', () => ({ captureError: vi.fn() }));
vi.mock('../../../lib/session', () => ({ getSessionFromRequest: () => sessao.atual }));

import { GET, POST } from './route';
import { DELETE, GET as GET_DETALHE } from './[id]/route';

const consultor = { userId: 'u1', email: 'c@x.com', role: 'consultor', empresaIds: ['e1'] };
const admin = { userId: 'u0', email: 'a@x.com', role: 'administrador', empresaIds: [] };
const cliente = { userId: 'u2', email: 'k@x.com', role: 'cliente', empresaIds: ['e1'] };

const criar = (corpo: unknown) => POST(new Request('http://x/api/perfil-disc', { method: 'POST', body: JSON.stringify(corpo) }));
const listar = () => GET(new Request('http://x/api/perfil-disc'));
const contexto = { params: Promise.resolve({ id: 'a1' }) };

beforeEach(() => {
  sessao.atual = consultor;
  db.empresa.findUnique.mockReset().mockResolvedValue({ id: 'e1' });
  db.perfilDiscAvaliacao.findMany.mockReset().mockResolvedValue([]);
  db.perfilDiscAvaliacao.findFirst.mockReset().mockResolvedValue(null);
  db.perfilDiscAvaliacao.deleteMany.mockReset().mockResolvedValue({ count: 1 });
  db.perfilDiscAvaliacao.create.mockReset().mockImplementation(({ data }: { data: { token: string; nomeRespondente: string | null } }) =>
    Promise.resolve({ id: `id-${data.token.slice(0, 4)}`, token: data.token, nomeRespondente: data.nomeRespondente }));
});

describe('acesso à área da equipe', () => {
  it('exige sessão', async () => {
    sessao.atual = null;
    expect((await listar()).status).toBe(401);
    expect((await criar({ empresaId: 'e1' })).status).toBe(401);
  });

  it('fecha para o perfil cliente', async () => {
    sessao.atual = cliente;
    expect((await listar()).status).toBe(403);
    expect((await criar({ empresaId: 'e1' })).status).toBe(403);
    expect((await GET_DETALHE(new Request('http://x'), contexto)).status).toBe(403);
    expect((await DELETE(new Request('http://x'), contexto)).status).toBe(403);
  });

  it('o consultor só vê as empresas que atende', async () => {
    await listar();
    expect(db.perfilDiscAvaliacao.findMany.mock.calls[0][0].where).toEqual({ empresaId: { in: ['e1'] } });
  });

  it('o administrador vê todas', async () => {
    sessao.atual = admin;
    await listar();
    expect(db.perfilDiscAvaliacao.findMany.mock.calls[0][0].where).toEqual({});
  });

  it('o detalhe e a exclusão respeitam o mesmo recorte', async () => {
    await GET_DETALHE(new Request('http://x'), contexto);
    expect(db.perfilDiscAvaliacao.findFirst.mock.calls[0][0].where).toEqual({ id: 'a1', empresaId: { in: ['e1'] } });
    await DELETE(new Request('http://x'), contexto);
    expect(db.perfilDiscAvaliacao.deleteMany.mock.calls[0][0].where).toEqual({ id: 'a1', empresaId: { in: ['e1'] } });
  });

  it('responde 404 quando não há o que excluir', async () => {
    db.perfilDiscAvaliacao.deleteMany.mockResolvedValue({ count: 0 });
    expect((await DELETE(new Request('http://x'), contexto)).status).toBe(404);
  });

  it('não devolve as respostas brutas no detalhe', async () => {
    await GET_DETALHE(new Request('http://x'), contexto);
    expect(db.perfilDiscAvaliacao.findFirst.mock.calls[0][0].select.respostas).toBeUndefined();
    expect(db.perfilDiscAvaliacao.findFirst.mock.calls[0][0].select.token).toBeUndefined();
  });
});

describe('listagem', () => {
  const linha = {
    id: 'a1', empresaId: 'e1', token: 'segredo', tipoRespondente: 'colaborador', nomeRespondente: 'P',
    emailRespondente: null, cargoRespondente: null, createdAt: new Date(), iniciadoEm: null,
    concluidoEm: null, tempoRespostaSeg: null, empresa: { razaoSocial: 'R', nomeFantasia: '' },
  };

  it('mostra o token só enquanto o link pode ser respondido', async () => {
    db.perfilDiscAvaliacao.findMany.mockResolvedValue([
      { ...linha, status: 'pendente', resultado: null },
      { ...linha, id: 'a2', status: 'concluida', resultado: { perfilNatural: 'CS', natural: { D: 1 } } },
    ]);
    const { avaliacoes } = await (await listar()).json();
    expect(avaliacoes[0].token).toBe('segredo');
    expect(avaliacoes[1].token).toBeNull();
    expect(avaliacoes[1].perfilNatural).toBe('CS');
    expect(avaliacoes[1].resultado).toBeUndefined();
    expect(avaliacoes[0].empresaNome).toBe('R');
  });
});

describe('listagem de links vencidos', () => {
  it('marca o link vencido e não devolve mais o token', async () => {
    const base = {
      id: 'a1', empresaId: 'e1', token: 'segredo', tipoRespondente: 'colaborador', nomeRespondente: 'P',
      emailRespondente: null, cargoRespondente: null, iniciadoEm: null, concluidoEm: null,
      tempoRespostaSeg: null, status: 'pendente', resultado: null, empresa: { razaoSocial: 'R', nomeFantasia: '' },
    };
    db.perfilDiscAvaliacao.findMany.mockResolvedValue([
      { ...base, createdAt: new Date(Date.now() - 25 * 3_600_000) },
      { ...base, id: 'a2', createdAt: new Date() },
    ]);
    const { avaliacoes } = await (await listar()).json();
    expect(avaliacoes[0].expirado).toBe(true);
    expect(avaliacoes[0].token).toBeNull();
    expect(avaliacoes[1].expirado).toBe(false);
    expect(avaliacoes[1].token).toBe('segredo');
  });
});

describe('gerar links', () => {
  it('recusa empresa fora do escopo do consultor', async () => {
    expect((await criar({ empresaId: 'outra' })).status).toBe(403);
    expect(db.perfilDiscAvaliacao.create).not.toHaveBeenCalled();
  });

  it('o administrador gera para qualquer empresa existente', async () => {
    sessao.atual = admin;
    expect((await criar({ empresaId: 'outra' })).status).toBe(201);
  });

  it('exige empresa e recusa empresa inexistente', async () => {
    expect((await criar({})).status).toBe(422);
    db.empresa.findUnique.mockResolvedValue(null);
    expect((await criar({ empresaId: 'e1' })).status).toBe(404);
  });

  it('gera um token longo e diferente para cada link', async () => {
    const res = await criar({ empresaId: 'e1', quantidade: 5 });
    const { criadas } = await res.json();
    expect(res.status).toBe(201);
    expect(criadas).toHaveLength(5);
    expect(new Set(criadas.map((c: { token: string }) => c.token)).size).toBe(5);
    for (const c of criadas) expect(c.token.length).toBeGreaterThanOrEqual(43);
  });

  it.each([[0], [51], [1.5], ['abc']])('recusa quantidade inválida: %s', async quantidade => {
    expect((await criar({ empresaId: 'e1', quantidade })).status).toBe(422);
  });

  it('não usa o mesmo nome em vários links', async () => {
    expect((await criar({ empresaId: 'e1', quantidade: 2, nomeRespondente: 'Pessoa' })).status).toBe(422);
  });

  it('grava quem gerou e normaliza o tipo', async () => {
    await criar({ empresaId: 'e1', tipoRespondente: 'invalido', nomeRespondente: '  Pessoa  ' });
    const { data } = db.perfilDiscAvaliacao.create.mock.calls[0][0];
    expect(data.criadoPorId).toBe('u1');
    expect(data.tipoRespondente).toBe('colaborador');
    expect(data.nomeRespondente).toBe('Pessoa');
  });
});
