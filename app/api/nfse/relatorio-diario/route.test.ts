import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-nao-usar-em-producao';
  return { enviar: vi.fn() };
});

vi.mock('../../../../lib/prisma', () => ({ default: { user: { findUnique: vi.fn() } } }));
vi.mock('../../../../lib/sentry-helper', () => ({ captureError: vi.fn() }));
vi.mock('../../../../lib/nfse/relatorio-fiscal', () => ({
  enviarRelatorioFiscalDiario: mocks.enviar,
  relatorioEmAndamento: () => false,
}));

import { GET, POST } from './route';
import { createSessionToken, sessionCookieHeader } from '../../../../lib/session';

const cookieDe = (role: string) => sessionCookieHeader(
  createSessionToken({ userId: 'u', email: 'u@x.com', role, empresaIds: [] }),
).split(';')[0];

const URL_ROTA = 'http://x/api/nfse/relatorio-diario';
const postar = (headers: Record<string, string> = {}) => POST(new Request(URL_ROTA, { method: 'POST', headers, body: '{}' }));

describe('quem pode disparar o relatório fiscal', () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
    mocks.enviar.mockReset().mockResolvedValue({ mensagem: 'ok', qtdEmitidas: 0, qtdTomadas: 0 });
  });

  it('sem sessão e sem token, não dispara', async () => {
    expect((await GET(new Request(URL_ROTA))).status).toBe(401);
    expect((await postar()).status).toBe(401);
    expect(mocks.enviar).not.toHaveBeenCalled();
  });

  it('o cliente não dispara', async () => {
    expect((await postar({ cookie: cookieDe('cliente') })).status).toBe(401);
    expect(mocks.enviar).not.toHaveBeenCalled();
  });

  it('o token errado do agendador não dispara', async () => {
    process.env.CRON_SECRET = 'segredo-do-cron';
    expect((await GET(new Request(`${URL_ROTA}?token=errado`))).status).toBe(401);
    expect(mocks.enviar).not.toHaveBeenCalled();
  });

  it('o consultor dispara', async () => {
    expect((await postar({ cookie: cookieDe('consultor') })).status).toBe(202);
    expect(mocks.enviar).toHaveBeenCalledOnce();
  });

  it('o agendador dispara com o token certo', async () => {
    process.env.CRON_SECRET = 'segredo-do-cron';
    expect((await GET(new Request(`${URL_ROTA}?token=segredo-do-cron`))).status).toBe(202);
    expect(mocks.enviar).toHaveBeenCalledOnce();
  });
});
