// ============================================================
// DIAGNÓSTICO 360º — Questionário de avaliação empresarial
// Metodologia Business Group: 5 áreas, perguntas de múltipla
// escolha (A→D) em escala crescente de maturidade.
// ============================================================

export type Letra = 'A' | 'B' | 'C' | 'D';
export type AreaKey = 'estrategia' | 'financas' | 'marketing' | 'rh' | 'operacoes';

export interface Opcao {
  letra: Letra;
  texto: string;
}

export interface Questao {
  id: string;
  area: AreaKey;
  numero: number;
  enunciado: string;
  opcoes: Opcao[];
  /** Ação sugerida quando a resposta não é a de maior maturidade */
  recomendacao: string;
}

export interface AreaDef {
  key: AreaKey;
  nome: string;
  icone: string;
  cor: string;
  /** RGB usado na geração do PDF */
  rgb: [number, number, number];
  descricao: string;
}

export interface RespondenteInfo {
  nome: string;
  cargo: string;
  nomeEmpresa: string;
  cidade: string;
  cnpj: string;
  segmento: string;
  telefone: string;
  faturamentoMedio: number;
  numFuncionarios: number;
}

export interface Diagnostico360 {
  id: string;
  empresaId: string;
  data: string; // YYYY-MM-DD
  consultor: string;
  respondente: RespondenteInfo;
  respostas: Record<string, Letra>;
  anotacoes: Partial<Record<AreaKey, string>>;
  parecer: string;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------
// Áreas
// ------------------------------------------------------------

export const AREAS: AreaDef[] = [
  {
    key: 'estrategia',
    nome: 'Estratégia',
    icone: '🎯',
    cor: '#600000',
    rgb: [96, 0, 0],
    descricao: 'Direcionamento, planejamento, metas e acompanhamento de resultados.',
  },
  {
    key: 'financas',
    nome: 'Finanças',
    icone: '💰',
    cor: '#10b981',
    rgb: [16, 185, 129],
    descricao: 'Reservas, orçamento, endividamento, fluxo de caixa e recebimentos.',
  },
  {
    key: 'marketing',
    nome: 'Marketing',
    icone: '📣',
    cor: '#8b5cf6',
    rgb: [139, 92, 246],
    descricao: 'Marca, presença digital, mensuração, pós-venda e política comercial.',
  },
  {
    key: 'rh',
    nome: 'Recursos Humanos',
    icone: '👥',
    cor: '#f59e0b',
    rgb: [245, 158, 11],
    descricao: 'Organograma, funções, recrutamento, avaliação, treinamento e cargos.',
  },
  {
    key: 'operacoes',
    nome: 'Operações',
    icone: '⚙️',
    cor: '#3b82f6',
    rgb: [59, 130, 246],
    descricao: 'Tecnologia, gestão de processos, políticas, compras e estoque.',
  },
];

export const AREA_BY_KEY: Record<AreaKey, AreaDef> = AREAS.reduce((acc, a) => {
  acc[a.key] = a;
  return acc;
}, {} as Record<AreaKey, AreaDef>);

// ------------------------------------------------------------
// Banco de questões
// ------------------------------------------------------------

const opts = (...textos: string[]): Opcao[] =>
  textos.map((texto, i) => ({ letra: (['A', 'B', 'C', 'D'] as Letra[])[i], texto }));

export const QUESTOES: Questao[] = [
  // ---------------------------- ESTRATÉGIA ----------------------------
  {
    id: 'est1',
    area: 'estrategia',
    numero: 1,
    enunciado: 'A empresa possui diretrizes estratégicas claras e compreendidas por toda a empresa?',
    opcoes: opts(
      'A empresa não possui visão definida.',
      'A empresa possui visão, porém está desatualizada.',
      'A empresa possui visão documentada, porém os colaboradores não possuem o entendimento claro sobre isso.',
      'A empresa possui visão definida e documentada, todos os colaboradores possuem o entendimento claro e esses itens são revistos periodicamente.',
    ),
    recomendacao: 'Formalizar missão, visão e valores em documento único, divulgar em reunião com toda a equipe e estabelecer revisão anual.',
  },
  {
    id: 'est2',
    area: 'estrategia',
    numero: 2,
    enunciado: 'Como a empresa realiza seu planejamento estratégico?',
    opcoes: opts(
      'A empresa não realiza o seu planejamento estratégico.',
      'A empresa realiza seu Planejamento Estratégico empiricamente, sem um processo formal.',
      'A empresa realiza o seu Planejamento Estratégico formalmente e com periodicidade definida.',
      'A empresa realiza seu Planejamento Estratégico colaborativamente, com periodicidade definida.',
    ),
    recomendacao: 'Implantar ciclo formal de planejamento estratégico (análise SWOT + objetivos anuais) com participação das lideranças e periodicidade definida.',
  },
  {
    id: 'est3',
    area: 'estrategia',
    numero: 3,
    enunciado: 'Como a empresa realiza seu plano de ação?',
    opcoes: opts(
      'A empresa não realiza o seu Plano de Ação.',
      'A empresa possui um plano de ação realizado empiricamente, mas não está documentado e/ou está desatualizado.',
      'A empresa possui um Plano de Ação documentado.',
      'A empresa possui um Plano de Ação elaborado colaborativamente, está documentado e compreendido por todos e é revisto periodicamente.',
    ),
    recomendacao: 'Documentar o plano de ação em formato 5W2H, atribuir responsáveis e prazos, e revisar o status em reunião mensal.',
  },
  {
    id: 'est4',
    area: 'estrategia',
    numero: 4,
    enunciado: 'A empresa possui metas específicas por áreas?',
    opcoes: opts(
      'Não, a empresa não possui.',
      'Sim, porém apenas de alguns índices.',
      'Sim, no entanto apenas para a área comercial.',
      'Sim, possui em todas as áreas.',
    ),
    recomendacao: 'Desdobrar a meta global da empresa em metas por área (comercial, financeiro, operações, RH) com indicadores mensuráveis.',
  },
  {
    id: 'est5',
    area: 'estrategia',
    numero: 5,
    enunciado: 'A empresa possui um controle do seu ponto de equilíbrio?',
    opcoes: opts(
      'A empresa não possui qualquer informação sobre o seu ponto de equilíbrio.',
      'A empresa sabe intuitivamente que há um nível mínimo de disponibilidades para pagar as contas do próximo mês.',
      'A empresa sabe qual o seu ponto de equilíbrio, mas possui dificuldades em atingi-lo.',
      'A empresa sabe seu ponto de equilíbrio e faz projeções para ultrapassá-lo.',
    ),
    recomendacao: 'Calcular o ponto de equilíbrio a partir dos custos fixos e da margem de contribuição, e acompanhá-lo mensalmente no fluxo de caixa.',
  },
  {
    id: 'est6',
    area: 'estrategia',
    numero: 6,
    enunciado: 'A empresa acompanha os resultados e possui metas estratégicas de médio e longo prazo?',
    opcoes: opts(
      'Não, a empresa não acompanha os resultados e não possui metas definidas.',
      'A empresa não traça metas estratégicas, mas faz um acompanhamento básico dos resultados.',
      'A empresa traça metas estratégicas, mas não consegue as acompanhar pois não mantém o registro dos resultados.',
      'Sim, a empresa acompanha seus resultados periodicamente e com base nos dados, traça suas metas estratégicas.',
    ),
    recomendacao: 'Criar um painel de indicadores com histórico mensal e usar os dados como base para as metas de médio e longo prazo.',
  },

  // ---------------------------- FINANÇAS ----------------------------
  {
    id: 'fin1',
    area: 'financas',
    numero: 1,
    enunciado: 'A empresa possui investimentos financeiros e capital de reserva?',
    opcoes: opts(
      'A empresa não possui reservas ou quaisquer investimentos financeiros.',
      'A empresa possui reservas em caixa, porém não aplicadas.',
      'A empresa possui reservas e as aplica para gerar renda financeira.',
      'A empresa possui reservas aplicadas com valores superiores a 6 meses de custos fixos.',
    ),
    recomendacao: 'Constituir reserva de emergência com meta de 6 meses de custo fixo, aplicada em liquidez diária.',
  },
  {
    id: 'fin2',
    area: 'financas',
    numero: 2,
    enunciado: 'A empresa possui planejamento e controle orçamentário?',
    opcoes: opts(
      'A empresa não possui qualquer planejamento ou controle orçamentário.',
      'A empresa planeja o orçamento ao início do ano e não o revisa ou não o segue durante o ano.',
      'A empresa planeja o orçamento e o segue ao longo do ano.',
      'A empresa usa o plano orçamentário como meio de reduzir gastos e aumentar o lucro.',
    ),
    recomendacao: 'Montar orçamento anual por centro de custo e acompanhar o realizado x orçado mensalmente, agindo sobre os desvios.',
  },
  {
    id: 'fin3',
    area: 'financas',
    numero: 3,
    enunciado: 'A empresa planeja pegar ou já pegou um empréstimo?',
    opcoes: opts(
      'Sim, a empresa pegou empréstimos nos últimos 12 meses, porém não conseguiu quitar suas dívidas e precisa urgentemente de um empréstimo.',
      'Sim, a empresa pegou empréstimos nos últimos 12 meses, porém não foi suficiente para quitar suas dívidas.',
      'Sim, a empresa pegou empréstimos nos últimos 12 meses, e está o pagando em dia, seu endividamento está organizado e a empresa não precisa pegar empréstimo a curto prazo.',
      'Não, a empresa não pegou empréstimos nos últimos 12 meses, está com seu endividamento organizado e se mantendo com seus próprios recursos.',
    ),
    recomendacao: 'Mapear todo o endividamento (saldo, taxa, prazo), priorizar a troca de dívidas caras por linhas mais baratas e montar plano de desalavancagem.',
  },
  {
    id: 'fin4',
    area: 'financas',
    numero: 4,
    enunciado: 'A empresa realiza a gestão do seu fluxo de caixa?',
    opcoes: opts(
      'A empresa não possui controle do seu saldo bancário.',
      'A empresa controla suas contas a pagar, a receber, acompanha saldos bancários e faturamento.',
      'A empresa possui um fluxo de caixa.',
      'A empresa possui fluxo de caixa capaz de calcular indicadores financeiros com projeções futuras.',
    ),
    recomendacao: 'Implantar fluxo de caixa diário com projeção de 90 dias e indicadores de liquidez, alimentado a partir do contas a pagar e a receber.',
  },
  {
    id: 'fin5',
    area: 'financas',
    numero: 5,
    enunciado: 'A empresa possui uma separação entre o que é dela e o que é do proprietário?',
    opcoes: opts(
      'As finanças da empresa e a do proprietário são uma só.',
      'Existe uma separação básica, mas as regras não são claras para todos.',
      'Existem regras claras de separação, mas contas pessoais ainda são pagas pela empresa (ex: moradia).',
      'Finanças separadas, há pró-labore, divisão controlada do lucro.',
    ),
    recomendacao: 'Definir pró-labore fixo para os sócios, encerrar o pagamento de despesas pessoais pela empresa e formalizar a política de distribuição de lucros.',
  },
  {
    id: 'fin6',
    area: 'financas',
    numero: 6,
    enunciado: 'A empresa possui uma política de cobrança e controla seus recebimentos de forma satisfatória?',
    opcoes: opts(
      'Não possuo e nem sei o quanto ou de quem devo receber este mês.',
      'Não possuo, mas tenho uma breve noção de quem é inadimplente e o quanto me deve, mas ainda assim tenho muitos problemas com inadimplência.',
      'Possuo uma política de cobrança, porém tenho dificuldades em converter meu faturamento em recebimentos reais.',
      'A empresa possui uma política de cobrança sólida e bem definida e tem total controle sobre seus devedores, valores a receber e controle dos índices (inadimplência dentro do mês, inadimplência 120 dias, jurídico e prejuízo).',
    ),
    recomendacao: 'Formalizar a política de cobrança com régua de contato por faixa de atraso e acompanhar os índices de inadimplência (mês, 120 dias, jurídico e prejuízo).',
  },

  // ---------------------------- MARKETING ----------------------------
  {
    id: 'mkt1',
    area: 'marketing',
    numero: 1,
    enunciado: 'A empresa possui uma identidade visual e comunica sua marca?',
    opcoes: opts(
      'A empresa não possui identidade visual.',
      'A empresa possui identidade visual feita emergencial ou amadoramente e já está desatualizada.',
      'A empresa possui identidade visual atualizada, desenvolvida por designer e passa credibilidade aos seus clientes.',
      'A empresa possui identidade visual adequada e a expõe em todos os materiais usados pela empresa.',
    ),
    recomendacao: 'Desenvolver ou atualizar o manual de identidade visual e aplicá-lo de forma padronizada em todos os pontos de contato com o cliente.',
  },
  {
    id: 'mkt2',
    area: 'marketing',
    numero: 2,
    enunciado: 'A empresa está presente na internet?',
    opcoes: opts(
      'Não está.',
      'Possui redes sociais ou site desatualizados.',
      'Possui redes sociais atualizadas periodicamente.',
      'Possui redes sociais e site atualizados periodicamente.',
    ),
    recomendacao: 'Estruturar site institucional e perfis nas redes sociais com calendário de publicação definido e responsável nomeado.',
  },
  {
    id: 'mkt3',
    area: 'marketing',
    numero: 3,
    enunciado: 'Como é a mensuração de resultados das ações de comunicação da empresa?',
    opcoes: opts(
      'A empresa não realiza monitoramento das ações de comunicação.',
      'A mensuração existe, mas somente para algumas ações (ex: número de visualizações no Facebook e Instagram).',
      'Há mensuração das ações de comunicação, mas os dados não são organizados e interpretados.',
      'A empresa mensura as ações e tem esses dados organizados e interpretados, potencializando desta forma a área comercial.',
    ),
    recomendacao: 'Definir indicadores de comunicação (alcance, leads, custo por lead, conversão) e consolidá-los em relatório mensal ligado ao resultado comercial.',
  },
  {
    id: 'mkt4',
    area: 'marketing',
    numero: 4,
    enunciado: 'Há um serviço de atendimento ao consumidor, ou uma pós-venda para coletar feedbacks?',
    opcoes: opts(
      'Não, não há nada do tipo.',
      'Sim, a empresa colhe feedback de maneira subjetiva.',
      'Sim, a empresa coleta feedback de seus clientes de maneira formal (ex: pesquisa por WhatsApp).',
      'Sim, a empresa possui um canal de atendimento, coleta feedback e utiliza essas informações para controlar sua qualidade.',
    ),
    recomendacao: 'Criar canal formal de pós-venda com pesquisa de satisfação (NPS) e rotina de tratamento das reclamações recebidas.',
  },
  {
    id: 'mkt5',
    area: 'marketing',
    numero: 5,
    enunciado: 'A empresa possui política comercial?',
    opcoes: opts(
      'Não, a empresa não possui.',
      'Sim, mas somente controlo as metas de vendas.',
      'Sim, está manualizada, mas não utilizo na prática.',
      'Sim, está manualizada e todos na empresa a compreendem.',
    ),
    recomendacao: 'Manualizar a política comercial (descontos, prazos, comissões, condições de venda) e treinar a equipe para a aplicação no dia a dia.',
  },
  {
    id: 'mkt6',
    area: 'marketing',
    numero: 6,
    enunciado: 'A empresa realiza campanhas periodicamente?',
    opcoes: opts(
      'Não, absolutamente nada.',
      'Sim, em redes sociais.',
      'Sim, em redes sociais e offline.',
      'Sim, em redes sociais, online e offline e possui um planejamento de calendário de eventos para o ano todo.',
    ),
    recomendacao: 'Montar calendário anual de campanhas contemplando datas sazonais do segmento, com orçamento e meta de retorno por ação.',
  },

  // ---------------------------- RECURSOS HUMANOS ----------------------------
  {
    id: 'rh1',
    area: 'rh',
    numero: 1,
    enunciado: 'A empresa possui um Organograma?',
    opcoes: opts(
      'Não, a empresa não possui.',
      'Sim, porém está desatualizado.',
      'Sim, porém os funcionários não o compreendem.',
      'Sim, existe um organograma e todos os funcionários compreendem.',
    ),
    recomendacao: 'Desenhar o organograma atual, validar com as lideranças, divulgar internamente e revisar a cada mudança de estrutura.',
  },
  {
    id: 'rh2',
    area: 'rh',
    numero: 2,
    enunciado: 'A empresa possui um descritivo de funções?',
    opcoes: opts(
      'Não, a empresa não possui.',
      'Sim, possui mas não está manualizado.',
      'Sim, possui e está manualizado porém não está atualizado.',
      'Sim, possui e está atualizado, manualizado e compreendido por todos os funcionários.',
    ),
    recomendacao: 'Elaborar a descrição de cargos com responsabilidades, requisitos e entregas esperadas, e entregá-la formalmente a cada colaborador.',
  },
  {
    id: 'rh3',
    area: 'rh',
    numero: 3,
    enunciado: 'Sua empresa possui processo de recrutamento e seleção dos funcionários?',
    opcoes: opts(
      'A empresa não possui processo de recrutamento e seleção.',
      'Há entrevistas com candidatos e pede-se referências a terceiros.',
      'A empresa possui um processo formal, com 1ª entrevista, 2ª entrevista, análise de perfil, verificação de referências e análise para tomada de decisão.',
    ),
    recomendacao: 'Padronizar o processo seletivo em etapas (triagem, entrevistas, análise de perfil e checagem de referências) com critérios de decisão registrados.',
  },
  {
    id: 'rh4',
    area: 'rh',
    numero: 4,
    enunciado: 'Como são feitas as avaliações de desempenho dos funcionários?',
    opcoes: opts(
      'A empresa não avalia o desempenho de seus funcionários.',
      'Há avaliação de desempenho, subjetiva, sem critérios ou periodicidade definida.',
      'Há avaliação com critérios, periodicidade definida e feedbacks construtivos aos colaboradores.',
      'Há avaliação de desempenho formal, feedbacks e cruzamento de dados.',
    ),
    recomendacao: 'Implantar avaliação de desempenho com critérios objetivos, periodicidade definida e reunião de feedback registrada.',
  },
  {
    id: 'rh5',
    area: 'rh',
    numero: 5,
    enunciado: 'Quando um funcionário novo assume um cargo ele recebe um treinamento adequado?',
    opcoes: opts(
      'Não, ele simplesmente assume a posição e se vira.',
      'Não, ele apenas recebe um treinamento organizacional, onde é apresentado à empresa e de acordo com a necessidade vai esclarecendo as dúvidas.',
      'Sim, possuímos um cronograma de treinamento e adaptação do funcionário para desempenhar sua função.',
    ),
    recomendacao: 'Criar programa de integração (onboarding) com cronograma de treinamento por função e padrinho responsável pela adaptação.',
  },
  {
    id: 'rh6',
    area: 'rh',
    numero: 6,
    enunciado: 'Existe uma política de cargos e salários definida na empresa?',
    opcoes: opts(
      'A empresa não possui política de cargos e salários.',
      'A empresa possui um manual com a descrição de cargos e salários, mas está desatualizado.',
      'Há um manual com a descrição de cargos e salários atualizado e compatível com o mercado.',
    ),
    recomendacao: 'Estruturar plano de cargos e salários com faixas salariais, critérios de promoção e pesquisa de mercado atualizada.',
  },

  // ---------------------------- OPERAÇÕES ----------------------------
  {
    id: 'ope1',
    area: 'operacoes',
    numero: 1,
    enunciado: 'A empresa faz uso de tecnologia em seus processos?',
    opcoes: opts(
      'A empresa não emprega tecnologias para melhorar seus processos.',
      'Utiliza sistema, porém apenas para emissão de notas fiscais.',
      'A empresa utiliza sistema e alimenta-o para gerar todas as informações necessárias à sua atividade.',
      'A empresa utiliza sistema gerencial, alimenta-o, gera relatórios e possui BI para geração de relatórios visuais que auxiliam na compreensão de todas as áreas e situações da empresa.',
    ),
    recomendacao: 'Consolidar as operações em um sistema de gestão alimentado diariamente e evoluir para painéis de BI que apoiem a tomada de decisão.',
  },
  {
    id: 'ope2',
    area: 'operacoes',
    numero: 2,
    enunciado: 'A empresa possui Gestores de Processos?',
    opcoes: opts(
      'Não, a empresa não possui pessoas específicas para gerenciar processos específicos.',
      'Sim, a empresa possui um gestor para gerenciar todos os processos.',
      'Sim, a empresa tem um gestor para cada grupo de processos importantes.',
    ),
    recomendacao: 'Nomear responsáveis por grupo de processos críticos, com autonomia e indicadores próprios de acompanhamento.',
  },
  {
    id: 'ope3',
    area: 'operacoes',
    numero: 3,
    enunciado: 'Sua empresa possui um Fluxograma definido?',
    opcoes: opts(
      'Não, a empresa não apresenta um Fluxograma.',
      'Sim, porém não se aplica no dia a dia.',
      'Sim, possui um fluxograma definido e em perfeita ordem com as funções que cada um desempenha dentro da empresa.',
    ),
    recomendacao: 'Mapear os processos-chave em fluxograma, validar com quem executa e transformá-lo em procedimento operacional padrão.',
  },
  {
    id: 'ope4',
    area: 'operacoes',
    numero: 4,
    enunciado: 'A empresa possui políticas de recebimentos e pagamentos?',
    opcoes: opts(
      'Não, a empresa não possui.',
      'Sim, porém não está manualizada.',
      'Sim, e está manualizada.',
      'Sim, está manualizada e todos os envolvidos a compreendem.',
    ),
    recomendacao: 'Manualizar as políticas de recebimento e pagamento (prazos, alçadas, formas aceitas) e treinar os envolvidos.',
  },
  {
    id: 'ope5',
    area: 'operacoes',
    numero: 5,
    enunciado: 'A empresa gerencia suas compras?',
    opcoes: opts(
      'A empresa não gerencia suas compras.',
      'A empresa gerencia suas compras apenas por cotação de preços com diferentes fornecedores.',
      'A empresa gerencia suas compras por cotação de preços, forma de pagamento e prazo de entrega.',
      'Gerencia-se compras com base em avaliações de preço, forma de pagamento, prazo de entrega e possui um controle de gestão, com metas, avaliando índices como markup, recebimento e estoque.',
    ),
    recomendacao: 'Formalizar o processo de compras com cotação mínima de três fornecedores e acompanhamento de markup, prazo médio e giro de estoque.',
  },
  {
    id: 'ope6',
    area: 'operacoes',
    numero: 6,
    enunciado: 'A empresa tem controle sobre seu estoque?',
    opcoes: opts(
      'A empresa não controla seu estoque.',
      'A empresa possui um inventário realizado, porém desatualizado.',
      'A empresa possui inventário realizado periodicamente.',
      'A empresa possui inventário atualizado com ponto de recompra para cada item.',
    ),
    recomendacao: 'Realizar inventário periódico, definir estoque mínimo e ponto de recompra por item e apurar as divergências mensalmente.',
  },
];

export const QUESTOES_POR_AREA = (area: AreaKey) => QUESTOES.filter(q => q.area === area);

export const TOTAL_QUESTOES = QUESTOES.length;

// ------------------------------------------------------------
// Pontuação
// ------------------------------------------------------------

export interface Nivel {
  label: string;
  cor: string;
  rgb: [number, number, number];
  descricao: string;
}

export const NIVEIS: Nivel[] = [
  {
    label: 'Crítico',
    cor: '#ef4444',
    rgb: [239, 68, 68],
    descricao: 'A área praticamente não possui estrutura formal. Risco alto e necessidade de intervenção imediata.',
  },
  {
    label: 'Inicial',
    cor: '#f59e0b',
    rgb: [245, 158, 11],
    descricao: 'Existem práticas informais e pontuais. É preciso formalizar e dar constância aos controles.',
  },
  {
    label: 'Intermediário',
    cor: '#3b82f6',
    rgb: [59, 130, 246],
    descricao: 'A área está estruturada, mas ainda não gera resultado pleno. Foco em execução e disciplina.',
  },
  {
    label: 'Consolidado',
    cor: '#10b981',
    rgb: [16, 185, 129],
    descricao: 'Práticas maduras, documentadas e utilizadas na gestão. Foco em manutenção e melhoria contínua.',
  },
];

export function nivelDe(pontuacao: number): Nivel {
  if (pontuacao < 25) return NIVEIS[0];
  if (pontuacao < 50) return NIVEIS[1];
  if (pontuacao < 75) return NIVEIS[2];
  return NIVEIS[3];
}

/** Pontuação de 0 a 100 de uma resposta, normalizada pelo nº de alternativas da questão. */
export function pontuacaoResposta(questao: Questao, letra?: Letra): number | null {
  if (!letra) return null;
  const idx = questao.opcoes.findIndex(o => o.letra === letra);
  if (idx < 0) return null;
  return (idx / (questao.opcoes.length - 1)) * 100;
}

export interface QuestaoAvaliada {
  questao: Questao;
  letra?: Letra;
  texto?: string;
  pontuacao: number | null;
}

export interface ResultadoArea {
  area: AreaDef;
  pontuacao: number;
  respondidas: number;
  total: number;
  nivel: Nivel;
  questoes: QuestaoAvaliada[];
}

export interface ResultadoDiagnostico {
  areas: ResultadoArea[];
  geral: number;
  nivelGeral: Nivel;
  respondidas: number;
  total: number;
  completo: boolean;
  /** Questões respondidas abaixo da maturidade máxima, da mais crítica para a menos crítica */
  pontosCriticos: QuestaoAvaliada[];
  /** Áreas com melhor e pior desempenho (entre as que possuem ao menos uma resposta) */
  melhorArea: ResultadoArea | null;
  piorArea: ResultadoArea | null;
}

export function calcularResultado(respostas: Record<string, Letra>): ResultadoDiagnostico {
  const areas: ResultadoArea[] = AREAS.map(area => {
    const questoes: QuestaoAvaliada[] = QUESTOES_POR_AREA(area.key).map(questao => {
      const letra = respostas[questao.id];
      const pontuacao = pontuacaoResposta(questao, letra);
      return {
        questao,
        letra,
        texto: letra ? questao.opcoes.find(o => o.letra === letra)?.texto : undefined,
        pontuacao,
      };
    });

    const respondidas = questoes.filter(q => q.pontuacao !== null);
    const pontuacao = respondidas.length
      ? respondidas.reduce((acc, q) => acc + (q.pontuacao as number), 0) / respondidas.length
      : 0;

    return {
      area,
      pontuacao,
      respondidas: respondidas.length,
      total: questoes.length,
      nivel: nivelDe(pontuacao),
      questoes,
    };
  });

  const respondidas = areas.reduce((acc, a) => acc + a.respondidas, 0);
  const areasComResposta = areas.filter(a => a.respondidas > 0);
  const geral = areasComResposta.length
    ? areasComResposta.reduce((acc, a) => acc + a.pontuacao, 0) / areasComResposta.length
    : 0;

  const pontosCriticos = areas
    .flatMap(a => a.questoes)
    .filter(q => q.pontuacao !== null && (q.pontuacao as number) < 100)
    .sort((a, b) => (a.pontuacao as number) - (b.pontuacao as number));

  const ordenadas = [...areasComResposta].sort((a, b) => b.pontuacao - a.pontuacao);

  return {
    areas,
    geral,
    nivelGeral: nivelDe(geral),
    respondidas,
    total: TOTAL_QUESTOES,
    completo: respondidas === TOTAL_QUESTOES,
    pontosCriticos,
    melhorArea: ordenadas[0] || null,
    piorArea: ordenadas.length ? ordenadas[ordenadas.length - 1] : null,
  };
}

/** Vértices de um radar de N eixos, em coordenadas absolutas. */
export function radarPontos(
  valores: number[],
  cx: number,
  cy: number,
  raio: number,
  escala = 100,
): { x: number; y: number }[] {
  const n = valores.length;
  return valores.map((v, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = (Math.max(0, Math.min(escala, v)) / escala) * raio;
    return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
  });
}

// ------------------------------------------------------------
// Persistência (localStorage, mesmo padrão do store principal)
// ------------------------------------------------------------

const STORAGE_KEY = 'cf_diagnosticos_360';

class Diagnostico360Store {
  private read(): Diagnostico360[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Diagnostico360[]) : [];
    } catch {
      return [];
    }
  }

  private write(items: Diagnostico360[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: STORAGE_KEY } }));
  }

  getAll(empresaId?: string): Diagnostico360[] {
    const items = this.read();
    return (empresaId ? items.filter(d => d.empresaId === empresaId) : items).sort((a, b) =>
      b.data.localeCompare(a.data),
    );
  }

  getById(id: string): Diagnostico360 | null {
    return this.read().find(d => d.id === id) || null;
  }

  save(diagnostico: Diagnostico360) {
    const items = this.read();
    const idx = items.findIndex(d => d.id === diagnostico.id);
    const registro = { ...diagnostico, updatedAt: new Date().toISOString() };
    if (idx >= 0) items[idx] = registro;
    else items.push(registro);
    this.write(items);
  }

  delete(id: string) {
    this.write(this.read().filter(d => d.id !== id));
  }
}

export const diagnostico360Store = new Diagnostico360Store();
