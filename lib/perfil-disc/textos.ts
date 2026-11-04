// ============================================================
// PERFIL COMPORTAMENTAL — textos do relatório
// ============================================================
// Redação própria. As frases evitam marcar gênero, porque o mesmo texto serve
// para qualquer pessoa, e descrevem tendências, nunca sentenças sobre alguém.

import type { Fator, PoloJung, Valor } from './questionario';

export interface LeituraFator {
  titulo: string;
  alto: string;
  medio: string;
  baixo: string;
  sobe: string;
  desce: string;
}

export interface TextoLideranca {
  nome: string;
  resumo: string;
  fortes: readonly string[];
  cuidados: readonly string[];
}

export interface TextoFator {
  nome: string;
  foco: string;
  sintese: string;
  complemento: string;
  potencialidades: string;
  relacoes: string;
  decisao: string;
  motivacao: string;
  receios: readonly string[];
  adequacao: string;
  pressao: readonly string[];
  comunicar: readonly string[];
  leitura: LeituraFator;
  lideranca: TextoLideranca;
  acoes: readonly string[];
}

export const TEXTOS_FATOR: Record<Fator, TextoFator> = {
  D: {
    nome: 'Dominância',
    foco: 'Ação e resultado',
    sintese: 'Tende a agir rápido, assumir o controle das situações e medir o próprio trabalho pelo resultado alcançado. Encara obstáculos como algo a ser vencido e se sente à vontade para decidir mesmo com pouca informação.',
    complemento: 'Esse jeito vem acompanhado de iniciativa e vontade de chegar ao resultado sem rodeios.',
    potencialidades: 'Destrava o que está parado. Define prioridades com clareza, assume a responsabilidade pelo que decide e mantém o grupo em movimento quando o cenário fica difícil.',
    relacoes: 'Vai direto ao ponto e valoriza quem faz o mesmo. As relações tendem a ser mais objetivas do que afetivas, o que pode soar como impaciência para quem precisa de mais conversa.',
    decisao: 'Rápida e voltada ao efeito final. Aceita riscos calculados e prefere corrigir a rota depois a esperar pela informação perfeita.',
    motivacao: 'Autonomia, metas desafiadoras e espaço para decidir.',
    receios: ['Perder o controle da situação', 'Ficar sem autonomia', 'Depender de processos lentos', 'Ter a própria capacidade questionada', 'Perder uma disputa importante'],
    adequacao: 'Rende mais em frentes com metas claras e liberdade de ação: gestão, abertura de novos negócios, vendas complexas e projetos de virada.',
    pressao: ['Atropelar pessoas para chegar ao resultado', 'Decidir sem ouvir quem vai executar', 'Cobrar em tom agressivo', 'Mostrar impaciência com detalhes', 'Assumir riscos além do necessário', 'Concentrar todas as decisões'],
    comunicar: ['Comece pela conclusão e explique os motivos depois', 'Apresente opções com o impacto e o prazo de cada uma', 'Seja breve e mantenha a conversa no assunto', 'Ao discordar, use fatos e não faça rodeios'],
    leitura: {
      titulo: 'Como enfrenta problemas e desafios',
      alto: 'Parte para a ação assim que identifica o problema. Gosta de desafios, toma a frente e aceita o risco de errar para ganhar tempo.',
      medio: 'Enfrenta os problemas quando é preciso, mas avalia o contexto antes. Alterna entre tomar a frente e dividir a decisão com o grupo.',
      baixo: 'Prefere resolver os problemas em conjunto e com calma, evitando o confronto. Busca acordo antes de impor uma solução e pode demorar a assumir riscos.',
      sobe: 'O ambiente pede mais firmeza do que é natural: decisões mais rápidas, mais exposição e mais riscos do que a pessoa escolheria por conta própria.',
      desce: 'O ambiente pede menos imposição do que é natural: mais escuta, mais alinhamento e menos decisões tomadas sem consultar o grupo.',
    },
    lideranca: {
      nome: 'Diretivo',
      resumo: 'Define o rumo, cobra prazos e assume as decisões difíceis.',
      fortes: ['Dá direção clara em momentos de incerteza', 'Decide com rapidez e assume as consequências', 'Mantém o foco da equipe nas metas'],
      cuidados: ['Pode reduzir o espaço para a equipe opinar', 'Tende a cobrar mais do que reconhecer', 'A pressa pode custar o engajamento de quem precisa de contexto'],
    },
    acoes: ['Antes de decidir, pergunte a opinião de quem vai executar', 'Reserve um momento por semana para reconhecer o que foi bem feito', 'Delegue uma decisão que hoje passa sempre por você'],
  },
  I: {
    nome: 'Influência',
    foco: 'Pessoas e comunicação',
    sintese: 'Tende a se comunicar com facilidade, criar conexões rapidamente e contagiar o grupo com otimismo. Pensa em voz alta, gosta de novidade e costuma se sentir bem em ambientes movimentados.',
    complemento: 'Esse jeito vem acompanhado de facilidade para se comunicar e envolver as pessoas.',
    potencialidades: 'Aproxima pessoas, abre portas e consegue apoio para as ideias. Traz energia ao grupo e ajuda a manter o clima positivo nos momentos difíceis.',
    relacoes: 'Faz amizades com facilidade e demonstra o que sente. Gosta de reconhecimento e de conversar, e pode se abrir antes de conhecer bem as pessoas.',
    decisao: 'Intuitiva e influenciada pelas pessoas envolvidas. Costuma ser rápida, mas pode mudar conforme a última conversa.',
    motivacao: 'Reconhecimento, convivência e liberdade para se expressar.',
    receios: ['Não ter a atenção do grupo', 'Perder a aprovação das pessoas', 'Passar muito tempo sem contato com pessoas', 'Cair em rotinas sem variedade', 'Passar por uma exposição negativa'],
    adequacao: 'Rende mais em atividades de contato: relacionamento com clientes, vendas, comunicação, treinamento e articulação entre equipes.',
    pressao: ['Falar mais do que ouvir', 'Prometer além do que consegue cumprir', 'Perder prazos e detalhes', 'Evitar conversas difíceis para não desagradar', 'Decidir pela emoção do momento', 'Dispersar a atenção entre muitas frentes'],
    comunicar: ['Reserve um momento para a conversa antes de entrar no assunto', 'Dê espaço para a pessoa falar e apresentar ideias', 'Reconheça as contribuições em público', 'Combine prazos e próximos passos por escrito ao final'],
    leitura: {
      titulo: 'Como lida com as pessoas e as influencia',
      alto: 'Busca contato e convence pelo entusiasmo. Se expõe com facilidade, gosta de falar em grupo e usa o relacionamento para fazer as coisas acontecerem.',
      medio: 'Conversa com tranquilidade e se adapta ao grupo. Influencia quando conhece o assunto, sem precisar estar em evidência.',
      baixo: 'Escolhe bem com quem se abre e prefere falar quando já tem clareza do que pensa. Convence mais por fatos e argumentos do que pelo entusiasmo.',
      sobe: 'O ambiente pede mais comunicação do que é natural: mais contato, mais exposição e mais iniciativa para convencer as pessoas.',
      desce: 'O ambiente pede mais contenção do que é natural: menos conversa, mais foco e mais objetividade nas interações.',
    },
    lideranca: {
      nome: 'Inspirador',
      resumo: 'Engaja pela conversa, pelo exemplo e pelo reconhecimento.',
      fortes: ['Cria um clima de confiança e entusiasmo', 'Comunica a visão de forma que as pessoas compram a ideia', 'Reconhece as conquistas da equipe'],
      cuidados: ['Pode evitar cobranças e conversas duras', 'Tende a deixar processos e controles em segundo plano', 'O excesso de novas ideias pode dispersar o time'],
    },
    acoes: ['Termine cada reunião com responsáveis e prazos definidos', 'Treine ouvir até o fim antes de responder', 'Use uma lista simples para acompanhar o que foi prometido'],
  },
  S: {
    nome: 'Estabilidade',
    foco: 'Constância e cooperação',
    sintese: 'Tende a manter um ritmo constante, cultivar relações duradouras e dar suporte às pessoas ao redor. Prefere ambientes previsíveis e leva o trabalho até o fim sem chamar atenção para si.',
    complemento: 'Esse jeito vem acompanhado de paciência, lealdade e cuidado com o clima do grupo.',
    potencialidades: 'Traz segurança ao grupo. Escuta com atenção, sustenta o trabalho no longo prazo e costuma ser a pessoa em quem os outros confiam para fazer o que foi combinado.',
    relacoes: 'Trata as pessoas com calma e acolhimento e prefere poucos vínculos profundos. Evita conflitos e pode guardar o que incomoda em vez de dizer.',
    decisao: 'Ponderada, considera o efeito sobre as pessoas e prefere consenso. Precisa de tempo e de segurança sobre as consequências.',
    motivacao: 'Segurança, cooperação e clareza sobre o que se espera.',
    receios: ['Passar por mudanças bruscas', 'Enfrentar conflitos abertos', 'Perder a estabilidade conquistada', 'Decepcionar as pessoas próximas', 'Trabalhar sob pressão constante'],
    adequacao: 'Rende mais em atividades de continuidade: atendimento, suporte, administração, operações e funções em que a confiança se constrói ao longo do tempo.',
    pressao: ['Resistir a mudanças necessárias', 'Dizer sim quando gostaria de dizer não', 'Guardar a insatisfação até o limite', 'Adiar conversas difíceis', 'Reduzir o ritmo quando há muita cobrança', 'Colocar as necessidades dos outros sempre na frente'],
    comunicar: ['Demonstre interesse pela pessoa antes de tratar do assunto', 'Antecipe as mudanças e explique o motivo de cada uma', 'Mostre o passo a passo, não apenas o objetivo', 'Evite pressão e dê tempo para a resposta'],
    leitura: {
      titulo: 'Como dita o ritmo e a constância',
      alto: 'Mantém um ritmo estável e previsível. Conclui o que começa, prefere uma coisa de cada vez e precisa de tempo para absorver as mudanças.',
      medio: 'Equilibra constância e agilidade. Aceita mudanças quando entende o motivo e consegue alternar entre tarefas sem grande desconforto.',
      baixo: 'Gosta de variedade e de ritmo acelerado. Muda de assunto com facilidade e pode perder o interesse por rotinas longas.',
      sobe: 'O ambiente pede mais paciência do que é natural: mais constância, mais rotina e mais tempo dedicado a cada etapa.',
      desce: 'O ambiente pede mais velocidade do que é natural: mais tarefas ao mesmo tempo e menos tempo para concluir cada etapa.',
    },
    lideranca: {
      nome: 'Facilitador',
      resumo: 'Lidera pelo apoio, pela escuta e pela construção de consenso.',
      fortes: ['Cria um ambiente seguro e de confiança', 'Escuta a equipe antes de definir o caminho', 'Mantém o grupo unido e a rotina funcionando'],
      cuidados: ['Pode demorar a tomar decisões impopulares', 'Tende a evitar o confronto quando alguém não entrega', 'Pode resistir a mudanças de que a equipe precisa'],
    },
    acoes: ['Diga o que incomoda enquanto o problema ainda é pequeno', 'Defina um prazo para as decisões que costuma adiar', 'Experimente uma pequena mudança de processo por mês'],
  },
  C: {
    nome: 'Conformidade',
    foco: 'Qualidade e precisão',
    sintese: 'Tende a pensar de forma estruturada, basear-se em fatos e cuidar da qualidade do que entrega. Prefere regras claras, gosta de entender o assunto a fundo e costuma revisar antes de considerar algo pronto.',
    complemento: 'Esse jeito vem acompanhado de método, atenção aos detalhes e cuidado com a qualidade.',
    potencialidades: 'Garante que o trabalho saia certo. Identifica falhas antes que virem problema, organiza informações e produz análises que dão segurança às decisões.',
    relacoes: 'Mantém certa reserva e formalidade no início e aprofunda os vínculos com o tempo. Respeita limites e costuma falar quando já tem certeza do que vai dizer.',
    decisao: 'Criteriosa e baseada em dados. Precisa de informação suficiente, compara alternativas e, depois de decidir, muda apenas diante de bons argumentos.',
    motivacao: 'Conhecimento, padrões claros e tempo para fazer bem feito.',
    receios: ['Cometer erros', 'Receber críticas pela qualidade do trabalho', 'Decidir sem informação suficiente', 'Trabalhar sem regras definidas', 'Ter que improvisar sem preparo'],
    adequacao: 'Rende mais em atividades técnicas e de análise: finanças, qualidade, controladoria, contabilidade, tecnologia e funções em que a precisão faz diferença.',
    pressao: ['Analisar demais e demorar a agir', 'Prender-se a detalhes pouco importantes', 'Evitar delegar por receio de erro', 'Soar distante ou exigente demais', 'Resistir ao que foge do procedimento', 'Isolar-se quando há conflito'],
    comunicar: ['Prepare-se e leve dados que sustentem o que vai dizer', 'Seja específico e evite generalizações', 'Dê tempo para a pessoa analisar antes de responder', 'Ao corrigir, trate do trabalho e não da pessoa'],
    leitura: {
      titulo: 'Como lida com regras e procedimentos',
      alto: 'Valoriza regras, padrões e procedimentos. Confere o próprio trabalho, questiona o que não tem fundamento e prefere fazer certo a fazer rápido.',
      medio: 'Respeita as regras e sabe quando vale flexibilizar. Cuida da qualidade sem deixar que os detalhes travem a entrega.',
      baixo: 'Prefere liberdade a procedimentos rígidos. Trabalha com o suficiente para seguir em frente e pode deixar passar detalhes.',
      sobe: 'O ambiente pede mais rigor do que é natural: mais atenção a detalhes, mais controle e mais seguimento de procedimentos.',
      desce: 'O ambiente pede mais flexibilidade do que é natural: delegar detalhes, aceitar o bom o suficiente e arriscar mais sem tanta preparação.',
    },
    lideranca: {
      nome: 'Estruturador',
      resumo: 'Organiza processos, define padrões e acompanha a qualidade.',
      fortes: ['Conduz projetos complexos com método', 'Antecipa riscos e previne retrabalho', 'Dá clareza sobre o que é esperado de cada um'],
      cuidados: ['Pode focar mais nas falhas do que nos acertos', 'Tende a centralizar por receio de erro', 'O excesso de análise pode atrasar decisões urgentes'],
    },
    acoes: ['Defina antes o que é "bom o suficiente" para cada entrega', 'Coloque um limite de tempo nas análises', 'Delegue uma tarefa e combine como acompanhar sem refazer'],
  },
};

export const ADAPTACAO_ESTAVEL = 'O ambiente pede praticamente o mesmo que é natural neste fator, o que tende a exigir pouco esforço.';

export const TITULOS_PERFIL: Record<string, string> = {
  D: 'Foco em resultado',
  I: 'Foco em pessoas e influência',
  S: 'Foco em estabilidade e apoio',
  C: 'Foco em qualidade e precisão',
  DI: 'Resultado com persuasão',
  DS: 'Resultado com constância',
  DC: 'Resultado com rigor',
  ID: 'Influência com iniciativa',
  IS: 'Influência com acolhimento',
  IC: 'Influência com método',
  SD: 'Constância com determinação',
  SI: 'Apoio com proximidade',
  SC: 'Constância com método',
  CD: 'Rigor com determinação',
  CI: 'Rigor com boa comunicação',
  CS: 'Rigor com paciência',
  DISC: 'Perfil equilibrado',
};

export const TEXTOS_ESFORCO = {
  baixo: 'O que o ambiente pede está próximo do jeito natural. Essa combinação tende a consumir pouca energia e a ser sustentável no longo prazo.',
  moderado: 'O ambiente pede alguns ajustes em relação ao jeito natural. É um esforço comum, que costuma ser administrável.',
  alto: 'O ambiente pede um comportamento bem diferente do natural. Vale conversar sobre isso, porque manter essa diferença por muito tempo tende a gerar desgaste.',
} as const;

export interface TextoValor {
  nome: string;
  motivador: string;
  descricao: string;
  estimulo: string;
}

export const TEXTOS_VALOR: Record<Valor, TextoValor> = {
  economico: {
    nome: 'Econômico',
    motivador: 'Retorno',
    descricao: 'Avalia as escolhas pelo retorno que trazem. Pensa em custo e benefício, valoriza o uso eficiente do tempo e dos recursos e gosta de ver resultado concreto.',
    estimulo: 'Metas ligadas a ganho, remuneração variável e clareza sobre o retorno do esforço.',
  },
  politico: {
    nome: 'Político',
    motivador: 'Influência',
    descricao: 'Valoriza posição, autoridade e reconhecimento. Gosta de influenciar os rumos e costuma se interessar por crescer na organização.',
    estimulo: 'Plano de carreira, responsabilidade sobre decisões e visibilidade para as conquistas.',
  },
  tradicional: {
    nome: 'Tradicional',
    motivador: 'Princípios',
    descricao: 'Orienta-se por princípios firmes e por aquilo que já provou funcionar. Valoriza coerência, regras claras e continuidade.',
    estimulo: 'Ambiente coerente, com regras estáveis e combinados cumpridos.',
  },
  teorico: {
    nome: 'Teórico',
    motivador: 'Conhecimento',
    descricao: 'Move-se pela vontade de entender. Gosta de estudar, questionar e organizar o que aprende, e costuma buscar a explicação por trás das coisas.',
    estimulo: 'Acesso a cursos, tempo para estudar e convivência com quem domina o assunto.',
  },
  estetico: {
    nome: 'Estético',
    motivador: 'Equilíbrio',
    descricao: 'Valoriza bem-estar, equilíbrio e criatividade. Dá importância à qualidade de vida e à forma como as experiências são vividas.',
    estimulo: 'Flexibilidade, ambiente agradável e espaço para criar.',
  },
  social: {
    nome: 'Social',
    motivador: 'Contribuição',
    descricao: 'Sente satisfação em ajudar. Preocupa-se com o bem-estar dos outros e costuma dedicar tempo e energia a quem precisa.',
    estimulo: 'Trabalho com propósito claro e oportunidade de desenvolver outras pessoas.',
  },
};

export const NOMES_NIVEL_VALOR = {
  significativo: 'Significativo',
  circunstancial: 'Circunstancial',
  indiferente: 'Pouco relevante',
} as const;

export const TEXTOS_JUNG: Record<PoloJung, { nome: string; descricao: string; tracos: readonly string[] }> = {
  E: {
    nome: 'Extroversão',
    descricao: 'Tende a direcionar a atenção para fora: pessoas, conversas e acontecimentos.',
    tracos: ['Ganha energia na interação', 'Pensa enquanto fala', 'Age antes de refletir longamente'],
  },
  I: {
    nome: 'Introversão',
    descricao: 'Tende a direcionar a atenção para dentro: ideias, reflexões e impressões pessoais.',
    tracos: ['Recupera a energia com tempo para si', 'Reflete antes de falar', 'Prefere conversas em grupos pequenos'],
  },
  S: {
    nome: 'Sensação',
    descricao: 'Tende a captar informação pelo que é concreto e pode ser observado.',
    tracos: ['Observa fatos e detalhes', 'Valoriza o que é prático', 'Confia na experiência'],
  },
  N: {
    nome: 'Intuição',
    descricao: 'Tende a captar informação pelos padrões e pelas possibilidades.',
    tracos: ['Enxerga o todo antes das partes', 'Gosta de imaginar alternativas', 'Pensa mais no futuro'],
  },
  T: {
    nome: 'Pensamento',
    descricao: 'Tende a decidir pela lógica e pela análise de causa e efeito.',
    tracos: ['Busca coerência nos argumentos', 'Separa a pessoa do problema', 'Prefere critérios impessoais'],
  },
  F: {
    nome: 'Sentimento',
    descricao: 'Tende a decidir considerando os valores envolvidos e o efeito sobre as pessoas.',
    tracos: ['Considera como cada um será afetado', 'Busca harmonia nas decisões', 'Leva em conta cada situação'],
  },
};

export const TEXTOS_COMPETENCIA: Record<string, { nome: string; descricao: string }> = {
  iniciativa: { nome: 'Iniciativa', descricao: 'Agir sem esperar ser solicitado.' },
  lideranca: { nome: 'Liderança', descricao: 'Assumir a condução das situações e das pessoas.' },
  resultado: { nome: 'Foco em resultado', descricao: 'Manter a atenção no que precisa ser entregue.' },
  decisao: { nome: 'Tomada de decisão', descricao: 'Escolher um caminho com rapidez e assumir a escolha.' },
  comunicacao: { nome: 'Comunicação', descricao: 'Expressar ideias com clareza e desenvoltura.' },
  influencia: { nome: 'Influência', descricao: 'Conseguir a adesão das pessoas a uma ideia.' },
  entusiasmo: { nome: 'Entusiasmo', descricao: 'Transmitir energia e otimismo ao grupo.' },
  relacionamento: { nome: 'Relacionamento', descricao: 'Criar e manter vínculos com as pessoas.' },
  empatia: { nome: 'Empatia', descricao: 'Compreender como o outro se sente em cada situação.' },
  paciencia: { nome: 'Paciência', descricao: 'Manter a calma diante de demoras e tensões.' },
  constancia: { nome: 'Constância', descricao: 'Sustentar o ritmo até concluir o que começou.' },
  cooperacao: { nome: 'Cooperação', descricao: 'Trabalhar em conjunto e apoiar os colegas.' },
  organizacao: { nome: 'Organização', descricao: 'Manter informações e tarefas em ordem.' },
  detalhes: { nome: 'Atenção a detalhes', descricao: 'Perceber pequenas variações e possíveis erros.' },
  prudencia: { nome: 'Prudência', descricao: 'Avaliar os riscos antes de agir.' },
  analise: { nome: 'Análise crítica', descricao: 'Examinar informações e questionar o que não tem base.' },
};

export const PERGUNTAS_PLANO: readonly string[] = [
  'Quais comportamentos deste relatório mais ajudam no meu trabalho hoje?',
  'O que preciso desenvolver primeiro, e por quê?',
  'Quais ações vou colocar em prática, e a partir de quando?',
  'Como vou saber que a mudança está dando resultado?',
];

export const AVISO_METODOLOGICO =
  'Este relatório é uma autoavaliação baseada nas teorias de Marston (DISC), Jung (tipos psicológicos) e Spranger (valores). '
  + 'Ele descreve preferências e tendências de comportamento no momento da resposta, sem medir inteligência, caráter ou capacidade. '
  + 'Não é um teste psicológico nem um diagnóstico e não deve ser o único critério para contratar, promover ou desligar alguém. '
  + 'As competências são estimativas calculadas a partir dos fatores DISC.';
