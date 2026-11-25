// ============================================================
// PERFIL COMPORTAMENTAL — montagem do relatório
// ============================================================
// Transforma os números salvos no conteúdo do relatório. A tela e o PDF leem
// daqui, para nunca mostrarem conclusões diferentes sobre a mesma avaliação.

import { FATORES, VALORES, type Fator, type Valor } from './questionario';
import { nivelValor, type NivelValor, type ResultadoPerfil, type ScoresDisc } from './pontuacao';
import {
  ADAPTACAO_ESTAVEL, NOMES_NIVEL_VALOR, PERGUNTAS_PLANO, TEXTOS_COMPETENCIA, TEXTOS_ESFORCO,
  TEXTOS_FATOR, TEXTOS_JUNG, TEXTOS_TEMPERAMENTO, TEXTOS_VALOR, TITULOS_PERFIL,
  type TemperamentoId,
} from './textos';

/** Diferença a partir da qual natural e adaptado são tratados como comportamentos distintos. */
const DIFERENCA_RELEVANTE = 8;
/** Diferença abaixo da qual uma tendência não pende para nenhum dos lados. */
const MARGEM_TENDENCIA = 6;

export type FaixaEsforco = keyof typeof TEXTOS_ESFORCO;

const NOMES_ESFORCO: Record<FaixaEsforco, string> = { baixo: 'Baixo', moderado: 'Moderado', alto: 'Alto' };

export function faixaEsforco(valor: number): FaixaEsforco {
  if (valor < 10) return 'baixo';
  if (valor <= 20) return 'moderado';
  return 'alto';
}

export function formatarTempoResposta(segundos?: number | null): string {
  if (segundos === null || segundos === undefined) return 'não registrado';
  const minutos = Math.floor(segundos / 60);
  return minutos > 0 ? `${minutos} min ${segundos % 60} s` : `${segundos} s`;
}

export const nomeTipoRespondente = (tipo: string) => (tipo === 'empresario' ? 'Empresário(a)' : 'Colaborador(a)');

export interface LinhaFator {
  fator: Fator;
  nome: string;
  titulo: string;
  natural: number;
  adaptado: number;
  leitura: string;
  adaptacao: string;
}

export interface LinhaJung {
  polos: [{ letra: string; nome: string; pct: number }, { letra: string; nome: string; pct: number }];
  preferencia: { letra: string; nome: string; pct: number; descricao: string; tracos: readonly string[] };
}

export interface LinhaValor {
  valor: Valor;
  nome: string;
  motivador: string;
  pontos: number;
  nivel: NivelValor;
  nomeNivel: string;
  descricao: string;
  estimulo: string;
}

export interface LinhaLideranca {
  fator: Fator;
  nome: string;
  resumo: string;
  pct: number;
}

export interface LinhaCompetencia {
  id: string;
  nome: string;
  descricao: string;
  natural: number;
  adaptado: number;
}

export interface LinhaTendencia {
  a: string;
  b: string;
  lado: 'a' | 'b' | 'equilibrio';
}

export interface LinhaTemperamento {
  id: TemperamentoId;
  nome: string;
  elemento: string;
  fatorDisc: Fator;
  fatorNome: string;
  polaridade: string;
  pct: number;
}

export interface AnaliseTemperamento {
  predominante: LinhaTemperamento;
  secundario: LinhaTemperamento | null;
  combinacao: string;
  sintese: string[];
  noTrabalho: string;
  comoEquilibrar: string;
  forcas: string[];
  desafios: string[];
  distribuicao: LinhaTemperamento[];
}

export interface RelatorioMontado {
  perfil: string;
  titulo: string;
  fatorPrincipal: Fator;
  visaoGeral: string[];
  potencialidades: string;
  relacoes: string;
  decisao: string;
  motivacao: string;
  receios: string[];
  adequacao: string;
  fatores: LinhaFator[];
  pressao: string[];
  esforco: { valor: number; faixa: FaixaEsforco; nome: string; texto: string };
  temperamento: AnaliseTemperamento;
  jung: LinhaJung[];
  tipoJung: string;
  valores: LinhaValor[];
  lideranca: LinhaLideranca[];
  liderancaPrincipal: { nome: string; resumo: string; fortes: readonly string[]; cuidados: readonly string[] };
  competencias: Array<{ fator: Fator; nome: string; itens: LinhaCompetencia[] }>;
  tendencias: LinhaTendencia[];
  comunicarComPessoa: readonly string[];
  comunicarComOutros: Array<{ fator: Fator; nome: string; dicas: readonly string[] }>;
  plano: { forcas: string[]; desenvolver: string[]; acoes: string[]; perguntas: readonly string[] };
}

function fatoresDoPerfil(perfil: string, natural: ScoresDisc): [Fator, Fator | null] {
  if (perfil === 'DISC') {
    // Todos no ponto médio: nenhum fator se destaca, então não há fator secundário.
    return [FATORES.reduce((m, f) => (natural[f] > natural[m] ? f : m), 'D' as Fator), null];
  }
  return [perfil[0] as Fator, (perfil[1] as Fator) ?? null];
}

function leituraFator(fator: Fator, natural: number, adaptado: number): { leitura: string; adaptacao: string } {
  const t = TEXTOS_FATOR[fator].leitura;
  const leitura = natural >= 60 ? t.alto : natural >= 40 ? t.medio : t.baixo;
  const delta = adaptado - natural;
  const adaptacao = Math.abs(delta) < DIFERENCA_RELEVANTE ? ADAPTACAO_ESTAVEL : delta > 0 ? t.sobe : t.desce;
  return { leitura, adaptacao };
}

function montarTendencias({ D, I, S, C }: ScoresDisc): LinhaTendencia[] {
  const regras: Array<[string, string, number]> = [
    ['Fala direto', 'Consulta antes', D - S],
    ['Fala mais', 'Ouve mais', I - S],
    ['Age com rapidez', 'Age com planejamento', (D + I) / 2 - (S + C) / 2],
    ['Assume riscos', 'Evita riscos', D - C],
    ['Foco nas pessoas', 'Foco nas tarefas', (I + S) / 2 - (D + C) / 2],
    ['Visão geral', 'Olhar para detalhes', (D + I) / 2 - C],
    ['Informalidade', 'Formalidade', I - C],
    ['Cria o novo', 'Aprimora o existente', D - S / 2 - C / 2],
    ['Muda com facilidade', 'Prefere estabilidade', (D + I) / 2 - S],
  ];
  return regras.map(([a, b, saldo]) => ({
    a,
    b,
    lado: Math.abs(saldo) < MARGEM_TENDENCIA ? 'equilibrio' : saldo > 0 ? 'a' : 'b',
  }));
}

function montarTemperamento(natural: ScoresDisc): AnaliseTemperamento {
  const mapa: Array<{ id: TemperamentoId; fator: Fator; peso: number }> = [
    { id: 'colerico', fator: 'D', peso: Math.max(0, natural.D) },
    { id: 'sanguineo', fator: 'I', peso: Math.max(0, natural.I) },
    { id: 'fleumatico', fator: 'S', peso: Math.max(0, natural.S) },
    { id: 'melancolico', fator: 'C', peso: Math.max(0, natural.C) },
  ];

  const soma = mapa.reduce((acc, item) => acc + item.peso, 0);
  const pcts = soma > 0
    ? mapa.map(item => Math.round((item.peso / soma) * 100))
    : [25, 25, 25, 25];

  // Garante fechamento exato em 100% ajustando o temperamento de maior peso
  const diff = 100 - pcts.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    let idxMaior = 0;
    for (let i = 1; i < pcts.length; i++) {
      if (pcts[i] > pcts[idxMaior]) idxMaior = i;
    }
    pcts[idxMaior] = Math.max(0, pcts[idxMaior] + diff);
  }

  const distribuicao: LinhaTemperamento[] = mapa
    .map((item, i) => {
      const t = TEXTOS_TEMPERAMENTO[item.id];
      return {
        id: item.id,
        nome: t.nome,
        elemento: t.elemento,
        fatorDisc: item.fator,
        fatorNome: TEXTOS_FATOR[item.fator].nome,
        polaridade: t.polaridade,
        pct: pcts[i],
      };
    })
    .sort((a, b) => b.pct - a.pct);

  const predominante = distribuicao[0];
  const segundo = distribuicao[1];
  const temSecundario = segundo && segundo.pct >= 20 && (predominante.pct - segundo.pct) <= 25;
  const secundario = temSecundario ? segundo : null;

  const tp = TEXTOS_TEMPERAMENTO[predominante.id];
  const ts = secundario ? TEXTOS_TEMPERAMENTO[secundario.id] : null;
  const combinacao = secundario ? `${predominante.nome}-${secundario.nome}` : `${predominante.nome} predominante`;

  const unir = (a: readonly string[], b?: readonly string[]) =>
    Array.from(new Set([...a.slice(0, 3), ...(b ? b.slice(0, 2) : a.slice(3, 4))]));

  return {
    predominante,
    secundario,
    combinacao,
    sintese: ts ? [tp.essencia, ts.complemento] : [tp.essencia],
    noTrabalho: tp.noTrabalho,
    comoEquilibrar: tp.comoEquilibrar,
    forcas: unir(tp.forcas, ts?.forcas),
    desafios: unir(tp.desafios, ts?.desafios),
    distribuicao,
  };
}

function montarJung(j: ResultadoPerfil['jung']): LinhaJung[] {
  const linha = (a: 'E' | 'S' | 'T', b: 'I' | 'N' | 'F'): LinhaJung => {
    const escolhido = j[a] > j[b] ? a : b;
    const texto = TEXTOS_JUNG[escolhido];
    return {
      polos: [
        { letra: a, nome: TEXTOS_JUNG[a].nome, pct: j[a] },
        { letra: b, nome: TEXTOS_JUNG[b].nome, pct: j[b] },
      ],
      preferencia: { letra: escolhido, nome: texto.nome, pct: j[escolhido], descricao: texto.descricao, tracos: texto.tracos },
    };
  };
  return [linha('E', 'I'), linha('S', 'N'), linha('T', 'F')];
}

function nomesCompetencias(lista: ResultadoPerfil['competencias']): string[] {
  return lista.map(c => TEXTOS_COMPETENCIA[c.id]?.nome ?? c.id);
}

/** Primeiro o que o ambiente pede além do natural; sem diferença relevante, as competências menos evidentes. */
function aDesenvolver(lista: ResultadoPerfil['competencias']): string[] {
  const pedidas = lista
    .filter(c => c.adaptado - c.natural >= DIFERENCA_RELEVANTE)
    .sort((a, b) => b.adaptado - b.natural - (a.adaptado - a.natural));
  if (pedidas.length >= 3) return nomesCompetencias(pedidas.slice(0, 3));
  const faltam = [...lista]
    .filter(c => !pedidas.includes(c))
    .sort((a, b) => a.natural - b.natural)
    .slice(0, 3 - pedidas.length);
  return nomesCompetencias([...pedidas, ...faltam]);
}

export function montarRelatorio(r: ResultadoPerfil): RelatorioMontado {
  const [principal, secundario] = fatoresDoPerfil(r.perfilNatural, r.natural);
  const tp = TEXTOS_FATOR[principal];
  const ts = secundario ? TEXTOS_FATOR[secundario] : null;

  const juntarListas = (a: readonly string[], b: readonly string[] | undefined, limite: number) =>
    Array.from(new Set([...a.slice(0, Math.ceil(limite / 2) + 1), ...(b ?? [])])).slice(0, limite);

  const valores = VALORES
    .map((valor): LinhaValor => {
      const t = TEXTOS_VALOR[valor];
      const pontos = r.valores[valor];
      const nivel = nivelValor(pontos);
      return { valor, nome: t.nome, motivador: t.motivador, pontos, nivel, nomeNivel: NOMES_NIVEL_VALOR[nivel], descricao: t.descricao, estimulo: t.estimulo };
    })
    .sort((a, b) => b.pontos - a.pontos);

  const lideranca = FATORES
    .map((fator): LinhaLideranca => ({
      fator,
      nome: TEXTOS_FATOR[fator].lideranca.nome,
      resumo: TEXTOS_FATOR[fator].lideranca.resumo,
      pct: r.lideranca[fator],
    }))
    .sort((a, b) => b.pct - a.pct);

  const porNatural = [...r.competencias].sort((a, b) => b.natural - a.natural);

  const faixa = faixaEsforco(r.esforcoAdaptacao);

  return {
    perfil: r.perfilNatural,
    titulo: TITULOS_PERFIL[r.perfilNatural] ?? TITULOS_PERFIL[r.perfilNatural.slice(0, 2)] ?? 'Perfil comportamental',
    fatorPrincipal: principal,
    visaoGeral: ts ? [tp.sintese, ts.complemento] : [tp.sintese],
    potencialidades: tp.potencialidades,
    relacoes: tp.relacoes,
    decisao: tp.decisao,
    motivacao: tp.motivacao,
    receios: juntarListas(tp.receios, ts?.receios, 7),
    adequacao: tp.adequacao,
    fatores: FATORES.map(fator => ({
      fator,
      nome: TEXTOS_FATOR[fator].nome,
      titulo: TEXTOS_FATOR[fator].leitura.titulo,
      natural: r.natural[fator],
      adaptado: r.adaptado[fator],
      ...leituraFator(fator, r.natural[fator], r.adaptado[fator]),
    })),
    pressao: juntarListas(tp.pressao, ts?.pressao, 8),
    esforco: { valor: r.esforcoAdaptacao, faixa, nome: NOMES_ESFORCO[faixa], texto: TEXTOS_ESFORCO[faixa] },
    temperamento: montarTemperamento(r.natural),
    jung: montarJung(r.jung),
    tipoJung: r.jung.tipo,
    valores,
    lideranca,
    liderancaPrincipal: TEXTOS_FATOR[lideranca[0].fator].lideranca,
    competencias: FATORES.map(fator => ({
      fator,
      nome: TEXTOS_FATOR[fator].nome,
      itens: r.competencias
        .filter(c => c.fator === fator)
        .map(c => ({
          id: c.id,
          nome: TEXTOS_COMPETENCIA[c.id]?.nome ?? c.id,
          descricao: TEXTOS_COMPETENCIA[c.id]?.descricao ?? '',
          natural: c.natural,
          adaptado: c.adaptado,
        })),
    })),
    tendencias: montarTendencias(r.natural),
    comunicarComPessoa: ts ? juntarListas(tp.comunicar, ts.comunicar, 5) : tp.comunicar,
    comunicarComOutros: FATORES.map(fator => ({ fator, nome: TEXTOS_FATOR[fator].nome, dicas: TEXTOS_FATOR[fator].comunicar })),
    plano: {
      forcas: nomesCompetencias(porNatural.slice(0, 3)),
      desenvolver: aDesenvolver(r.competencias),
      acoes: juntarListas(tp.acoes, ts?.acoes, 4),
      perguntas: PERGUNTAS_PLANO,
    },
  };
}
