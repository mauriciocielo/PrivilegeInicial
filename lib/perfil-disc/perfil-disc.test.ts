import { describe, expect, it } from 'vitest';
import {
  BLOCOS_DISC, FATORES, IDS_BLOCOS_ADAPTADO, ITENS_JUNG, PARES_VALORES, VALORES,
  questionarioPublico, validarRespostas,
  type Fator, type RespostasPerfil, type Valor,
} from './questionario';
import { calcularResultado, letrasPerfil, nivelValor, pontuarDisc } from './pontuacao';
import { fimDoPrazo, linkExpirado } from './prazo';
import { faixaEsforco, formatarTempoResposta, montarRelatorio } from './relatorio';
import { TEXTOS_COMPETENCIA, TITULOS_PERFIL } from './textos';

/** Escolhe sempre o mesmo fator como "mais" e outro como "menos", e responde o resto em favor dos polos dados. */
function responder(opcoes: {
  mais: Fator; menos: Fator;
  maisAdaptado?: Fator; menosAdaptado?: Fator;
  polos?: string; valorVencedor?: Valor;
}): RespostasPerfil {
  const escolha = (id: string, mais: Fator, menos: Fator) => {
    const frases = BLOCOS_DISC.find(b => b.id === id)!.frases;
    return { mais: frases.findIndex(f => f.fator === mais), menos: frases.findIndex(f => f.fator === menos) };
  };
  const polos = opcoes.polos ?? 'EST';
  return {
    natural: Object.fromEntries(BLOCOS_DISC.map(b => [b.id, escolha(b.id, opcoes.mais, opcoes.menos)])),
    adaptado: Object.fromEntries(IDS_BLOCOS_ADAPTADO.map(id => [id, escolha(id, opcoes.maisAdaptado ?? opcoes.mais, opcoes.menosAdaptado ?? opcoes.menos)])),
    jung: Object.fromEntries(ITENS_JUNG.map(i => [i.id, (polos.includes(i.opcoes[0].polo) ? 0 : 1) as 0 | 1])),
    valores: Object.fromEntries(PARES_VALORES.map(p => [p.id, (p.opcoes[1].valor === opcoes.valorVencedor ? 1 : 0) as 0 | 1])),
  };
}

describe('questionário', () => {
  it('tem uma frase de cada fator em todo bloco, sem frases repetidas', () => {
    for (const b of BLOCOS_DISC) {
      expect(b.frases.map(f => f.fator).sort()).toEqual([...FATORES].sort());
    }
    const textos = BLOCOS_DISC.flatMap(b => b.frases.map(f => f.texto));
    expect(new Set(textos).size).toBe(textos.length);
  });

  it('não entrega o gabarito por posição: cada fator aparece em todas as colunas', () => {
    for (const fator of FATORES) {
      const posicoes = new Set(BLOCOS_DISC.map(b => b.frases.findIndex(f => f.fator === fator)));
      expect(posicoes.size).toBe(4);
    }
  });

  it('a parte sobre o ambiente só usa blocos que existem, sem repetir', () => {
    expect(new Set(IDS_BLOCOS_ADAPTADO).size).toBe(IDS_BLOCOS_ADAPTADO.length);
    for (const id of IDS_BLOCOS_ADAPTADO) expect(BLOCOS_DISC.some(b => b.id === id)).toBe(true);
  });

  it('tem número ímpar de itens por dimensão de Jung, para nunca empatar', () => {
    for (const par of [['E', 'I'], ['S', 'N'], ['T', 'F']]) {
      const itens = ITENS_JUNG.filter(i => i.opcoes.every(o => par.includes(o.polo)));
      expect(itens.length % 2).toBe(1);
      for (const i of itens) expect(i.opcoes[0].polo).not.toBe(i.opcoes[1].polo);
    }
  });

  it('faz cada valor enfrentar os outros uma vez, com frases diferentes', () => {
    expect(PARES_VALORES).toHaveLength(15);
    for (const v of VALORES) {
      const confrontos = PARES_VALORES.filter(p => p.opcoes.some(o => o.valor === v));
      expect(confrontos).toHaveLength(5);
    }
    const textos = PARES_VALORES.flatMap(p => p.opcoes.map(o => o.texto));
    expect(new Set(textos).size).toBe(30);
  });

  it('não manda o gabarito para o navegador', () => {
    const texto = JSON.stringify(questionarioPublico());
    expect(texto).not.toContain('fator');
    expect(texto).not.toContain('polo');
    expect(texto).not.toContain('"valor"');
    expect(texto).not.toContain('tradicional');
  });
});

describe('validação das respostas', () => {
  const completa = () => responder({ mais: 'D', menos: 'C', valorVencedor: 'social' });

  it('aceita um formulário completo', () => {
    expect(validarRespostas(completa()).ok).toBe(true);
  });

  it('remove chaves desconhecidas', () => {
    const r = validarRespostas({ ...completa(), extra: 1, natural: { ...completa().natural, invasor: { mais: 0, menos: 1 } } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.respostas)).toEqual(['natural', 'adaptado', 'jung', 'valores']);
      expect(r.respostas.natural).not.toHaveProperty('invasor');
    }
  });

  it.each([
    ['nulo', null],
    ['lista', []],
    ['vazio', {}],
  ])('recusa entrada inválida: %s', (_nome, entrada) => {
    expect(validarRespostas(entrada).ok).toBe(false);
  });

  it('recusa resposta faltando', () => {
    const r = completa();
    delete r.natural.b05;
    expect(validarRespostas(r).ok).toBe(false);
  });

  it('recusa a mesma frase como "mais" e "menos"', () => {
    const r = completa();
    r.natural.b01 = { mais: 2, menos: 2 };
    expect(validarRespostas(r).ok).toBe(false);
  });

  it.each([[4], [-1], [1.5], ['0']])('recusa índice fora do bloco: %s', indice => {
    const r = completa();
    r.natural.b01 = { mais: indice as number, menos: 0 };
    expect(validarRespostas(r).ok).toBe(false);
  });

  it('recusa opção inexistente em uma escolha de duas opções', () => {
    const r = completa();
    (r.jung as Record<string, unknown>).j01 = 2;
    expect(validarRespostas(r).ok).toBe(false);
  });

  it('não lê respostas herdadas do protótipo do objeto', () => {
    const r = completa();
    delete r.natural.b01;
    Object.setPrototypeOf(r.natural, { b01: { mais: 0, menos: 1 } });
    expect(validarRespostas(r).ok).toBe(false);
  });
});

describe('pontuação DISC', () => {
  it('leva os extremos a 100 e 0, e mantém os outros fatores no ponto médio', () => {
    const r = calcularResultado(responder({ mais: 'C', menos: 'D' }));
    expect(r.natural).toEqual({ D: 0, I: 50, S: 50, C: 100 });
    expect(r.perfilNatural).toBe('C');
  });

  it('pontua o natural e o adaptado separadamente', () => {
    const r = calcularResultado(responder({ mais: 'S', menos: 'D', maisAdaptado: 'D', menosAdaptado: 'S' }));
    expect(r.natural.S).toBe(100);
    expect(r.adaptado.D).toBe(100);
    expect(r.perfilNatural).toBe('S');
    expect(r.perfilAdaptado).toBe('D');
  });

  it('soma cerca de 200 pontos, então 50 é a média da própria pessoa', () => {
    const escolhas = Object.fromEntries(BLOCOS_DISC.map((b, i) => [b.id, { mais: i % 4, menos: (i + 1) % 4 }]));
    const s = pontuarDisc(escolhas, BLOCOS_DISC.map(b => b.id));
    const soma = FATORES.reduce((t, f) => t + s[f], 0);
    expect(Math.abs(soma - 200)).toBeLessThanOrEqual(2);
  });

  it('monta as letras do perfil do fator mais forte para o mais fraco', () => {
    expect(letrasPerfil({ D: 26, I: 32, S: 69, C: 73 })).toBe('CS');
    expect(letrasPerfil({ D: 53, I: 59, S: 53, C: 35 })).toBe('IDS');
    expect(letrasPerfil({ D: 50, I: 50, S: 50, C: 50 })).toBe('DISC');
  });

  it('não acusa esforço de adaptação quando o ambiente pede o mesmo jeito', () => {
    expect(calcularResultado(responder({ mais: 'I', menos: 'C' })).esforcoAdaptacao).toBe(0);
  });

  it('mede a distância média entre natural e adaptado', () => {
    const r = calcularResultado(responder({ mais: 'S', menos: 'D', maisAdaptado: 'D', menosAdaptado: 'S' }));
    expect(r.esforcoAdaptacao).toBe(50);
  });

  it('distribui a liderança em 100%', () => {
    const r = calcularResultado(responder({ mais: 'C', menos: 'I' }));
    const soma = FATORES.reduce((t, f) => t + r.lideranca[f], 0);
    expect(soma).toBeCloseTo(100, 0);
    expect(r.lideranca.C).toBe(50);
    expect(r.lideranca.I).toBe(0);
  });

  it('calcula 16 competências dentro da escala e puxadas pelo fator certo', () => {
    const r = calcularResultado(responder({ mais: 'D', menos: 'S' }));
    expect(r.competencias).toHaveLength(16);
    for (const c of r.competencias) {
      expect(c.natural).toBeGreaterThanOrEqual(0);
      expect(c.natural).toBeLessThanOrEqual(100);
    }
    const nota = (id: string) => r.competencias.find(c => c.id === id)!.natural;
    expect(nota('iniciativa')).toBeGreaterThan(nota('paciencia'));
  });
});

describe('validade do link', () => {
  const criadoEm = new Date('2026-11-04T10:00:00Z');
  const em = (horas: number) => new Date(criadoEm.getTime() + horas * 3_600_000);

  it('vence 24 horas depois de gerado', () => {
    expect(fimDoPrazo(criadoEm)).toEqual(em(24));
    expect(linkExpirado({ createdAt: criadoEm, iniciadoEm: null }, em(24))).toBe(false);
    expect(linkExpirado({ createdAt: criadoEm, iniciadoEm: null }, em(24.01))).toBe(true);
  });

  it('dá 1 hora de tolerância a quem começou dentro do prazo', () => {
    const iniciado = { createdAt: criadoEm, iniciadoEm: em(23.9) };
    expect(linkExpirado(iniciado, em(24.5))).toBe(false);
    expect(linkExpirado(iniciado, em(25))).toBe(false);
    expect(linkExpirado(iniciado, em(25.01))).toBe(true);
  });
});

describe('montagem do relatório', () => {
  const base = calcularResultado(responder({ mais: 'C', menos: 'D', maisAdaptado: 'I', menosAdaptado: 'C', polos: 'ISF', valorVencedor: 'economico' }));

  it('tem título para todas as combinações de até dois fatores', () => {
    for (const a of FATORES) {
      expect(TITULOS_PERFIL[a]).toBeTruthy();
      for (const b of FATORES) if (a !== b) expect(TITULOS_PERFIL[a + b]).toBeTruthy();
    }
  });

  it('tem nome e descrição para todas as competências calculadas', () => {
    for (const c of base.competencias) expect(TEXTOS_COMPETENCIA[c.id]?.nome).toBeTruthy();
  });

  it('usa o fator principal e aponta o que muda no ambiente', () => {
    const rel = montarRelatorio(base);
    expect(rel.perfil).toBe('C');
    expect(rel.titulo).toBe('Foco em qualidade e precisão');
    const c = rel.fatores.find(f => f.fator === 'C')!;
    expect(c.leitura).toContain('Valoriza regras');
    expect(c.adaptacao).toContain('mais flexibilidade');
    const i = rel.fatores.find(f => f.fator === 'I')!;
    expect(i.adaptacao).toContain('mais comunicação');
  });

  it('reaproveita o título das duas primeiras letras quando o perfil tem três fatores', () => {
    const rel = montarRelatorio({ ...base, perfilNatural: 'IDS' });
    expect(rel.titulo).toBe('Influência com iniciativa');
  });

  it('não quebra com todos os fatores no ponto médio', () => {
    const rel = montarRelatorio({ ...base, perfilNatural: 'DISC', natural: { D: 50, I: 50, S: 50, C: 50 } });
    expect(rel.titulo).toBe('Perfil equilibrado');
    expect(rel.visaoGeral).toHaveLength(1);
  });

  it('ordena valores e liderança do maior para o menor', () => {
    const rel = montarRelatorio(base);
    expect(rel.valores[0].valor).toBe('economico');
    expect(rel.valores[0].nomeNivel).toBe('Significativo');
    for (let i = 1; i < rel.lideranca.length; i++) {
      expect(rel.lideranca[i - 1].pct).toBeGreaterThanOrEqual(rel.lideranca[i].pct);
    }
    expect(rel.liderancaPrincipal.nome).toBe('Estruturador');
  });

  it('prioriza no plano de ação o que o ambiente pede além do natural', () => {
    const rel = montarRelatorio(base);
    expect(rel.plano.forcas).toHaveLength(3);
    expect(rel.plano.desenvolver).toHaveLength(3);
    expect(['Comunicação', 'Entusiasmo', 'Influência']).toEqual(expect.arrayContaining(rel.plano.desenvolver.slice(0, 1)));
  });

  it('completa o plano com as competências menos evidentes quando não há diferença', () => {
    const r = calcularResultado(responder({ mais: 'S', menos: 'D' }));
    const rel = montarRelatorio(r);
    expect(rel.plano.desenvolver).toHaveLength(3);
    expect(rel.plano.desenvolver).toContain('Iniciativa');
  });

  it('não pende para lado nenhum quando os fatores estão empatados', () => {
    const rel = montarRelatorio({ ...base, natural: { D: 50, I: 50, S: 50, C: 50 } });
    expect(rel.tendencias.every(t => t.lado === 'equilibrio')).toBe(true);
  });

  it.each([
    [0, 'baixo'], [9, 'baixo'], [10, 'moderado'], [20, 'moderado'], [21, 'alto'],
  ])('classifica esforço %i como %s', (valor, faixa) => {
    expect(faixaEsforco(valor)).toBe(faixa);
  });

  it.each([
    [null, 'não registrado'], [undefined, 'não registrado'], [0, '0 s'], [45, '45 s'], [60, '1 min 0 s'], [1100, '18 min 20 s'],
  ])('mostra o tempo de resposta %s como %s', (segundos, esperado) => {
    expect(formatarTempoResposta(segundos)).toBe(esperado);
  });

  it('não traz nenhuma lista repetida', () => {
    const rel = montarRelatorio(calcularResultado(responder({ mais: 'S', menos: 'D', maisAdaptado: 'D', menosAdaptado: 'S' })));
    for (const lista of [rel.receios, rel.pressao, rel.plano.acoes]) {
      expect(new Set(lista).size).toBe(lista.length);
    }
  });
});

describe('tipos e valores', () => {
  it('marca a preferência de cada dimensão, sem empates', () => {
    expect(calcularResultado(responder({ mais: 'D', menos: 'C', polos: 'INF' })).jung).toEqual({
      E: 0, I: 100, S: 0, N: 100, T: 0, F: 100, tipo: 'INF',
    });
    expect(calcularResultado(responder({ mais: 'D', menos: 'C', polos: 'EST' })).jung.tipo).toBe('EST');
  });

  it('dá 100 ao valor que vence todos os confrontos', () => {
    const { valores } = calcularResultado(responder({ mais: 'D', menos: 'C', valorVencedor: 'tradicional' }));
    expect(valores.tradicional).toBe(100);
    expect(VALORES.reduce((t, v) => t + valores[v], 0)).toBe(300);
  });

  it.each([
    [100, 'significativo'], [60, 'significativo'],
    [40, 'circunstancial'],
    [20, 'indiferente'], [0, 'indiferente'],
  ])('classifica %i como %s', (pontos, nivel) => {
    expect(nivelValor(pontos)).toBe(nivel);
  });
});
