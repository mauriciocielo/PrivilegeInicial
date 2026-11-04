import { describe, expect, it } from 'vitest';
import { PORTAIS_ESTADUAIS, UFS, portalDaUf } from './portais-estaduais';

const TODAS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

describe('portais de certidão estadual', () => {
  it('tem as 27 unidades da federação, sem faltar nem sobrar', () => {
    expect(UFS).toEqual(TODAS);
  });

  it('todo estado tem nome e ao menos um link válido', () => {
    for (const [uf, portal] of Object.entries(PORTAIS_ESTADUAIS)) {
      expect(portal.nome, uf).toBeTruthy();
      expect(portal.links.length, uf).toBeGreaterThan(0);
      for (const link of portal.links) {
        expect(link.rotulo, uf).toBeTruthy();
        expect(new URL(link.url).protocol, uf).toMatch(/^https?:$/);
      }
    }
  });

  it('só aponta para domínios do governo', () => {
    for (const [uf, portal] of Object.entries(PORTAIS_ESTADUAIS)) {
      for (const link of portal.links) expect(new URL(link.url).hostname, `${uf}: ${link.url}`).toMatch(/\.gov\.br$/);
    }
  });

  it('os estados com certidão de dívida ativa separada mostram os dois links', () => {
    for (const uf of ['AC', 'BA', 'MA', 'PI', 'RJ']) {
      expect(PORTAIS_ESTADUAIS[uf].links.some(l => l.rotulo === 'Dívida ativa'), uf).toBe(true);
    }
  });

  it('o Rio aponta primeiro para a certidão conjunta', () => {
    expect(PORTAIS_ESTADUAIS.RJ.links[0].url).toContain('crf-unificada-web');
    expect(PORTAIS_ESTADUAIS.RJ.observacao).toMatch(/conjunta/);
  });

  it('encontra o estado sem depender de maiúscula ou espaço', () => {
    expect(portalDaUf('sp')?.nome).toBe('São Paulo');
    expect(portalDaUf(' PR ')?.nome).toBe('Paraná');
    expect(portalDaUf(null)).toBeNull();
    expect(portalDaUf('XX')).toBeNull();
  });
});
