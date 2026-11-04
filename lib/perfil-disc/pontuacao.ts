// ============================================================
// PERFIL COMPORTAMENTAL — pontuação
// ============================================================
// Regras puras, sem banco nem rede. O resultado é guardado só em números: os
// textos do relatório vêm de textos.ts, então uma correção de redação vale também
// para as avaliações antigas.

import {
  BLOCOS_DISC, FATORES, IDS_BLOCOS_ADAPTADO, ITENS_JUNG, PARES_VALORES, VALORES,
  type EscolhaBloco, type Fator, type PoloJung, type RespostasPerfil, type Valor,
} from './questionario';

export type ScoresDisc = Record<Fator, number>;

export interface ResultadoJung {
  E: number; I: number;
  S: number; N: number;
  T: number; F: number;
  tipo: string;
}

export interface CompetenciaCalculada {
  id: string;
  fator: Fator;
  natural: number;
  adaptado: number;
}

export interface ResultadoPerfil {
  versao: number;
  natural: ScoresDisc;
  adaptado: ScoresDisc;
  perfilNatural: string;
  perfilAdaptado: string;
  /** Distância média, de 0 a 100, entre o jeito natural e o que o ambiente pede. */
  esforcoAdaptacao: number;
  jung: ResultadoJung;
  valores: Record<Valor, number>;
  /** Participação de cada fator natural no total, em %: base dos estilos de liderança. */
  lideranca: ScoresDisc;
  competencias: CompetenciaCalculada[];
}

const limitar = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * "Mais parecido" soma um ponto ao fator e "menos parecido" tira um. Com N blocos,
 * 50 é o ponto médio da própria pessoa e os quatro fatores somam cerca de 200.
 */
export function pontuarDisc(escolhas: Record<string, EscolhaBloco>, idsBlocos: readonly string[]): ScoresDisc {
  const saldo: ScoresDisc = { D: 0, I: 0, S: 0, C: 0 };
  for (const id of idsBlocos) {
    const bloco = BLOCOS_DISC.find(b => b.id === id);
    const escolha = escolhas[id];
    if (!bloco || !escolha) throw new Error(`Bloco sem resposta: ${id}`);
    saldo[bloco.frases[escolha.mais].fator]++;
    saldo[bloco.frases[escolha.menos].fator]--;
  }
  const n = idsBlocos.length;
  return {
    D: limitar(50 + (50 * saldo.D) / n),
    I: limitar(50 + (50 * saldo.I) / n),
    S: limitar(50 + (50 * saldo.S) / n),
    C: limitar(50 + (50 * saldo.C) / n),
  };
}

/** As letras do perfil: fatores acima do ponto médio, do mais forte para o mais fraco. */
export function letrasPerfil(scores: ScoresDisc): string {
  const acima = FATORES
    .filter(f => scores[f] > 50)
    .sort((a, b) => scores[b] - scores[a] || FATORES.indexOf(a) - FATORES.indexOf(b));
  // Só acontece com os quatro fatores exatamente em 50.
  return acima.length > 0 ? acima.join('') : 'DISC';
}

function pontuarJung(escolhas: Record<string, 0 | 1>): ResultadoJung {
  const votos: Record<PoloJung, number> = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0 };
  for (const item of ITENS_JUNG) votos[item.opcoes[escolhas[item.id]].polo]++;

  const pct = (a: PoloJung, b: PoloJung) => {
    const total = votos[a] + votos[b];
    return total === 0 ? 50 : Math.round((votos[a] / total) * 100);
  };
  const E = pct('E', 'I');
  const S = pct('S', 'N');
  const T = pct('T', 'F');
  return {
    E, I: 100 - E,
    S, N: 100 - S,
    T, F: 100 - T,
    tipo: `${E > 50 ? 'E' : 'I'}${S > 50 ? 'S' : 'N'}${T > 50 ? 'T' : 'F'}`,
  };
}

function pontuarValores(escolhas: Record<string, 0 | 1>): Record<Valor, number> {
  const vitorias = Object.fromEntries(VALORES.map(v => [v, 0])) as Record<Valor, number>;
  for (const par of PARES_VALORES) vitorias[par.opcoes[escolhas[par.id]].valor]++;
  // Cada valor disputa 5 confrontos: 5 vitórias valem 100.
  return Object.fromEntries(VALORES.map(v => [v, vitorias[v] * 20])) as Record<Valor, number>;
}

export type NivelValor = 'significativo' | 'circunstancial' | 'indiferente';

export function nivelValor(pontos: number): NivelValor {
  if (pontos >= 60) return 'significativo';
  if (pontos >= 40) return 'circunstancial';
  return 'indiferente';
}

// Competências são uma leitura derivada dos fatores, sem perguntas próprias: cada
// peso diz quanto o fator puxa a competência para cima ou para baixo do ponto médio.
type Pesos = Partial<Record<Fator, number>>;

const PESOS_COMPETENCIAS: ReadonlyArray<{ id: string; fator: Fator; pesos: Pesos }> = [
  { id: 'iniciativa', fator: 'D', pesos: { D: 0.8, I: 0.2, S: -0.3, C: -0.1 } },
  { id: 'lideranca', fator: 'D', pesos: { D: 0.8, I: 0.3, S: -0.1, C: -0.1 } },
  { id: 'resultado', fator: 'D', pesos: { D: 0.7, S: -0.2, C: 0.1 } },
  { id: 'decisao', fator: 'D', pesos: { D: 0.7, I: 0.1, S: -0.2, C: -0.1 } },
  { id: 'comunicacao', fator: 'I', pesos: { I: 0.8, D: 0.2, C: -0.2 } },
  { id: 'influencia', fator: 'I', pesos: { I: 0.7, D: 0.3, S: -0.1, C: -0.1 } },
  { id: 'entusiasmo', fator: 'I', pesos: { I: 0.8, D: 0.1, S: -0.1, C: -0.2 } },
  { id: 'relacionamento', fator: 'I', pesos: { I: 0.6, S: 0.4, D: -0.1, C: -0.1 } },
  { id: 'empatia', fator: 'S', pesos: { S: 0.6, I: 0.3, D: -0.2 } },
  { id: 'paciencia', fator: 'S', pesos: { S: 0.9, D: -0.3, I: -0.1, C: 0.1 } },
  { id: 'constancia', fator: 'S', pesos: { S: 0.7, C: 0.3, D: -0.2, I: -0.2 } },
  { id: 'cooperacao', fator: 'S', pesos: { S: 0.7, I: 0.3, D: -0.3 } },
  { id: 'organizacao', fator: 'C', pesos: { C: 0.7, S: 0.3, I: -0.2, D: -0.1 } },
  { id: 'detalhes', fator: 'C', pesos: { C: 0.9, S: 0.1, I: -0.3, D: -0.1 } },
  { id: 'prudencia', fator: 'C', pesos: { C: 0.7, S: 0.2, D: -0.3, I: -0.1 } },
  { id: 'analise', fator: 'C', pesos: { C: 0.8, D: 0.1, I: -0.2 } },
];

function competencia(scores: ScoresDisc, pesos: Pesos): number {
  let total = 50;
  for (const f of FATORES) total += (pesos[f] ?? 0) * (scores[f] - 50);
  return limitar(total);
}

export function calcularResultado(respostas: RespostasPerfil): ResultadoPerfil {
  const natural = pontuarDisc(respostas.natural, BLOCOS_DISC.map(b => b.id));
  const adaptado = pontuarDisc(respostas.adaptado, IDS_BLOCOS_ADAPTADO);

  const somaNatural = FATORES.reduce((s, f) => s + natural[f], 0) || 1;
  const participacao = (f: Fator) => Math.round((natural[f] / somaNatural) * 1000) / 10;

  return {
    versao: 1,
    natural,
    adaptado,
    perfilNatural: letrasPerfil(natural),
    perfilAdaptado: letrasPerfil(adaptado),
    esforcoAdaptacao: Math.round(FATORES.reduce((s, f) => s + Math.abs(adaptado[f] - natural[f]), 0) / 4),
    jung: pontuarJung(respostas.jung),
    valores: pontuarValores(respostas.valores),
    lideranca: { D: participacao('D'), I: participacao('I'), S: participacao('S'), C: participacao('C') },
    competencias: PESOS_COMPETENCIAS.map(c => ({
      id: c.id,
      fator: c.fator,
      natural: competencia(natural, c.pesos),
      adaptado: competencia(adaptado, c.pesos),
    })),
  };
}
