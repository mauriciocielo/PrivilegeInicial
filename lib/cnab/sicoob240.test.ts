import { describe, expect, it } from 'vitest';
import { gerarRemessaSicoob240, modulo11Sicoob, RemessaSicoobInvalidaError, type BeneficiarioSicoob, type PagamentoCnab } from './sicoob240';

const benef: BeneficiarioSicoob = {
  empresaMae: 'Empresa Exemplo Ltda',
  documentoCedente: '11.222.333/0001-81',
  agencia: '4321',
  digitoConta: '7',
  conta: '123456',
  modalidadeCarteira: '01',
  sequencialRemessa: 1,
};

const pagamento = (over: Partial<PagamentoCnab> = {}): PagamentoCnab => ({
  nossoNumero: 1001,
  numeroDocumento: 555,
  valor: 1234.56,
  dataVencimento: '2026-12-20',
  dataEmissao: '2026-11-09',
  sacado: {
    documento: '123.456.789-09',
    nome: 'João da Silva Comércio',
    endereco: 'Rua das Flores, 100',
    bairro: 'Centro',
    cep: '85600-000',
    cidade: 'Francisco Beltrão',
    uf: 'PR',
  },
  ...over,
});

const agora = new Date('2026-11-09T08:30:15');

describe('Remessa CNAB 240 Sicoob', () => {
  const arquivo = gerarRemessaSicoob240(benef, [pagamento()], agora);
  const linhas = arquivo.replace(/\r\n$/, '').split('\r\n');

  it('tem a estrutura certa: header arq, header lote, P/Q/R, trailer lote, trailer arq', () => {
    expect(linhas).toHaveLength(7); // ha(1)+hl(1)+P/Q/R(3)+tl(1)+ta(1)=7
  });

  it('todas as linhas têm exatamente 240 caracteres', () => {
    const arq2 = gerarRemessaSicoob240(benef, [pagamento(), pagamento({ nossoNumero: 1002, valor: 99.9 })], agora);
    for (const l of arq2.replace(/\r\n$/, '').split('\r\n')) {
      expect(l.length).toBe(240);
    }
  });

  it('header de arquivo: banco 756, versão 081, termina em CRLF', () => {
    const ha = linhas[0];
    expect(ha.slice(0, 3)).toBe('756');
    expect(ha.slice(163, 166)).toBe('081'); // posições 164-166
    expect(ha.slice(72, 92).trimEnd()).toBe('EMPRESA EXEMPLO LTDA'); // razão social 73-102
    expect(arquivo.endsWith('\r\n')).toBe(true);
  });

  it('segmento P: marcador P, nosso número e valor nas posições certas', () => {
    const p = linhas.find(l => l[13] === 'P')!;
    expect(p.slice(0, 3)).toBe('756');
    expect(p[7]).toBe('3');                       // tipo de registro
    expect(p.slice(37, 47)).toBe('0000001001');   // nosso número (38-47)
    expect(p.slice(47, 49)).toBe('01');           // parcela
    expect(p.slice(49, 51)).toBe('01');           // modalidade carteira
    expect(p.slice(85, 100)).toBe('000000000123456'); // valor 1234,56 em centavos (86-100)
    expect(p.slice(77, 85)).toBe('20122026');     // vencimento ddmmaaaa (78-85)
  });

  it('segmento Q: sacado com documento, nome e CEP', () => {
    const q = linhas.find(l => l[13] === 'Q')!;
    expect(q[17]).toBe('1'); // CPF
    expect(q.slice(18, 33)).toBe('000012345678909'); // doc sacado 19-33
    expect(q.slice(33, 73).trimEnd()).toBe('JOAO DA SILVA COMERCIO');
    expect(q.slice(128, 133)).toBe('85600'); // CEP parte 1 (129-133)
  });

  it('trailer de arquivo: 756 99999 e total de linhas', () => {
    const ta = linhas[linhas.length - 1];
    expect(ta.slice(0, 8)).toBe('75699999');
    expect(ta.slice(17, 23)).toBe('000001');           // qtd de lotes
    expect(ta.slice(23, 29)).toBe('000007');           // total de linhas (7)
  });

  it('trailer de lote: quantidade e soma dos títulos', () => {
    const tl = linhas.find(l => l[7] === '5')!;
    expect(tl.slice(23, 29)).toBe('000001');           // qtd de títulos
    expect(tl.slice(29, 46)).toBe('00000000000123456'); // soma em centavos (17)
  });

  it('recusa remessa sem dados obrigatórios', () => {
    expect(() => gerarRemessaSicoob240({ ...benef, empresaMae: '' }, [pagamento()], agora)).toThrow(RemessaSicoobInvalidaError);
    expect(() => gerarRemessaSicoob240(benef, [], agora)).toThrow(RemessaSicoobInvalidaError);
    expect(() => gerarRemessaSicoob240(benef, [pagamento({ valor: 0 })], agora)).toThrow(RemessaSicoobInvalidaError);
  });

  it('módulo 11 devolve um dígito', () => {
    expect(modulo11Sicoob('123456')).toMatch(/^\d$/);
  });
});
