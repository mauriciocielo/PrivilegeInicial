import { describe, expect, it } from 'vitest';
import tabela from './dados/tabela-servicos.json';
import { SERVICOS_POR_CNAE, formatarCnae, servicosDoCnae, sugerirServicos } from './cnae-servicos';
import { mapearCnpjPublico } from './emissor';

describe('mapeamento CNAE para serviço', () => {
  const oficiais = new Set(tabela.servicos.map(s => s.c));

  it('só usa códigos que existem na lista oficial', () => {
    const invalidos = Object.entries(SERVICOS_POR_CNAE).flatMap(([cnae, codigos]) => codigos.filter(c => !oficiais.has(c)).map(c => `${cnae}: ${c}`));
    expect(invalidos).toEqual([]);
  });

  it('as chaves são só dígitos, sem CNAE repetido e sem código repetido na mesma linha', () => {
    for (const [cnae, codigos] of Object.entries(SERVICOS_POR_CNAE)) {
      expect(cnae).toMatch(/^\d{2,7}$/);
      expect(new Set(codigos).size).toBe(codigos.length);
    }
  });

  it.each([
    ['6920601', '171901', 'contabilidade'],
    ['6911701', '171401', 'advocacia'],
    ['6201501', '010101', 'desenvolvimento de software'],
    ['7020400', '170101', 'consultoria em gestão'],
    ['8630504', '041201', 'odontologia'],
    ['9602501', '060101', 'cabeleireiro'],
    ['4120400', '070202', 'construção de edifícios'],
  ])('%s sugere %s primeiro (%s)', (cnae, servico) => {
    expect(servicosDoCnae(cnae)[0]).toBe(servico);
  });

  it('a chave mais específica vence a mais curta', () => {
    expect(servicosDoCnae('4311802')).toEqual(['070401']);
    expect(servicosDoCnae('4399101')[0]).toBe('070201');
    expect(servicosDoCnae('4399199')[0]).toBe('070202');
  });

  it('comércio e banco ficam sem sugestão, em vez de um palpite', () => {
    expect(servicosDoCnae('4711301')).toEqual([]);
    expect(servicosDoCnae('6422100')).toEqual([]);
  });

  it('aceita o código formatado', () => {
    expect(servicosDoCnae('6920-6/01')).toEqual(['171901']);
    expect(formatarCnae('6920601')).toBe('6920-6/01');
  });
});

describe('sugestões da empresa', () => {
  const cnae = (codigo: string, principal = false) => ({ codigo, descricao: codigo, principal });

  it('o principal vem primeiro, mesmo fora de ordem', () => {
    expect(sugerirServicos([cnae('6911701'), cnae('6920601', true)]).map(s => s.codigo)).toEqual(['6920601', '6911701']);
  });

  it('não repete nos secundários um código já sugerido', () => {
    const [principal, secundario] = sugerirServicos([cnae('6201501', true), cnae('6202300')]);
    expect(principal.servicos).toContain('010101');
    expect(secundario.servicos).toEqual(['010501']);
  });
});

describe('CNAEs vindos do cadastro público', () => {
  it('lê o formato da BrasilAPI e da Minha Receita e ignora o secundário vazio', () => {
    expect(mapearCnpjPublico({
      cnae_fiscal: 6920601, cnae_fiscal_descricao: 'Contabilidade',
      cnaes_secundarios: [{ codigo: 6911701, descricao: 'Advocacia' }, { codigo: 0, descricao: '' }],
    }).cnaes).toEqual([
      { codigo: '6920601', descricao: 'Contabilidade', principal: true },
      { codigo: '6911701', descricao: 'Advocacia', principal: false },
    ]);
  });

  it('lê o formato do cnpj.ws', () => {
    expect(mapearCnpjPublico({
      estabelecimento: {
        atividade_principal: { id: '6422100', descricao: 'Bancos' },
        atividades_secundarias: [{ id: '6499999', descricao: 'Outras' }],
      },
    }).cnaes).toEqual([
      { codigo: '6422100', descricao: 'Bancos', principal: true },
      { codigo: '6499999', descricao: 'Outras', principal: false },
    ]);
  });

  it('completa o zero à esquerda que o número perde', () => {
    expect(mapearCnpjPublico({ cnae_fiscal: 161003, cnae_fiscal_descricao: 'Apoio' }).cnaes[0].codigo).toBe('0161003');
  });

  it('sem CNAE, devolve lista vazia', () => {
    expect(mapearCnpjPublico({ razao_social: 'X' }).cnaes).toEqual([]);
  });
});
