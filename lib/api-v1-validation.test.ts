import { describe, it, expect } from 'vitest';
import {
  validarCpfCnpj, validarValorMonetario, validarDataIso, validarVencimento,
  calcularValorLiquido, calcularStatus, validarPayloadSacado, validarPayloadContaFinanceira,
} from './api-v1-validation';

describe('validarCpfCnpj', () => {
  it('aceita um CNPJ válido (Petrobras, dígitos verificadores reais)', () => {
    expect(validarCpfCnpj('33.000.167/0001-01')).toBe(true);
  });
  it('aceita um CPF válido conhecido', () => {
    expect(validarCpfCnpj('529.982.247-25')).toBe(true);
  });
  it('rejeita sequência repetida com tamanho certo', () => {
    expect(validarCpfCnpj('111.111.111-11')).toBe(false);
    expect(validarCpfCnpj('11.111.111/1111-11')).toBe(false);
  });
  it('rejeita dígito verificador errado', () => {
    expect(validarCpfCnpj('529.982.247-26')).toBe(false);
  });
  it('rejeita tamanho que não é nem CPF nem CNPJ', () => {
    expect(validarCpfCnpj('123')).toBe(false);
  });
});

describe('validarValorMonetario', () => {
  it('aceita um valor com 2 casas decimais', () => {
    const r = validarValorMonetario(1234.56);
    expect(r.valido).toBe(true);
  });
  it('rejeita mais de 2 casas decimais', () => {
    const r = validarValorMonetario(10.999);
    expect(r.valido).toBe(false);
  });
  it('rejeita string mesmo que pareça um número', () => {
    const r = validarValorMonetario('1000');
    expect(r.valido).toBe(false);
  });
  it('rejeita NaN e Infinity', () => {
    expect(validarValorMonetario(NaN).valido).toBe(false);
    expect(validarValorMonetario(Infinity).valido).toBe(false);
  });
  it('rejeita negativo por padrão, mas aceita quando explicitamente permitido', () => {
    expect(validarValorMonetario(-10).valido).toBe(false);
    expect(validarValorMonetario(-10, { permitirNegativo: true }).valido).toBe(true);
  });
  it('rejeita zero por padrão, mas aceita quando explicitamente permitido', () => {
    expect(validarValorMonetario(0).valido).toBe(false);
    expect(validarValorMonetario(0, { permitirZero: true }).valido).toBe(true);
  });
});

describe('validarDataIso', () => {
  it('aceita YYYY-MM-DD válido', () => expect(validarDataIso('2026-09-10')).toBe(true));
  it('rejeita data sem zero à esquerda', () => expect(validarDataIso('2026-9-10')).toBe(false));
  it('rejeita dia inexistente (31 de fevereiro)', () => expect(validarDataIso('2026-02-31')).toBe(false));
  it('rejeita data com hora embutida', () => expect(validarDataIso('2026-09-10T00:00:00Z')).toBe(false));
});

describe('validarVencimento', () => {
  const hoje = new Date('2026-09-10T12:00:00Z');
  it('rejeita vencimento no passado sem a flag', () => {
    const r = validarVencimento('2026-09-01', { hoje });
    expect(r.valido).toBe(false);
  });
  it('aceita vencimento no passado com permitirRetroativo', () => {
    const r = validarVencimento('2026-09-01', { hoje, permitirRetroativo: true });
    expect(r.valido).toBe(true);
  });
  it('aceita vencimento hoje ou futuro sem flag', () => {
    expect(validarVencimento('2026-09-10', { hoje }).valido).toBe(true);
    expect(validarVencimento('2026-12-25', { hoje }).valido).toBe(true);
  });
});

describe('calcularValorLiquido', () => {
  it('soma acréscimos e subtrai descontos', () => {
    expect(calcularValorLiquido(1000, 50, 30)).toBe(1020);
  });
  it('arredonda erros de ponto flutuante', () => {
    expect(calcularValorLiquido(10.1, 0.2, 0)).toBeCloseTo(10.3, 2);
  });
});

describe('calcularStatus', () => {
  it('aberto quando nada foi baixado', () => {
    expect(calcularStatus({ valorLiquido: 100, totalBaixado: 0 })).toBe('aberto');
  });
  it('parcial quando baixou menos que o total', () => {
    expect(calcularStatus({ valorLiquido: 100, totalBaixado: 40 })).toBe('parcial');
  });
  it('liquidado quando baixou o total (com tolerância de centavo)', () => {
    expect(calcularStatus({ valorLiquido: 100, totalBaixado: 100 })).toBe('liquidado');
    expect(calcularStatus({ valorLiquido: 100, totalBaixado: 99.999 })).toBe('liquidado');
  });
});

describe('validarPayloadSacado', () => {
  it('aceita um payload completo e válido', () => {
    expect(validarPayloadSacado({ nome: 'Cliente X', cpfCnpj: '33.000.167/0001-01', email: 'a@b.com' })).toEqual([]);
  });
  it('acumula todos os erros do payload, não só o primeiro', () => {
    const erros = validarPayloadSacado({ nome: '', cpfCnpj: '123' });
    expect(erros.map(e => e.campo).sort()).toEqual(['cpfCnpj', 'nome']);
  });
});

describe('validarPayloadContaFinanceira', () => {
  const base = {
    sacadoId: 'abc', dataEmissao: '2026-09-01', dataVencimento: '2026-12-01',
    valorOriginal: 1000, acrescimos: 10, descontos: 5,
  };
  it('aceita um payload válido e calcula o valor líquido', () => {
    const r = validarPayloadContaFinanceira(base);
    expect(r.erros).toEqual([]);
    expect(r.valorLiquido).toBe(1005);
  });
  it('rejeita payload sem sacado/fornecedor', () => {
    const { sacadoId, ...resto } = base;
    const r = validarPayloadContaFinanceira(resto);
    expect(r.erros.some(e => e.campo === 'sacadoId')).toBe(true);
  });
  it('aceita formaPagamentoPrevista opcional', () => {
    const r = validarPayloadContaFinanceira({ ...base, formaPagamentoPrevista: 'PIX' });
    expect(r.erros).toEqual([]);
  });
  it('rejeita formaPagamentoPrevista maior que 60 caracteres', () => {
    const r = validarPayloadContaFinanceira({ ...base, formaPagamentoPrevista: 'x'.repeat(61) });
    expect(r.erros.some(e => e.campo === 'formaPagamentoPrevista')).toBe(true);
  });
});
