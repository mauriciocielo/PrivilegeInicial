import { randomBytes } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  nfeDestinada: { findMany: vi.fn(), count: vi.fn() },
  empresa: { findUnique: vi.fn(), findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const sessao = vi.hoisted(() => ({ atual: { userId: 'u1', email: 'c@x.com', role: 'consultor', empresaIds: ['e1'] } as { userId: string; email: string; role: string; empresaIds: string[] } | null }));

vi.mock('../../../../../lib/prisma', () => ({ default: db }));
vi.mock('../../../../../lib/sentry-helper', () => ({ captureError: vi.fn() }));
vi.mock('../../../../../lib/session', () => ({ getSessionFromRequest: () => sessao.atual }));

import { POST } from './route';

const CHAVE = '41261111222333000181550010000012341000012345';
const XML = `<nfeProc><NFe><infNFe Id="NFe${CHAVE}"><ide><nNF>1</nNF><serie>1</serie><tpNF>1</tpNF></ide><emit><xNome>F</xNome></emit><dest><xNome>D</xNome></dest><det nItem="1"><prod><cProd>1</cProd><xProd>P</xProd></prod></det></infNFe></NFe></nfeProc>`;
const nota = (over = {}) => ({ numero: '1', chaveAcesso: CHAVE, dataEmissao: '2026-11-03', emitenteNome: 'Fornecedor Á', situacao: 'autorizada', xml: XML, ...over });

const exportar = (corpo: unknown) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(corpo) }));

beforeEach(() => {
  sessao.atual = { userId: 'u1', email: 'c@x.com', role: 'consultor', empresaIds: ['e1'] };
  db.nfeDestinada.findMany.mockReset().mockResolvedValue([nota()]);
  db.nfeDestinada.count.mockReset().mockResolvedValue(0);
  db.empresa.findUnique.mockReset().mockResolvedValue({ razaoSocial: 'Empresa', nomeFantasia: '' });
  db.empresa.findFirst.mockReset().mockResolvedValue(null);
  db.user.findUnique.mockReset().mockResolvedValue({ allowedRoutes: [] });
});

describe('acesso', () => {
  it('exige sessão e fecha para o cliente', async () => {
    sessao.atual = null;
    expect((await exportar({ empresaId: 'e1' })).status).toBe(401);
    sessao.atual = { userId: 'u', email: 'k@x.com', role: 'cliente', empresaIds: ['e1'] };
    expect((await exportar({ empresaId: 'e1' })).status).toBe(403);
  });

  it('recusa empresa fora da carteira', async () => {
    expect((await exportar({ empresaId: 'outra' })).status).toBe(403);
    expect(db.nfeDestinada.findMany).not.toHaveBeenCalled();
  });

  it('mantém a empresa no filtro das selecionadas: id de outra empresa não vaza', async () => {
    await exportar({ empresaId: 'e1', ids: ['n1', 'de-outra'] });
    expect(db.nfeDestinada.findMany.mock.calls[0][0].where).toMatchObject({ empresaId: 'e1', id: { in: ['n1', 'de-outra'] }, possuiXml: true });
  });
});

describe('seleção', () => {
  it('aplica o mês quando exporta o filtro', async () => {
    await exportar({ empresaId: 'e1', mes: '2026-11' });
    expect(db.nfeDestinada.findMany.mock.calls[0][0].where).toMatchObject({ empresaId: 'e1', dataEmissao: { gte: '2026-11-01', lte: '2026-11-31' } });
  });

  it('recusa seleção vazia', async () => {
    expect((await exportar({ empresaId: 'e1', ids: [] })).status).toBe(422);
  });

  it('explica quando só há resumos', async () => {
    db.nfeDestinada.findMany.mockResolvedValue([]);
    db.nfeDestinada.count.mockResolvedValue(3);
    const res = await exportar({ empresaId: 'e1', mes: '2026-11' });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain('3 nota(s)');
  });
});

describe('formatos', () => {
  const nomes = async (res: Response) => Buffer.from(await res.arrayBuffer()).toString('latin1');

  it('entrega ZIP com XML e PDF em pastas', async () => {
    const res = await exportar({ empresaId: 'e1', formato: 'ambos', mes: '2026-11' });
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('NFe-Empresa-2026-11.zip');
    const corpo = await nomes(res);
    expect(corpo).toContain('xml/NFe_1_2026-11-03_Fornecedor_A.xml');
    expect(corpo).toContain('pdf/NFe_1_2026-11-03_Fornecedor_A.pdf');
  });

  it('marca a nota cancelada no nome do arquivo', async () => {
    db.nfeDestinada.findMany.mockResolvedValue([nota({ situacao: 'cancelada' })]);
    expect(await nomes(await exportar({ empresaId: 'e1', formato: 'xml' }))).toContain('CANCELADA_NFe_1');
  });

  it('não sobrescreve arquivos de mesmo nome', async () => {
    db.nfeDestinada.findMany.mockResolvedValue([nota(), nota()]);
    const corpo = await nomes(await exportar({ empresaId: 'e1', formato: 'xml' }));
    expect(corpo).toContain('NFe_1_2026-11-03_Fornecedor_A_2.xml');
  });

  it('entrega um único PDF', async () => {
    const res = await exportar({ empresaId: 'e1', formato: 'pdf_unico', ids: ['n1'] });
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toContain('Selecionadas.pdf');
  });

  it('informa as notas que ficaram de fora', async () => {
    db.nfeDestinada.count.mockResolvedValue(2);
    db.nfeDestinada.findMany.mockResolvedValue([nota(), nota({ xml: '<resNFe/>' })]);
    const res = await exportar({ empresaId: 'e1', formato: 'pdf' });
    expect(res.headers.get('x-notas-sem-xml')).toBe('2');
    expect(res.headers.get('x-notas-com-erro')).toBe('1');
    expect(res.headers.get('x-notas-exportadas')).toBe('1');
  });

  it('não entrega arquivo acima do limite da hospedagem', async () => {
    // Dados que não comprimem: o limite vale para o tamanho final do arquivo.
    const enorme = XML.replace('<cProd>1</cProd>', `<cProd>1</cProd><x>${randomBytes(5_000_000).toString('latin1')}</x>`);
    db.nfeDestinada.findMany.mockResolvedValue([nota({ xml: enorme })]);
    const res = await exportar({ empresaId: 'e1', formato: 'xml' });
    expect(res.status).toBe(413);
  });
});
