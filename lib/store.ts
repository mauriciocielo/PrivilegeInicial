// ============================================================
// STORE — Gerenciamento de dados via localStorage
// ============================================================

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'consultor' | 'cliente';
  empresaIds: string[];
  avatar?: string;
  receberEmailDiario?: boolean;
  createdAt: string;
}

export interface Empresa {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  responsavel: string;
  email: string;
  telefone: string;
  receitaMensalEstimada?: number;
  comprasMensalEstimada?: number;
  createdAt: string;
}

export interface PlanoConta {
  id: string;
  codigo: string;
  descricao: string;
  tipo: 'receita' | 'despesa';
  nivel: number;
  parentId?: string;
  ativo: boolean;
  empresaId: string;
  dreCategoria?: string;
}

export interface Portador {
  id: string;
  nome: string;
  tipo: 'conta_corrente' | 'poupanca' | 'aplicacao' | 'caixa' | 'cartao' | 'outro';
  banco?: string;
  agencia?: string;
  conta?: string;
  saldoInicial: number;
  ativo: boolean;
  empresaId: string;
}

export interface Endividamento {
  id: string;
  empresaId: string;
  banco: string;
  conta: string;
  contrato: string;
  descricaoContrato?: string;
  taxa: number;
  taxaTipo?: 'am' | 'aa';
  indexador: string;
  parcela: number;
  parcelasFaltantes: number;
  valorQuitacao: number;
  valorAPagar: number;
  garantia: string;
  pagamentoMes: number;
}

export interface IndicadorMensal {
  id: string;
  empresaId: string;
  mes: string; // YYYY-MM
  faturamento: number;
  compras: number;
  inadimplencia: number;
}

export interface OrcamentoMensal {
  id: string;
  empresaId: string;
  mes: string; // YYYY-MM
  categorias: Record<string, number>; // planoContaId -> valor
}

export interface Lancamento {
  id: string;
  empresaId: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa';
  planoContaId: string;
  portadorId: string;
  status: 'previsto' | 'realizado';
  numeroDocumento?: string;
  observacao?: string;
  origem: 'manual' | 'ofx';
  ofxId?: string;
  createdAt: string;
}

// ---- Defaults ----
const DEFAULT_USERS: User[] = [
  {
    id: 'u1',
    name: 'Admin Consultor',
    email: 'consultor@sistema.com',
    password: '123456',
    role: 'consultor',
    empresaIds: ['e1', 'e2'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u2',
    name: 'João Silva',
    email: 'cliente@empresa.com',
    password: '123456',
    role: 'cliente',
    empresaIds: ['e1'],
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_EMPRESAS: Empresa[] = [
  {
    id: 'e1',
    razaoSocial: 'Tech Solutions Ltda',
    nomeFantasia: 'TechSol',
    cnpj: '12.345.678/0001-90',
    responsavel: 'João Silva',
    email: 'contato@techsol.com',
    telefone: '(11) 99999-0001',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'e2',
    razaoSocial: 'Comércio Brasil S/A',
    nomeFantasia: 'ComBrasil',
    cnpj: '98.765.432/0001-10',
    responsavel: 'Maria Santos',
    email: 'contato@combrasil.com',
    telefone: '(11) 99999-0002',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_PLANO_CONTAS: PlanoConta[] = [
  // 1. RECEITAS OPERACIONAIS
  { id: 'pc1', codigo: '1', descricao: 'RECEITAS OPERACIONAIS', tipo: 'receita', nivel: 1, ativo: true, empresaId: 'e1' },
  { id: 'pc1_1', codigo: '1.1', descricao: 'RECEITAS', tipo: 'receita', nivel: 2, parentId: 'pc1', ativo: true, empresaId: 'e1' },
  { id: 'pc1_1_1', codigo: '1.1.1.001', descricao: 'Recebimento Cheque/Dinheiro', tipo: 'receita', nivel: 3, parentId: 'pc1_1', ativo: true, empresaId: 'e1' },
  { id: 'pc1_1_2', codigo: '1.1.1.002', descricao: 'Recebimento Cartao de Credito/Debito', tipo: 'receita', nivel: 3, parentId: 'pc1_1', ativo: true, empresaId: 'e1' },
  { id: 'pc1_1_3', codigo: '1.1.1.003', descricao: 'Recebimento Pix', tipo: 'receita', nivel: 3, parentId: 'pc1_1', ativo: true, empresaId: 'e1' },
  { id: 'pc1_1_4', codigo: '1.1.1.004', descricao: 'Recebimento Antecipação', tipo: 'receita', nivel: 3, parentId: 'pc1_1', ativo: true, empresaId: 'e1' },
  { id: 'pc1_1_5', codigo: '1.1.1.005', descricao: '( - ) Estorno Antecipação', tipo: 'receita', nivel: 3, parentId: 'pc1_1', ativo: true, empresaId: 'e1' },

  // 2. CUSTOS OPERACIONAIS (VARIÁVEIS)
  { id: 'pc2', codigo: '2', descricao: 'CUSTOS OPERACIONAIS (VARIÁVEIS)', tipo: 'despesa', nivel: 1, ativo: true, empresaId: 'e1' },
  { id: 'pc2_1', codigo: '2.1', descricao: 'CUSTOS (COMPRAS)', tipo: 'despesa', nivel: 2, parentId: 'pc2', ativo: true, empresaId: 'e1' },
  { id: 'pc2_1_1', codigo: '2.1.1.001', descricao: 'Pagamento de Armação', tipo: 'despesa', nivel: 3, parentId: 'pc2_1', ativo: true, empresaId: 'e1' },
  { id: 'pc2_1_2', codigo: '2.1.1.002', descricao: 'Pagamento de Lentes', tipo: 'despesa', nivel: 3, parentId: 'pc2_1', ativo: true, empresaId: 'e1' },
  { id: 'pc2_1_3', codigo: '2.1.1.003', descricao: 'Frete S/ Compra', tipo: 'despesa', nivel: 3, parentId: 'pc2_1', ativo: true, empresaId: 'e1' },

  // 3. DESPESAS OPERACIONAIS
  { id: 'pc3', codigo: '3', descricao: 'DESPESAS OPERACIONAIS', tipo: 'despesa', nivel: 1, ativo: true, empresaId: 'e1' },
  // 3.1 DESPESAS FIXAS
  { id: 'pc3_1', codigo: '3.1', descricao: 'DESPESAS FIXAS', tipo: 'despesa', nivel: 2, parentId: 'pc3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_1', codigo: '3.1.1.001', descricao: 'Despesa Serasa/sindicomércio/', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_2', codigo: '3.1.1.002', descricao: 'Despesa Agua', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_3', codigo: '3.1.1.003', descricao: 'Despesa Telefone', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_4', codigo: '3.1.1.004', descricao: 'Despesa Softwares', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_5', codigo: '3.1.1.005', descricao: 'Despesa Associações', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_6', codigo: '3.1.1.006', descricao: 'Despesa Assessoria', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_7', codigo: '3.1.1.007', descricao: 'Despesa Combustivel', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_8', codigo: '3.1.1.008', descricao: 'Despesa Veículos', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_9', codigo: '3.1.1.009', descricao: 'Despesa Propaganda e Publicidade', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_10', codigo: '3.1.1.010', descricao: 'Despesa Material de Expediente/Limpeza', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_11', codigo: '3.1.1.011', descricao: 'Despesa Energia Eletrica', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_12', codigo: '3.1.1.012', descricao: 'Despesa Internet', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_13', codigo: '3.1.1.013', descricao: 'Despesa Seguro', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_14', codigo: '3.1.1.014', descricao: 'Despesa Honorarios Contabeis', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_15', codigo: '3.1.1.015', descricao: 'Despesa Iptu', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_16', codigo: '3.1.1.016', descricao: 'Despesa Impostos e Taxas', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_17', codigo: '3.1.1.017', descricao: 'Despesa Aluguel', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_18', codigo: '3.1.1.018', descricao: 'Despesa Brindes e Doações', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_19', codigo: '3.1.1.019', descricao: 'Despesa Frete/Uber', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_20', codigo: '3.1.1.020', descricao: 'Despesa Refeições/Viagens', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_21', codigo: '3.1.1.021', descricao: 'Despesa Vigilancia e Monitoriamento', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_22', codigo: '3.1.1.022', descricao: 'Despesa Manutenção Imobilizado', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_23', codigo: '3.1.1.023', descricao: 'Despesa Locação', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_24', codigo: '3.1.1.024', descricao: 'Despesa Uso e Consumo', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },
  { id: 'pc3_1_25', codigo: '3.1.1.025', descricao: 'Despesa com Embalagem', tipo: 'despesa', nivel: 3, parentId: 'pc3_1', ativo: true, empresaId: 'e1' },

  // 3.2 DESPESAS VARIÁVEIS
  { id: 'pc3_2', codigo: '3.2', descricao: 'DESPESAS VARIÁVEIS', tipo: 'despesa', nivel: 2, parentId: 'pc3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_2_1', codigo: '3.2.1.001', descricao: 'Despesa com Uso e Consumo', tipo: 'despesa', nivel: 3, parentId: 'pc3_2', ativo: true, empresaId: 'e1' },
  { id: 'pc3_2_2', codigo: '3.2.1.002', descricao: 'Despesa com Fretes', tipo: 'despesa', nivel: 3, parentId: 'pc3_2', ativo: true, empresaId: 'e1' },
  { id: 'pc3_2_3', codigo: '3.2.1.003', descricao: 'Despesa com Royaltes', tipo: 'despesa', nivel: 3, parentId: 'pc3_2', ativo: true, empresaId: 'e1' },

  // 3.3 DESPESAS COM IMPOSTOS
  { id: 'pc3_3', codigo: '3.3', descricao: 'DESPESAS COM IMPOSTOS', tipo: 'despesa', nivel: 2, parentId: 'pc3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_3_1', codigo: '3.3.1.001', descricao: 'DAS', tipo: 'despesa', nivel: 3, parentId: 'pc3_3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_3_2', codigo: '3.3.1.002', descricao: 'DIFAL', tipo: 'despesa', nivel: 3, parentId: 'pc3_3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_3_3', codigo: '3.3.1.003', descricao: 'ICMS ST', tipo: 'despesa', nivel: 3, parentId: 'pc3_3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_3_4', codigo: '3.3.1.004', descricao: 'PIS', tipo: 'despesa', nivel: 3, parentId: 'pc3_3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_3_5', codigo: '3.3.1.005', descricao: 'COFINS', tipo: 'despesa', nivel: 3, parentId: 'pc3_3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_3_6', codigo: '3.3.1.006', descricao: 'IRPJ', tipo: 'despesa', nivel: 3, parentId: 'pc3_3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_3_7', codigo: '3.3.1.007', descricao: 'CSLL', tipo: 'despesa', nivel: 3, parentId: 'pc3_3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_3_8', codigo: '3.3.1.008', descricao: 'ISS', tipo: 'despesa', nivel: 3, parentId: 'pc3_3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_3_9', codigo: '3.3.1.009', descricao: 'Impostos Retidos', tipo: 'despesa', nivel: 3, parentId: 'pc3_3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_3_10', codigo: '3.3.1.010', descricao: 'Assessoria Tributaria', tipo: 'despesa', nivel: 3, parentId: 'pc3_3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_3_11', codigo: '3.3.1.011', descricao: 'Impostos Parcelados', tipo: 'despesa', nivel: 3, parentId: 'pc3_3', ativo: true, empresaId: 'e1' },

  // 3.4 DESPESAS COM TERCEIRIZAÇÃO
  { id: 'pc3_4', codigo: '3.4', descricao: 'DESPESAS COM TERCEIRIZAÇÃO', tipo: 'despesa', nivel: 2, parentId: 'pc3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_4_1', codigo: '3.4.1.001', descricao: 'Despesa Prestador de Serviço', tipo: 'despesa', nivel: 3, parentId: 'pc3_4', ativo: true, empresaId: 'e1' },
  { id: 'pc3_4_2', codigo: '3.4.1.002', descricao: 'Despesa Representante', tipo: 'despesa', nivel: 3, parentId: 'pc3_4', ativo: true, empresaId: 'e1' },
  { id: 'pc3_4_3', codigo: '3.4.1.003', descricao: 'Despesa Coleta de Residuos', tipo: 'despesa', nivel: 3, parentId: 'pc3_4', ativo: true, empresaId: 'e1' },
  { id: 'pc3_4_4', codigo: '3.4.1.004', descricao: 'Despesa Zeladora', tipo: 'despesa', nivel: 3, parentId: 'pc3_4', ativo: true, empresaId: 'e1' },
  { id: 'pc3_4_5', codigo: '3.4.1.005', descricao: 'Despesa com Responsável Técnico', tipo: 'despesa', nivel: 3, parentId: 'pc3_4', ativo: true, empresaId: 'e1' },
  { id: 'pc3_4_6', codigo: '3.4.1.006', descricao: 'Despesa com Optometrista', tipo: 'despesa', nivel: 3, parentId: 'pc3_4', ativo: true, empresaId: 'e1' },

  // 3.5 DESPESAS COM PESSOAL
  { id: 'pc3_5', codigo: '3.5', descricao: 'DESPESAS COM PESSOAL', tipo: 'despesa', nivel: 2, parentId: 'pc3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_1', codigo: '3.5.1.001', descricao: 'Despesa Adto', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_2', codigo: '3.5.1.002', descricao: 'Despesa Salarios', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_3', codigo: '3.5.1.003', descricao: 'Despesa Comissao', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_4', codigo: '3.5.1.004', descricao: 'Despesa Horas Extras', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_5', codigo: '3.5.1.005', descricao: 'Despesa Bonificação', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_6', codigo: '3.5.1.006', descricao: 'Despesa 13 salario', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_7', codigo: '3.5.1.007', descricao: 'Despesa Férias Funcionários', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_8', codigo: '3.5.1.008', descricao: 'Despesa Rescisão', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_9', codigo: '3.5.1.009', descricao: 'Despesa INSS', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_10', codigo: '3.5.1.010', descricao: 'Despesa FGTS', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_11', codigo: '3.5.1.011', descricao: 'Despesa IRRF salários', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_12', codigo: '3.5.1.012', descricao: 'Despesa Medicina Ocupacional', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_13', codigo: '3.5.1.013', descricao: 'Despesa Uniformes', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_14', codigo: '3.5.1.014', descricao: 'Despesa Seguro de Vida', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_15', codigo: '3.5.1.015', descricao: 'Despesa Pro Labore', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_16', codigo: '3.5.1.016', descricao: 'Despesa Confraternização', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_17', codigo: '3.5.1.017', descricao: 'Despesa Farmacia', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_18', codigo: '3.5.1.018', descricao: 'Depesa com Treinamentos', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },
  { id: 'pc3_5_19', codigo: '3.5.1.019', descricao: 'Despesa com Sindicato', tipo: 'despesa', nivel: 3, parentId: 'pc3_5', ativo: true, empresaId: 'e1' },

  // 3.6 DESPESAS BANCÁRIAS
  { id: 'pc3_6', codigo: '3.6', descricao: 'DESPESAS BANCÁRIAS', tipo: 'despesa', nivel: 2, parentId: 'pc3', ativo: true, empresaId: 'e1' },
  { id: 'pc3_6_1', codigo: '3.6.1.001', descricao: 'Tarifa Bancária', tipo: 'despesa', nivel: 3, parentId: 'pc3_6', ativo: true, empresaId: 'e1' },
  { id: 'pc3_6_2', codigo: '3.6.1.002', descricao: 'Tarifa Cobrança/Pix/Ted/Doc', tipo: 'despesa', nivel: 3, parentId: 'pc3_6', ativo: true, empresaId: 'e1' },
  { id: 'pc3_6_3', codigo: '3.6.1.003', descricao: 'Juros Antecipação', tipo: 'despesa', nivel: 3, parentId: 'pc3_6', ativo: true, empresaId: 'e1' },
  { id: 'pc3_6_4', codigo: '3.6.1.004', descricao: 'Juros Limite', tipo: 'despesa', nivel: 3, parentId: 'pc3_6', ativo: true, empresaId: 'e1' },
  { id: 'pc3_6_5', codigo: '3.6.1.005', descricao: 'Juros pagos a Fornecedores', tipo: 'despesa', nivel: 3, parentId: 'pc3_6', ativo: true, empresaId: 'e1' },
  { id: 'pc3_6_6', codigo: '3.6.1.006', descricao: 'Taxa Cartão Crédito/Débito', tipo: 'despesa', nivel: 3, parentId: 'pc3_6', ativo: true, empresaId: 'e1' },
  { id: 'pc3_6_7', codigo: '3.6.1.007', descricao: 'Despesa Sustação', tipo: 'despesa', nivel: 3, parentId: 'pc3_6', ativo: true, empresaId: 'e1' },
  { id: 'pc3_6_8', codigo: '3.6.1.008', descricao: 'Juro Rotativo', tipo: 'despesa', nivel: 3, parentId: 'pc3_6', ativo: true, empresaId: 'e1' },
  { id: 'pc3_6_9', codigo: '3.6.1.009', descricao: 'IOF', tipo: 'despesa', nivel: 3, parentId: 'pc3_6', ativo: true, empresaId: 'e1' },
  { id: 'pc3_6_10', codigo: '3.6.1.010', descricao: 'Seguro Prestamista', tipo: 'despesa', nivel: 3, parentId: 'pc3_6', ativo: true, empresaId: 'e1' },
  { id: 'pc3_6_11', codigo: '3.6.1.011', descricao: 'Imposto de Renda Aplicacao Financeira', tipo: 'despesa', nivel: 3, parentId: 'pc3_6', ativo: true, empresaId: 'e1' },

  // 4. ATIVIDADE DE FINANCIAMENTO
  { id: 'pc4', codigo: '4', descricao: 'ATIVIDADE DE FINANCIAMENTO', tipo: 'despesa', nivel: 1, ativo: true, empresaId: 'e1' },
  { id: 'pc4_1', codigo: '4.1', descricao: 'LIBERAÇÕES (ENTRADAS)', tipo: 'receita', nivel: 2, parentId: 'pc4', ativo: true, empresaId: 'e1' },
  { id: 'pc4_1_1', codigo: '4.1.1.001', descricao: 'Emprestimo Obtido Bancários', tipo: 'receita', nivel: 3, parentId: 'pc4_1', ativo: true, empresaId: 'e1' },
  { id: 'pc4_1_2', codigo: '4.1.1.002', descricao: 'Emprestimo Obtido Terceiros', tipo: 'receita', nivel: 3, parentId: 'pc4_1', ativo: true, empresaId: 'e1' },

  { id: 'pc4_2', codigo: '4.2', descricao: 'PAGAMENTOS PARCELAS / EMPRÉSTIMOS (SAÍDAS)', tipo: 'despesa', nivel: 2, parentId: 'pc4', ativo: true, empresaId: 'e1' },
  { id: 'pc4_2_1', codigo: '4.2.1.001', descricao: 'Cresol - Contrato 500100320250943198', tipo: 'despesa', nivel: 3, parentId: 'pc4_2', ativo: true, empresaId: 'e1' },
  { id: 'pc4_2_2', codigo: '4.2.1.002', descricao: 'Cresol - Contrato 500100320240839225', tipo: 'despesa', nivel: 3, parentId: 'pc4_2', ativo: true, empresaId: 'e1' },
  { id: 'pc4_2_3', codigo: '4.2.1.003', descricao: 'Cresol - Contrato 500100320250051273', tipo: 'despesa', nivel: 3, parentId: 'pc4_2', ativo: true, empresaId: 'e1' },
  { id: 'pc4_2_4', codigo: '4.2.1.004', descricao: 'Cresol - Contrato 500100320250942612', tipo: 'despesa', nivel: 3, parentId: 'pc4_2', ativo: true, empresaId: 'e1' },
  { id: 'pc4_2_5', codigo: '4.2.1.005', descricao: 'Consórcio - Contemplado', tipo: 'despesa', nivel: 3, parentId: 'pc4_2', ativo: true, empresaId: 'e1' },
  { id: 'pc4_2_6', codigo: '4.2.1.006', descricao: 'Sicredi - Contrato C51831658', tipo: 'despesa', nivel: 3, parentId: 'pc4_2', ativo: true, empresaId: 'e1' },

  // 5. ATIVIDADE DE INVESTIMENTO
  { id: 'pc5_inv', codigo: '5', descricao: 'ATIVIDADE DE INVESTIMENTO', tipo: 'despesa', nivel: 1, ativo: true, empresaId: 'e1' },
  { id: 'pc5_1', codigo: '5.1', descricao: 'INVESTIMENTOS / IMOBILIZADO', tipo: 'despesa', nivel: 2, parentId: 'pc5_inv', ativo: true, empresaId: 'e1' },
  { id: 'pc5_1_1', codigo: '5.1.1.001', descricao: 'Capitalização Sicoob', tipo: 'despesa', nivel: 3, parentId: 'pc5_1', ativo: true, empresaId: 'e1' },
  { id: 'pc5_1_2', codigo: '5.1.1.002', descricao: 'Capitalização Cresol', tipo: 'despesa', nivel: 3, parentId: 'pc5_1', ativo: true, empresaId: 'e1' },
  { id: 'pc5_1_3', codigo: '5.1.1.003', descricao: 'Capitalização Santander', tipo: 'despesa', nivel: 3, parentId: 'pc5_1', ativo: true, empresaId: 'e1' },
  { id: 'pc5_1_4', codigo: '5.1.1.004', descricao: 'Consorcio', tipo: 'despesa', nivel: 3, parentId: 'pc5_1', ativo: true, empresaId: 'e1' },
  { id: 'pc5_1_5', codigo: '5.1.1.005', descricao: 'Imobilizado', tipo: 'despesa', nivel: 3, parentId: 'pc5_1', ativo: true, empresaId: 'e1' },
  { id: 'pc5_1_6', codigo: '5.1.1.006', descricao: 'Pagamento da Franquia', tipo: 'despesa', nivel: 3, parentId: 'pc5_1', ativo: true, empresaId: 'e1' },
  { id: 'pc5_1_7', codigo: '5.1.1.007', descricao: 'Pagamento de Coligadas', tipo: 'despesa', nivel: 3, parentId: 'pc5_1', ativo: true, empresaId: 'e1' },
  { id: 'pc5_1_8', codigo: '5.1.1.008', descricao: 'Quota Capital', tipo: 'despesa', nivel: 3, parentId: 'pc5_1', ativo: true, empresaId: 'e1' },
];

const DEFAULT_PORTADORES: Portador[] = [
  { id: 'p1', nome: 'Caixa Geral', tipo: 'caixa', saldoInicial: 5000, ativo: true, empresaId: 'e1' },
  { id: 'p2', nome: 'Banco do Brasil CC', tipo: 'conta_corrente', banco: 'Banco do Brasil', agencia: '1234-5', conta: '00001-2', saldoInicial: 50000, ativo: true, empresaId: 'e1' },
  { id: 'p3', nome: 'Itaú Poupança', tipo: 'poupanca', banco: 'Itaú', agencia: '5678-9', conta: '00002-3', saldoInicial: 20000, ativo: true, empresaId: 'e1' },
  { id: 'p4', nome: 'Cartão Corporativo', tipo: 'cartao', saldoInicial: 0, ativo: true, empresaId: 'e1' },
];

function gerarLancamentos(): Lancamento[] {
  const lancamentos: Lancamento[] = [];
  const hoje = new Date();
  
  const receitas = [
    { desc: 'Recebimento Pix - Venda Óculos', valor: 450, planoId: 'pc1_1_3' },
    { desc: 'Recebimento Cartão de Crédito - Parcelas', valor: 8500, planoId: 'pc1_1_2' },
    { desc: 'Recebimento Cheque - Venda Balcão', valor: 1200, planoId: 'pc1_1_1' },
    { desc: 'Recebimento Pix - Consulta Opto', valor: 250, planoId: 'pc1_1_3' },
  ];
  
  const despesas = [
    { desc: 'Pagamento Lentes Essilor', valor: 3500, planoId: 'pc2_1_2' },
    { desc: 'Aluguel Loja Central', valor: 2500, planoId: 'pc3_1_17' },
    { desc: 'Energia Elétrica Copel', valor: 780, planoId: 'pc3_1_11' },
    { desc: 'Internet Fibra', valor: 150, planoId: 'pc3_1_12' },
    { desc: 'Imposto DAS Simples', valor: 1400, planoId: 'pc3_3_1' },
    { desc: 'Honorários Contabilidade', valor: 600, planoId: 'pc3_1_14' },
    { desc: 'Salário Atendente Loja', valor: 2100, planoId: 'pc3_5_2' },
    { desc: 'Pró-Labore Diretores', valor: 5000, planoId: 'pc3_5_15' },
    { desc: 'Tarifa Bancária Cresol', valor: 45, planoId: 'pc3_6_1' },
  ];

  let id = 1;
  for (let m = 5; m >= 0; m--) {
    const mes = new Date(hoje.getFullYear(), hoje.getMonth() - m, 1);
    receitas.forEach((r) => {
      const dia = Math.floor(Math.random() * 20) + 1;
      lancamentos.push({
        id: `l${id++}`,
        empresaId: 'e1',
        data: new Date(mes.getFullYear(), mes.getMonth(), dia).toISOString().split('T')[0],
        descricao: r.desc,
        valor: r.valor + Math.floor(Math.random() * 200 - 100),
        tipo: 'receita',
        planoContaId: r.planoId,
        portadorId: Math.random() > 0.5 ? 'p2' : 'p1',
        status: m > 0 ? 'realizado' : (Math.random() > 0.5 ? 'realizado' : 'previsto'),
        origem: 'manual',
        createdAt: new Date().toISOString(),
      });
    });
    despesas.forEach((d) => {
      const dia = Math.floor(Math.random() * 25) + 1;
      lancamentos.push({
        id: `l${id++}`,
        empresaId: 'e1',
        data: new Date(mes.getFullYear(), mes.getMonth(), dia).toISOString().split('T')[0],
        descricao: d.desc,
        valor: d.valor + Math.floor(Math.random() * 100 - 50),
        tipo: 'despesa',
        planoContaId: d.planoId,
        portadorId: Math.random() > 0.7 ? 'p2' : 'p1',
        status: m > 0 ? 'realizado' : (Math.random() > 0.3 ? 'realizado' : 'previsto'),
        origem: 'manual',
        createdAt: new Date().toISOString(),
      });
    });
  }
  return lancamentos;
}

// ---- Store Class ----
class DataStore {
  private get<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  }

  private set(key: string, value: unknown) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  }

  private init() {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('cf_initialized_v3')) {
      this.set('cf_users', DEFAULT_USERS);
      this.set('cf_empresas', DEFAULT_EMPRESAS);
      this.set('cf_plano_contas', DEFAULT_PLANO_CONTAS);
      this.set('cf_portadores', DEFAULT_PORTADORES);
      this.set('cf_lancamentos', gerarLancamentos());
      this.set('cf_initialized_v3', true);
    }
  }

  // Auth
  login(email: string, password: string): User | null {
    this.init();
    const users = this.getUsers();
    return users.find(u => u.email === email && u.password === password) || null;
  }

  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem('cf_current_user');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  setCurrentUser(user: User | null) {
    if (typeof window === 'undefined') return;
    if (user) sessionStorage.setItem('cf_current_user', JSON.stringify(user));
    else sessionStorage.removeItem('cf_current_user');
  }

  // Users
  getUsers(): User[] { this.init(); return this.get<User[]>('cf_users', DEFAULT_USERS); }
  saveUser(user: User) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    this.set('cf_users', users);
  }
  deleteUser(id: string) {
    this.set('cf_users', this.getUsers().filter(u => u.id !== id));
  }

  // Empresas
  getEmpresas(): Empresa[] { this.init(); return this.get<Empresa[]>('cf_empresas', DEFAULT_EMPRESAS); }
  saveEmpresa(empresa: Empresa) {
    const list = this.getEmpresas();
    const idx = list.findIndex(e => e.id === empresa.id);
    const isNew = idx < 0;
    if (idx >= 0) list[idx] = empresa; else list.push(empresa);
    this.set('cf_empresas', list);

    if (isNew) {
      const idMap: Record<string, string> = {};
      const newPcs = DEFAULT_PLANO_CONTAS.map(p => {
        const newId = 'pc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        idMap[p.id] = newId;
        return {
          ...p,
          id: newId,
          empresaId: empresa.id
        };
      });

      newPcs.forEach(p => {
        if (p.parentId && idMap[p.parentId]) {
          p.parentId = idMap[p.parentId];
        }
      });

      const currentPcs = this.getPlanoContas();
      currentPcs.push(...newPcs);
      this.set('cf_plano_contas', currentPcs);
    }
  }
  deleteEmpresa(id: string) {
    this.set('cf_empresas', this.getEmpresas().filter(e => e.id !== id));
  }

  // Plano de Contas
  getPlanoContas(empresaId?: string): PlanoConta[] {
    this.init();
    const all = this.get<PlanoConta[]>('cf_plano_contas', DEFAULT_PLANO_CONTAS);
    return empresaId ? all.filter(p => p.empresaId === empresaId) : all;
  }
  savePlanoConta(pc: PlanoConta) {
    const list = this.getPlanoContas();
    const idx = list.findIndex(p => p.id === pc.id);
    if (idx >= 0) list[idx] = pc; else list.push(pc);
    this.set('cf_plano_contas', list);
  }
  deletePlanoConta(id: string) {
    this.set('cf_plano_contas', this.getPlanoContas().filter(p => p.id !== id));
  }

  // Portadores
  getPortadores(empresaId?: string): Portador[] {
    this.init();
    const all = this.get<Portador[]>('cf_portadores', DEFAULT_PORTADORES);
    return empresaId ? all.filter(p => p.empresaId === empresaId) : all;
  }
  savePortador(portador: Portador) {
    const list = this.getPortadores();
    const idx = list.findIndex(p => p.id === portador.id);
    if (idx >= 0) list[idx] = portador; else list.push(portador);
    this.set('cf_portadores', list);
  }
  deletePortador(id: string) {
    this.set('cf_portadores', this.getPortadores().filter(p => p.id !== id));
  }

  // Lançamentos
  getLancamentos(empresaId?: string): Lancamento[] {
    this.init();
    const all = this.get<Lancamento[]>('cf_lancamentos', []);
    return empresaId ? all.filter(l => l.empresaId === empresaId) : all;
  }
  saveLancamento(lancamento: Lancamento) {
    const list = this.getLancamentos();
    const idx = list.findIndex(l => l.id === lancamento.id);
    if (idx >= 0) list[idx] = lancamento; else list.push(lancamento);
    this.set('cf_lancamentos', list);
  }
  deleteLancamento(id: string) {
    this.set('cf_lancamentos', this.getLancamentos().filter(l => l.id !== id));
  }

  // Endividamento
  getEndividamentos(empresaId?: string): Endividamento[] {
    this.init();
    const all = this.get<Endividamento[]>('cf_endividamentos', []);
    return empresaId ? all.filter(l => l.empresaId === empresaId) : all;
  }
  saveEndividamento(endividamento: Endividamento) {
    const list = this.getEndividamentos();
    const idx = list.findIndex(l => l.id === endividamento.id);
    if (idx >= 0) list[idx] = endividamento; else list.push(endividamento);
    this.set('cf_endividamentos', list);
  }
  deleteEndividamento(id: string) {
    this.set('cf_endividamentos', this.getEndividamentos().filter(l => l.id !== id));
  }

  // Indicadores Mensais
  getIndicadores(empresaId?: string): IndicadorMensal[] {
    this.init();
    const all = this.get<IndicadorMensal[]>('cf_indicadores', []);
    return empresaId ? all.filter(l => l.empresaId === empresaId) : all;
  }
  saveIndicador(indicador: IndicadorMensal) {
    const list = this.getIndicadores();
    const idx = list.findIndex(l => l.id === indicador.id);
    if (idx >= 0) list[idx] = indicador; else list.push(indicador);
    this.set('cf_indicadores', list);
  }
  deleteIndicador(id: string) {
    this.set('cf_indicadores', this.getIndicadores().filter(l => l.id !== id));
  }

  // Orçamentos
  getOrcamentos(empresaId?: string): OrcamentoMensal[] {
    this.init();
    const all = this.get<OrcamentoMensal[]>('cf_orcamentos', []);
    return empresaId ? all.filter(l => l.empresaId === empresaId) : all;
  }
  saveOrcamento(orcamento: OrcamentoMensal) {
    const list = this.getOrcamentos();
    const idx = list.findIndex(l => l.id === orcamento.id);
    if (idx >= 0) list[idx] = orcamento; else list.push(orcamento);
    this.set('cf_orcamentos', list);
  }
  deleteOrcamento(id: string) {
    this.set('cf_orcamentos', this.getOrcamentos().filter(l => l.id !== id));
  }

  // Helpers
  getSaldoPortador(portadorId: string, empresaId: string): number {
    const portador = this.getPortadores().find(p => p.id === portadorId);
    if (!portador) return 0;
    const lancamentos = this.getLancamentos(empresaId).filter(
      l => l.portadorId === portadorId && l.status === 'realizado'
    );
    const total = lancamentos.reduce((acc, l) => {
      return l.tipo === 'receita' ? acc + l.valor : acc - l.valor;
    }, portador.saldoInicial);
    return total;
  }

  getResumoMensal(empresaId: string, meses = 6) {
    const hoje = new Date();
    return Array.from({ length: meses }, (_, i) => {
      const mes = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1 - i), 1);
      const lancamentos = this.getLancamentos(empresaId).filter(l => {
        const d = new Date(l.data);
        return d.getFullYear() === mes.getFullYear() && d.getMonth() === mes.getMonth() && l.status === 'realizado';
      });
      const receitas = lancamentos.filter(l => l.tipo === 'receita').reduce((a, l) => a + l.valor, 0);
      const despesas = lancamentos.filter(l => l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0);
      return {
        mes: mes.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
        receitas,
        despesas,
        saldo: receitas - despesas,
      };
    });
  }
}

export const store = new DataStore();
export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
