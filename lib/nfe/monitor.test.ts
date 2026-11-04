import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  empresa: { findUnique: vi.fn() },
  nfeDistribuicao: { upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  nfeDestinada: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}));
const sefaz = vi.hoisted(() => ({ enviar: vi.fn() }));

vi.mock('../prisma', () => ({ default: db }));
vi.mock('../nfse/servidor', () => ({ abrirCredencial: async () => ({ credencial: { cnpj: '11222333000181' } }) }));
vi.mock('./distribuicao', async (original) => ({ ...(await original<typeof import('./distribuicao')>()), enviarDistribuicao: sefaz.enviar }));

import { consultarLoteNfeDestinadas, consultarNfeDestinadas } from './monitor';

const SEM_NOTAS = '<retDistDFeInt><cStat>137</cStat><xMotivo>Nenhum documento</xMotivo><ultNSU>000000000000001</ultNSU><maxNSU>000000000000001</maxNSU></retDistDFeInt>';
const COM_MAIS = '<retDistDFeInt><cStat>138</cStat><xMotivo>Documento localizado</xMotivo><ultNSU>000000000000002</ultNSU><maxNSU>000000000000009</maxNSU></retDistDFeInt>';

beforeEach(() => {
  db.empresa.findUnique.mockReset().mockResolvedValue({ cnpj: '11222333000181', nfseConfig: { usarProcuracao: false, codigoMunicipio: '4106902' } });
  db.nfeDistribuicao.upsert.mockReset().mockResolvedValue({ ativo: true, ultNsu: '0', maxNsu: '0', proximaConsultaEm: null });
  db.nfeDistribuicao.updateMany.mockReset().mockResolvedValue({ count: 1 });
  db.nfeDistribuicao.update.mockReset().mockResolvedValue({});
  db.nfeDistribuicao.findMany.mockReset().mockResolvedValue([]);
  sefaz.enviar.mockReset().mockResolvedValue({ status: 200, corpo: SEM_NOTAS });
});

describe('consulta concorrente', () => {
  it('não chama a SEFAZ quando outra instância já reservou o CNPJ', async () => {
    db.nfeDistribuicao.updateMany.mockResolvedValue({ count: 0 });
    const r = await consultarNfeDestinadas('e1');
    expect(r.executada).toBe(false);
    expect(sefaz.enviar).not.toHaveBeenCalled();
  });

  it('reserva só se o período de espera já passou', async () => {
    await consultarNfeDestinadas('e1');
    const { where, data } = db.nfeDistribuicao.updateMany.mock.calls[0][0];
    expect(where.empresaId).toBe('e1');
    expect(where.OR[0]).toEqual({ proximaConsultaEm: null });
    expect(data.proximaConsultaEm.getTime()).toBeGreaterThan(Date.now());
    expect(sefaz.enviar).toHaveBeenCalledTimes(1);
  });

  it('a resposta da SEFAZ substitui a reserva pela espera de 1 hora', async () => {
    const r = await consultarNfeDestinadas('e1');
    expect(r.proximaConsultaEm!.getTime() - Date.now()).toBeGreaterThan(60 * 60_000);
  });
});

describe('limite de tempo', () => {
  it('sem tempo para outra página, grava como parcial e libera a continuação', async () => {
    sefaz.enviar.mockResolvedValue({ status: 200, corpo: COM_MAIS.replace('<ultNSU>000000000000002', '<ultNSU>000000000000002') });
    const r = await consultarNfeDestinadas('e1', Date.now() - 1);
    expect(sefaz.enviar).toHaveBeenCalledTimes(1);
    expect(r.temMais).toBe(true);
    expect(r.proximaConsultaEm).toBeNull();
  });

  it('a rodada para de iniciar empresas no limite e conta as que restaram', async () => {
    db.nfeDistribuicao.findMany.mockResolvedValue([{ empresaId: 'e1' }, { empresaId: 'e2' }]);
    const r = await consultarLoteNfeDestinadas(150, -1);
    expect(r.restantes).toBe(2);
    expect(sefaz.enviar).not.toHaveBeenCalled();
  });
});
