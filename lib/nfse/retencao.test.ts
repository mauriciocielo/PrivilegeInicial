import { describe, expect, it } from 'vitest';
import { gzipSync } from 'zlib';
import { montarDps, validarEmissao, type ConfigFiscalNfse, type DadosDps } from './dps';
import { estimarValoresNota } from './lote';
import { eventoCancelaNota, lerNotaEmitida, mesclarServicos } from './emissor';
import { lerCaixaDfe, type Transporte } from './sefin';
import {
  SEM_RETENCAO, calcularRetidos, dividirRetencaoAgrupada, escolherRegra, normalizarRegras, percentuaisDosValores,
  tipoRetencaoPisCofins, totalRetidoFederal, type RegraRetencao,
} from './retencao';
import tabela from './dados/tabela-servicos.json';

const AGORA = new Date('2026-11-03T15:00:00Z');
const CNPJ = '11222333000181';

const cfg: ConfigFiscalNfse = { cnpj: CNPJ, codigoMunicipio: '4305108', opSimpNac: 1, regEspTrib: 0, piscofinsCst: '00', convenioAtivo: true };
const dados: DadosDps = {
  ambiente: 'producao', serie: '10', nDps: '1', dataCompetencia: '2026-11', descricao: 'Consultoria', valorServicos: 800,
  cTribNac: '170101', municipioPrestacao: '4305108', issRetido: false, tomadorDocumento: '04252011000110', tomadorNome: 'Cliente',
};

const regra = (extra: Partial<RegraRetencao> = {}): RegraRetencao => ({
  id: 'r', nome: 'Regra', ativa: true, servicos: [], tomador: 'pj', valorMinimo: 0, issRetido: false, aliquotaIss: null,
  percentuais: { irrf: 1.5, pis: 0.65, cofins: 3, csll: 1, cp: 0 }, ...extra,
});

describe('código de retenção (tpRetPisCofins)', () => {
  it('segue a tabela oficial da NT 007', () => {
    const t = (pis: number, cofins: number, csll: number) => tipoRetencaoPisCofins({ pis, cofins, csll });
    expect(t(1, 1, 1)).toBe('3');
    expect(t(1, 1, 0)).toBe('4');
    expect(t(1, 0, 0)).toBe('5');
    expect(t(0, 1, 0)).toBe('6');
    expect(t(0, 1, 1)).toBe('7');
    expect(t(0, 0, 1)).toBe('8');
    expect(t(1, 0, 1)).toBe('9');
    expect(t(0, 0, 0)).toBeNull();
  });
});

describe('cálculo', () => {
  it('reproduz o exemplo de R$ 800 com retenção integral', () => {
    const r = calcularRetidos(800, regra().percentuais);
    expect(r).toEqual({ irrf: 12, pis: 5.2, cofins: 24, csll: 8, cp: 0 });
    expect(totalRetidoFederal(r)).toBe(49.2);
    expect(percentuaisDosValores(800, r)).toEqual(regra().percentuais);
  });

  it('calcula o líquido como o Sefin: serviço menos retenções', () => {
    expect(estimarValoresNota(1000, 3, true, 61.5)).toEqual({ valorIss: 30, valorLiquido: 908.5 });
    expect(estimarValoresNota(1000, 3, false, 61.5).valorLiquido).toBe(938.5);
    expect(estimarValoresNota(1000, 0, false).valorLiquido).toBe(1000);
  });
});

describe('DPS com retenção', () => {
  it('soma PIS, COFINS e CSLL em vRetCSLL e nunca usa vPis/vCofins', () => {
    const { xml } = montarDps(cfg, { ...dados, retencao: { irrf: 12, pis: 5.2, cofins: 24, csll: 8, cp: 0 } }, AGORA);
    expect(xml).toContain('<tribFed><piscofins><CST>00</CST><tpRetPisCofins>3</tpRetPisCofins></piscofins><vRetIRRF>12.00</vRetIRRF><vRetCSLL>37.20</vRetCSLL></tribFed>');
    expect(xml).not.toContain('<vPis>');
    expect(xml).not.toContain('<vCofins>');
    expect(xml).not.toContain('vRetCP');
  });

  it('coloca os valores na ordem do XSD quando há INSS', () => {
    const { xml } = montarDps(cfg, { ...dados, retencao: { irrf: 1, pis: 0, cofins: 0, csll: 2, cp: 3 } }, AGORA);
    expect(xml).toContain('<tpRetPisCofins>8</tpRetPisCofins></piscofins><vRetCP>3.00</vRetCP><vRetIRRF>1.00</vRetIRRF><vRetCSLL>2.00</vRetCSLL>');
  });

  it('só IRRF não informa vRetCSLL (E0720)', () => {
    const { xml } = montarDps({ ...cfg, tpRetPisCofins: '0' }, { ...dados, retencao: { ...SEM_RETENCAO, irrf: 12 } }, AGORA);
    expect(xml).toContain('<tpRetPisCofins>0</tpRetPisCofins></piscofins><vRetIRRF>12.00</vRetIRRF></tribFed>');
    expect(xml).not.toContain('vRetCSLL');
  });

  it('ignora código de retenção da configuração que exigiria vRetCSLL (E0724)', () => {
    const { xml } = montarDps({ ...cfg, tpRetPisCofins: '3' }, dados, AGORA);
    expect(xml).not.toContain('tpRetPisCofins');
  });

  it('não emite nada federal para MEI e barra retenção informada', () => {
    const mei = { ...cfg, opSimpNac: 2 };
    const comRetencao = { ...dados, retencao: { ...SEM_RETENCAO, irrf: 12 } };
    expect(montarDps(mei, comRetencao, AGORA).xml).not.toContain('tribFed');
    expect(validarEmissao(mei, comRetencao, AGORA).join(' ')).toContain('E0676');
  });

  it('barra retenções que alcançam o valor do serviço (E0428)', () => {
    const problemas = validarEmissao(cfg, { ...dados, valorServicos: 100, issRetido: true, aliquotaIss: 5, retencao: { ...SEM_RETENCAO, irrf: 96 }, tomadorCodigoMunicipio: '4305108', tomadorCep: '95000000', tomadorLogradouro: 'R', tomadorBairro: 'B' }, AGORA);
    expect(problemas.join(' ')).toContain('E0428');
  });
});

describe('regras de retenção', () => {
  const nota = { cTribNac: '170101', tomadorDocumento: '04252011000110', valorServicos: 1000 };

  it('filtra por tomador, valor mínimo, serviço e situação', () => {
    expect(escolherRegra([regra({ tomador: 'pf' })], nota)).toBeNull();
    expect(escolherRegra([regra({ valorMinimo: 5000 })], nota)).toBeNull();
    expect(escolherRegra([regra({ servicos: ['010101'] })], nota)).toBeNull();
    expect(escolherRegra([regra({ ativa: false })], nota)).toBeNull();
    expect(escolherRegra([regra()], { ...nota, tomadorDocumento: '52998224725' })).toBeNull();
    expect(escolherRegra(null, nota)).toBeNull();
  });

  it('prefere a regra do serviço à regra geral', () => {
    const geral = regra({ id: 'geral' });
    const especifica = regra({ id: 'especifica', servicos: ['170101'] });
    expect(escolherRegra([geral, especifica], nota)?.id).toBe('especifica');
  });

  it('normaliza o que vem da tela', () => {
    const [r] = normalizarRegras([{ nome: '  ', tomador: 'x', valorMinimo: -5, servicos: ['17.01.01', 'abc'], percentuais: { irrf: 500, pis: 'x' }, aliquotaIss: '' }]);
    expect(r).toMatchObject({ nome: 'Regra 1', tomador: 'todos', valorMinimo: 0, servicos: ['170101'], aliquotaIss: null, ativa: true });
    expect(r.percentuais).toEqual({ irrf: 100, pis: 0, cofins: 0, csll: 0, cp: 0 });
    expect(normalizarRegras('nada')).toEqual([]);
  });
});

describe('separação da soma de uma nota emitida', () => {
  it('fecha sempre o total', () => {
    const d = dividirRetencaoAgrupada(37.2, '3');
    expect(d).toEqual({ pis: 5.2, cofins: 24, csll: 8 });
    const q = dividirRetencaoAgrupada(10.01, '3');
    expect(Math.round((q.pis + q.cofins + q.csll) * 100) / 100).toBe(10.01);
  });

  it('respeita a composição do código, e sem código considera só CSLL', () => {
    expect(dividirRetencaoAgrupada(10, '5')).toEqual({ pis: 10, cofins: 0, csll: 0 });
    expect(dividirRetencaoAgrupada(10, '8')).toEqual({ pis: 0, cofins: 0, csll: 10 });
    expect(dividirRetencaoAgrupada(10, null)).toEqual({ pis: 0, cofins: 0, csll: 10 });
    expect(dividirRetencaoAgrupada(0, '3')).toEqual({ pis: 0, cofins: 0, csll: 0 });
  });
});

describe('leitura de nota emitida', () => {
  const chave = '4'.repeat(50);
  const xml = `<NFSe xmlns="x"><infNFSe Id="NFS${chave}"><nNFSe>147</nNFSe><emit><CNPJ>${CNPJ}</CNPJ><xNome>Padaria</xNome></emit>`
    + `<valores><vBC>1000.00</vBC><pAliqAplic>3.00</pAliqAplic><vISSQN>30.00</vISSQN><vTotalRet>91.50</vTotalRet><vLiq>908.50</vLiq></valores>`
    + `<DPS><infDPS Id="DPS9"><tpAmb>1</tpAmb><dhEmi>2026-10-15T10:00:00-03:00</dhEmi><serie>900</serie><nDPS>5</nDPS><dCompet>2026-10-01</dCompet><prest><CNPJ>${CNPJ}</CNPJ><IM>55</IM></prest>`
    + `<toma><CNPJ>04252011000110</CNPJ><xNome>Cliente &amp; Cia</xNome><end><endNac><cMun>4305108</cMun><CEP>95000000</CEP></endNac><xLgr>Rua A</xLgr><nro>10</nro><xBairro>Centro</xBairro></end><email>a@b.com</email></toma>`
    + `<serv><locPrest><cLocPrestacao>4305108</cLocPrestacao></locPrest><cServ><cTribNac>170101</cTribNac><cTribMun>001</cTribMun><xDescServ>Consultoria 10/2026</xDescServ><cNBS>123456789</cNBS></cServ></serv>`
    + `<valores><vServPrest><vServ>1000.00</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>2</tpRetISSQN></tribMun><tribFed><piscofins><CST>00</CST><tpRetPisCofins>3</tpRetPisCofins></piscofins><vRetIRRF>15.00</vRetIRRF><vRetCSLL>46.50</vRetCSLL></tribFed></trib></valores></infDPS></DPS></infNFSe></NFSe>`;

  it('traz identificação, tomador, serviço e valores', () => {
    expect(lerNotaEmitida(xml, CNPJ)).toMatchObject({
      chaveAcesso: chave, ambiente: 'producao', numero: '147', serie: '900', nDps: '5', idDps: 'DPS9', dataEmissao: '2026-10-15', dataCompetencia: '2026-10',
      tomadorDocumento: '04252011000110', tomadorRazaoSocial: 'Cliente & Cia', tomadorCep: '95000000', tomadorCodigoMunicipio: '4305108', tomadorEndereco: 'Rua A', tomadorBairro: 'Centro',
      codigoServico: '170101', cTribMun: '001', cNbs: '123456789', municipioPrestacao: '4305108',
      valorServicos: 1000, valorBaseCalculo: 1000, aliquotaIss: 3, valorIss: 30, valorLiquido: 908.5, issRetido: true,
      valorIr: 15, valorPis: 6.5, valorCofins: 30, valorCsll: 10,
    });
  });

  it('ignora nota recebida como tomador', () => {
    expect(lerNotaEmitida(xml, '04252011000110')).toBeNull();
  });

  it('não trata a solicitação de análise fiscal como cancelamento', () => {
    expect(eventoCancelaNota('<evento><e101101><xDesc>Cancelamento de NFS-e</xDesc></e101101></evento>')).toBe(true);
    expect(eventoCancelaNota('<evento><e105102>x</e105102></evento>')).toBe(true);
    expect(eventoCancelaNota('<evento><e101103><xDesc>Solicitação de Análise Fiscal para Cancelamento de NFS-e</xDesc></e101103></evento>')).toBe(false);
  });

  it('soma as ocorrências ao mesclar serviços', () => {
    const s = (q: number, c = '170101') => ({ cTribNac: c, cTribMun: null, cNbs: null, descricao: 'x', quantidade: q });
    expect(mesclarServicos([s(2), s(1, '010101')], [s(3), s(9, '020101')]).map(x => [x.cTribNac, x.quantidade])).toEqual([['020101', 9], ['170101', 5], ['010101', 1]]);
  });
});

describe('leitura incremental da caixa', () => {
  it('continua do último NSU e separa os eventos', async () => {
    const b64 = (x: string) => gzipSync(Buffer.from(x)).toString('base64');
    const chamadas: string[] = [];
    const transporte: Transporte = async (_m, caminho) => {
      chamadas.push(caminho);
      if (caminho.includes('DFe/7?')) {
        return { status: 200, corpo: JSON.stringify({ TipoConsulta: 'Procuracao', LoteDFe: [
          { NSU: 8, TipoDocumento: 'NFSE', ArquivoXml: b64('<n/>') },
          { NSU: 9, TipoDocumento: 'EVENTO', ChaveAcesso: 'C1', ArquivoXml: b64('<e101101/>') },
        ] }) };
      }
      return { status: 404, corpo: JSON.stringify({ StatusProcessamento: 'NENHUM_DOCUMENTO_LOCALIZADO' }) };
    };
    const r = await lerCaixaDfe(transporte, CNPJ, async () => {}, 7);
    expect(chamadas[0]).toContain('DFe/7?');
    expect(r).toMatchObject({ xmls: ['<n/>'], eventos: [{ chave: 'C1', xml: '<e101101/>' }], ultimoNsu: 9, parcial: false });
  });
});

describe('tabela oficial de serviços', () => {
  it('traz códigos de 6 dígitos com zero à esquerda e NBS de 9 dígitos', () => {
    expect(tabela.servicos.find(s => s.c === '010101')?.d).toContain('desenvolvimento de sistemas');
    expect(tabela.servicos.every(s => /^\d{6}$/.test(s.c))).toBe(true);
    expect(Object.keys(tabela.nbs).every(c => /^\d{9}$/.test(c))).toBe(true);
    expect((tabela.correlacao as Record<string, string[]>)['0101']).toContain('115021000');
  });
});
