// ============================================================
// STORE — Gerenciamento de dados via localStorage
// ============================================================

import { idbGetAllLancamentos, idbSaveAllLancamentos, idbPutLancamento, idbDeleteLancamento, migrateFromLocalStorage } from './idb';
import { SYNC_COLLECTION_KEYS } from './sync-registry';

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
  updatedAt?: string;
  twoFactorEnabled?: boolean;
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
  tipo?: 'empresa' | 'condominio' | 'cooperativa';
  taxaMensalPadrao?: number;
  fundoReservaPct?: number;
  dataInicioContrato?: string;
  /** Endereço — usado na qualificação das partes do contrato. */
  endereco?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
  /** Termos comerciais do contrato de prestação de serviços. */
  contratoValorTotal?: number;
  contratoValorEntrada?: number;
  contratoParcelas?: number;
  contratoDiaVencimento?: number;
  contratoPrimeiroVencimento?: string;
  contratoInicioServicos?: string;
  contratoDuracaoMeses?: number;
  contratoHorasSemanais?: number;
  /** Descricao dos servicos do Anexo I (texto livre, por cliente). */
  contratoServicos?: string;
  grupoEconomico?: string;
  receitaMensalEstimada?: number;
  comprasMensalEstimada?: number;
  logoData?: string;
  bancoBoleto?: 'nenhum' | 'c6';
  allowedRoutes?: string[];
  fechamentoData?: string;
  createdAt: string;
  politicaReceberName?: string;
  politicaReceberData?: string;
  politicaComprasName?: string;
  politicaComprasData?: string;
  politicaCobrancaName?: string;
  politicaCobrancaData?: string;
  politicaReceberTexto?: string;
  politicaCobrancaTexto?: string;
  politicaComprasTexto?: string;
  politicaPagamentosTexto?: string;
  politicaCreditoTexto?: string;
  updatedAt?: string;
}

export interface InteligenciaDoc {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

// Identificadores do registro de visualização de ata dentro do log de auditoria.
// Ficam no topo para que a leitura e a escrita nunca saiam de sincronia.
export const ATA_ACESSO_ACTION = 'Visualizacao de Ata';
const ATA_REF = 'ata:';

export interface StoreAuditLog {
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
  updatedAt?: string;
}

export interface PlanoConta {
  id: string;
  codigo: string;
  descricao: string;
  tipo: 'receita' | 'despesa' | 'transferencia';
  nivel: number;
  parentId?: string;
  ativo: boolean;
  empresaId: string;
  dreCategoria?: string;
  updatedAt?: string;
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
  updatedAt?: string;
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
  updatedAt?: string;
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
  updatedAt?: string;
  /** Id do documento no Autentique, quando enviado para assinatura eletrônica. */
  assinaturaId?: string;
  assinaturaEnviadaEm?: string;
}

export interface Imobilizado {
  id: string;
  empresaId: string;
  nome: string;
  dataAquisicao: string;
  valorAquisicao: number;
  taxaDepreciacao: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AtividadeLog {
  id: string;
  empresaId: string;
  descricao: string;
  tempoSegundos: number;
  data: string;
  localizacao: { lat: number; lng: number } | null;
  fotoInicio?: string | null;
  fotoFim?: string | null;
  updatedAt?: string;
}

export interface IndicadorMensal {
  id: string;
  empresaId: string;
  mes: string; // YYYY-MM
  faturamento: number;
  compras: number;
  inadimplencia: number;
  updatedAt?: string;
}

export interface OrcamentoMensal {
  id: string;
  empresaId: string;
  mes: string; // YYYY-MM
  categorias: Record<string, number>; // planoContaId -> valor
  updatedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  empresaId: string;
  userId: string;
  userName: string;
  acao: string;
  descricao: string;
  data: string; // ISO String
}

export type GrupoContaBalanco = 'ativo_circulante' | 'ativo_nao_circulante' | 'passivo_circulante' | 'passivo_nao_circulante' | 'patrimonio_liquido';

export interface ContaBalanco {
  id: string;
  empresaId: string;
  grupo: GrupoContaBalanco;
  subgrupo?: string; // ex: "Imobilizado", "Realizável a Longo Prazo" (subdivisão opcional dentro do grupo)
  codigo: string;
  descricao: string;
  ordem: number;
  ativo: boolean;
  createdAt: string;
}

export interface BalancoPatrimonial {
  id: string;
  empresaId: string;
  competencia: string; // YYYY-MM
  observacao?: string;
  valores: Record<string, number>; // contaBalancoId -> valor
  createdAt: string;
  updatedAt?: string;
}

export type ClassificacaoAbc = 'A' | 'B' | 'C';

export interface CurvaAbcConfig {
  empresaId: string;
  percentualA: number; // corte acumulado até a Classe A (padrão 80%)
  percentualB: number; // corte acumulado até a Classe B (padrão 95%) — o restante é Classe C
}

export interface CurvaAbcItemEntry {
  id: string;
  nome: string;
  valorFaturado: number;
  percentualIndividual: number;
  percentualAcumulado: number;
  classificacao: ClassificacaoAbc;
  ordem: number;
}

export interface CurvaAbc {
  id: string;
  empresaId: string;
  nome: string; // nome do arquivo importado / descrição do lote
  dataImportacao: string; // YYYY-MM-DD
  percentualA: number; // percentuais usados nesta classificação (snapshot da config no momento da importação)
  percentualB: number;
  itens: CurvaAbcItemEntry[];
  createdAt: string;
}

export interface CentroCusto {
  id: string;
  empresaId: string;
  nome: string;
  codigo?: string;
  ativo: boolean;
  createdAt: string;
  updatedAt?: string;
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
  centroCustoId?: string; // Rateio por Centro de Custo/Projeto/Safra
  createdAt: string;
  updatedAt?: string;
  attachmentName?: string;
  attachmentData?: string; // Conteúdo em Base64
  conferido?: boolean; // Conciliação manual (OFX/extrato)
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
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  dataLog: string;
  horaLog: string;
  empresaId: string;
  userId: string;
  userName: string;
  acao: 'CREATE' | 'UPDATE' | 'DELETE' | 'BLOCK' | 'BATCH';
  entidade: 'Lancamento' | 'Empresa' | 'Config';
  detalhes: string;
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
  updatedAt?: string;
}

export interface SituacaoFiscal {
  id: string;
  empresaId: string;
  dataVerificacao: string;
  status: 'regular' | 'pendencia' | 'atencao';
  observacoes: string;
  updatedAt?: string;
}

// ---- Defaults ----
const STORAGE_VERSION_KEY = 'cf_storage_version';
const STORAGE_VERSION = '8';

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

const DEFAULT_EMPRESAS: Empresa[] = [];

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
  { id: 'pc5_1_8', codigo: '5.1.1.008', descricao: 'Quota Capital', tipo: 'despesa', nivel: 3, parentId: 'pc5_1', ativo: true, empresaId: 'e1' },

  // 6. TRANSFERÊNCIAS
  { id: 'pc6', codigo: '6', descricao: 'Transferências', tipo: 'transferencia', nivel: 1, ativo: true, empresaId: 'e1' },
  { id: 'pc6_1', codigo: '6.1', descricao: 'Transferências entre Portadores', tipo: 'transferencia', nivel: 2, parentId: 'pc6', ativo: true, empresaId: 'e1' },
  { id: 'pc6_1_1', codigo: '6.1.1', descricao: 'Transferência Entrada', tipo: 'transferencia', nivel: 3, parentId: 'pc6_1', ativo: true, empresaId: 'e1' },
  { id: 'pc6_1_2', codigo: '6.1.2', descricao: 'Transferência Saída (Conta redutora no fluxo de caixa)', tipo: 'transferencia', nivel: 3, parentId: 'pc6_1', ativo: true, empresaId: 'e1' },
];

const DEFAULT_PORTADORES: Portador[] = [
  { id: 'p1', nome: 'Caixa Geral', tipo: 'caixa', saldoInicial: 5000, saldoInicialData: '2023-01-01', ativo: true, empresaId: 'e1' },
  { id: 'p2', nome: 'Banco do Brasil CC', tipo: 'conta_corrente', banco: 'Banco do Brasil', agencia: '1234-5', conta: '00001-2', saldoInicial: 50000, saldoInicialData: '2023-01-01', ativo: true, empresaId: 'e1' },
  { id: 'p3', nome: 'Itaú Poupança', tipo: 'poupanca', banco: 'Itaú', agencia: '5678-9', conta: '00002-3', saldoInicial: 20000, saldoInicialData: '2023-01-01', ativo: true, empresaId: 'e1' },
  { id: 'p4', nome: 'Cartão Corporativo', tipo: 'cartao', saldoInicial: 0, saldoInicialData: '2023-01-01', ativo: true, empresaId: 'e1' },
];

// Estrutura padrão do Balanço Patrimonial (pré-criada para toda empresa nova).
// O usuário apenas preenche os valores manualmente — não precisa montar a estrutura contábil.
const DEFAULT_CONTAS_BALANCO: Omit<ContaBalanco, 'id' | 'empresaId' | 'createdAt'>[] = [
  // ATIVO CIRCULANTE
  { grupo: 'ativo_circulante', codigo: '1.1.01', descricao: 'Caixa', ordem: 1, ativo: true },
  { grupo: 'ativo_circulante', codigo: '1.1.02', descricao: 'Bancos Conta Movimento', ordem: 2, ativo: true },
  { grupo: 'ativo_circulante', codigo: '1.1.03', descricao: 'Aplicações Financeiras', ordem: 3, ativo: true },
  { grupo: 'ativo_circulante', codigo: '1.1.04', descricao: 'Contas a Receber de Clientes', ordem: 4, ativo: true },
  { grupo: 'ativo_circulante', codigo: '1.1.05', descricao: 'Estoques', ordem: 5, ativo: true },
  { grupo: 'ativo_circulante', codigo: '1.1.06', descricao: 'Impostos a Recuperar', ordem: 6, ativo: true },
  { grupo: 'ativo_circulante', codigo: '1.1.07', descricao: 'Despesas Antecipadas', ordem: 7, ativo: true },
  { grupo: 'ativo_circulante', codigo: '1.1.08', descricao: 'Outros Créditos de Curto Prazo', ordem: 8, ativo: true },

  // ATIVO NÃO CIRCULANTE
  { grupo: 'ativo_nao_circulante', subgrupo: 'Realizável a Longo Prazo', codigo: '1.2.1.01', descricao: 'Empréstimos a Sócios/Coligadas', ordem: 1, ativo: true },
  { grupo: 'ativo_nao_circulante', subgrupo: 'Realizável a Longo Prazo', codigo: '1.2.1.02', descricao: 'Depósitos Judiciais', ordem: 2, ativo: true },
  { grupo: 'ativo_nao_circulante', subgrupo: 'Investimentos', codigo: '1.2.2.01', descricao: 'Participações Societárias', ordem: 3, ativo: true },
  { grupo: 'ativo_nao_circulante', subgrupo: 'Imobilizado', codigo: '1.2.3.01', descricao: 'Móveis e Utensílios', ordem: 4, ativo: true },
  { grupo: 'ativo_nao_circulante', subgrupo: 'Imobilizado', codigo: '1.2.3.02', descricao: 'Veículos', ordem: 5, ativo: true },
  { grupo: 'ativo_nao_circulante', subgrupo: 'Imobilizado', codigo: '1.2.3.03', descricao: 'Máquinas e Equipamentos', ordem: 6, ativo: true },
  { grupo: 'ativo_nao_circulante', subgrupo: 'Imobilizado', codigo: '1.2.3.04', descricao: 'Edificações e Benfeitorias', ordem: 7, ativo: true },
  { grupo: 'ativo_nao_circulante', subgrupo: 'Imobilizado', codigo: '1.2.3.05', descricao: '( - ) Depreciação Acumulada', ordem: 8, ativo: true },
  { grupo: 'ativo_nao_circulante', subgrupo: 'Intangível', codigo: '1.2.4.01', descricao: 'Softwares e Sistemas', ordem: 9, ativo: true },
  { grupo: 'ativo_nao_circulante', subgrupo: 'Intangível', codigo: '1.2.4.02', descricao: 'Marcas e Patentes', ordem: 10, ativo: true },
  { grupo: 'ativo_nao_circulante', subgrupo: 'Intangível', codigo: '1.2.4.03', descricao: '( - ) Amortização Acumulada', ordem: 11, ativo: true },

  // PASSIVO CIRCULANTE
  { grupo: 'passivo_circulante', codigo: '2.1.01', descricao: 'Fornecedores', ordem: 1, ativo: true },
  { grupo: 'passivo_circulante', codigo: '2.1.02', descricao: 'Empréstimos e Financiamentos (Curto Prazo)', ordem: 2, ativo: true },
  { grupo: 'passivo_circulante', codigo: '2.1.03', descricao: 'Obrigações Trabalhistas', ordem: 3, ativo: true },
  { grupo: 'passivo_circulante', codigo: '2.1.04', descricao: 'Obrigações Tributárias', ordem: 4, ativo: true },
  { grupo: 'passivo_circulante', codigo: '2.1.05', descricao: 'Impostos e Contribuições a Recolher', ordem: 5, ativo: true },
  { grupo: 'passivo_circulante', codigo: '2.1.06', descricao: 'Adiantamento de Clientes', ordem: 6, ativo: true },
  { grupo: 'passivo_circulante', codigo: '2.1.07', descricao: 'Dividendos/Pró-labore a Pagar', ordem: 7, ativo: true },
  { grupo: 'passivo_circulante', codigo: '2.1.08', descricao: 'Outras Contas a Pagar', ordem: 8, ativo: true },

  // PASSIVO NÃO CIRCULANTE
  { grupo: 'passivo_nao_circulante', codigo: '2.2.01', descricao: 'Empréstimos e Financiamentos (Longo Prazo)', ordem: 1, ativo: true },
  { grupo: 'passivo_nao_circulante', codigo: '2.2.02', descricao: 'Provisões para Contingências', ordem: 2, ativo: true },
  { grupo: 'passivo_nao_circulante', codigo: '2.2.03', descricao: 'Outras Obrigações de Longo Prazo', ordem: 3, ativo: true },

  // PATRIMÔNIO LÍQUIDO
  { grupo: 'patrimonio_liquido', codigo: '2.3.01', descricao: 'Capital Social', ordem: 1, ativo: true },
  { grupo: 'patrimonio_liquido', codigo: '2.3.02', descricao: 'Reservas de Capital', ordem: 2, ativo: true },
  { grupo: 'patrimonio_liquido', codigo: '2.3.03', descricao: 'Reservas de Lucros', ordem: 3, ativo: true },
  { grupo: 'patrimonio_liquido', codigo: '2.3.04', descricao: 'Lucros/Prejuízos Acumulados', ordem: 4, ativo: true },
  { grupo: 'patrimonio_liquido', codigo: '2.3.05', descricao: 'Resultado do Exercício', ordem: 5, ativo: true },
];

function adaptPlanoContaDescricao(pcId: string, descricao: string, tipo?: 'empresa' | 'condominio' | 'cooperativa'): string {
  if (tipo === 'condominio') {
    if (pcId === 'pc1_1_1') return 'Taxas Condominiais Ordinárias';
    if (pcId === 'pc1_1_2') return 'Taxas Extraordinárias';
    if (pcId === 'pc1_1_3') return 'Multas e Juros';
    if (pcId === 'pc1_1_4') return 'Fundo de Reserva Entradas';
    if (pcId === 'pc3_1_1') return 'Zeladoria e Limpeza';
    if (pcId === 'pc3_1_2') return 'Água da Área Comum';
    if (pcId === 'pc3_1_11') return 'Energia de Área Comum';
    if (pcId === 'pc3_1_17') return 'Manutenção Elevadores';
  } else if (tipo === 'cooperativa') {
    if (pcId === 'pc1_1_1') return 'Ingressos Operacionais';
    if (pcId === 'pc1_1_2') return 'Ingressos de Cooperados';
    if (pcId === 'pc1_1_3') return 'Taxas e Contribuições';
    if (pcId === 'pc3_1_1') return 'Despesas com Cooperados';
    if (pcId === 'pc3_1_2') return 'Rateio de Despesas';
  }
  return descricao;
}

function gerarLancamentos(): Lancamento[] {
  return [];
}
// ---- Store Class ----
type StoredRecord = { id: string };

export interface DeletedRecord { id: string; collection: string; deletedAt: string; }

class DataStore {
  getDeletedRecords(): DeletedRecord[] {
    this.init();
    return this.get<DeletedRecord[]>("cf_deleted_records", []);
  }

  addDeletedRecord(id: string, collection: string) {
    if(!id) return;
    const records = this.getDeletedRecords();
    records.push({ id, collection, deletedAt: new Date().toISOString() });
    this.set("cf_deleted_records", records);
  }

  clearDeletedRecords() {
    this.set("cf_deleted_records", []);
  }

  private initialized = false;
  private cache: Record<string, unknown> = {};

  // ---- In-memory cache for lancamentos (IndexedDB backend) ----
  private _lancamentosCache: Lancamento[] | null = null;
  private _lancamentosReady: Promise<void> | null = null;

  /** Garante que o cache de lançamentos está carregado */
  private async ensureLancamentosCache(): Promise<void> {
    // Se a Promise já foi iniciada, aguardamos ela terminar.
    if (this._lancamentosReady) {
      return this._lancamentosReady;
    }

    this._lancamentosReady = (async () => {
      try {
        await migrateFromLocalStorage();
        const all = await idbGetAllLancamentos();
        this._lancamentosCache = all as Lancamento[];
      } catch (err) {
        console.warn('[DEBUG_STORE] ensureLancamentosCache IDB error:', err);
        const raw = localStorage.getItem('cf_lancamentos');
        this._lancamentosCache = raw ? JSON.parse(raw) : [];
      }
      
      // Sempre que termina a carga do banco real (IDB), notifica a UI
      window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: 'cf_lancamentos' } }));
    })();
    return this._lancamentosReady;
  }

  /** Persiste o cache de lançamentos no IDB (async, fire-and-forget) */
  private persistLancamentos(list: Lancamento[], silent = false) {
    this._lancamentosCache = list;
    idbSaveAllLancamentos(list).catch(err =>
      console.error('[IDB] Failed to persist lancamentos:', err)
    );
    if (!silent) window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: 'cf_lancamentos' } }));
  }

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

    // Inicia o carregamento assíncrono do cache de lançamentos
    this.ensureLancamentosCache().catch(() => { });

    // Remove legacy seeded default companies (e1/TechSol, e2/ComBrasil) if they exist
    const empresasRaw = localStorage.getItem('cf_empresas');
    if (empresasRaw) {
      try {
        const empresas = JSON.parse(empresasRaw) as Empresa[];
        const idsToRemove = ['e1', 'e2', 'emp_demo', 'condo_demo', 'coopercab_demo'];
        const namesToRemove = ['Empresa Auto-Criada', 'PRIVILEGE BPO & SERVICOS FINANCEIROS LTDA', 'CONDOMINIO RESIDENCIAL PRIVILEGE', 'COOPERCAB COOPERATIVA DE TRANSPORTES'];
        
        const filteredEmpresas = empresas.filter(e => 
          !idsToRemove.includes(e.id) && 
          !namesToRemove.some(name => e.razaoSocial.includes(name) || (e.nomeFantasia && e.nomeFantasia.includes(name)))
        );
        if (empresas.length !== filteredEmpresas.length) {
          localStorage.setItem('cf_empresas', JSON.stringify(filteredEmpresas));

          const saved = sessionStorage.getItem('cf_empresa_sel');
          if (saved === 'e1' || saved === 'e2') {
            sessionStorage.removeItem('cf_empresa_sel');
          }
        }
      } catch { }
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

        return {
          ...p,
          id: newId,
          descricao: adaptPlanoContaDescricao(p.id, p.descricao, emp.tipo),
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
        seededPortadores.push({ id: `port_${emp.id}_reserva`, nome: 'Conta Fundo de Reserva', tipo: 'poupanca', saldoInicial: 5000, saldoInicialData: '2023-01-01', ativo: true, empresaId: emp.id });
      } else if (emp.tipo === 'cooperativa') {
        seededPortadores.push({ id: `port_${emp.id}_capital`, nome: 'Fundo Capital Social', tipo: 'poupanca', saldoInicial: 5000, saldoInicialData: '2023-01-01', ativo: true, empresaId: emp.id });
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
    if (!localStorage.getItem('cf_politicas_globais')) {
      const empresas = this.get<Empresa[]>('cf_empresas', []);
      const empWithPolicies = empresas.find(e =>
        e.politicaReceberTexto ||
        e.politicaCobrancaTexto ||
        e.politicaComprasTexto ||
        e.politicaPagamentosTexto ||
        e.politicaCreditoTexto
      );
      this.set('cf_politicas_globais', {
        politicaReceberTexto: empWithPolicies?.politicaReceberTexto || '',
        politicaCobrancaTexto: empWithPolicies?.politicaCobrancaTexto || '',
        politicaComprasTexto: empWithPolicies?.politicaComprasTexto || '',
        politicaPagamentosTexto: empWithPolicies?.politicaPagamentosTexto || '',
        politicaCreditoTexto: empWithPolicies?.politicaCreditoTexto || '',
      });
    }

    // Retrofitting das contas de transferências (Código 6)
    try {
      const currentPcs = this.get<PlanoConta[]>('cf_plano_contas', []);
      const empresas = this.get<any[]>('cf_empresas', []);
      let modified = false;

      empresas.forEach(emp => {
        const hasCode6 = currentPcs.some(p => p.empresaId === emp.id && p.codigo === '6');
        if (!hasCode6) {
          const pc6Id = `pc_${emp.id}_pc6`;
          const pc6_1Id = `pc_${emp.id}_pc6_1`;
          const pc6_1_1Id = `pc_${emp.id}_pc6_1_1`;
          const pc6_1_2Id = `pc_${emp.id}_pc6_1_2`;

          currentPcs.push(
            { id: pc6Id, codigo: '6', descricao: 'Transferências', tipo: 'transferencia', nivel: 1, ativo: true, empresaId: emp.id },
            { id: pc6_1Id, codigo: '6.1', descricao: 'Transferências entre Portadores', tipo: 'transferencia', nivel: 2, parentId: pc6Id, ativo: true, empresaId: emp.id },
            { id: pc6_1_1Id, codigo: '6.1.1', descricao: 'Transferência Entrada', tipo: 'transferencia', nivel: 3, parentId: pc6_1Id, ativo: true, empresaId: emp.id },
            { id: pc6_1_2Id, codigo: '6.1.2', descricao: 'Transferência Saída (Conta redutora no fluxo de caixa)', tipo: 'transferencia', nivel: 3, parentId: pc6_1Id, ativo: true, empresaId: emp.id }
          );
          modified = true;
        }
      });

      if (modified) {
        this.set('cf_plano_contas', currentPcs, true);
      }
    } catch (err) {
      console.error('Erro ao retrofitar plano de contas:', err);
    }
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

    const users = this.get<User[]>('cf_users', DEFAULT_USERS);
    this.set('cf_users', users);

    // Migrações removidas (Coopercab e afins já não são padrão)

    this.set('cf_initialized_v3', true);
    this.set(STORAGE_VERSION_KEY, STORAGE_VERSION);
  }



  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    let raw = localStorage.getItem('cf_current_user');
    if (!raw) raw = sessionStorage.getItem('cf_current_user');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  setCurrentUser(user: User | null) {
    if (typeof window === 'undefined') return;
    if (user) {
      const payload = JSON.stringify(user);
      try {
        localStorage.setItem('cf_current_user', payload);
      } catch {
        // localStorage cheio (QuotaExceededError): o login não pode falhar por
        // causa disso. Sem este fallback, a sessão nunca era persistida e o
        // layout devolvia o usuário para a tela de login. getCurrentUser() já
        // lê do sessionStorage quando não acha no localStorage.
        try {
          sessionStorage.setItem('cf_current_user', payload);
        } catch {
          console.error('Não foi possível persistir a sessão: armazenamento do navegador cheio.');
        }
      }
    } else {
      localStorage.removeItem('cf_current_user');
      localStorage.removeItem('cf_empresa_sel');
      localStorage.removeItem('cf_app_mode');
      // Também limpa a cópia de fallback — senão o logout não desloga de fato.
      try { sessionStorage.removeItem('cf_current_user'); } catch { }
    }
  }

  // Users
  getUsers(): User[] {
    this.init();
    return this.get<User[]>('cf_users', DEFAULT_USERS);
  }
  saveUser(user: User) {
    if (user && typeof user === "object") user.updatedAt = new Date().toISOString();
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    this.set('cf_users', users);
  }
  deleteUser(id: string) {
    this.addDeletedRecord(id, "cf_users");
    this.set("cf_users", this.getUsers().filter(u => u.id !== id));
  }

  // Políticas Financeiras Globais
  getGlobalPolicies(): Record<string, string> {
    this.init();
    return this.get<Record<string, string>>('cf_politicas_globais', {
      politicaReceberTexto: '',
      politicaCobrancaTexto: '',
      politicaComprasTexto: '',
      politicaPagamentosTexto: '',
      politicaCreditoTexto: '',
    });
  }

  saveGlobalPolicy(field: string, text: string) {
    const current = this.getGlobalPolicies();
    current[field] = text;
    this.set('cf_politicas_globais', current);
  }

  // Empresas
  getEmpresas(): Empresa[] {
    this.init();
    const list = this.get<Empresa[]>('cf_empresas', DEFAULT_EMPRESAS);
    return Array.from(new Map(list.map(e => [e.id, e])).values());
  }
  saveEmpresa(empresa: Empresa) {
    if (empresa && typeof empresa === "object") empresa.updatedAt = new Date().toISOString();
    const list = this.getEmpresas();
    const idx = list.findIndex(e => e.id === empresa.id);
    const isNew = idx < 0;
    if (idx >= 0) list[idx] = empresa; else list.push(empresa);
    this.set('cf_empresas', list);

    if (isNew) {
      // ---- Plano de Contas padrão ----
      const idMap: Record<string, string> = {};
      const newPcs = DEFAULT_PLANO_CONTAS.map(p => {
        const newId = 'pc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        idMap[p.id] = newId;

        return { ...p, id: newId, descricao: adaptPlanoContaDescricao(p.id, p.descricao, empresa.tipo), empresaId: empresa.id };
      });

      // Corrige parentId para os novos IDs
      newPcs.forEach(p => {
        if (p.parentId && idMap[p.parentId]) {
          p.parentId = idMap[p.parentId];
        }
      });

      const currentPcs = this.getPlanoContas();
      currentPcs.push(...newPcs);
      this.set('cf_plano_contas', currentPcs);

      // ---- Portadores padrão ----
      const currentPorts = this.getPortadores();
      const hoje = new Date().toISOString().split('T')[0];
      currentPorts.push(
        { id: `port_${empresa.id}_cc`, nome: 'Conta Corrente Principal', tipo: 'conta_corrente', saldoInicial: 0, saldoInicialData: hoje, ativo: true, empresaId: empresa.id },
        { id: `port_${empresa.id}_cx`, nome: 'Fundo Caixa / Caixinha', tipo: 'caixa', saldoInicial: 0, saldoInicialData: hoje, ativo: true, empresaId: empresa.id }
      );
      if (empresa.tipo === 'condominio') {
        currentPorts.push({ id: `port_${empresa.id}_res`, nome: 'Conta Fundo de Reserva', tipo: 'poupanca', saldoInicial: 0, saldoInicialData: hoje, ativo: true, empresaId: empresa.id });
      } else if (empresa.tipo === 'cooperativa') {
        currentPorts.push({ id: `port_${empresa.id}_cap`, nome: 'Fundo Capital Social', tipo: 'poupanca', saldoInicial: 0, saldoInicialData: hoje, ativo: true, empresaId: empresa.id });
      }
      this.set('cf_portadores', currentPorts);
    }
  }
  deleteEmpresa(id: string) {
    this.addDeletedRecord(id, "cf_empresas");
    this.set("cf_empresas", this.getEmpresas().filter(e => e.id !== id));
  }

  // Plano de Contas
  getPlanoContas(empresaId?: string): PlanoConta[] {
    this.init();
    const all = this.get<PlanoConta[]>('cf_plano_contas', DEFAULT_PLANO_CONTAS);
    return empresaId ? all.filter(p => p.empresaId === empresaId) : all;
  }
  savePlanoConta(pc: PlanoConta) {
    if (pc && typeof pc === "object") pc.updatedAt = new Date().toISOString();
    const list = this.getPlanoContas();
    const idx = list.findIndex(p => p.id === pc.id);
    if (idx >= 0) list[idx] = pc; else list.push(pc);
    this.set('cf_plano_contas', list);
  }
  deletePlanoConta(id: string) {
    this.addDeletedRecord(id, "cf_plano_contas");
    this.set("cf_plano_contas", this.getPlanoContas().filter(p => p.id !== id));
    
    // Remote Sync (Database)
    if (typeof window !== 'undefined') {
      fetch(`/api/plano-contas?id=${id}`, { method: 'DELETE' })
        .catch(err => console.error('Erro na exclusão remota do plano de contas:', err));
    }
  }
  deleteAllPlanoContas(empresaId: string) {
    this.set('cf_plano_contas', this.getPlanoContas().filter(p => p.empresaId !== empresaId));
  }

  mergePlanoContas(empresaId: string, sourceId: string, targetId: string) {
    const list = this.getPlanoContas();
    const sourceP = list.find(p => p.id === sourceId);
    const targetP = list.find(p => p.id === targetId);

    // 1. Move lançamentos
    const lancamentos = this.getLancamentos();
    let lancUpdated = false;
    for (const l of lancamentos) {
      if (l.empresaId === empresaId && l.planoContaId === sourceId) {
        // Guarda na observacao um registro de auditoria, como pedido pelo cliente
        l.observacao = `[AUDITORIA] Movido automaticamente da categoria original [${sourceP?.codigo} - ${sourceP?.descricao}] para [${targetP?.codigo} - ${targetP?.descricao}] devido a mesclagem. Observação Original: ` + (l.observacao || '');
        l.planoContaId = targetId;
        lancUpdated = true;
      }
    }
    if (lancUpdated) {
      this.persistLancamentos(lancamentos);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: 'cf_lancamentos' } }));
      }
    }

    // 2. Transfer parent relations
    const contas = this.getPlanoContas();
    let pcsUpdated = false;
    for (const p of contas) {
      if (p.empresaId === empresaId && p.parentId === sourceId) {
        p.parentId = targetId;
        pcsUpdated = true;
      }
    }
    if (pcsUpdated) {
      this.set('cf_plano_contas', contas);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: 'cf_plano_contas' } }));
      }
    }

    // 3. Database remote sync
    if (typeof window !== 'undefined' && sourceId && targetId) {
      fetch('/api/plano-contas/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, sourceId, targetId })
      }).then(res => {
         // Opcionalmente recarregar aqui para sync perfeito, mas a view será otimista
      }).catch(err => console.error('Erro na mesclagem remota API:', err));
    }

    // 4. Delete the duplicate source account
    this.deletePlanoConta(sourceId);
  }

  /**
   * Gera o plano de contas padrão (e portadores padrão) para uma empresa que ainda não possui.
   * Pode ser chamado a qualquer momento — não duplica se já existir.
   */
  seedPlanoContasForEmpresa(empresaId: string): { planosAdded: number; portadoresAdded: number } {
    const empresa = this.getEmpresas().find(e => e.id === empresaId);
    if (!empresa) return { planosAdded: 0, portadoresAdded: 0 };

    const idMap: Record<string, string> = {};
    const newPcs = DEFAULT_PLANO_CONTAS.map(p => {
      const newId = 'pc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      idMap[p.id] = newId;

      return { ...p, id: newId, descricao: adaptPlanoContaDescricao(p.id, p.descricao, empresa.tipo), empresaId };
    });

    newPcs.forEach(p => {
      if (p.parentId && idMap[p.parentId]) p.parentId = idMap[p.parentId];
    });

    const currentPcs = this.getPlanoContas();
    currentPcs.push(...newPcs);
    this.set('cf_plano_contas', currentPcs);

    // Portadores padrão (somente os que ainda não existem para essa empresa)
    const currentPorts = this.getPortadores();
    const existingPorts = currentPorts.filter(p => p.empresaId === empresaId);
    let portadoresAdded = 0;
    const hoje = new Date().toISOString().split('T')[0];
    const addPort = (p: typeof currentPorts[0]) => {
      if (!existingPorts.find(ep => ep.id === p.id)) {
        currentPorts.push(p);
        portadoresAdded++;
      }
    };

    addPort({ id: `port_${empresaId}_cc`, nome: 'Conta Corrente Principal', tipo: 'conta_corrente', saldoInicial: 0, saldoInicialData: hoje, ativo: true, empresaId });
    addPort({ id: `port_${empresaId}_cx`, nome: 'Fundo Caixa / Caixinha', tipo: 'caixa', saldoInicial: 0, saldoInicialData: hoje, ativo: true, empresaId });
    if (empresa.tipo === 'condominio') {
      addPort({ id: `port_${empresaId}_res`, nome: 'Conta Fundo de Reserva', tipo: 'poupanca', saldoInicial: 0, saldoInicialData: hoje, ativo: true, empresaId });
    } else if (empresa.tipo === 'cooperativa') {
      addPort({ id: `port_${empresaId}_cap`, nome: 'Fundo Capital Social', tipo: 'poupanca', saldoInicial: 0, saldoInicialData: hoje, ativo: true, empresaId });
    }
    if (portadoresAdded > 0) this.set('cf_portadores', currentPorts);

    return { planosAdded: newPcs.length, portadoresAdded };
  }

  // Portadores
  getPortadores(empresaId?: string): Portador[] {
    this.init();
    const all = this.get<Portador[]>('cf_portadores', DEFAULT_PORTADORES);
    return empresaId ? all.filter(p => p.empresaId === empresaId) : all;
  }
  savePortador(portador: Portador) {
    if (portador && typeof portador === "object") portador.updatedAt = new Date().toISOString();
    const list = this.getPortadores();
    const idx = list.findIndex(p => p.id === portador.id);
    if (idx >= 0) list[idx] = portador; else list.push(portador);
    this.set('cf_portadores', list);
  }
  deletePortador(id: string) {
    this.addDeletedRecord(id, "cf_portadores");
    this.set("cf_portadores", this.getPortadores().filter(p => p.id !== id));
  }

  // Imobilizado
  getImobilizados(empresaId?: string): Imobilizado[] {
    this.init();
    const all = this.get<Imobilizado[]>('cf_imobilizados', []);
    return empresaId ? all.filter(p => p.empresaId === empresaId) : all;
  }
  saveImobilizado(item: Imobilizado) {
    if (item && typeof item === "object") item.updatedAt = new Date().toISOString();
    const list = this.getImobilizados();
    const idx = list.findIndex(p => p.id === item.id);
    if (idx >= 0) list[idx] = item; else list.push(item);
    this.set('cf_imobilizados', list);
  }
  deleteImobilizado(id: string) {
    this.addDeletedRecord(id, "cf_imobilizados");
    this.set("cf_imobilizados", this.getImobilizados().filter(p => p.id !== id));
  }

  getAtividadesLog(empresaId?: string): AtividadeLog[] {
    this.init();
    const arr = this.get<AtividadeLog[]>("cf_atividades_log", []);
    return empresaId ? arr.filter(a => a.empresaId === empresaId) : arr;
  }

  saveAtividadeLog(atividade: AtividadeLog) {
    if (atividade && typeof atividade === "object") atividade.updatedAt = new Date().toISOString();
    const list = this.getAtividadesLog();
    const idx = list.findIndex(a => a.id === atividade.id);
    if (idx >= 0) list[idx] = atividade;
    else list.push(atividade);
    this.set("cf_atividades_log", list);
  }

  pruneLancamentosAttachmentData() {
    this.init();
    if (!this._lancamentosCache) return;
    let changed = false;
    const prunedList = this._lancamentosCache.map(l => {
      if (l.attachmentData) {
        changed = true;
        const { attachmentData, ...rest } = l;
        return rest as Lancamento;
      }
      return l;
    });
    if (changed) {
      this.persistLancamentos(prunedList, true);
    }
  }

  pruneAtividadesFotos() {
    try {
      const saved = localStorage.getItem('cf_atividades_log');
      if (!saved) return;
      const list = JSON.parse(saved);
      let changed = false;
      const pruned = list.map((a: any) => {
        let mod = false;
        let finalA = { ...a };
        if (a.fotoInicio && a.fotoInicio.length > 500) {
          finalA.fotoInicio = '__PRUNED_IN_LOCAL_STAGE__';
          mod = true;
        }
        if (a.fotoFim && a.fotoFim.length > 500) {
          finalA.fotoFim = '__PRUNED_IN_LOCAL_STAGE__';
          mod = true;
        }
        if (mod) changed = true;
        return finalA;
      });
      if (changed) {
        localStorage.setItem('cf_atividades_log', JSON.stringify(pruned));
      }
    } catch (e) {}
  }

  pruneEmpresasPolicyData() {
    this.init();
    const list = this.getEmpresas();
    let changed = false;
    const prunedList = list.map(e => {
      let finalE = { ...e };
      let mod = false;

      if (e.logoData && e.logoData.length > 500) {
        finalE.logoData = '__PRUNED_IN_LOCAL_STAGE__';
        mod = true;
      }
      if (e.politicaReceberData && e.politicaReceberData.length > 500) {
        finalE.politicaReceberData = '__PRUNED_IN_LOCAL_STAGE__';
        mod = true;
      }
      if (e.politicaComprasData && e.politicaComprasData.length > 500) {
        finalE.politicaComprasData = '__PRUNED_IN_LOCAL_STAGE__';
        mod = true;
      }
      if (e.politicaCobrancaData && e.politicaCobrancaData.length > 500) {
        finalE.politicaCobrancaData = '__PRUNED_IN_LOCAL_STAGE__';
        mod = true;
      }

      if (mod) changed = true;
      return finalE as Empresa;
    });
    if (changed) {
      this.set('cf_empresas', prunedList, true);
    }
  }

  pruneUserAvatarData() {
    this.init();
    const list = this.getUsers();
    let changed = false;
    const prunedList = list.map(u => {
      if (u.avatarData && u.avatarData.length > 500) {
        changed = true;
        return { ...u, avatarData: '__PRUNED_IN_LOCAL_STAGE__' } as User;
      }
      return u;
    });
    if (changed) {
      this.set('cf_users', prunedList, true);
    }
  }

  // Lançamentos — usa IndexedDB via cache em memória
  getLancamentos(empresaId?: string): Lancamento[] {
    this.init();
    // Se o cache ainda não foi carregado, tenta ler do localStorage como fallback síncrono
    if (this._lancamentosCache === null) {
      try {
        const raw = localStorage.getItem('cf_lancamentos');
        this._lancamentosCache = raw ? JSON.parse(raw) : [];
      } catch (err) {
        console.warn('[DEBUG_STORE] getLancamentos: fallback error', err);
        this._lancamentosCache = [];
      }
      // Kick off async load to upgrade cache from IDB
      this.ensureLancamentosCache().catch(() => { });
    }
    const all = this._lancamentosCache as Lancamento[];
    return empresaId ? all.filter(l => l.empresaId === empresaId) : [...all];
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
    this.persistLancamentos(list);
    // Sincroniza a conciliação com o banco de dados remoto
    if (typeof window !== 'undefined') {
      const lancamentoAtualizado = manualId
        ? list.find(l => l.id === manualId)
        : list.find(l => l.ofxId === (ofxData.ofxId || ofxData.id));
      if (lancamentoAtualizado) {
        console.log('☁️ [STORE] Sincronizando conciliação no servidor:', lancamentoAtualizado.id);
        fetch('/api/lancamentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lancamentoAtualizado)
        }).then(res => {
          if (!res.ok) res.json().then(e => console.error('Erro HTTP ao salvar reconciliação:', e));
          else console.log('☁️ [STORE] Conciliação salva com sucesso no servidor.');
        }).catch(err => console.error('Erro ao salvar reconciliação no servidor:', err));
      }
    }
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

  // Lógica de Inteligência: Classificação por Padrão com busca estendida para empresas com mesmo banco/grupo econômico
  classifyDescription(empresaId: string, description: string): string | null {
    const cleanDesc = this.normalizeText(description);

    // 1. Busca primeiro nos padrões da própria empresa
    const ownPatterns = this.getTransactionPatterns(empresaId);
    const ownMatch = ownPatterns.find(p => {
      const cleanPattern = this.normalizeText(p.pattern);
      return cleanDesc.includes(cleanPattern) || cleanPattern.includes(cleanDesc);
    });
    if (ownMatch) return ownMatch.categoryId;

    // 2. Identifica empresas relacionadas (mesmo banco ou mesmo grupo econômico)
    const empresas = this.getEmpresas();
    const targetCompany = empresas.find(e => e.id === empresaId);
    if (!targetCompany) return null;

    const targetPortadores = this.getPortadores(empresaId);

    // Função auxiliar para extrair o código de banco (primeiros 3 dígitos) se estiver no padrão COMPE ou normalizar nomes
    const getBankCodeOrName = (bancoStr: string): string => {
      const trimmed = bancoStr.trim().toLowerCase();
      const match = trimmed.match(/^(\d{3})/);
      if (match) return match[1];

      // Mapeia nomes comuns para o código COMPE correspondente para facilitar o compartilhamento cruzado
      if (trimmed.includes('brasil')) return '001';
      if (trimmed.includes('santander')) return '033';
      if (trimmed.includes('caixa')) return '104';
      if (trimmed.includes('bradesco')) return '237';
      if (trimmed.includes('itau') || trimmed.includes('itaú')) return '341';
      if (trimmed.includes('inter')) return '077';
      if (trimmed.includes('nubank') || trimmed.includes('nu pag')) return '260';
      if (trimmed.includes('c6')) return '336';
      if (trimmed.includes('pagseguro') || trimmed.includes('pagbank')) return '290';
      if (trimmed.includes('banrisul')) return '041';
      if (trimmed.includes('sicredi')) return '748';
      if (trimmed.includes('sicoob')) return '756';
      if (trimmed.includes('safra')) return '422';
      if (trimmed.includes('cresol')) return '133';

      return trimmed;
    };

    const targetBancos = targetPortadores
      .map(p => p.banco ? getBankCodeOrName(p.banco) : '')
      .filter(Boolean) as string[];

    // Encontra outras empresas relacionadas
    const relatedCompanies = empresas.filter(e => {
      if (e.id === empresaId) return false;

      // Verifica se é do mesmo grupo econômico
      const mesmoGrupo = targetCompany.grupoEconomico &&
        e.grupoEconomico &&
        targetCompany.grupoEconomico.trim().toLowerCase() === e.grupoEconomico.trim().toLowerCase();

      // Verifica se utilizam o mesmo banco
      const ePortadores = this.getPortadores(e.id);
      const eBancos = ePortadores
        .map(p => p.banco ? getBankCodeOrName(p.banco) : '')
        .filter(Boolean) as string[];
      const mesmoBanco = targetBancos.some(b => eBancos.includes(b));

      return mesmoGrupo || mesmoBanco;
    });

    if (relatedCompanies.length === 0) return null;

    // Ordena as empresas relacionadas (mesmo grupo E mesmo banco primeiro)
    relatedCompanies.sort((a, b) => {
      const aMesmoGrupo = targetCompany.grupoEconomico && a.grupoEconomico && targetCompany.grupoEconomico.trim().toLowerCase() === a.grupoEconomico.trim().toLowerCase() ? 1 : 0;
      const bMesmoGrupo = targetCompany.grupoEconomico && b.grupoEconomico && targetCompany.grupoEconomico.trim().toLowerCase() === b.grupoEconomico.trim().toLowerCase() ? 1 : 0;
      return bMesmoGrupo - aMesmoGrupo;
    });

    const targetPlano = this.getPlanoContas(empresaId);

    // 3. Busca nos padrões das empresas relacionadas
    for (const relComp of relatedCompanies) {
      const relPatterns = this.getTransactionPatterns(relComp.id);
      const relMatch = relPatterns.find(p => {
        const cleanPattern = this.normalizeText(p.pattern);
        return cleanDesc.includes(cleanPattern) || cleanPattern.includes(cleanDesc);
      });

      if (relMatch) {
        // Encontra o planoConta do padrão correspondente na empresa relacionada
        const relPlano = this.getPlanoContas(relComp.id);
        const relCategory = relPlano.find(pc => pc.id === relMatch.categoryId);
        if (relCategory) {
          // Procura a categoria correspondente no plano de contas da empresa atual
          // Prioriza categorias de nível 3 (folhas) que são ativas
          const targetCategory = targetPlano.find(pc => pc.codigo === relCategory.codigo && pc.nivel === 3 && pc.ativo) ||
            targetPlano.find(pc => pc.descricao.trim().toLowerCase() === relCategory.descricao.trim().toLowerCase() && pc.nivel === 3 && pc.ativo) ||
            targetPlano.find(pc => {
              if (!pc.ativo || pc.nivel !== 3) return false;
              const cleanPc = pc.descricao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/s\b/g, '').trim();
              const cleanRel = relCategory.descricao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/s\b/g, '').trim();
              return cleanPc.includes(cleanRel) || cleanRel.includes(cleanPc);
            }) ||
            // Fallback para qualquer nível se não encontrar folha ativa
            targetPlano.find(pc => pc.codigo === relCategory.codigo && pc.ativo) ||
            targetPlano.find(pc => pc.codigo === relCategory.codigo);

          if (targetCategory) {
            console.log(`🧠 Inteligência: Classificação sugerida de empresa relacionada (${relComp.nomeFantasia}) para ${description} -> ${targetCategory.codigo} - ${targetCategory.descricao}`);
            return targetCategory.id;
          }
        }
      }
    }

    return null;
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

  // ---- Centros de Custo ----
  getCentrosCusto(empresaId?: string): CentroCusto[] {
    const list = this.get<CentroCusto[]>('cf_centros_custo', []);
    if (empresaId) return list.filter(c => c.empresaId === empresaId);
    return list;
  }

  saveCentroCusto(cc: CentroCusto) {
    if (cc && typeof cc === "object") cc.updatedAt = new Date().toISOString();
    const list = this.getCentrosCusto();
    const idx = list.findIndex(c => c.id === cc.id);
    if (idx >= 0) list[idx] = cc;
    else list.push(cc);
    this.set('cf_centros_custo', list);
  }

  deleteCentroCusto(id: string) {
    const list = this.getCentrosCusto();
    if (list.findIndex(c => c.id === id) === -1) return;
    this.addDeletedRecord(id, "cf_centros_custo");
    this.set("cf_centros_custo", list.filter(c => c.id !== id));
  }

  saveLancamento(lancamento: Lancamento) {
    if (lancamento && typeof lancamento === "object") lancamento.updatedAt = new Date().toISOString();
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
    this.persistLancamentos(list);
    // Sincronização direta e imediata com o banco de dados
    if (typeof window !== 'undefined') {
      console.log('☁️ [STORE] Salvando lançamento direto no servidor:', lancamento.id);
      fetch('/api/lancamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lancamento)
      }).then(res => {
        if (!res.ok) res.json().then(e => console.error('Erro HTTP ao salvar lançamento:', e));
        else console.log('☁️ [STORE] Lançamento salvo com sucesso no servidor:', lancamento.id);
      }).catch(err => console.error('Erro ao salvar lançamento direto no servidor:', err));
    }
  }

  saveLancamentos(lancamentos: Lancamento[]): { imported: number; skipped: number } {
    if (lancamentos.length === 0) return { imported: 0, skipped: 0 };
    const list = this.getLancamentos();
    const ids = new Set(lancamentos.map(l => l.id));

    // Filtrar lançamentos que caem em período bloqueado, ao invés de lançar erro para o lote todo
    const openLancamentos: Lancamento[] = [];
    let skippedCount = 0;

    lancamentos.forEach(l => {
      if (this.isPeriodLocked(l.empresaId, l.data)) {
        skippedCount++;
      } else {
        openLancamentos.push(l);
      }
    });

    if (openLancamentos.length === 0) {
      throw new Error(`Não é possível importar lançamentos pois todas as transações selecionadas pertencem a um período fechado.`);
    }

    const processed = openLancamentos.map(l => {
      if (!l.planoContaId || l.planoContaId === '') {
        const autoId = this.classifyDescription(l.empresaId, l.descricao);
        if (autoId) return { ...l, planoContaId: autoId };
      }
      return l;
    });

    const filtered = list.filter(l => !ids.has(l.id));
    const newList = [...filtered, ...processed];
    
    // Debug: quais empresaId estamos salvando?
    const empresaStats = newList.reduce((acc, l) => {
      acc[l.empresaId] = (acc[l.empresaId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    
    if (typeof window !== 'undefined' && processed.length > 0) {
      console.log(`☁️ [STORE] Salvando lote de ${processed.length} lançamentos no servidor...`);
      fetch('/api/lancamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processed)
      }).then(res => {
        if (!res.ok) res.json().then(e => console.error('Erro HTTP ao salvar lote de lançamentos:', e));
        else console.log(`☁️ [STORE] Lote de ${processed.length} lançamentos salvo com sucesso no servidor.`);
      }).catch(err => console.error('Erro ao salvar lote de lançamentos direto no servidor:', err));
    }
    this.persistLancamentos(newList);

    // Salva/aprende as regras para todos os lançamentos que possuem categoria associada
    processed.forEach(l => {
      if (l.planoContaId) {
        this.learnPattern(l.empresaId, l.descricao, l.planoContaId);
      }
    });

    const empId = lancamentos[0].empresaId;
    this.logAction(empId, 'Importação', `Importou lote de ${processed.length} transações (${skippedCount} ignoradas por período fechado).`);

    return { imported: processed.length, skipped: skippedCount };
  }

  deleteLancamento(id: string) {
    this.addDeletedRecord(id, "cf_lancamentos");
    const list = this.getLancamentos();
    const l = list.find(item => item.id === id);
    if (l) {
      if (this.isPeriodLocked(l.empresaId, l.data)) {
        throw new Error(`Este período está fechado e conciliado. Não é possível excluir o lançamento.`);
      }
      this.logAction(l.empresaId, 'Exclusão', `Excluiu lançamento "${l.descricao}" no valor de R$ ${l.valor.toFixed(2)} (Data: ${l.data})`);
      const newList = list.filter(item => item.id !== id);
      this.persistLancamentos(newList, true);
      idbDeleteLancamento(id).catch(() => { });

      // Sincroniza a exclusão com o banco de dados remoto
      if (typeof window !== 'undefined') {
        console.log('☁️ [STORE] Deletando lançamento no servidor:', id);
        fetch(`/api/lancamentos?id=${id}`, { method: 'DELETE' })
          .then(res => {
            if (!res.ok) res.json().then(e => console.error('Erro HTTP ao deletar lançamento:', e));
            else console.log('☁️ [STORE] Lançamento deletado com sucesso no servidor:', id);
          })
          .catch(err => console.error('Erro ao deletar lançamento no servidor:', err));
      }
    }
  }

  importSingleLancamento(lancamento: Lancamento) {
    const list = this.getLancamentos();
    const idx = list.findIndex(l => l.id === lancamento.id);
    if (idx >= 0) {
      list[idx] = lancamento;
    } else {
      list.push(lancamento);
    }
    this.persistLancamentos(list, true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: 'cf_lancamentos', source: 'import' } }));
    }
  }

  importDeleteLancamento(id: string) {
    const list = this.getLancamentos();
    const newList = list.filter(item => item.id !== id);
    if (list.length !== newList.length) {
      this.persistLancamentos(newList, true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: 'cf_lancamentos', source: 'import' } }));
      }
    }
  }

  // Helpers de Auditoria e Fechamento
  isPeriodLocked(empresaId: string, data: string): boolean {
    const emp = this.getEmpresas().find(e => e.id === empresaId);
    if (!emp || !emp.fechamentoData) return false;
    return data <= emp.fechamentoData;
  }

  getAuditLogs(empresaId?: string): StoreAuditLog[] {
    this.init();
    const all = this.get<StoreAuditLog[]>('cf_audit_logs', []);
    return empresaId ? all.filter(l => l.empresaId === empresaId) : all;
  }

  /**
   * Registra que o usuário atual abriu uma ata para leitura. Reaproveita o log
   * de auditoria (que já sincroniza para o Postgres) em vez de criar uma
   * coleção nova. Evita duplicar o registro quando a mesma pessoa reabre a
   * mesma ata em sequência — senão um F5 repetido inflaria o histórico.
   */
  logAtaAcesso(ata: { id: string; empresaId: string; titulo: string }) {
    const JANELA_MS = 5 * 60 * 1000;
    const anteriores = this.getAtaAcessos(ata.id);
    const usuario = this.getCurrentUser();
    const nome = usuario ? usuario.name : 'Sistema/BPO';
    const ultimo = anteriores.find(l => l.userName === nome);
    if (ultimo && Date.now() - new Date(ultimo.timestamp).getTime() < JANELA_MS) return;

    this.logAction(ata.empresaId, ATA_ACESSO_ACTION, `${ATA_REF}${ata.id}|${ata.titulo}`);
  }

  /** Histórico de quem visualizou uma ata, do mais recente para o mais antigo. */
  getAtaAcessos(ataId: string): StoreAuditLog[] {
    return this.getAuditLogs()
      .filter(l => l.action === ATA_ACESSO_ACTION && l.details.startsWith(`${ATA_REF}${ataId}|`))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  logAction(empresaId: string, action: string, details: string) {
    const logs = this.getAuditLogs();
    const currentUser = this.getCurrentUser();
    const newLog: StoreAuditLog = {
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
    if (cliente && typeof cliente === "object") cliente.updatedAt = new Date().toISOString();
    const list = this.getClientes();
    const idx = list.findIndex(c => c.id === cliente.id);
    if (idx >= 0) list[idx] = cliente; else list.push(cliente);
    this.set('cf_clientes', list);
  }
  deleteCliente(id: string) {
    this.addDeletedRecord(id, "cf_clientes");
    this.set("cf_clientes", this.getClientes().filter(c => c.id !== id));
  }

  // NFS-e
  getNfsE(empresaId?: string): NfsE[] {
    this.init();
    const all = this.get<NfsE[]>('cf_nfse', []);
    return empresaId ? all.filter(n => n.empresaId === empresaId) : all;
  }
  saveNfsE(nfse: NfsE) {
    if (nfse && typeof nfse === "object") nfse.updatedAt = new Date().toISOString();
    const list = this.getNfsE();
    const idx = list.findIndex(n => n.id === nfse.id);
    if (idx >= 0) list[idx] = { ...nfse, updatedAt: new Date().toISOString() };
    else list.push(nfse);
    this.set('cf_nfse', list);
  }
  deleteNfsE(id: string) {
    this.addDeletedRecord(id, "cf_nfse");
    this.set("cf_nfse", this.getNfsE().filter(n => n.id !== id));
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
    if (unidade && typeof unidade === "object") unidade.updatedAt = new Date().toISOString();
    const list = this.getUnidades();
    const idx = list.findIndex(u => u.id === unidade.id);
    if (idx >= 0) list[idx] = unidade; else list.push(unidade);
    this.set('cf_unidades', list);
  }
  deleteUnidade(id: string) {
    this.addDeletedRecord(id, "cf_unidades");
    this.set("cf_unidades", this.getUnidades().filter(u => u.id !== id));
  }

  // Endividamento
  getEndividamentos(empresaId?: string): Endividamento[] {
    this.init();
    const all = this.get<Endividamento[]>('cf_endividamentos', []);
    return empresaId ? all.filter(l => l.empresaId === empresaId) : all;
  }
  saveEndividamento(endividamento: Endividamento) {
    if (endividamento && typeof endividamento === "object") endividamento.updatedAt = new Date().toISOString();
    const list = this.getEndividamentos();
    const idx = list.findIndex(l => l.id === endividamento.id);
    if (idx >= 0) list[idx] = endividamento; else list.push(endividamento);
    this.set('cf_endividamentos', list);
  }
  deleteEndividamento(id: string) {
    this.addDeletedRecord(id, "cf_endividamentos");
    this.set("cf_endividamentos", this.getEndividamentos().filter(l => l.id !== id));
  }

  // Atas
  getAtas(empresaId?: string): AtaAtendimento[] {
    this.init();
    const all = this.get<AtaAtendimento[]>('cf_atas', []);
    return empresaId ? all.filter(a => a.empresaId === empresaId) : all;
  }
  saveAta(ata: AtaAtendimento) {
    if (ata && typeof ata === "object") ata.updatedAt = new Date().toISOString();
    const list = this.getAtas();
    const idx = list.findIndex(a => a.id === ata.id);
    if (idx >= 0) list[idx] = ata; else list.push(ata);
    this.set('cf_atas', list);
  }
  deleteAta(id: string) {
    this.addDeletedRecord(id, "cf_atas");
    this.set("cf_atas", this.getAtas().filter(a => a.id !== id));
  }

  // Padrões de Classificação
  getTransactionPatterns(empresaId?: string): TransactionPattern[] {
    this.init();
    const all = this.get<TransactionPattern[]>('cf_transaction_patterns', []);
    return empresaId ? all.filter(p => p.empresaId === empresaId) : all;
  }

  saveTransactionPattern(pattern: TransactionPattern) {
    if (pattern && typeof pattern === "object") pattern.updatedAt = new Date().toISOString();
    const list = this.getTransactionPatterns();
    const idx = list.findIndex(p => p.id === pattern.id);
    if (idx >= 0) list[idx] = pattern; else list.push(pattern);
    this.set('cf_transaction_patterns', list);
  }

  deleteTransactionPattern(id: string) {
    const list = this.getTransactionPatterns().filter(p => p.id !== id);
    this.addDeletedRecord(id, "cf_transaction_patterns");
    this.set("cf_transaction_patterns", list);
  }

  // Situação Fiscal
  getSituacaoFiscal(empresaId: string): SituacaoFiscal[] {
    this.init();
    return this.get<SituacaoFiscal[]>('cf_situacao_fiscal', []).filter(s => s.empresaId === empresaId);
  }
  saveSituacaoFiscal(item: SituacaoFiscal) {
    if (item && typeof item === "object") item.updatedAt = new Date().toISOString();
    const all = this.get<SituacaoFiscal[]>('cf_situacao_fiscal', []);
    all.push(item);
    this.set('cf_situacao_fiscal', all);
  }

  getInteligenciaDocs(): InteligenciaDoc[] {
    this.init();
    return this.get<InteligenciaDoc[]>('cf_inteligencia_docs', []);
  }

  saveInteligenciaDoc(doc: InteligenciaDoc) {
    if (doc && typeof doc === "object") doc.updatedAt = new Date().toISOString();
    const list = this.getInteligenciaDocs();
    const idx = list.findIndex(d => d.id === doc.id);
    if (idx >= 0) list[idx] = doc; else list.push(doc);
    this.set('cf_inteligencia_docs', list);
    window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: 'cf_inteligencia_docs' } }));
  }

  deleteInteligenciaDoc(id: string) {
    const list = this.getInteligenciaDocs().filter(d => d.id !== id);
    this.addDeletedRecord(id, "cf_inteligencia_docs");
    this.set("cf_inteligencia_docs", list);
    window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: 'cf_inteligencia_docs' } }));
  }

  // Indicadores Mensais
  getIndicadores(empresaId?: string): IndicadorMensal[] {
    this.init();
    const all = this.get<IndicadorMensal[]>('cf_indicadores', []);
    return empresaId ? all.filter(l => l.empresaId === empresaId) : all;
  }
  saveIndicador(indicador: IndicadorMensal) {
    if (indicador && typeof indicador === "object") indicador.updatedAt = new Date().toISOString();
    const list = this.getIndicadores();
    const idx = list.findIndex(l => l.id === indicador.id);
    if (idx >= 0) list[idx] = indicador; else list.push(indicador);
    this.set('cf_indicadores', list);
  }
  deleteIndicador(id: string) {
    this.addDeletedRecord(id, "cf_indicadores");
    this.set("cf_indicadores", this.getIndicadores().filter(l => l.id !== id));
  }

  // Orçamentos
  getOrcamentos(empresaId?: string): OrcamentoMensal[] {
    this.init();
    const all = this.get<OrcamentoMensal[]>('cf_orcamentos', []);
    return empresaId ? all.filter(l => l.empresaId === empresaId) : all;
  }
  saveOrcamento(orcamento: OrcamentoMensal) {
    if (orcamento && typeof orcamento === "object") orcamento.updatedAt = new Date().toISOString();
    const list = this.getOrcamentos();
    const idx = list.findIndex(l => l.id === orcamento.id);
    if (idx >= 0) list[idx] = orcamento; else list.push(orcamento);
    this.set('cf_orcamentos', list);
  }
  deleteOrcamento(id: string) {
    this.addDeletedRecord(id, "cf_orcamentos");
    this.set("cf_orcamentos", this.getOrcamentos().filter(l => l.id !== id));
  }

  // Contas do Balanço Patrimonial (estrutura pré-criada, editável apenas para inclusão de contas extras)
  getContasBalanco(empresaId?: string): ContaBalanco[] {
    this.init();
    const all = this.get<ContaBalanco[]>('cf_contas_balanco', []);
    if (!empresaId) return all;
    const existing = all.filter(c => c.empresaId === empresaId);
    if (existing.length === 0 && this.getEmpresas().some(e => e.id === empresaId)) {
      return this.seedContasBalancoForEmpresa(empresaId);
    }
    return existing;
  }
  /**
   * Gera a estrutura padrão do Balanço Patrimonial para uma empresa que ainda não possui.
   * Não duplica se já existir — pode ser chamado a qualquer momento.
   */
  seedContasBalancoForEmpresa(empresaId: string): ContaBalanco[] {
    const all = this.get<ContaBalanco[]>('cf_contas_balanco', []);
    const already = all.filter(c => c.empresaId === empresaId);
    if (already.length > 0) return already;

    const novas: ContaBalanco[] = DEFAULT_CONTAS_BALANCO.map(c => ({
      ...c,
      id: uid(),
      empresaId,
      createdAt: new Date().toISOString(),
    }));
    all.push(...novas);
    this.set('cf_contas_balanco', all);
    return novas;
  }
  saveContaBalanco(conta: ContaBalanco) {
    const list = this.get<ContaBalanco[]>('cf_contas_balanco', []);
    const idx = list.findIndex(c => c.id === conta.id);
    if (idx >= 0) list[idx] = conta; else list.push(conta);
    this.set('cf_contas_balanco', list);
  }
  deleteContaBalanco(id: string) {
    this.addDeletedRecord(id, "cf_contas_balanco");
    this.set("cf_contas_balanco", this.get<ContaBalanco[]>('cf_contas_balanco', []).filter(c => c.id !== id));
  }

  // Balanços Patrimoniais (lançamento manual de valores por competência)
  getBalancosPatrimoniais(empresaId?: string): BalancoPatrimonial[] {
    this.init();
    const all = this.get<BalancoPatrimonial[]>('cf_balancos_patrimoniais', []);
    return empresaId ? all.filter(b => b.empresaId === empresaId) : all;
  }
  saveBalancoPatrimonial(balanco: BalancoPatrimonial) {
    balanco.updatedAt = new Date().toISOString();
    const list = this.getBalancosPatrimoniais();
    const idx = list.findIndex(b => b.id === balanco.id);
    if (idx >= 0) list[idx] = balanco; else list.push(balanco);
    this.set('cf_balancos_patrimoniais', list);
  }
  deleteBalancoPatrimonial(id: string) {
    this.addDeletedRecord(id, "cf_balancos_patrimoniais");
    this.set("cf_balancos_patrimoniais", this.getBalancosPatrimoniais().filter(b => b.id !== id));
  }

  // Curva ABC
  getCurvaAbcConfig(empresaId: string): CurvaAbcConfig {
    this.init();
    const all = this.get<CurvaAbcConfig[]>('cf_curva_abc_config', []);
    return all.find(c => c.empresaId === empresaId) || { empresaId, percentualA: 80, percentualB: 95 };
  }
  saveCurvaAbcConfig(config: CurvaAbcConfig) {
    const list = this.get<CurvaAbcConfig[]>('cf_curva_abc_config', []);
    const idx = list.findIndex(c => c.empresaId === config.empresaId);
    if (idx >= 0) list[idx] = config; else list.push(config);
    this.set('cf_curva_abc_config', list);
  }
  getCurvasAbc(empresaId?: string): CurvaAbc[] {
    this.init();
    const all = this.get<CurvaAbc[]>('cf_curvas_abc', []);
    return empresaId ? all.filter(c => c.empresaId === empresaId) : all;
  }
  saveCurvaAbc(curva: CurvaAbc) {
    const list = this.get<CurvaAbc[]>('cf_curvas_abc', []);
    const idx = list.findIndex(c => c.id === curva.id);
    if (idx >= 0) list[idx] = curva; else list.push(curva);
    this.set('cf_curvas_abc', list);
  }
  deleteCurvaAbc(id: string) {
    this.addDeletedRecord(id, "cf_curvas_abc");
    this.set("cf_curvas_abc", this.getCurvasAbc().filter(c => c.id !== id));
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
      const lancamentos = this.getLancamentos(empresaId).filter(l => {
        if (!l.data.startsWith(mesStr) || l.status !== 'realizado' || l.planoContaId === 'transf') return false;
        const pc = plano.find(p => p.id === l.planoContaId);
        if (pc?.tipo === 'transferencia') return false;
        return true;
      });
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
      const lancamentosDoMes = todosLancamentosDoGrupo.filter(l => {
        if (!l.data.startsWith(mesStr) || l.status !== 'realizado' || l.planoContaId === 'transf') return false;
        const pc = planoMap.get(l.planoContaId);
        if (pc?.tipo === 'transferencia') return false;
        return true;
      });
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
    // Deriva da mesma lista única de coleções sincronizáveis usada pelo resto do
    // pipeline (ver lib/sync-registry.ts) — evita que o backup completo "esqueça"
    // uma coleção que já existe nos outros pontos de sincronização.
    return this.exportPartialBackup(SYNC_COLLECTION_KEYS);
  }

  exportBackupForSync(): string {
    // Versão sem dados pesados (attachmentData) — usada para sincronização com o banco.
    // Evita payload gigantesco que causa timeout/erro 413 na Vercel/Railway.
    this.init();
    const keys = [
      'cf_users', 'cf_empresas', 'cf_plano_contas', 'cf_portadores',
      'cf_lancamentos', 'cf_endividamentos', 'cf_indicadores', 'cf_orcamentos',
      'cf_atas', 'cf_situacao_fiscal', 'cf_transaction_patterns', 'cf_clientes', 'cf_nfse',
      'cf_atividades_log'
    ];
    const data: Record<string, unknown> = {};
    if (typeof window !== 'undefined') {
      keys.forEach(key => {
        if (key === 'cf_lancamentos') {
          // Remove attachmentData (base64) que pode ter vários MB por lançamento
          data[key] = this.getLancamentos().map(l => {
            const { attachmentData, ...rest } = l as any;
            return rest;
          });
        } else {
          const raw = localStorage.getItem(key);
          if (raw) {
            try { data[key] = JSON.parse(raw); } catch { data[key] = null; }
          }
        }
      });
    }
    const totalSize = JSON.stringify(data).length;
    console.log(`[exportBackupForSync] Tamanho total sem anexos: ${(totalSize / 1024).toFixed(1)} KB`);
    Object.keys(data).forEach(k => {
      const arr = data[k] as any[];
      if (Array.isArray(arr)) console.log(`  ${k}: ${arr.length} itens`);
    });
    return JSON.stringify({ version: STORAGE_VERSION, timestamp: new Date().toISOString(), isPartial: true, data });
  }

  exportPartialBackup(keys: string[]): string {
    this.init();
    const data: Record<string, unknown> = {};
    if (typeof window !== 'undefined') {
      keys.forEach(key => {
        if (key === 'cf_lancamentos') {
          data[key] = this.getLancamentos();
        } else {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              data[key] = JSON.parse(raw);
            } catch {
              data[key] = null;
            }
          }
        }
      });
    }
    return JSON.stringify({
      version: STORAGE_VERSION,
      timestamp: new Date().toISOString(),
      isPartial: true,
      data
    });
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

      // Validação de sanidade básica dos dados (ignora se for importação parcial)
      if (!parsed.isPartial) {
        const requiredKeys = ['cf_empresas', 'cf_plano_contas'];
        for (const reqKey of requiredKeys) {
          if (!data[reqKey] || !Array.isArray(data[reqKey])) {
            return { success: false, error: `Dados essenciais (${reqKey}) estão ausentes ou no formato incorreto.` };
          }
        }
      }

      if (typeof window !== 'undefined') {
        // Grava as coleções que vieram no backup (exceto lancamentos que vai pelo IDB)
        Object.entries(data).forEach(([key, value]) => {
          if (key === 'cf_lancamentos' && Array.isArray(value)) {
            // Importa lançamentos via IDB
            this._lancamentosCache = value as Lancamento[];
            idbSaveAllLancamentos(value).catch(err =>
              console.error('[IDB] Failed to import lancamentos backup:', err)
            );
            localStorage.removeItem('cf_lancamentos');
          } else if (key.startsWith('cf_') && value !== null) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        });

        // Configura a versão do storage
        localStorage.setItem(STORAGE_VERSION_KEY, parsed.version || STORAGE_VERSION);

        // Notifica todos os listeners de que a base mudou
        window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key: 'all', source: 'import' } }));
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: 'Falha ao processar o JSON: ' + (e as Error).message };
    }
  }

  getOfxPendingTransactions(portadorId: string, empresaId: string): any[] {
    const list = this.getLancamentos(empresaId);
    // Find anticipated/predicted transactions that are not reconciled yet
    return list.filter(l => l.portadorId === portadorId && l.status === 'previsto');
  }

  // --- ORÇAMENTOS MENSAIS ---
  getOrcamentosMensais(empresaId?: string): OrcamentoMensal[] {
    this.init();
    const all = this.get<OrcamentoMensal[]>('cf_orcamentos_mensais', []);
    return empresaId ? all.filter(o => o.empresaId === empresaId) : all;
  }

  saveOrcamentoMensal(orc: OrcamentoMensal) {
    if (orc && typeof orc === "object") orc.updatedAt = new Date().toISOString();
    const list = this.getOrcamentosMensais();
    const idx = list.findIndex(o => o.id === orc.id);
    if (idx >= 0) list[idx] = orc; else list.push(orc);
    this.set('cf_orcamentos_mensais', list);
  }

  deleteOrcamentoMensal(id: string) {
    this.set('cf_orcamentos_mensais', this.getOrcamentosMensais().filter(o => o.id !== id));
  }

  // --- AUDITORIA DE ELITE ---
  logAudit(empresaId: string, action: string, details: string) {
    const user = this.getCurrentUser();
    if (!user) return;
    
    const d = new Date();
    const log: StoreAuditLog = {
      id: uid(),
      empresaId,
      timestamp: d.toISOString(),
      userName: user.name,
      action,
      details,
    };
    const list = this.getAuditLogs();
    list.push(log);
    this.set('cf_audit_logs', list);
  }
}

export const store = new DataStore();
export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
