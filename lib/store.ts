// ============================================================
// STORE — Gerenciamento de dados via localStorage
// ============================================================

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'administrador' | 'consultor' | 'cliente';
  empresaIds: string[];
  avatar?: string;
  avatarData?: string;
  receberEmailDiario?: boolean;
  phone?: string;
  allowedRoutes?: string[];
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
  atividade?: 'Comércio' | 'Serviço' | 'Indústria';
  tipo?: 'empresa' | 'condominio';
  taxaMensalPadrao?: number;
  fundoReservaPct?: number;
  dataInicioContrato?: string;
  grupoEconomico?: string;
  receitaMensalEstimada?: number;
  comprasMensalEstimada?: number;
  logoData?: string;
  bancoBoleto?: 'nenhum' | 'c6';
  allowedRoutes?: string[];
  fechamentoData?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  empresaId: string;
  timestamp: string;
  userName: string;
  action: string;
  details: string;
}

export interface Unidade {
  id: string;
  condominioId: string;
  identificacao: string;
  proprietario: string;
  proprietarioCpf?: string;
  fracaoIdeal: number;
  email: string;
  telefone: string;
  moradorNome?: string;
  moradorCpf?: string;
  moradorEmail?: string;
  moradorTelefone?: string;
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
  saldoInicialData?: string;
  ativo: boolean;
  empresaId: string;
}

export interface PagamentoEndividamento {
  id: string;
  data: string;
  valorTotal: number;
  valorJuros: number;
  valorAmortizacao: number;
}

export interface Endividamento {
  id: string;
  empresaId: string;
  tipo: 'bancario' | 'tributario';
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
  pagamentos?: PagamentoEndividamento[];
}

export interface AtaAtendimento {
  id: string;
  empresaId: string;
  consultorId: string;
  data: string;
  titulo: string;
  conteudo: string;
  participantes: string;
  createdAt: string;
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
  unidadeId?: string;
  clienteId?: string; // Vincula ao Cliente/Fornecedor cadastrado
  createdAt: string;
  attachmentName?: string;
  attachmentData?: string; // Conteúdo em Base64
}

export interface Cliente {
  id: string;
  empresaId: string;
  tipo: 'cliente' | 'fornecedor' | 'ambos';
  nome: string;
  nomeFantasia?: string;
  cpfCnpj: string;
  email?: string;
  telefone?: string;
  celular?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  contato?: string; // Nome do responsável / contato
  observacao?: string;
  limiteCredito?: number;
  ativo: boolean;
  createdAt: string;
}

export interface NfsE {
  id: string;
  empresaId: string;
  // Numeração
  numero: string;              // Número da NFS-e (gerado localmente)
  serie: string;               // Série (default '1')
  codigoVerificacao?: string;  // Código de verificação retornado pela prefeitura
  // Status
  status: 'rascunho' | 'emitida' | 'cancelada';
  motivoCancelamento?: string;
  // Prestador (empresa emissora)
  prestadorCnpj: string;
  prestadorRazaoSocial: string;
  prestadorInscricaoMunicipal?: string;
  prestadorEndereco?: string;
  prestadorCidade?: string;
  prestadorUf?: string;
  prestadorCep?: string;
  // Tomador (cliente)
  clienteId?: string;
  tomadorCnpjCpf: string;
  tomadorRazaoSocial: string;
  tomadorEmail?: string;
  tomadorEndereco?: string;
  tomadorCidade?: string;
  tomadorUf?: string;
  tomadorCep?: string;
  tomadorInscricaoMunicipal?: string;
  // Serviço
  dataEmissao: string;         // YYYY-MM-DD
  dataCompetencia: string;     // YYYY-MM (mês de competência)
  codigoServico: string;       // Lista de Serviços (LC116)
  cnae?: string;
  discriminacao: string;       // Descrição detalhada do serviço
  municipioPrestacao?: string;
  // Valores
  valorServicos: number;
  valorDeducoes: number;
  valorPis: number;
  valorCofins: number;
  valorInss: number;
  valorIr: number;
  valorCsll: number;
  issRetido: boolean;
  valorIss: number;
  aliquotaIss: number;         // % ISS
  valorBaseCalculo: number;
  valorLiquido: number;
  // Vínculo financeiro
  lancamentoId?: string;       // ID do lançamento (Conta a Receber) gerado
  portadorId?: string;
  planoContaId?: string;
  vencimento?: string;         // Data de vencimento da conta a receber
  // Controle
  createdAt: string;
  updatedAt?: string;
}

export interface TransactionPattern {
  id: string;
  empresaId: string;
  pattern: string; // Parte do texto do histórico
  categoryId: string; // ID da categoria a ser aplicada
}

export interface SituacaoFiscal {
  id: string;
  empresaId: string;
  dataVerificacao: string;
  status: 'regular' | 'pendencia' | 'atencao';
  observacoes: string;
}

// ---- Defaults ----
const STORAGE_VERSION_KEY = 'cf_storage_version';
const STORAGE_VERSION = '7';

const DEFAULT_USERS: User[] = [
  {
    id: 'u1',
    name: 'Admin Consultor',
    email: 'consultor@sistema.com',
    password: '123456',
    role: 'administrador',
    empresaIds: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u_privilege',
    name: 'Privilege Consultoria',
    email: 'consultoria@privilegecontabilidade.com.br',
    password: '145236',
    role: 'administrador',
    empresaIds: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u2',
    name: 'João Silva',
    email: 'cliente@empresa.com',
    password: '123456',
    role: 'cliente',
    empresaIds: [],
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_EMPRESAS: Empresa[] = [
  {
    id: 'emp_demo',
    razaoSocial: 'PRIVILEGE BPO & SERVICOS FINANCEIROS LTDA',
    nomeFantasia: 'Privilege BPO',
    cnpj: '12.345.678/0001-90',
    responsavel: 'Maurício Cielo',
    email: 'bpo@privilege.com',
    telefone: '(54) 99999-9999',
    atividade: 'Serviço',
    tipo: 'empresa',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'condo_demo',
    razaoSocial: 'CONDOMINIO RESIDENCIAL PRIVILEGE',
    nomeFantasia: 'Residencial Privilege',
    cnpj: '98.765.432/0001-10',
    responsavel: 'Síndico João Silva',
    email: 'condominio@privilege.com',
    telefone: '(54) 88888-8888',
    atividade: 'Serviço',
    tipo: 'condominio',
    taxaMensalPadrao: 350.00,
    fundoReservaPct: 10,
    createdAt: new Date().toISOString(),
  }
];

const DEFAULT_PLANO_CONTAS: PlanoConta[] = [
  // 1. RECEITAS OPERACIONAIS
  { id: 'pc1', codigo: '1', descricao: 'RECEITAS OPERACIONAIS', tipo: 'receita', nivel: 1, ativo: true, empresaId: 'e1' },
  { id: 'pc1_1', codigo: '1.1', descricao: 'RECEITAS', tipo: 'receita', nivel: 2, parentId: 'pc1', ativo: true, empresaId: 'e1' },
  { id: 'pc1_1_1', codigo: '1.1.1.001', descricao: 'Recebimento Cheque/Dinheiro', tipo: 'receita', nivel: 3, parentId: 'pc1_1', ativo: true, empresaId: 'e1' },
  { id: 'pc1_1_2', codigo: '1.1.1.002', descricao: 'Recebimento Cartao de Credito/Debito', tipo: 'receita', nivel: 3, parentId: 'pc1_1', ativo: true, empresaId: 'e1' },
  { id: 'pc1_1_3', codigo: '1.1.1.003', descricao: 'Recebimento Pix', tipo: 'receita', nivel: 3, parentId: 'pc1_1', ativo: true, empresaId: 'e1' },
  { id: 'pc1_1_4', codigo: '1.1.1.004', descricao: 'Recebimento Antecipação', tipo: 'receita', nivel: 3, parentId: 'pc1_1', ativo: true, empresaId: 'e1' },
  { id: 'pc1_1_5', codigo: '1.1.1.005', descricao: '( - ) Estorno de Recebimento', tipo: 'receita', nivel: 3, parentId: 'pc1_1', ativo: true, empresaId: 'e1' },

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
  { id: 'p1', nome: 'Caixa Geral', tipo: 'caixa', saldoInicial: 5000, saldoInicialData: '2023-01-01', ativo: true, empresaId: 'e1' },
  { id: 'p2', nome: 'Banco do Brasil CC', tipo: 'conta_corrente', banco: 'Banco do Brasil', agencia: '1234-5', conta: '00001-2', saldoInicial: 50000, saldoInicialData: '2023-01-01', ativo: true, empresaId: 'e1' },
  { id: 'p3', nome: 'Itaú Poupança', tipo: 'poupanca', banco: 'Itaú', agencia: '5678-9', conta: '00002-3', saldoInicial: 20000, saldoInicialData: '2023-01-01', ativo: true, empresaId: 'e1' },
  { id: 'p4', nome: 'Cartão Corporativo', tipo: 'cartao', saldoInicial: 0, saldoInicialData: '2023-01-01', ativo: true, empresaId: 'e1' },
];

function gerarLancamentos(): Lancamento[] {
  return [];
}
// ---- Store Class ----
type StoredRecord = { id: string };

class DataStore {
  private initialized = false;
  private cache: Record<string, unknown> = {};

  private get<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    if (key in this.cache) {
      return this.cache[key] as T;
    }
    const raw = localStorage.getItem(key);
    if (!raw) {
      this.cache[key] = fallback;
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw) as T;
      this.cache[key] = parsed;
      return parsed;
    } catch {
      this.cache[key] = fallback;
      return fallback;
    }
  }

  private set(key: string, value: unknown, silent = false) {
    if (typeof window === 'undefined') return;
    this.cache[key] = value;
    localStorage.setItem(key, JSON.stringify(value));
    if (!silent) window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key } }));
  }

  private init() {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    // Remove legacy seeded default companies (e1/TechSol, e2/ComBrasil) if they exist
    const empresasRaw = localStorage.getItem('cf_empresas');
    if (empresasRaw) {
      try {
        const empresas = JSON.parse(empresasRaw) as Empresa[];
        const filteredEmpresas = empresas.filter(e => e.id !== 'e1' && e.id !== 'e2');
        if (empresas.length !== filteredEmpresas.length) {
          localStorage.setItem('cf_empresas', JSON.stringify(filteredEmpresas));

          const cleanCollection = (key: string, filterFn: (item: any) => boolean) => {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  localStorage.setItem(key, JSON.stringify(parsed.filter(filterFn)));
                }
              } catch {}
            }
          };

          cleanCollection('cf_lancamentos', l => l.empresaId !== 'e1' && l.empresaId !== 'e2');
          cleanCollection('cf_portadores', p => p.empresaId !== 'e1' && p.empresaId !== 'e2');
          cleanCollection('cf_plano_contas', pc => pc.empresaId !== 'e1' && pc.empresaId !== 'e2');
          cleanCollection('cf_endividamentos', e => e.empresaId !== 'e1' && e.empresaId !== 'e2');

          const saved = sessionStorage.getItem('cf_empresa_sel');
          if (saved === 'e1' || saved === 'e2') {
            sessionStorage.removeItem('cf_empresa_sel');
          }
        }
      } catch {}
    }

    const hasAnyData = [
      'cf_users',
      'cf_empresas',
      'cf_plano_contas',
      'cf_portadores',
      'cf_lancamentos',
    ].some(key => localStorage.getItem(key));

    if (!hasAnyData) {
      this.seedDatabase();
      return;
    }

    this.ensureRequiredCollections();

    if (localStorage.getItem(STORAGE_VERSION_KEY) !== STORAGE_VERSION) {
      this.migrateDatabase();
    }
  }

  private seedDatabase() {
    const defaultEmpresas = DEFAULT_EMPRESAS;
    
    // Gera plano contas para as empresas padrão
    const seededPlanoContas: PlanoConta[] = [];
    const seededPortadores: Portador[] = [];
    
    defaultEmpresas.forEach(emp => {
      const idMap: Record<string, string> = {};
      const newPcs = DEFAULT_PLANO_CONTAS.map(p => {
        const newId = 'pc_' + emp.id + '_' + p.id;
        idMap[p.id] = newId;
        
        let descricao = p.descricao;
        if (emp.tipo === 'condominio') {
          if (p.id === 'pc1_1_1') descricao = 'Taxas Condominiais Ordinárias';
          else if (p.id === 'pc1_1_2') descricao = 'Taxas Extraordinárias';
          else if (p.id === 'pc1_1_3') descricao = 'Multas e Juros';
          else if (p.id === 'pc1_1_4') descricao = 'Fundo de Reserva Entradas';
          else if (p.id === 'pc3_1_1') descricao = 'Zeladoria e Limpeza';
          else if (p.id === 'pc3_1_2') descricao = 'Água da Área Comum';
          else if (p.id === 'pc3_1_11') descricao = 'Energia de Área Comum';
          else if (p.id === 'pc3_1_17') descricao = 'Manutenção Elevadores';
        }
        
        return {
          ...p,
          id: newId,
          descricao,
          empresaId: emp.id
        };
      });
      newPcs.forEach(p => {
        if (p.parentId && idMap[p.parentId]) {
          p.parentId = idMap[p.parentId];
        }
      });
      seededPlanoContas.push(...newPcs);
      
      seededPortadores.push(
        { id: `port_${emp.id}_1`, nome: 'Conta Corrente Principal', tipo: 'conta_corrente', saldoInicial: 15000, saldoInicialData: '2023-01-01', ativo: true, empresaId: emp.id },
        { id: `port_${emp.id}_2`, nome: 'Fundo Caixa / Caixinha', tipo: 'caixa', saldoInicial: 500, saldoInicialData: '2023-01-01', ativo: true, empresaId: emp.id }
      );
      
      if (emp.tipo === 'condominio') {
        seededPortadores.push(
          { id: `port_${emp.id}_reserva`, nome: 'Conta Fundo de Reserva', tipo: 'poupanca', saldoInicial: 5000, saldoInicialData: '2023-01-01', ativo: true, empresaId: emp.id }
        );
      }
    });

    const seededUnits: Unidade[] = [
      { id: 'uni_1', condominioId: 'condo_demo', identificacao: 'Apto 101', proprietario: 'Carlos Souza', proprietarioCpf: '123.456.789-00', fracaoIdeal: 0.12, email: 'carlos@email.com', telefone: '(54) 99111-2222', moradorNome: 'Carlos Souza', moradorCpf: '123.456.789-00', moradorEmail: 'carlos@email.com', moradorTelefone: '(54) 99111-2222' },
      { id: 'uni_2', condominioId: 'condo_demo', identificacao: 'Apto 102', proprietario: 'Ana Maria', proprietarioCpf: '987.654.321-11', fracaoIdeal: 0.12, email: 'ana@email.com', telefone: '(54) 99111-3333', moradorNome: 'Rodrigo Silva (Inquilino)', moradorCpf: '456.789.123-22', moradorEmail: 'rodrigo@email.com', moradorTelefone: '(54) 99111-9999' },
      { id: 'uni_3', condominioId: 'condo_demo', identificacao: 'Apto 201', proprietario: 'Felipe Dias', proprietarioCpf: '111.222.333-44', fracaoIdeal: 0.13, email: 'felipe@email.com', telefone: '(54) 99111-4444', moradorNome: 'Felipe Dias', moradorCpf: '111.222.333-44', moradorEmail: 'felipe@email.com', moradorTelefone: '(54) 99111-4444' },
      { id: 'uni_4', condominioId: 'condo_demo', identificacao: 'Apto 202', proprietario: 'Julia Silva', proprietarioCpf: '555.666.777-88', fracaoIdeal: 0.13, email: 'julia@email.com', telefone: '(54) 99111-5555', moradorNome: 'Julia Silva', moradorCpf: '555.666.777-88', moradorEmail: 'julia@email.com', moradorTelefone: '(54) 99111-5555' },
      { id: 'uni_5', condominioId: 'condo_demo', identificacao: 'Apto 301', proprietario: 'Roberto Santos', proprietarioCpf: '999.888.777-66', fracaoIdeal: 0.25, email: 'roberto@email.com', telefone: '(54) 99111-6666', moradorNome: 'Juliana Mendes (Inquilina)', moradorCpf: '888.777.666-55', moradorEmail: 'juliana@email.com', moradorTelefone: '(54) 99111-8888' },
      { id: 'uni_6', condominioId: 'condo_demo', identificacao: 'Apto 302', proprietario: 'Fernanda Rocha', proprietarioCpf: '222.333.444-55', fracaoIdeal: 0.25, email: 'fernanda@email.com', telefone: '(54) 99111-7777', moradorNome: 'Fernanda Rocha', moradorCpf: '222.333.444-55', moradorEmail: 'fernanda@email.com', moradorTelefone: '(54) 99111-7777' },
    ];

    this.set('cf_users', DEFAULT_USERS, true);
    this.set('cf_empresas', defaultEmpresas, true);
    this.set('cf_plano_contas', seededPlanoContas, true);
    this.set('cf_portadores', seededPortadores, true);
    this.set('cf_unidades', seededUnits, true);
    this.set('cf_lancamentos', [], true);
    this.set('cf_endividamentos', [], true);
    this.set('cf_indicadores', [], true);
    this.set('cf_orcamentos', [], true);
    this.set('cf_atas', [], true);
    this.set('cf_transaction_patterns', [], true);
    this.set('cf_audit_logs', [], true);
    this.set('cf_initialized_v3', true, true);
    this.set(STORAGE_VERSION_KEY, STORAGE_VERSION);
  }

  private ensureRequiredCollections() {
    if (!localStorage.getItem('cf_users')) this.set('cf_users', DEFAULT_USERS);
    if (!localStorage.getItem('cf_empresas')) this.set('cf_empresas', DEFAULT_EMPRESAS);
    if (!localStorage.getItem('cf_plano_contas')) this.set('cf_plano_contas', DEFAULT_PLANO_CONTAS);
    if (!localStorage.getItem('cf_portadores')) this.set('cf_portadores', DEFAULT_PORTADORES);
    if (!localStorage.getItem('cf_unidades')) this.set('cf_unidades', []);
    if (!localStorage.getItem('cf_lancamentos')) this.set('cf_lancamentos', []);
    if (!localStorage.getItem('cf_endividamentos')) this.set('cf_endividamentos', []);
    if (!localStorage.getItem('cf_indicadores')) this.set('cf_indicadores', []);
    if (!localStorage.getItem('cf_orcamentos')) this.set('cf_orcamentos', []);
    if (!localStorage.getItem('cf_atas')) this.set('cf_atas', []);
    if (!localStorage.getItem('cf_situacao_fiscal')) this.set('cf_situacao_fiscal', []);
    if (!localStorage.getItem('cf_transaction_patterns')) this.set('cf_transaction_patterns', []);
    if (!localStorage.getItem('cf_clientes')) this.set('cf_clientes', []);
    if (!localStorage.getItem('cf_nfse')) this.set('cf_nfse', []);
    if (!localStorage.getItem('cf_audit_logs')) this.set('cf_audit_logs', []);
  }

  private mergeDefaults<T extends StoredRecord>(current: T[], defaults: T[]): T[] {
    const currentById = new Map(current.map(item => [item.id, item]));
    const defaultById = new Map(defaults.map(item => [item.id, item]));

    const merged = current.map(item => {
      const defaultItem = defaultById.get(item.id);
      return defaultItem ? { ...defaultItem, ...item } : item;
    });

    defaults.forEach(item => {
      if (!currentById.has(item.id)) merged.push(item);
    });

    return merged;
  }

  private syncCollection<T extends StoredRecord>(key: string, defaults: T[]) {
    const current = this.get<T[]>(key, defaults);
    const merged = this.mergeDefaults(current, defaults);

    if (JSON.stringify(current) !== JSON.stringify(merged)) {
      this.set(key, merged);
    }
  }

  private migrateDatabase() {
    this.syncCollection('cf_users', DEFAULT_USERS);
    this.syncCollection('cf_empresas', DEFAULT_EMPRESAS);
    this.syncCollection('cf_plano_contas', DEFAULT_PLANO_CONTAS);
    this.syncCollection('cf_portadores', DEFAULT_PORTADORES);

    const users = this.withMauricioPassword(this.get<User[]>('cf_users', DEFAULT_USERS));
    this.set('cf_users', users);
    this.set('cf_initialized_v3', true);
    this.set(STORAGE_VERSION_KEY, STORAGE_VERSION);
  }

  private withMauricioPassword(users: User[]): User[] {
    let changed = false;
    const updatedUsers = users.map(user => {
      const userText = `${ user.name } ${ user.email }`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      if (userText.includes('mauricio') && user.password !== '123456') {
        changed = true;
        return { ...user, password: '123456' };
      }

      return user;
    });

    // Não dispara evento aqui para evitar loop infinito em componentes que ouvem cfDataChange
    if (changed) this.set('cf_users', updatedUsers, true);
    return updatedUsers;
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
  getUsers(): User[] {
    this.init();
    return this.withMauricioPassword(this.get<User[]>('cf_users', DEFAULT_USERS));
  }
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

  getPotentialMatches(ofx: Partial<Lancamento>): Lancamento[] {
    if (!ofx.empresaId) return [];
    const list = this.getLancamentos(ofx.empresaId);
    return list.filter(l =>
      l.status === 'previsto' &&
      l.tipo === ofx.tipo &&
      // Margem de 5 dias para conferência
      Math.abs(new Date(l.data + 'T12:00:00').getTime() - new Date((ofx.data || '') + 'T12:00:00').getTime()) <= 5 * 24 * 60 * 60 * 1000 &&
      // Valor exato ou com diferença mínima (centavos)
      Math.abs(l.valor - (ofx.valor || 0)) < 0.01
    );
  }

  reconciliar(ofxData: Lancamento, manualId?: string) {
    if (this.isPeriodLocked(ofxData.empresaId, ofxData.data)) {
      throw new Error(`Este período está fechado e conciliado (limite: ${this.formatDate(this.getEmpresas().find(e => e.id === ofxData.empresaId)?.fechamentoData || '')}). Não é possível reconciliar transações.`);
    }
    const list = this.getLancamentos();

    if (manualId) {
      const idx = list.findIndex(l => l.id === manualId);
      if (idx !== -1) {
        const old = list[idx];
        if (this.isPeriodLocked(old.empresaId, old.data)) {
          throw new Error(`O lançamento previsto original está em período bloqueado.`);
        }
        list[idx] = {
          ...list[idx],
          status: 'realizado',
          valor: ofxData.valor,
          data: ofxData.data,
          origem: 'ofx',
          ofxId: ofxData.ofxId || ofxData.id
        };
        this.learnPattern(list[idx].empresaId, list[idx].descricao, list[idx].planoContaId);
        this.logAction(ofxData.empresaId, 'Conciliação', `Conciliou o lançamento previsto "${list[idx].descricao}" com extrato bancário (R$ ${ofxData.valor.toFixed(2)})`);
      }
    } else {
      list.push({ ...ofxData, status: 'realizado' });
      this.learnPattern(ofxData.empresaId, ofxData.descricao, ofxData.planoContaId);
      this.logAction(ofxData.empresaId, 'Conciliação', `Importou e conciliou a transação "${ofxData.descricao}" de R$ ${ofxData.valor.toFixed(2)}`);
    }
    this.set('cf_lancamentos', list);
  }

  // Helper para limpar descrições bancárias (remove datas, números isolados e símbolos)
  private normalizeText(text: string): string {
    return text
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[0-9]{2,}/g, "") // Remove números longos (geralmente IDs ou datas)
      .replace(/[^A-Z ]/g, " ") // Mantém apenas letras e espaços
      .replace(/\s+/g, " ") // Remove espaços duplos
      .trim();
  }

  // Lógica de Inteligência: Classificação por Padrão
  classifyDescription(empresaId: string, description: string): string | null {
    const patterns = this.getTransactionPatterns(empresaId);
    const cleanDesc = this.normalizeText(description);

    const match = patterns.find(p => {
      const cleanPattern = this.normalizeText(p.pattern);
      return cleanDesc.includes(cleanPattern) || cleanPattern.includes(cleanDesc);
    });

    return match ? match.categoryId : null;
  }

  learnPattern(empresaId: string, description: string, categoryId: string) {
    if (!description || description.length < 3 || !categoryId) return;
    const patterns = this.getTransactionPatterns();
    const cleanDesc = this.normalizeText(description);

    const existing = patterns.find(p =>
      p.empresaId === empresaId && this.normalizeText(p.pattern) === cleanDesc
    );

    if (existing) {
      if (existing.categoryId !== categoryId) {
        existing.categoryId = categoryId;
        this.saveTransactionPattern(existing);
      }
    } else {
      this.saveTransactionPattern({
        id: 'pt_' + Math.random().toString(36).slice(2, 9),
        empresaId,
        pattern: cleanDesc,
        categoryId
      });
    }
  }

  saveLancamento(lancamento: Lancamento) {
    if (this.isPeriodLocked(lancamento.empresaId, lancamento.data)) {
      throw new Error(`Este período está fechado e conciliado (limite: ${this.formatDate(this.getEmpresas().find(e => e.id === lancamento.empresaId)?.fechamentoData || '')}). Não é possível salvar.`);
    }
    const list = this.getLancamentos();
    const idx = list.findIndex(l => l.id === lancamento.id);

    if (idx >= 0) {
      const old = list[idx];
      if (this.isPeriodLocked(old.empresaId, old.data)) {
        throw new Error(`Não é possível editar este lançamento pois ele estava em um período bloqueado.`);
      }
      if (old.planoContaId !== lancamento.planoContaId) {
        this.learnPattern(lancamento.empresaId, lancamento.descricao, lancamento.planoContaId);
      }
      list[idx] = lancamento;
      this.logAction(lancamento.empresaId, 'Edição', `Editou lançamento "${lancamento.descricao}" no valor de R$ ${lancamento.valor.toFixed(2)} (Data: ${lancamento.data})`);
    } else {
      if (lancamento.planoContaId) {
        this.learnPattern(lancamento.empresaId, lancamento.descricao, lancamento.planoContaId);
      }
      list.push(lancamento);
      this.logAction(lancamento.empresaId, 'Criação', `Criou lançamento "${lancamento.descricao}" no valor de R$ ${lancamento.valor.toFixed(2)} (Data: ${lancamento.data})`);
    }
    this.set('cf_lancamentos', list);
  }

  saveLancamentos(lancamentos: Lancamento[]) {
    if (lancamentos.length === 0) return;
    const list = this.getLancamentos();
    const ids = new Set(lancamentos.map(l => l.id));

    // Validar se alguma importação cai em período bloqueado
    const lockedEmpresas = new Set<string>();
    lancamentos.forEach(l => {
      if (this.isPeriodLocked(l.empresaId, l.data)) {
        lockedEmpresas.add(l.empresaId);
      }
    });
    if (lockedEmpresas.size > 0) {
      throw new Error(`Não é possível importar lançamentos pois algumas transações pertencem a um período fechado.`);
    }

    const processed = lancamentos.map(l => {
      if (!l.planoContaId || l.planoContaId === '') {
        const autoId = this.classifyDescription(l.empresaId, l.descricao);
        if (autoId) return { ...l, planoContaId: autoId };
      }
      return l;
    });

    const filtered = list.filter(l => !ids.has(l.id));
    const newList = [...filtered, ...processed];
    this.set('cf_lancamentos', newList);
    
    const empId = lancamentos[0].empresaId;
    this.logAction(empId, 'Importação', `Importou lote de ${lancamentos.length} transações.`);
  }

  deleteLancamento(id: string) {
    const list = this.getLancamentos();
    const l = list.find(item => item.id === id);
    if (l) {
      if (this.isPeriodLocked(l.empresaId, l.data)) {
        throw new Error(`Este período está fechado e conciliado. Não é possível excluir o lançamento.`);
      }
      this.logAction(l.empresaId, 'Exclusão', `Excluiu lançamento "${l.descricao}" no valor de R$ ${l.valor.toFixed(2)} (Data: ${l.data})`);
      this.set('cf_lancamentos', list.filter(item => item.id !== id));
    }
  }

  // Helpers de Auditoria e Fechamento
  isPeriodLocked(empresaId: string, data: string): boolean {
    const emp = this.getEmpresas().find(e => e.id === empresaId);
    if (!emp || !emp.fechamentoData) return false;
    return data <= emp.fechamentoData;
  }

  getAuditLogs(empresaId?: string): AuditLog[] {
    this.init();
    const all = this.get<AuditLog[]>('cf_audit_logs', []);
    return empresaId ? all.filter(l => l.empresaId === empresaId) : all;
  }

  logAction(empresaId: string, action: string, details: string) {
    const logs = this.getAuditLogs();
    const currentUser = this.getCurrentUser();
    const newLog: AuditLog = {
      id: 'log_' + Math.random().toString(36).slice(2, 9),
      empresaId,
      timestamp: new Date().toISOString(),
      userName: currentUser ? currentUser.name : 'Sistema/BPO',
      action,
      details
    };
    logs.unshift(newLog);
    this.set('cf_audit_logs', logs.slice(0, 1000));
  }

  private formatDate(s: string) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }

  // Clientes / Fornecedores
  getClientes(empresaId?: string): Cliente[] {
    this.init();
    const all = this.get<Cliente[]>('cf_clientes', []);
    return empresaId ? all.filter(c => c.empresaId === empresaId) : all;
  }
  saveCliente(cliente: Cliente) {
    const list = this.getClientes();
    const idx = list.findIndex(c => c.id === cliente.id);
    if (idx >= 0) list[idx] = cliente; else list.push(cliente);
    this.set('cf_clientes', list);
  }
  deleteCliente(id: string) {
    this.set('cf_clientes', this.getClientes().filter(c => c.id !== id));
  }

  // NFS-e
  getNfsE(empresaId?: string): NfsE[] {
    this.init();
    const all = this.get<NfsE[]>('cf_nfse', []);
    return empresaId ? all.filter(n => n.empresaId === empresaId) : all;
  }
  saveNfsE(nfse: NfsE) {
    const list = this.getNfsE();
    const idx = list.findIndex(n => n.id === nfse.id);
    if (idx >= 0) list[idx] = { ...nfse, updatedAt: new Date().toISOString() };
    else list.push(nfse);
    this.set('cf_nfse', list);
  }
  deleteNfsE(id: string) {
    this.set('cf_nfse', this.getNfsE().filter(n => n.id !== id));
  }
  getNextNfseNumero(empresaId: string): string {
    const list = this.getNfsE(empresaId).filter(n => n.status !== 'cancelada');
    const nums = list.map(n => parseInt(n.numero, 10)).filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return String(max + 1).padStart(6, '0');
  }

  // Unidades do Condomínio
  getUnidades(condominioId?: string): Unidade[] {
    this.init();
    const all = this.get<Unidade[]>('cf_unidades', []);
    return condominioId ? all.filter(u => u.condominioId === condominioId) : all;
  }
  saveUnidade(unidade: Unidade) {
    const list = this.getUnidades();
    const idx = list.findIndex(u => u.id === unidade.id);
    if (idx >= 0) list[idx] = unidade; else list.push(unidade);
    this.set('cf_unidades', list);
  }
  deleteUnidade(id: string) {
    this.set('cf_unidades', this.getUnidades().filter(u => u.id !== id));
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

  // Atas
  getAtas(empresaId?: string): AtaAtendimento[] {
    this.init();
    const all = this.get<AtaAtendimento[]>('cf_atas', []);
    return empresaId ? all.filter(a => a.empresaId === empresaId) : all;
  }
  saveAta(ata: AtaAtendimento) {
    const list = this.getAtas();
    const idx = list.findIndex(a => a.id === ata.id);
    if (idx >= 0) list[idx] = ata; else list.push(ata);
    this.set('cf_atas', list);
  }
  deleteAta(id: string) {
    this.set('cf_atas', this.getAtas().filter(a => a.id !== id));
  }

  // Padrões de Classificação
  getTransactionPatterns(empresaId?: string): TransactionPattern[] {
    this.init();
    const all = this.get<TransactionPattern[]>('cf_transaction_patterns', []);
    return empresaId ? all.filter(p => p.empresaId === empresaId) : all;
  }

  saveTransactionPattern(pattern: TransactionPattern) {
    const list = this.getTransactionPatterns();
    const idx = list.findIndex(p => p.id === pattern.id);
    if (idx >= 0) list[idx] = pattern; else list.push(pattern);
    this.set('cf_transaction_patterns', list);
  }

  deleteTransactionPattern(id: string) {
    const list = this.getTransactionPatterns().filter(p => p.id !== id);
    this.set('cf_transaction_patterns', list);
  }

  // Situação Fiscal
  getSituacaoFiscal(empresaId: string): SituacaoFiscal[] {
    this.init();
    return this.get<SituacaoFiscal[]>('cf_situacao_fiscal', []).filter(s => s.empresaId === empresaId);
  }
  saveSituacaoFiscal(item: SituacaoFiscal) {
    const all = this.get<SituacaoFiscal[]>('cf_situacao_fiscal', []);
    all.push(item);
    this.set('cf_situacao_fiscal', all);
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
  getSaldoPortador(portadorId: string, empresaId: string, dataFim?: string): number {
    const portador = this.getPortadores().find(p => p.id === portadorId);
    if (!portador) return 0;
    if (dataFim && portador.saldoInicialData && portador.saldoInicialData > dataFim) return 0;
    const lancamentos = this.getLancamentos(empresaId).filter(
      l => l.portadorId === portadorId && l.status === 'realizado' &&
        (!portador.saldoInicialData || l.data >= portador.saldoInicialData) &&
        (!dataFim || l.data <= dataFim)
    );
    const plano = this.getPlanoContas(empresaId);
    const total = lancamentos.reduce((acc, l) => {
      if (l.tipo === 'receita') {
        const pc = plano.find(p => p.id === l.planoContaId);
        const isRedutora = pc && pc.descricao.trim().startsWith('( - )');
        return isRedutora ? acc - l.valor : acc + l.valor;
      } else {
        return acc - l.valor;
      }
    }, portador.saldoInicial);
    return total;
  }

  getResumoMensal(empresaId: string, meses = 6) {
    const hoje = new Date();
    const plano = this.getPlanoContas(empresaId);
    return Array.from({ length: meses }, (_, i) => {
      const mes = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1 - i), 1);
      const mesStr = mes.toISOString().substring(0, 7); // formato YYYY-MM
      const lancamentos = this.getLancamentos(empresaId).filter(l => 
        l.data.startsWith(mesStr) && l.status === 'realizado'
      );
      const receitas = lancamentos.filter(l => l.tipo === 'receita').reduce((a, l) => {
        const pc = plano.find(p => p.id === l.planoContaId);
        const isRedutora = pc && pc.descricao.trim().startsWith('( - )');
        return a + (isRedutora ? -l.valor : l.valor);
      }, 0);
      const despesas = lancamentos.filter(l => l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0);
      return {
        mes: mes.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
        receitas,
        despesas,
        saldo: receitas - despesas,
      };
    });
  }

  getResumoMensalGrupoEconomico(grupoEconomico: string, meses = 6) {
    const hoje = new Date();
    const empresasDoGrupo = this.getEmpresas().filter(e => e.grupoEconomico === grupoEconomico);
    const todosLancamentosDoGrupo: Lancamento[] = [];

    empresasDoGrupo.forEach(empresa => {
      todosLancamentosDoGrupo.push(...this.getLancamentos(empresa.id));
    });

    const planoMap = new Map(this.getPlanoContas().map(p => [p.id, p]));

    return Array.from({ length: meses }, (_, i) => {
      const mes = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1 - i), 1);
      const mesStr = mes.toISOString().substring(0, 7);
      const lancamentosDoMes = todosLancamentosDoGrupo.filter(l => 
        l.data.startsWith(mesStr) && l.status === 'realizado'
      );
      const receitas = lancamentosDoMes.filter(l => l.tipo === 'receita').reduce((a, l) => {
        const pc = planoMap.get(l.planoContaId);
        const isRedutora = pc && pc.descricao.trim().startsWith('( - )');
        return a + (isRedutora ? -l.valor : l.valor);
      }, 0);
      const despesas = lancamentosDoMes.filter(l => l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0);
      return {
        mes: mes.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
        receitas,
        despesas,
        saldo: receitas - despesas,
      };
    });
  }

  exportBackup(): string {
    this.init();
    const keys = [
      'cf_users',
      'cf_empresas',
      'cf_plano_contas',
      'cf_portadores',
      'cf_lancamentos',
      'cf_endividamentos',
      'cf_indicadores',
      'cf_orcamentos',
      'cf_atas',
      'cf_situacao_fiscal',
      'cf_transaction_patterns',
      'cf_clientes',
      'cf_nfse'
    ];
    const data: Record<string, unknown> = {};
    if (typeof window !== 'undefined') {
      keys.forEach(key => {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            data[key] = JSON.parse(raw);
          } catch {
            data[key] = null;
          }
        }
      });
    }
    return JSON.stringify({
      version: STORAGE_VERSION,
      timestamp: new Date().toISOString(),
      data
    }, null, 2);
  }

  importBackup(jsonString: string): { success: boolean; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'Formato de arquivo de backup inválido.' };
      }
      if (!parsed.data || typeof parsed.data !== 'object') {
        return { success: false, error: 'Os dados do backup estão ausentes ou corrompidos.' };
      }

      const data = parsed.data as Record<string, unknown>;
      
      // Validação de sanidade básica dos dados
      const requiredKeys = ['cf_empresas', 'cf_plano_contas'];
      for (const reqKey of requiredKeys) {
        if (!data[reqKey] || !Array.isArray(data[reqKey])) {
          return { success: false, error: `Dados essenciais (${reqKey}) estão ausentes ou no formato incorreto.` };
        }
      }

      if (typeof window !== 'undefined') {
        // Grava as coleções que vieram no backup
        Object.entries(data).forEach(([key, value]) => {
          if (key.startsWith('cf_') && value !== null) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        });

        // Configura a versão do storage
        localStorage.setItem(STORAGE_VERSION_KEY, parsed.version || STORAGE_VERSION);

        // Notifica todos os listeners de que a base mudou
        window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: 'all' } }));
      }
      
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Falha ao processar o JSON: ' + (e as Error).message };
    }
  }
}

export const store = new DataStore();
export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
