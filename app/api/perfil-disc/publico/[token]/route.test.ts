import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  perfilDiscAvaliacao: { findUnique: vi.fn(), updateMany: vi.fn() },
}));

vi.mock('../../../../../lib/prisma', () => ({ default: db }));
vi.mock('../../../../../lib/sentry-helper', () => ({ captureError: vi.fn() }));

import { GET, POST } from './route';
import { BLOCOS_DISC, IDS_BLOCOS_ADAPTADO, ITENS_JUNG, PARES_VALORES } from '../../../../../lib/perfil-disc/questionario';

const tabela = db.perfilDiscAvaliacao;
const contexto = { params: Promise.resolve({ token: 'token-valido' }) };

let ip = 0;
const requisicao = (corpo?: unknown) => new Request('http://x/api/perfil-disc/publico/token-valido', {
  method: corpo === undefined ? 'GET' : 'POST',
  // Cada chamada usa outro IP, para o limite por minuto não interferir nos testes.
  headers: { 'x-forwarded-for': `10.0.0.${++ip}` },
  ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
});

const pendente = {
  id: 'a1', status: 'pendente', nomeRespondente: 'Pessoa Teste', cargoRespondente: null,
  iniciadoEm: new Date(Date.now() - 600_000), consentimentoEm: new Date(Date.now() - 600_000),
  createdAt: new Date(Date.now() - 3_600_000),
  empresa: { razaoSocial: 'Empresa Ltda', nomeFantasia: 'Empresa' },
};

const respostasCompletas = () => ({
  natural: Object.fromEntries(BLOCOS_DISC.map(b => [b.id, { mais: 0, menos: 1 }])),
  adaptado: Object.fromEntries(IDS_BLOCOS_ADAPTADO.map(id => [id, { mais: 2, menos: 3 }])),
  jung: Object.fromEntries(ITENS_JUNG.map(i => [i.id, 0])),
  valores: Object.fromEntries(PARES_VALORES.map(p => [p.id, 1])),
});

beforeEach(() => {
  tabela.findUnique.mockReset();
  tabela.updateMany.mockReset();
  tabela.updateMany.mockResolvedValue({ count: 1 });
});

describe('abrir o link', () => {
  it('entrega o formulário sem exigir sessão e sem o gabarito', async () => {
    tabela.findUnique.mockResolvedValue(pendente);
    const res = await GET(requisicao(), contexto);
    const dados = await res.json();
    expect(res.status).toBe(200);
    expect(dados.status).toBe('pendente');
    expect(dados.empresa).toBe('Empresa');
    expect(dados.questionario.natural).toHaveLength(16);
    expect(JSON.stringify(dados)).not.toContain('fator');
  });

  it('não consome o link: abrir várias vezes não grava nada', async () => {
    tabela.findUnique.mockResolvedValue(pendente);
    await GET(requisicao(), contexto);
    await GET(requisicao(), contexto);
    expect(tabela.updateMany).not.toHaveBeenCalled();
  });

  it('não reabre um link já respondido nem revela de quem era', async () => {
    tabela.findUnique.mockResolvedValue({ ...pendente, status: 'concluida' });
    const res = await GET(requisicao(), contexto);
    expect(await res.json()).toEqual({ status: 'concluida' });
  });

  it('recusa token desconhecido', async () => {
    tabela.findUnique.mockResolvedValue(null);
    const res = await GET(requisicao(), contexto);
    expect(res.status).toBe(404);
  });

  it('não permite guardar a resposta em cache', async () => {
    tabela.findUnique.mockResolvedValue(pendente);
    const res = await GET(requisicao(), contexto);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('iniciar', () => {
  const semInicio = { ...pendente, iniciadoEm: null, consentimentoEm: null };

  it('exige o consentimento', async () => {
    tabela.findUnique.mockResolvedValue(semInicio);
    const res = await POST(requisicao({ acao: 'iniciar', consentimento: false }), contexto);
    expect(res.status).toBe(422);
    expect(tabela.updateMany).not.toHaveBeenCalled();
  });

  it('exige nome quando o link foi gerado em branco', async () => {
    tabela.findUnique.mockResolvedValue({ ...semInicio, nomeRespondente: null });
    const res = await POST(requisicao({ acao: 'iniciar', consentimento: true, nome: '   ' }), contexto);
    expect(res.status).toBe(422);
  });

  it('não deixa quem abre o link trocar o nome definido pela equipe', async () => {
    tabela.findUnique.mockResolvedValue(semInicio);
    await POST(requisicao({ acao: 'iniciar', consentimento: true, nome: 'Outra Pessoa' }), contexto);
    expect(tabela.updateMany.mock.calls[0][0].data.nomeRespondente).toBe('Pessoa Teste');
  });

  it('registra o aceite e o início na primeira vez', async () => {
    tabela.findUnique.mockResolvedValue(semInicio);
    await POST(requisicao({ acao: 'iniciar', consentimento: true }), contexto);
    const { data } = tabela.updateMany.mock.calls[0][0];
    expect(data.iniciadoEm).toBeInstanceOf(Date);
    expect(data.consentimentoEm).toBeInstanceOf(Date);
  });

  it('mantém o horário original quando a página é recarregada', async () => {
    tabela.findUnique.mockResolvedValue(pendente);
    await POST(requisicao({ acao: 'iniciar', consentimento: true }), contexto);
    expect(tabela.updateMany.mock.calls[0][0].data.iniciadoEm).toBe(pendente.iniciadoEm);
  });
});

describe('concluir', () => {
  it('calcula o resultado no servidor e encerra o link', async () => {
    tabela.findUnique.mockResolvedValue(pendente);
    const res = await POST(requisicao({ acao: 'concluir', respostas: respostasCompletas() }), contexto);
    expect(res.status).toBe(200);
    const { where, data } = tabela.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: 'a1', status: 'pendente' });
    expect(data.status).toBe('concluida');
    expect(data.resultado.natural).toBeDefined();
    expect(data.tempoRespostaSeg).toBeGreaterThanOrEqual(599);
  });

  it('ignora um resultado enviado pelo navegador', async () => {
    tabela.findUnique.mockResolvedValue(pendente);
    await POST(requisicao({ acao: 'concluir', respostas: respostasCompletas(), resultado: { natural: { D: 100 } } }), contexto);
    expect(tabela.updateMany.mock.calls[0][0].data.resultado.natural.D).not.toBe(100);
  });

  it('recusa um segundo envio depois de respondido', async () => {
    tabela.findUnique.mockResolvedValue({ ...pendente, status: 'concluida' });
    const res = await POST(requisicao({ acao: 'concluir', respostas: respostasCompletas() }), contexto);
    expect(res.status).toBe(409);
    expect(tabela.updateMany).not.toHaveBeenCalled();
  });

  it('recusa o envio que perdeu a corrida para outro simultâneo', async () => {
    tabela.findUnique.mockResolvedValue(pendente);
    tabela.updateMany.mockResolvedValue({ count: 0 });
    const res = await POST(requisicao({ acao: 'concluir', respostas: respostasCompletas() }), contexto);
    expect(res.status).toBe(409);
  });

  it('não aceita iniciar de novo um link respondido', async () => {
    tabela.findUnique.mockResolvedValue({ ...pendente, status: 'concluida' });
    const res = await POST(requisicao({ acao: 'iniciar', consentimento: true }), contexto);
    expect(res.status).toBe(409);
  });

  it('não encerra o link se faltar resposta, para a pessoa poder corrigir', async () => {
    tabela.findUnique.mockResolvedValue(pendente);
    const respostas = respostasCompletas();
    delete (respostas.natural as Record<string, unknown>).b03;
    const res = await POST(requisicao({ acao: 'concluir', respostas }), contexto);
    expect(res.status).toBe(422);
    expect(tabela.updateMany).not.toHaveBeenCalled();
  });

  it('exige ter passado pelo aceite antes de enviar', async () => {
    tabela.findUnique.mockResolvedValue({ ...pendente, iniciadoEm: null, consentimentoEm: null });
    const res = await POST(requisicao({ acao: 'concluir', respostas: respostasCompletas() }), contexto);
    expect(res.status).toBe(422);
    expect(tabela.updateMany).not.toHaveBeenCalled();
  });

  it('recusa ação desconhecida e corpo inválido', async () => {
    tabela.findUnique.mockResolvedValue(pendente);
    expect((await POST(requisicao({ acao: 'apagar' }), contexto)).status).toBe(400);
    expect((await POST(requisicao('não é objeto'), contexto)).status).toBe(400);
  });
});

describe('prazo de 24 horas', () => {
  const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000);
  const vencido = { ...pendente, createdAt: horasAtras(25), iniciadoEm: null, consentimentoEm: null };

  it('não abre o formulário depois do prazo nem revela de quem era', async () => {
    tabela.findUnique.mockResolvedValue(vencido);
    const res = await GET(requisicao(), contexto);
    expect(await res.json()).toEqual({ status: 'expirado' });
  });

  it('não deixa começar depois do prazo', async () => {
    tabela.findUnique.mockResolvedValue(vencido);
    const res = await POST(requisicao({ acao: 'iniciar', consentimento: true }), contexto);
    expect(res.status).toBe(410);
    expect(tabela.updateMany).not.toHaveBeenCalled();
  });

  it('aceita o envio de quem começou no prazo, dentro da tolerância', async () => {
    tabela.findUnique.mockResolvedValue({ ...pendente, createdAt: horasAtras(24.5), iniciadoEm: horasAtras(0.6) });
    const res = await POST(requisicao({ acao: 'concluir', respostas: respostasCompletas() }), contexto);
    expect(res.status).toBe(200);
  });

  it('recusa o envio depois da tolerância, sem gravar', async () => {
    tabela.findUnique.mockResolvedValue({ ...pendente, createdAt: horasAtras(26), iniciadoEm: horasAtras(2.5) });
    const res = await POST(requisicao({ acao: 'concluir', respostas: respostasCompletas() }), contexto);
    expect(res.status).toBe(410);
    expect(tabela.updateMany).not.toHaveBeenCalled();
  });

  it('um link respondido continua dizendo que foi respondido, mesmo depois do prazo', async () => {
    tabela.findUnique.mockResolvedValue({ ...vencido, status: 'concluida' });
    expect(await (await GET(requisicao(), contexto)).json()).toEqual({ status: 'concluida' });
  });
});

describe('limite de tentativas', () => {
  it('bloqueia o excesso vindo do mesmo IP', async () => {
    tabela.findUnique.mockResolvedValue(pendente);
    const mesmoIp = () => new Request('http://x/api', { headers: { 'x-forwarded-for': '203.0.113.9' } });
    let ultima = 0;
    for (let i = 0; i < 121; i++) ultima = (await GET(mesmoIp(), contexto)).status;
    expect(ultima).toBe(429);
  });
});
