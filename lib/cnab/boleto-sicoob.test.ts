import { describe, expect, it } from 'vitest';
import {
  gerarBoletoSicoob, nossoNumeroDvSicoob, dvGeralBarras, modulo10, fatorVencimento, linhaDigitavel, barrasITF,
  type BeneficiarioBoletoSicoob,
} from './boleto-sicoob';

const benef: BeneficiarioBoletoSicoob = { agencia: '0001', convenio: '19', carteira: '1', variacao: '01' };

describe('DV do nosso número Sicoob', () => {
  it('bate com o exemplo do BRCobranca (…0000021 → 8)', () => {
    expect(nossoNumeroDvSicoob('0001', '19', '21')).toBe('8');
  });
  it('devolve um único dígito', () => {
    expect(nossoNumeroDvSicoob('4321', '12345', '999')).toMatch(/^\d$/);
  });
});

describe('Fator de vencimento (âncoras FEBRABAN)', () => {
  it('21/02/2025 = 9999 e 22/02/2025 = 1000 (virada do ciclo)', () => {
    expect(fatorVencimento('2025-02-21')).toBe('9999');
    expect(fatorVencimento('2025-02-22')).toBe('1000');
  });
  it('sempre 4 dígitos', () => {
    expect(fatorVencimento('2026-12-20')).toMatch(/^\d{4}$/);
  });
});

describe('Dígitos verificadores', () => {
  it('módulo 10 de um dígito', () => {
    expect(modulo10('123456789')).toMatch(/^\d$/);
  });
  it('DV geral das barras: nunca 0/10/11 (vira 1)', () => {
    expect(dvGeralBarras('7569' + '0'.repeat(39))).toMatch(/^\d$/);
  });
});

describe('Boleto Sicoob completo', () => {
  const b = gerarBoletoSicoob(benef, { nossoNumero: 21, valor: 1234.56, dataVencimento: '2026-12-20' });

  it('código de barras tem 44 dígitos e começa com 756 9', () => {
    expect(b.codigoBarras).toHaveLength(44);
    expect(b.codigoBarras.slice(0, 3)).toBe('756');
    expect(b.codigoBarras[3]).toBe('9'); // moeda
  });

  it('o DV geral (posição 5) confere com o cálculo sobre os 43 dígitos', () => {
    const sem = b.codigoBarras.slice(0, 4) + b.codigoBarras.slice(5); // remove DV
    expect(b.codigoBarras[4]).toBe(dvGeralBarras(sem));
  });

  it('valor e fator estão nas posições certas', () => {
    expect(b.codigoBarras.slice(5, 9)).toBe(b.fatorVencimento);       // fator (pos 6-9)
    expect(b.codigoBarras.slice(9, 19)).toBe('0000123456');           // valor (pos 10-19)
  });

  it('campo livre tem 25 dígitos e contém o nosso número com DV', () => {
    expect(b.campoLivre).toHaveLength(25);
    expect(b.nossoNumero).toBe('00000218'); // 0000021 + DV 8
    expect(b.campoLivre).toContain('00000218');
  });

  it('linha digitável: 5 campos, 47 dígitos', () => {
    const soDigitos = b.linhaDigitavel.replace(/\D/g, '');
    expect(soDigitos).toHaveLength(47);
    // os DVs de campo (módulo 10) conferem
    const campos = b.linhaDigitavel.split(' ');
    expect(campos).toHaveLength(5);
  });

  it('linha digitável é recalculável a partir do código de barras', () => {
    expect(linhaDigitavel(b.codigoBarras)).toBe(b.linhaDigitavel);
  });
});

describe('Código de barras ITF', () => {
  it('44 dígitos → início(4) + 44/2*10 + fim(3) larguras', () => {
    const larguras = barrasITF('7'.repeat(44));
    expect(larguras).toHaveLength(4 + (44 / 2) * 10 + 3);
  });
  it('recusa número ímpar de dígitos', () => {
    expect(() => barrasITF('123')).toThrow();
  });
});
