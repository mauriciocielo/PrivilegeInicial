import { describe, it, expect } from 'vitest';
import { parseRowsToItens, classificarAbc } from './curva-abc-parser';

describe('curva-abc-parser', () => {
  describe('parseRowsToItens', () => {
    it('reconhece cabeçalho e extrai nome/valor nas colunas certas', () => {
      const rows = [
        ['Cliente', 'Valor Faturado'],
        ['Empresa Alfa', 1000],
        ['Empresa Beta', '2.500,50'],
      ];
      const itens = parseRowsToItens(rows);
      expect(itens).toEqual([
        { nome: 'Empresa Alfa', valorFaturado: 1000 },
        { nome: 'Empresa Beta', valorFaturado: 2500.5 },
      ]);
    });

    it('funciona sem cabeçalho reconhecido, varrendo a linha', () => {
      const rows = [
        ['Empresa Gama', 'R$ 750,00'],
      ];
      const itens = parseRowsToItens(rows);
      expect(itens).toEqual([{ nome: 'Empresa Gama', valorFaturado: 750 }]);
    });

    it('ignora linhas em branco', () => {
      const rows = [
        ['Nome', 'Valor'],
        ['', '', ''],
        ['Empresa Delta', 100],
      ];
      const itens = parseRowsToItens(rows);
      expect(itens).toEqual([{ nome: 'Empresa Delta', valorFaturado: 100 }]);
    });

    it('descarta linhas sem valor positivo identificável', () => {
      const rows = [
        ['Nome', 'Valor'],
        ['Empresa Sem Valor', 0],
        ['Empresa Válida', 50],
      ];
      const itens = parseRowsToItens(rows);
      expect(itens).toEqual([{ nome: 'Empresa Válida', valorFaturado: 50 }]);
    });

    it('retorna lista vazia para entrada vazia', () => {
      expect(parseRowsToItens([])).toEqual([]);
    });
  });

  describe('classificarAbc', () => {
    it('ordena por valor decrescente e classifica A/B/C pelos cortes', () => {
      // Total = 1000. Cortes padrão 80/95.
      const itens = [
        { nome: 'C (pequeno)', valorFaturado: 50 },
        { nome: 'A (grande)', valorFaturado: 700 },
        { nome: 'B (médio)', valorFaturado: 250 },
      ];
      const resultado = classificarAbc(itens, 80, 95);

      expect(resultado.map(r => r.nome)).toEqual(['A (grande)', 'B (médio)', 'C (pequeno)']);
      expect(resultado[0].classificacao).toBe('A'); // 70% acumulado, <= 80
      expect(resultado[1].classificacao).toBe('B'); // 95% acumulado, <= 95
      expect(resultado[2].classificacao).toBe('C'); // 100% acumulado, > 95

      // Percentual acumulado sempre bate 100% no final (dentro de arredondamento).
      expect(resultado[resultado.length - 1].percentualAcumulado).toBeCloseTo(100, 5);
    });

    it('atribui ordem sequencial (0-based) após a ordenação', () => {
      const itens = [
        { nome: 'Menor', valorFaturado: 10 },
        { nome: 'Maior', valorFaturado: 90 },
      ];
      const resultado = classificarAbc(itens, 80, 95);
      expect(resultado[0].nome).toBe('Maior');
      expect(resultado[0].ordem).toBe(0);
      expect(resultado[1].ordem).toBe(1);
    });

    it('lida com lista vazia sem quebrar', () => {
      expect(classificarAbc([], 80, 95)).toEqual([]);
    });

    it('classifica tudo como A quando o corte é 100%', () => {
      const itens = [{ nome: 'X', valorFaturado: 10 }, { nome: 'Y', valorFaturado: 5 }];
      const resultado = classificarAbc(itens, 100, 100);
      expect(resultado.every(r => r.classificacao === 'A')).toBe(true);
    });
  });
});
