// pageData.tsx — Dados estáticos da Landing Page Privilege

export const consultoriaServices = [
  {
    title: 'BPO Financeiro Estratégico',
    desc: 'Terceirização da gestão para dados confiáveis e tomada de decisão.',
    items: ['Gestão de Contas a Pagar/Receber', 'Conciliação Diária', 'Fluxo de Caixa (DFC)']
  },
  {
    title: 'Consultoria e Planejamento Tributário',
    desc: 'Otimização da carga fiscal conforme a Reforma Tributária.',
    items: ['Diagnóstico e Enquadramento', 'Auditoria SPED', 'Planejamento Patrimonial']
  },
  {
    title: 'Controladoria e BI',
    desc: 'Estruturação de dados para direcionar a estratégia e rentabilidade.',
    items: ['DRE por Centro de Custos', 'Pricing Estratégico', 'Dashboards de KPIs']
  },
  {
    title: 'Captação de Recursos',
    desc: 'Preparação técnica para obtenção de capital e crescimento.',
    items: ['Laudos de Viabilidade', 'Linhas de Fomento/BNDES', 'Valuation e M&A']
  },
  {
    title: 'Treinamentos In-Company',
    desc: 'Capacitação prática para gestores e equipes.',
    items: ['Gestão Financeira para Líderes', 'Workshops Setoriais']
  },
  {
    title: 'Consultoria Setorial',
    desc: 'Soluções para nichos de alta complexidade.',
    items: ['Agronegócio (LCDPR)', 'Varejo e Franquias']
  },
];

export const contabilidadeServices = [
  {
    title: 'Abertura e Legalização',
    desc: 'Constituição, alteração e encerramento societário com agilidade.',
    items: ['Abertura de CNPJ', 'Alterações Contratuais', 'Certidões Negativas']
  },
  {
    title: 'Escrituração Fiscal',
    desc: 'Apuração precisa de impostos e entrega de obrigações.',
    items: ['Apuração (ICMS, PIS, COFINS)', 'Entrega de SPED', 'Gestão de Notas Fiscais']
  },
  {
    title: 'Folha de Pagamento',
    desc: 'Processamento completo de rotinas de pessoal.',
    items: ['Folha e Pró-labore', 'Férias e 13º Salário', 'Encargos Sociais']
  },
  {
    title: 'Contabilidade Consultiva',
    desc: 'Análise de balanço para decisões de curto e longo prazo.',
    items: ['Balanço Patrimonial', 'DRE Anual', 'Indicadores Estratégicos']
  },
  {
    title: 'Imposto de Renda PF',
    desc: 'Declaração completa e planejamento patrimonial.',
    items: ['Declaração IRPF', 'Revisão de Restituições', 'Planejamento Patrimonial']
  },
  {
    title: 'Certificação Digital',
    desc: 'Emissão e renovação de certificados com validade legal.',
    items: ['e-CNPJ', 'e-CPF', 'Validação Eletrônica']
  },
];

export const cnds = [
  { label: 'CND Receita Federal & PGFN', url: 'https://solucoes.receita.fazenda.gov.br/servicos/certidaointernet/PJ/emitir' },
  { label: 'CND Previdenciária (INSS)', url: 'https://www.fazenda.gov.br/cidadao/certidoes' },
  { label: 'CND FGTS (Caixa)', url: 'https://consulta-crf.caixa.gov.br/consultacrf/main.asp' },
  { label: 'CND Débitos Estaduais (SEFAZ-PR)', url: 'https://www.fazenda.pr.gov.br/certidao' },
];

export const faqs = [
  {
    q: 'O que é o BPO Financeiro?',
    a: 'BPO Financeiro é a terceirização completa do departamento financeiro, garantindo dados em tempo real para sua empresa.',
  },
  {
    q: 'Como funciona a migração contábil?',
    a: 'Realizamos um diagnóstico gratuito, organizamos a documentação anterior e garantimos uma transição sem interrupções.',
  },
  {
    q: 'Quais os regimes tributários atendidos?',
    a: 'Atendemos empresas optantes pelo Simples Nacional, Lucro Presumido e Lucro Real, garantindo conformidade e otimização fiscal.',
  },
];

export const setoresAtuacao = [
  { title: 'Farmácias e Distribuidoras', desc: 'Regimes específicos, ST e margem.' },
  { title: 'Construção Civil', desc: 'Exclusão ICMS, gestão de obras e retenções.' },
  { title: 'Agronegócio', desc: 'LCDPR, patrimonial e sucessório.' },
  { title: 'Varejo e Franquias', desc: 'BPO, DRE e controle de estoques.' }
];

export const metodologiaPassos = [
  { step: '01', title: 'Diagnóstico', desc: 'Mapeamento analítico das operações e riscos.' },
  { step: '02', title: 'Estruturação', desc: 'Planejamento tributário e processos.' },
  { step: '03', title: 'Execução', desc: 'BPO, Controladoria e Fiscal.' },
  { step: '04', title: 'Gestão', desc: 'KPIs e comitê estratégico mensal.' }
];
