// ============================================================
// PERFIL COMPORTAMENTAL — questionário
// ============================================================
// Instrumento próprio do escritório: as frases foram escritas para este sistema
// a partir das teorias públicas de Marston (DISC), Jung (tipos) e Spranger
// (valores). Não há amostra normativa: o resultado compara a pessoa com ela mesma.
//
// O gabarito (qual fator cada frase mede) fica só no servidor. O navegador recebe
// apenas os textos, por questionarioPublico(), e responde com índices.

export const VERSAO_QUESTIONARIO = 1;

export type Fator = 'D' | 'I' | 'S' | 'C';
export const FATORES: readonly Fator[] = ['D', 'I', 'S', 'C'];

export type Valor = 'teorico' | 'economico' | 'estetico' | 'social' | 'politico' | 'tradicional';
export const VALORES: readonly Valor[] = ['economico', 'politico', 'tradicional', 'teorico', 'estetico', 'social'];

export type PoloJung = 'E' | 'I' | 'S' | 'N' | 'T' | 'F';

interface BlocoDisc {
  id: string;
  frases: ReadonlyArray<{ fator: Fator; texto: string }>;
}

const bloco = (id: string, ...frases: Array<[Fator, string]>): BlocoDisc => ({
  id,
  frases: frases.map(([fator, texto]) => ({ fator, texto })),
});

// A posição de cada fator varia de bloco para bloco de propósito: a ordem não pode entregar o gabarito.
export const BLOCOS_DISC: readonly BlocoDisc[] = [
  bloco('b01', ['D', 'Tomar a frente das situações'], ['I', 'Puxar conversa com quem não conheço'], ['S', 'Manter a calma quando há tensão'], ['C', 'Conferir tudo antes de entregar']),
  bloco('b02', ['I', 'Animar as pessoas ao redor'], ['C', 'Seguir as regras à risca'], ['D', 'Decidir rápido, mesmo sem todos os dados'], ['S', 'Ouvir com paciência']),
  bloco('b03', ['S', 'Manter uma rotina previsível'], ['D', 'Encarar desafios difíceis'], ['C', 'Analisar os dados antes de opinar'], ['I', 'Falar em público com naturalidade']),
  bloco('b04', ['C', 'Organizar as informações com método'], ['S', 'Ajudar os colegas sem esperar pedido'], ['I', 'Convencer as pessoas com entusiasmo'], ['D', 'Cobrar resultados com firmeza']),
  bloco('b05', ['D', 'Competir para chegar em primeiro'], ['C', 'Buscar a forma mais correta de fazer'], ['I', 'Fazer novos contatos'], ['S', 'Terminar o que comecei, no meu ritmo']),
  bloco('b06', ['S', 'Evitar conflitos e buscar acordo'], ['I', 'Contar histórias e descontrair o grupo'], ['D', 'Dizer o que penso de forma direta'], ['C', 'Prestar atenção em pequenos detalhes']),
  bloco('b07', ['I', 'Expressar o que estou sentindo'], ['D', 'Assumir riscos para ganhar tempo'], ['S', 'Ser leal às pessoas de sempre'], ['C', 'Planejar cada etapa por escrito']),
  bloco('b08', ['C', 'Questionar o que não tem fundamento'], ['S', 'Apoiar as decisões do grupo'], ['D', 'Mudar o rumo quando algo não anda'], ['I', 'Inspirar o time com novas ideias']),
  bloco('b09', ['D', 'Resolver problemas de imediato'], ['S', 'Fazer uma coisa de cada vez'], ['C', 'Evitar erros a todo custo'], ['I', 'Trabalhar junto de muita gente']),
  bloco('b10', ['S', 'Dar tempo para as pessoas se adaptarem'], ['C', 'Documentar o que foi feito'], ['I', 'Manter o otimismo nas dificuldades'], ['D', 'Exigir o máximo de mim e dos outros']),
  bloco('b11', ['I', 'Elogiar e reconhecer em voz alta'], ['C', 'Comparar as opções antes de escolher'], ['S', 'Preservar o clima do ambiente'], ['D', 'Buscar autonomia para agir']),
  bloco('b12', ['C', 'Manter um padrão alto de qualidade'], ['D', 'Definir metas ousadas'], ['I', 'Improvisar e me adaptar conversando'], ['S', 'Ensinar com calma quem está começando']),
  bloco('b13', ['D', 'Enfrentar quem discorda de mim'], ['I', 'Gostar de estar em evidência'], ['C', 'Seguir um procedimento definido'], ['S', 'Aceitar as mudanças aos poucos']),
  bloco('b14', ['S', 'Cumprir os combinados sem alarde'], ['D', 'Liderar sem esperar permissão'], ['I', 'Envolver as pessoas na conversa'], ['C', 'Revisar o trabalho mais de uma vez']),
  bloco('b15', ['I', 'Criar um clima leve nas reuniões'], ['S', 'Ser uma presença constante e confiável'], ['C', 'Entender a fundo antes de agir'], ['D', 'Focar no resultado final']),
  bloco('b16', ['C', 'Usar critérios objetivos'], ['I', 'Influenciar a opinião dos outros'], ['D', 'Agir com velocidade'], ['S', 'Cooperar mais do que competir']),
];

/** Na parte sobre o ambiente basta um recorte dos blocos, em outra ordem, para o formulário não ficar cansativo. */
export const IDS_BLOCOS_ADAPTADO: readonly string[] = [
  'b09', 'b02', 'b14', 'b06', 'b11', 'b01', 'b16', 'b04', 'b12', 'b07', 'b15', 'b03',
];

interface ItemJung {
  id: string;
  pergunta: string;
  opcoes: readonly [{ polo: PoloJung; texto: string }, { polo: PoloJung; texto: string }];
}

const itemJung = (id: string, pergunta: string, a: [PoloJung, string], b: [PoloJung, string]): ItemJung => ({
  id,
  pergunta,
  opcoes: [{ polo: a[0], texto: a[1] }, { polo: b[0], texto: b[1] }],
});

// Cinco itens por dimensão: número ímpar, portanto nunca há empate.
export const ITENS_JUNG: readonly ItemJung[] = [
  itemJung('j01', 'Para recuperar a energia, prefiro…', ['E', 'estar com pessoas e movimento'], ['I', 'ter um tempo só para mim']),
  itemJung('j02', 'Quando preciso pensar em um assunto…', ['I', 'organizo primeiro na cabeça'], ['E', 'falo em voz alta com alguém']),
  itemJung('j03', 'Em um evento, costumo…', ['E', 'puxar conversa com várias pessoas'], ['I', 'ficar com poucas pessoas que já conheço']),
  itemJung('j04', 'Rendo mais trabalhando…', ['I', 'em um lugar reservado'], ['E', 'em um ambiente movimentado']),
  itemJung('j05', 'Ao receber uma notícia importante…', ['E', 'compartilho logo com alguém'], ['I', 'reflito antes de comentar']),
  itemJung('j06', 'Presto mais atenção…', ['S', 'nos fatos concretos'], ['N', 'nas possibilidades e nos significados']),
  itemJung('j07', 'Prefiro receber instruções…', ['N', 'com a ideia geral e liberdade para fazer'], ['S', 'com o passo a passo claro']),
  itemJung('j08', 'Na hora de avaliar algo, confio mais…', ['S', 'no que já vivi na prática'], ['N', 'no meu palpite sobre o que pode acontecer']),
  itemJung('j09', 'Em um projeto, o que mais me atrai é…', ['N', 'imaginar o que ainda não existe'], ['S', 'colocar em prática o que já está definido']),
  itemJung('j10', 'Costumo pensar mais…', ['S', 'no que precisa ser feito agora'], ['N', 'em como as coisas podem ser no futuro']),
  itemJung('j11', 'Ao decidir, pesa mais para mim…', ['T', 'a lógica da situação'], ['F', 'o efeito sobre as pessoas']),
  itemJung('j12', 'Em uma discussão, busco principalmente…', ['F', 'que todos saiam bem da conversa'], ['T', 'chegar ao argumento correto']),
  itemJung('j13', 'Ao dar um retorno a alguém, prefiro…', ['T', 'ir direto ao ponto, mesmo que incomode'], ['F', 'cuidar do que a pessoa vai sentir']),
  itemJung('j14', 'Considero mais justo…', ['F', 'considerar a situação de cada um'], ['T', 'aplicar a mesma regra para todos']),
  itemJung('j15', 'Me incomoda mais…', ['T', 'uma decisão sem lógica'], ['F', 'uma decisão que magoa alguém']),
];

// Cinco frases por valor, uma para cada confronto com os outros cinco valores.
// Crenças ficam de fora de propósito: convicção religiosa é dado sensível na LGPD.
const FRASES_VALOR: Record<Valor, readonly string[]> = {
  teorico: [
    'aprender algo novo todos os dias',
    'entender a fundo como as coisas funcionam',
    'estudar um assunto até dominá-lo',
    'buscar a resposta certa, mesmo que demore',
    'conviver com pessoas que sabem muito',
  ],
  economico: [
    'ver retorno financeiro claro no que faço',
    'usar bem o tempo e os recursos disponíveis',
    'fazer cada real investido render mais',
    'construir patrimônio e independência financeira',
    'entregar soluções práticas que dão resultado',
  ],
  estetico: [
    'ter equilíbrio entre trabalho e vida pessoal',
    'trabalhar em um ambiente bonito e agradável',
    'dar forma criativa às minhas ideias',
    'viver experiências que tragam bem-estar',
    'cuidar da minha qualidade de vida',
  ],
  social: [
    'ajudar quem está passando por dificuldades',
    'fazer diferença na vida de outras pessoas',
    'contribuir com causas da comunidade',
    'desenvolver pessoas sem esperar nada em troca',
    'colocar as necessidades do grupo na frente das minhas',
  ],
  politico: [
    'ter autoridade para decidir os rumos',
    'conquistar uma posição de destaque',
    'liderar pessoas e ser referência',
    'ampliar minha influência na organização',
    'ter reconhecimento público pelas minhas conquistas',
  ],
  tradicional: [
    'seguir os princípios em que acredito, sem exceção',
    'manter as tradições da minha família',
    'trabalhar em um lugar com regras claras e estáveis',
    'agir de acordo com meus princípios, mesmo contra a maioria',
    'preservar o que já provou funcionar',
  ],
};

interface ParValores {
  id: string;
  opcoes: readonly [{ valor: Valor; texto: string }, { valor: Valor; texto: string }];
}

/** Todos os valores se enfrentam uma vez: 15 pares, e cada valor vence de 0 a 5 vezes. */
function montarParesValores(): ParValores[] {
  const ordem: Valor[] = ['teorico', 'economico', 'estetico', 'social', 'politico', 'tradicional'];
  const usadas: Record<string, number> = {};
  const proxima = (v: Valor) => {
    const i = usadas[v] ?? 0;
    usadas[v] = i + 1;
    return FRASES_VALOR[v][i];
  };

  const pares: ParValores[] = [];
  for (let a = 0; a < ordem.length; a++) {
    for (let b = a + 1; b < ordem.length; b++) {
      const n = pares.length + 1;
      const primeiro = { valor: ordem[a], texto: proxima(ordem[a]) };
      const segundo = { valor: ordem[b], texto: proxima(ordem[b]) };
      // Alterna os lados para que nenhum valor fique sempre na mesma posição.
      pares.push({
        id: `v${String(n).padStart(2, '0')}`,
        opcoes: n % 2 === 0 ? [segundo, primeiro] : [primeiro, segundo],
      });
    }
  }
  return pares;
}

export const PARES_VALORES: readonly ParValores[] = montarParesValores();

// ------------------------------------------------------------
// O que vai para o navegador
// ------------------------------------------------------------

export interface BlocoPublico { id: string; opcoes: string[] }
export interface EscolhaPublica { id: string; pergunta: string; opcoes: [string, string] }

export interface QuestionarioPublico {
  versao: number;
  natural: BlocoPublico[];
  adaptado: BlocoPublico[];
  jung: EscolhaPublica[];
  valores: EscolhaPublica[];
}

const blocoPublico = (b: BlocoDisc): BlocoPublico => ({ id: b.id, opcoes: b.frases.map(f => f.texto) });

function blocoPorId(id: string): BlocoDisc {
  const b = BLOCOS_DISC.find(x => x.id === id);
  if (!b) throw new Error(`Bloco inexistente no questionário: ${id}`);
  return b;
}

export function questionarioPublico(): QuestionarioPublico {
  return {
    versao: VERSAO_QUESTIONARIO,
    natural: BLOCOS_DISC.map(blocoPublico),
    adaptado: IDS_BLOCOS_ADAPTADO.map(id => blocoPublico(blocoPorId(id))),
    jung: ITENS_JUNG.map(i => ({ id: i.id, pergunta: i.pergunta, opcoes: [i.opcoes[0].texto, i.opcoes[1].texto] })),
    valores: PARES_VALORES.map(p => ({
      id: p.id,
      pergunta: 'O que pesa mais para você?',
      opcoes: [p.opcoes[0].texto, p.opcoes[1].texto],
    })),
  };
}

// ------------------------------------------------------------
// Respostas
// ------------------------------------------------------------

export interface EscolhaBloco { mais: number; menos: number }

export interface RespostasPerfil {
  natural: Record<string, EscolhaBloco>;
  adaptado: Record<string, EscolhaBloco>;
  jung: Record<string, 0 | 1>;
  valores: Record<string, 0 | 1>;
}

export type ValidacaoRespostas =
  | { ok: true; respostas: RespostasPerfil }
  | { ok: false; erro: string };

const ehObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const lerCampo = (obj: Record<string, unknown>, chave: string): unknown =>
  Object.prototype.hasOwnProperty.call(obj, chave) ? obj[chave] : undefined;

function lerBlocos(entrada: unknown, ids: readonly string[]): Record<string, EscolhaBloco> | null {
  if (!ehObjeto(entrada)) return null;
  const saida: Record<string, EscolhaBloco> = {};
  for (const id of ids) {
    const r = lerCampo(entrada, id);
    if (!ehObjeto(r)) return null;
    const mais = lerCampo(r, 'mais');
    const menos = lerCampo(r, 'menos');
    const indiceValido = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 3;
    if (!indiceValido(mais) || !indiceValido(menos) || mais === menos) return null;
    saida[id] = { mais, menos };
  }
  return saida;
}

function lerEscolhas(entrada: unknown, ids: readonly string[]): Record<string, 0 | 1> | null {
  if (!ehObjeto(entrada)) return null;
  const saida: Record<string, 0 | 1> = {};
  for (const id of ids) {
    const r = lerCampo(entrada, id);
    if (r !== 0 && r !== 1) return null;
    saida[id] = r;
  }
  return saida;
}

/**
 * Confere as respostas vindas do formulário público e devolve um objeto limpo, só
 * com as chaves conhecidas: qualquer resposta faltando ou fora do padrão recusa o envio.
 */
export function validarRespostas(entrada: unknown): ValidacaoRespostas {
  if (!ehObjeto(entrada)) return { ok: false, erro: 'Respostas inválidas.' };

  const natural = lerBlocos(lerCampo(entrada, 'natural'), BLOCOS_DISC.map(b => b.id));
  const adaptado = lerBlocos(lerCampo(entrada, 'adaptado'), IDS_BLOCOS_ADAPTADO);
  const jung = lerEscolhas(lerCampo(entrada, 'jung'), ITENS_JUNG.map(i => i.id));
  const valores = lerEscolhas(lerCampo(entrada, 'valores'), PARES_VALORES.map(p => p.id));

  if (!natural || !adaptado || !jung || !valores) {
    return { ok: false, erro: 'Faltam respostas. Volte e confira se todas as perguntas foram respondidas.' };
  }
  return { ok: true, respostas: { natural, adaptado, jung, valores } };
}
