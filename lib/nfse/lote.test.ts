import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { NfsE } from '../store';
import {
  copiarParaCompetencia, estimarValoresNota, existeNotaIgual, interpretarLinhas, lerCompetencia, lerData,
  lerPlanilha, lerValor, mesAnterior,
} from './lote';

const AGORA = new Date('2026-11-03T15:00:00Z');
const padroes = { competencia: '2026-11', cTribNac: '170101', cTribMun: '001', municipioPrestacao: '4305108' };

const linhaBase = {
  tomador_documento: '52998224725',
  tomador_nome: 'Maria',
  valor: '1.500,50',
  descricao: 'Consultoria',
};

const notaOriginal = {
  id: 'orig', empresaId: 'e', numero: '147', serie: '10', status: 'emitida',
  chaveAcesso: '4'.repeat(50), nDps: '5', idDps: 'DPS5', ambiente: 'producao', lancamentoId: 'lanc', ultimoErro: 'x',
  prestadorCnpj: '1', prestadorRazaoSocial: 'P', clienteId: 'c1',
  tomadorCnpjCpf: '529.982.247-25', tomadorRazaoSocial: 'Maria', tomadorCep: '95000000',
  dataEmissao: '2026-10-15', dataCompetencia: '2026-10', codigoServico: '170101', cTribMun: '001', cNbs: '123456789',
  discriminacao: 'Mensalidade referente a 10/2026', municipioPrestacao: '4305108',
  valorServicos: 1000, valorDeducoes: 0, valorPis: 0, valorCofins: 0, valorInss: 0, valorIr: 0, valorCsll: 0,
  issRetido: true, valorIss: 30, aliquotaIss: 3, valorBaseCalculo: 1000, valorLiquido: 970, createdAt: '2026-10-15',
} as NfsE;

describe('competência', () => {
  it('volta um mês, inclusive na virada do ano', () => {
    expect(mesAnterior('2026-11')).toBe('2026-10');
    expect(mesAnterior('2026-01')).toBe('2025-12');
  });

  it('aceita os formatos comuns e recusa mês inexistente', () => {
    expect(lerCompetencia('10/2026')).toBe('2026-10');
    expect(lerCompetencia('2026-10')).toBe('2026-10');
    expect(lerCompetencia('15/10/2026')).toBe('2026-10');
    expect(lerCompetencia('13/2026')).toBeNull();
    expect(lerCompetencia('outubro')).toBeNull();
  });
});

describe('cópia de nota', () => {
  it('não leva nada que identifique a nota original no Sefin', () => {
    const copia = copiarParaCompetencia(notaOriginal, '2026-11', true);
    for (const campo of ['id', 'numero', 'chaveAcesso', 'nDps', 'idDps', 'lancamentoId', 'ultimoErro', 'status', 'ambiente']) {
      expect(copia).not.toHaveProperty(campo);
    }
    expect(copia).toMatchObject({ dataCompetencia: '2026-11', clienteId: 'c1', cNbs: '123456789', issRetido: true, aliquotaIss: 3, valorServicos: 1000 });
  });

  it('atualiza o mês citado na descrição só quando pedido', () => {
    expect(copiarParaCompetencia(notaOriginal, '2026-11', true).discriminacao).toBe('Mensalidade referente a 11/2026');
    expect(copiarParaCompetencia(notaOriginal, '2026-11', false).discriminacao).toBe('Mensalidade referente a 10/2026');
  });
});

describe('nota igual', () => {
  const alvo = { tomadorCnpjCpf: '52998224725', valorServicos: 1000, dataCompetencia: '2026-10' };

  it('encontra nota viva com o mesmo tomador, valor e competência', () => {
    expect(existeNotaIgual([notaOriginal], alvo)).toBe(true);
    expect(existeNotaIgual([notaOriginal], { ...alvo, dataCompetencia: '2026-11' })).toBe(false);
    expect(existeNotaIgual([notaOriginal], { ...alvo, valorServicos: 999 })).toBe(false);
  });

  it('ignora canceladas e simuladas', () => {
    expect(existeNotaIgual([{ ...notaOriginal, status: 'cancelada' }], alvo)).toBe(false);
    expect(existeNotaIgual([{ ...notaOriginal, chaveAcesso: null }], alvo)).toBe(false);
    expect(existeNotaIgual([{ ...notaOriginal, status: 'rascunho', chaveAcesso: null }], alvo)).toBe(true);
  });
});

describe('estimativa de valores', () => {
  it('só desconta o ISS do líquido quando retido', () => {
    expect(estimarValoresNota(1000, 3, true)).toEqual({ valorIss: 30, valorLiquido: 970 });
    expect(estimarValoresNota(1000, 3, false)).toEqual({ valorIss: 30, valorLiquido: 1000 });
  });
});

describe('leitura de células', () => {
  it('interpreta valores em formato brasileiro', () => {
    expect(lerValor('1.500,50')).toBe(1500.5);
    expect(lerValor('R$ 1.500')).toBe(1500);
    expect(lerValor(1500.5)).toBe(1500.5);
    expect(lerValor('abc')).toBeNull();
  });

  it('interpreta datas em texto e células de data sem cair no dia anterior', () => {
    expect(lerData('31/12/2026')).toBe('2026-12-31');
    expect(lerData('2026-12-31')).toBe('2026-12-31');
    expect(lerData('amanhã')).toBeNull();
    expect(lerData(new Date(2026, 11, 30, 23, 59, 50))).toBe('2026-12-31');
  });
});

describe('importação de linhas', () => {
  it('usa os padrões da empresa nas colunas ausentes', () => {
    const [l] = interpretarLinhas([linhaBase], padroes, [], AGORA);
    expect(l.erros).toEqual([]);
    expect(l.linha).toBe(2);
    expect(l.dados).toMatchObject({ valorServicos: 1500.5, dataCompetencia: '2026-11', codigoServico: '170101', cTribMun: '001', municipioPrestacao: '4305108', tomadorCnpjCpf: '529.982.247-25' });
  });

  it('reconhece cabeçalhos em português, com acentos e maiúsculas', () => {
    const [l] = interpretarLinhas([{ 'CPF/CNPJ': '52998224725', 'Razão Social': 'Maria', 'Valor do Serviço': 100, 'Discriminação': 'X', 'Competência': '10/2026' }], padroes, [], AGORA);
    expect(l.erros).toEqual([]);
    expect(l.dados).toMatchObject({ tomadorRazaoSocial: 'Maria', valorServicos: 100, discriminacao: 'X', dataCompetencia: '2026-10' });
  });

  it('recupera zeros à esquerda apagados pelo Excel', () => {
    // CNPJ 04.252.011/0001-10 e código 010101 gravados como número
    const [l] = interpretarLinhas([{ ...linhaBase, tomador_documento: 4252011000110, codigo_tributacao_nacional: 10101 }], padroes, [], AGORA);
    expect(l.erros).toEqual([]);
    expect(l.dados).toMatchObject({ tomadorCnpjCpf: '04.252.011/0001-10', codigoServico: '010101' });
  });

  it('completa os dados pelo cadastro quando o documento é de um cliente', () => {
    const clientes = [{ id: 'c1', nome: 'Maria Cadastrada', cpfCnpj: '529.982.247-25', email: 'm@x.com' }];
    const [l] = interpretarLinhas([{ ...linhaBase, tomador_nome: '' }], padroes, clientes, AGORA);
    expect(l.erros).toEqual([]);
    expect(l.dados).toMatchObject({ clienteId: 'c1', tomadorRazaoSocial: 'Maria Cadastrada', tomadorEmail: 'm@x.com' });
  });

  it('aponta os problemas de cada linha e ignora linhas vazias', () => {
    const r = interpretarLinhas([
      { ...linhaBase, tomador_documento: '123', valor: '0', descricao: '', competencia: '12/2026' },
      { tomador_documento: '', tomador_nome: '', valor: '', descricao: '' },
    ], { competencia: '2026-11' }, [], AGORA);
    expect(r).toHaveLength(1);
    const erros = r[0].erros.join(' | ');
    for (const trecho of ['CPF/CNPJ', 'valor', 'descrição', 'competência futura', 'tributação nacional', 'município']) {
      expect(erros).toContain(trecho);
    }
  });

  it('lê ISS retido em várias formas', () => {
    const [sim, nao] = interpretarLinhas([{ ...linhaBase, iss_retido: 'Sim' }, { ...linhaBase, iss_retido: 'não' }], padroes, [], AGORA);
    expect(sim.dados.issRetido).toBe(true);
    expect(nao.dados.issRetido).toBe(false);
  });
});

describe('leitura de arquivos', () => {
  const buffer = (t: Uint8Array) => t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength) as ArrayBuffer;

  it('lê CSV com ponto e vírgula, mantendo zeros, acentos e o mês como texto', async () => {
    const csv = 'CPF/CNPJ;Razão Social;Valor;Descrição;Competência\n04252011000110;João Ação;1.500,50;Serviço;10/2026\n';
    const linhas = await lerPlanilha(buffer(new TextEncoder().encode(csv)), 'notas.csv');
    expect(linhas[0]).toMatchObject({ 'CPF/CNPJ': '04252011000110', 'Razão Social': 'João Ação', Valor: '1.500,50', 'Competência': '10/2026' });
    const [l] = interpretarLinhas(linhas, padroes, [], AGORA);
    expect(l.erros).toEqual([]);
    expect(l.dados).toMatchObject({ valorServicos: 1500.5, dataCompetencia: '2026-10' });
  });

  it('lê CSV salvo em Windows-1252', async () => {
    const bytes = Uint8Array.from([...Buffer.from('Nome;Descri', 'latin1'), 0xe7, 0xe3, ...Buffer.from('o\nJo', 'latin1'), 0xe3, ...Buffer.from('o;A', 'latin1'), 0xe7, 0xe3, ...Buffer.from('o\n', 'latin1')]);
    const linhas = await lerPlanilha(buffer(bytes), 'notas.csv');
    expect(linhas[0]).toMatchObject({ Nome: 'João', 'Descrição': 'Ação' });
  });

  it('lê XLSX com célula de data e valor numérico', async () => {
    const aba = XLSX.utils.aoa_to_sheet([
      ['tomador_documento', 'tomador_nome', 'valor', 'descricao', 'competencia', 'vencimento'],
      ['52998224725', 'Maria', 1500.5, 'Serviço', new Date(2026, 9, 1), new Date(2026, 11, 31)],
    ]);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, aba, 'Notas');
    const bytes = XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const [l] = interpretarLinhas(await lerPlanilha(bytes, 'notas.xlsx'), padroes, [], AGORA);
    expect(l.erros).toEqual([]);
    expect(l.dados).toMatchObject({ valorServicos: 1500.5, dataCompetencia: '2026-10', vencimento: '2026-12-31' });
  });
});
