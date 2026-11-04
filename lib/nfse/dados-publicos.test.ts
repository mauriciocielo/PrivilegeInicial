import { describe, expect, it } from 'vitest';
import { mapearCep, mapearCnpjPublico } from './emissor';

describe('endereço pelo CNPJ', () => {
  it('lê o formato da BrasilAPI e junta o tipo com o nome da via', () => {
    expect(mapearCnpjPublico({
      razao_social: 'ACME LTDA', codigo_municipio_ibge: 4106902, municipio: 'CURITIBA', uf: 'PR', cep: '80010-000',
      descricao_tipo_de_logradouro: 'RUA', logradouro: 'XV DE NOVEMBRO', numero: '100', bairro: 'CENTRO', email: 'Contato@Acme.com',
    })).toMatchObject({
      codigoMunicipio: '4106902', cep: '80010000', logradouro: 'RUA XV DE NOVEMBRO', numero: '100', bairro: 'CENTRO', email: 'contato@acme.com',
    });
  });

  it('lê o formato aninhado do cnpj.ws', () => {
    expect(mapearCnpjPublico({
      razao_social: 'ACME',
      estabelecimento: {
        tipo_logradouro: 'AVENIDA', logradouro: 'PAULISTA', numero: '1', bairro: 'BELA VISTA', cep: '01311000', email: 'a@b.com',
        cidade: { ibge_id: 3550308, nome: 'São Paulo' }, estado: { sigla: 'SP' },
      },
    })).toMatchObject({ logradouro: 'AVENIDA PAULISTA', codigoMunicipio: '3550308', cidade: 'São Paulo', uf: 'SP', cep: '01311000' });
  });

  it('não repete o tipo quando o nome da via já o traz', () => {
    expect(mapearCnpjPublico({ descricao_tipo_de_logradouro: 'RUA', logradouro: 'RUA DAS FLORES' }).logradouro).toBe('RUA DAS FLORES');
  });

  it('deixa vazio o que o provedor não informou, em vez de inventar', () => {
    expect(mapearCnpjPublico({ razao_social: 'X', cep: '123' })).toMatchObject({ logradouro: null, numero: null, bairro: null, email: null, cep: null });
  });
});

describe('endereço pelo CEP', () => {
  it('traz o endereço com o código do município', () => {
    expect(mapearCep({ logradouro: 'Rua A', bairro: 'Centro', localidade: 'Curitiba', uf: 'PR', ibge: '4106902' }))
      .toEqual({ logradouro: 'Rua A', bairro: 'Centro', cidade: 'Curitiba', uf: 'PR', codigoMunicipio: '4106902' });
  });

  it('CEP inexistente devolve nulo', () => {
    expect(mapearCep({ erro: true })).toBeNull();
  });
});
