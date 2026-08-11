// pageData.tsx — Dados estáticos da Landing Page Privilege

export const services = [
  { title: 'Abertura e Legalização de Empresas', desc: 'Constituição, alteração e encerramento societário com agilidade e segurança jurídica.', icon: 'Building' },
  { title: 'Escrituração Fiscal', desc: 'Apuração de impostos (ICMS, PIS, COFINS, ISS, IPI) e entrega de obrigações acessórias.', icon: 'FileText' },
  { title: 'Folha de Pagamento', desc: 'Processamento de folha, pró-labore, férias, 13º salário e encargos sociais.', icon: 'Users' },
  { title: 'Contabilidade Consultiva', desc: 'DRE, balanço e análise de indicadores para embasar decisões estratégicas.', icon: 'TrendingUp' },
  { title: 'Imposto de Renda PF', desc: 'Declaração de IRPF completa, revisão de restituições e planejamento patrimonial.', icon: 'DollarSign' },
  { title: 'Certificação Digital', desc: 'Emissão e renovação de e-CNPJ e e-CPF para assinatura eletrônica com validade legal.', icon: 'Shield' },
  { title: 'Consultoria de Gestão', desc: 'Diagnóstico organizacional e implantação de indicadores de performance (KPIs).', icon: 'BarChart2' },
  { title: 'Consultoria Gerencial', desc: 'Estruturação de relatórios gerenciais, budget e projeções de cenário.', icon: 'PieChart' },
  { title: 'Consultoria Tributária', desc: 'Planejamento tributário e Reforma Tributária (IBS/CBS/IS) para redução legal de carga.', icon: 'Scale' },
  { title: 'BPO Financeiro', desc: 'Terceirização do financeiro: contas a pagar/receber, conciliação bancária e OFX.', icon: 'Landmark' },
];

export const cnds = [
  { label: 'CND Receita Federal & PGFN', url: 'https://solucoes.receita.fazenda.gov.br/servicos/certidaointernet/PJ/emitir' },
  { label: 'CND Previdenciária (INSS)', url: 'https://www.fazenda.gov.br/cidadao/certidoes' },
  { label: 'CND FGTS (Caixa)', url: 'https://consulta-crf.caixa.gov.br/consultacrf/main.asp' },
  { label: 'CND Débitos Estaduais (SEFAZ-PR)', url: 'https://www.fazenda.pr.gov.br/certidao' },
  { label: 'CND Trabalhista (TST)', url: 'https://www.tst.jus.br/certidao' },
  { label: 'Consulta CNPJ / CPF (RFB)', url: 'https://www.receita.fazenda.gov.br/pessoajuridica/cnpj/cnpjreva/cnpjrevainter.asp' },
];

export const integrations = [
  { name: 'Omie', color: '#FF6B35' },
  { name: 'Conta Azul', color: '#0066CC' },
  { name: 'Bling', color: '#F7941D' },
  { name: 'eSocial', color: '#1B5E20' },
  { name: 'Domínio', color: '#8c1a22' },
  { name: 'Power BI', color: '#F2C811' },
];

export const faqs = [
  {
    q: 'O que é o BPO Financeiro e como ele se integra à minha empresa?',
    a: 'BPO Financeiro é a terceirização completa do departamento financeiro: contas a pagar e receber, fluxo de caixa, conciliação bancária e relatórios gerenciais. Integramos diretamente ao seu ERP (Omie, Conta Azul, Bling) via API, garantindo dados em tempo real sem necessidade de equipe interna dedicada.',
  },
  {
    q: 'Qual é o processo para migrar a contabilidade para a Privilege?',
    a: 'O processo tem 3 etapas: (1) Diagnóstico gratuito de 30 minutos com nosso consultor; (2) Recebimento e organização de toda a documentação anterior pelo nosso time; (3) Transição fluida com acompanhamento dedicado por 90 dias. A migração não gera interrupção nas suas obrigações fiscais.',
  },
  {
    q: 'A Privilege atende Simples Nacional, Lucro Presumido e Lucro Real?',
    a: 'Sim. Atendemos todos os regimes tributários. Nossa equipe especializada em planejamento tributário avalia qual regime é mais vantajoso para o seu perfil de faturamento e atividade, podendo gerar economia de até 30% na carga tributária anual.',
  },
  {
    q: 'Como funciona o envio e recebimento de documentos fiscais?',
    a: 'Disponibilizamos um portal exclusivo para envio de documentos com criptografia de ponta a ponta. Também integramos com Google Drive, WhatsApp Business e e-mail corporativo. Emitimos alertas automáticos sobre vencimentos de guias e obrigações acessórias para que você não perca nenhum prazo.',
  },
];

export const legalDocs: Record<string, { title: string; subtitle: string; content: string }> = {
  termos: {
    title: 'Termos de Uso',
    subtitle: 'Vigência: Janeiro 2026',
    content: 'Este site é de propriedade da Privilege Contabilidade e Consultoria. O acesso e uso das informações disponibilizadas neste portal pressupõe a aceitação integral dos presentes termos. As informações aqui contidas têm caráter meramente informativo e não substituem a consulta a um profissional contábil habilitado. A Privilege reserva-se o direito de alterar estes termos a qualquer momento, mediante aviso prévio publicado neste portal.',
  },
  privacidade: {
    title: 'Política de Privacidade',
    subtitle: 'Conforme LGPD — Lei 13.709/2018',
    content: 'A Privilege Contabilidade trata seus dados pessoais conforme a Lei Geral de Proteção de Dados (LGPD). Coletamos apenas os dados necessários para prestação dos serviços contratados: nome, CNPJ, e-mail e telefone. Seus dados não são vendidos ou compartilhados com terceiros sem seu consentimento expresso. Você pode solicitar a exclusão dos seus dados a qualquer momento pelo e-mail: privacidade@privilegecontabilidade.com.br.',
  },
  lgpd: {
    title: 'Compliance LGPD',
    subtitle: 'Data Protection Officer — DPO Interno',
    content: 'Nossa organização possui DPO (Encarregado de Dados) designado, conforme exigência do art. 41 da LGPD. Mantemos registro de todas as atividades de tratamento de dados, avaliamos riscos de privacidade (DPIA) para processos críticos e treinamos nossa equipe periodicamente. Em caso de incidente de segurança, comunicaremos a ANPD e os titulares afetados no prazo legal de 72 horas.',
  },
};
