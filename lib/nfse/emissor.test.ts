import { describe, expect, it } from 'vitest';
import { gzipSync } from 'zlib';
import { emiteViaProcuracao, escolherSerie, extrairCnpjs, extrairDadosEmissor, mapearCnpjPublico } from './emissor';
import { lerCaixaDfe, type RespostaHttp, type Transporte } from './sefin';

const CNPJ = '11222333000181';
const OUTRO = '04252011000110';

function nota(opcoes: { prestador?: string; serie?: string; cTribNac?: string; cTribMun?: string; desc?: string; im?: string } = {}) {
  const prestador = opcoes.prestador ?? CNPJ;
  const im = opcoes.im ? `<IM>${opcoes.im}</IM>` : '';
  const mun = opcoes.cTribMun ? `<cTribMun>${opcoes.cTribMun}</cTribMun>` : '';
  return `<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS1"><emit><CNPJ>${prestador}</CNPJ><xNome>Padaria &amp; Cia</xNome><xFant>Padaria</xFant><enderNac><cMun>4305108</cMun></enderNac></emit>`
    + `<DPS><infDPS Id="DPS1"><serie>${opcoes.serie ?? '900'}</serie><cLocEmi>4305108</cLocEmi><prest><CNPJ>${prestador}</CNPJ>${im}<regTrib><opSimpNac>3</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib></regTrib></prest>`
    + `<serv><cServ><cTribNac>${opcoes.cTribNac ?? '170101'}</cTribNac>${mun}<xDescServ>${opcoes.desc ?? 'Consultoria'}</xDescServ><cNBS>123456789</cNBS></cServ></serv>`
    + `<valores><trib><tribFed><piscofins><CST>08</CST></piscofins></tribFed><totTrib><pTotTribSN>6.00</pTotTribSN></totTrib></trib></valores></infDPS></DPS></infNFSe></NFSe>`;
}

describe('emissão por procuração', () => {
  it('exige procuração ativa e uso do certificado do escritório', () => {
    expect(emiteViaProcuracao({ usarProcuracao: true, procuracaoStatus: 'ativa' })).toBe(true);
    expect(emiteViaProcuracao({ usarProcuracao: false, procuracaoStatus: 'ativa' })).toBe(false);
    expect(emiteViaProcuracao({ usarProcuracao: true, procuracaoStatus: 'sem_procuracao' })).toBe(false);
    expect(emiteViaProcuracao({ usarProcuracao: true, procuracaoStatus: 'indeterminada' })).toBe(false);
    expect(emiteViaProcuracao({ usarProcuracao: true, procuracaoStatus: null })).toBe(false);
    expect(emiteViaProcuracao(null)).toBe(false);
  });
});

describe('colagem de CNPJs', () => {
  it('aceita formatos variados, remove repetidos e aponta os inválidos', () => {
    const texto = `Empresa A 11.222.333/0001-81\nEmpresa B: 04252011000110; 11222333000181\n11.222.333/0001-82`;
    const r = extrairCnpjs(texto);
    expect(r.validos).toEqual([CNPJ, OUTRO]);
    expect(r.invalidos).toEqual(['11.222.333/0001-82']);
  });

  it('ignora textos sem documento', () => {
    expect(extrairCnpjs('sem nada aqui, só 123')).toEqual({ validos: [], invalidos: [] });
  });
});

describe('dados extraídos das notas', () => {
  it('usa a nota mais recente e agrupa os serviços por frequência', () => {
    const d = extrairDadosEmissor([
      nota({ cTribNac: '010101', desc: 'Sistemas', im: '555' }),
      nota({ cTribNac: '170101', cTribMun: '001', serie: '1' }),
      nota({ cTribNac: '170101', cTribMun: '001', serie: '1' }),
    ], CNPJ);
    expect(d).toMatchObject({
      notasEmitidas: 3, razaoSocial: 'Padaria & Cia', nomeFantasia: 'Padaria', codigoMunicipio: '4305108', inscricaoMunicipal: '555',
      opSimpNac: 3, regApTribSN: 1, regEspTrib: 0, piscofinsCst: '08', pTotTribSN: 6,
    });
    expect(d.seriesUsadas.sort()).toEqual(['1', '900']);
    expect(d.servicos.map(s => [s.cTribNac, s.quantidade])).toEqual([['170101', 2], ['010101', 1]]);
    expect(d.servicos[0]).toMatchObject({ cTribMun: '001', cNbs: '123456789' });
  });

  it('não confunde nota recebida como tomador com nota emitida', () => {
    const d = extrairDadosEmissor([nota({ prestador: OUTRO })], CNPJ);
    expect(d.notasEmitidas).toBe(0);
    expect(d.razaoSocial).toBeNull();
    expect(d.servicos).toEqual([]);
  });
});

describe('série dedicada', () => {
  it('escolhe a primeira livre a partir de 10, mesmo com zeros à esquerda', () => {
    expect(escolherSerie(['1', '900'])).toBe('10');
    expect(escolherSerie(['00010', '11'])).toBe('12');
  });
});

describe('cadastro público', () => {
  it('traduz o regime e o código IBGE', () => {
    expect(mapearCnpjPublico({ razao_social: 'X', codigo_municipio_ibge: 5300108, opcao_pelo_simples: true, opcao_pelo_mei: false })).toMatchObject({ razaoSocial: 'X', codigoMunicipio: '5300108', opSimpNac: 3 });
    expect(mapearCnpjPublico({ opcao_pelo_simples: true, opcao_pelo_mei: true }).opSimpNac).toBe(2);
    expect(mapearCnpjPublico({ opcao_pelo_simples: false, opcao_pelo_mei: false }).opSimpNac).toBe(1);
  });

  it('não inventa regime nem IBGE quando faltam', () => {
    expect(mapearCnpjPublico({ codigo_municipio_ibge: 123 })).toMatchObject({ codigoMunicipio: null, opSimpNac: null });
  });
});

describe('leitura da caixa de documentos', () => {
  const b64 = (xml: string) => gzipSync(Buffer.from(xml)).toString('base64');
  const semEspera = async () => {};

  function transportePorNsu(respostas: Record<string, RespostaHttp | RespostaHttp[]>) {
    const chamadas: string[] = [];
    const transporte: Transporte = async (_m, caminho) => {
      chamadas.push(caminho);
      const nsu = caminho.match(/DFe\/(\d+)/)![1];
      const r = respostas[nsu];
      if (!r) throw new Error(`NSU inesperado: ${nsu}`);
      return Array.isArray(r) ? r.shift()! : r;
    };
    return { transporte, chamadas };
  }
  const pagina = (docs: unknown[], extra = {}) => ({ status: 200, corpo: JSON.stringify({ StatusProcessamento: 'DOCUMENTOS_LOCALIZADOS', TipoConsulta: 'Procuracao', LoteDFe: docs, ...extra }) });
  const fim = { status: 404, corpo: JSON.stringify({ StatusProcessamento: 'NENHUM_DOCUMENTO_LOCALIZADO', TipoConsulta: 'Procuracao' }) };

  it('pagina pelo maior NSU, ignora eventos e entrega da mais recente para a mais antiga', async () => {
    const { transporte, chamadas } = transportePorNsu({
      0: pagina([
        { NSU: 1, TipoDocumento: 'NFSE', ArquivoXml: b64('<a/>') },
        { NSU: 2, TipoDocumento: 'EVENTO', ArquivoXml: b64('<evento/>') },
      ]),
      2: pagina([{ NSU: 3, TipoDocumento: 'NFSE', ArquivoXml: b64('<b/>') }]),
      3: fim,
    });
    const r = await lerCaixaDfe(transporte, CNPJ, semEspera);
    expect(r).toMatchObject({ status: 'ativa', mensagem: null, tipoConsulta: 'Procuracao', xmls: ['<b/>', '<a/>'], ultimoNsu: 3, parcial: false });
    expect(chamadas[0]).toBe(`contribuintes/DFe/0?cnpjConsulta=${CNPJ}&lote=true`);
  });

  it('reconhece a falta de procuração', async () => {
    const { transporte } = transportePorNsu({ 0: { status: 400, corpo: JSON.stringify({ StatusProcessamento: 'REJEICAO', TipoConsulta: 'InscricaoCertificado', Erros: [{ Codigo: 'E2245', Descricao: 'Não há procuração' }] }) } });
    await expect(lerCaixaDfe(transporte, CNPJ, semEspera)).resolves.toMatchObject({ status: 'sem_procuracao', mensagem: 'Não há procuração', xmls: [] });
  });

  it('considera ativa a empresa que nunca emitiu', async () => {
    const { transporte } = transportePorNsu({ 0: fim });
    await expect(lerCaixaDfe(transporte, CNPJ, semEspera)).resolves.toMatchObject({ status: 'ativa', tipoConsulta: 'Procuracao', xmls: [], parcial: false });
  });

  it('entende o erro E2230 como fim da caixa, não como leitura incompleta', async () => {
    const e2230 = { status: 400, corpo: JSON.stringify({ StatusProcessamento: 'REJEICAO', Erros: [{ Codigo: 'E2230', Descricao: 'Nenhum documento localizado' }] }) };
    const vazia = transportePorNsu({ 0: e2230 });
    await expect(lerCaixaDfe(vazia.transporte, CNPJ, semEspera)).resolves.toMatchObject({ status: 'ativa', xmls: [], parcial: false });
    const fimDaLeitura = transportePorNsu({ 0: pagina([{ NSU: 1, TipoDocumento: 'NFSE', ArquivoXml: b64('<a/>') }]), 1: e2230 });
    await expect(lerCaixaDfe(fimDaLeitura.transporte, CNPJ, semEspera)).resolves.toMatchObject({ status: 'ativa', xmls: ['<a/>'], parcial: false });
  });

  it('repete a mesma página no 429', async () => {
    const { transporte, chamadas } = transportePorNsu({ 0: [{ status: 429, corpo: '' }, fim] });
    await expect(lerCaixaDfe(transporte, CNPJ, semEspera)).resolves.toMatchObject({ status: 'ativa' });
    expect(chamadas).toHaveLength(2);
  });

  it('não conclui nada de falha logo na primeira página', async () => {
    const { transporte } = transportePorNsu({ 0: { status: 503, corpo: '<html>' } });
    await expect(lerCaixaDfe(transporte, CNPJ, semEspera)).resolves.toMatchObject({ status: 'indeterminada', xmls: [] });
  });

  it('aproveita o que já leu se uma página seguinte falhar, marcando como parcial', async () => {
    const { transporte } = transportePorNsu({
      0: pagina([{ NSU: 1, TipoDocumento: 'NFSE', ArquivoXml: b64('<a/>') }]),
      1: { status: 503, corpo: '' },
    });
    await expect(lerCaixaDfe(transporte, CNPJ, semEspera)).resolves.toMatchObject({ status: 'ativa', xmls: ['<a/>'], parcial: true });
  });
});
