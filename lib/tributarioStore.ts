// ============================================================
// tributarioStore.ts — Motor de Inteligência Tributária
// Reforma Tributária Brasileira — EC 132/2023 | LC 214/2025 | LC 227/2026
// ============================================================

// --- Tipos Base ---

export type FonteIngestao = 'SPED_EFD_CONTRIB' | 'SPED_EFD_ICMS_IPI' | 'NFE_XML' | 'CSV_ERP' | 'MANUAL';
export type StatusArquivo = 'enviado' | 'processando' | 'concluido' | 'erro';
export type TipoInsight = 'alerta' | 'oportunidade' | 'risco' | 'estrategia';
export type RegimeTributario = 'lucro_real' | 'lucro_presumido' | 'simples_nacional';

// --- Arquivo de Ingestão ---
export interface SpedFile {
  id: string;
  empresaId: string;
  fileName: string;
  fileSize: number;
  uploadDate: string;
  status: StatusArquivo;
  content: string;
  fonte?: FonteIngestao;
}

// --- Log de Parsing (ETL) ---
export interface ParseLog {
  fonte: FonteIngestao;
  integridade: 'ok' | 'parcial' | 'corrompido';
  totalLinhas: number;
  blocosEncontrados: string[];
  totalItens: number;
  anomaliasEncontradas: number;
  mensagens: string[];
  timestamp: string;
}

// --- Item Analisado (granularidade NCM/CFOP) ---
export interface ItemAnalisado {
  id: string;
  ncm: string;
  cest?: string;
  cfop: string;
  descricao: string;
  valorOperacao: number;
  // === Cenário Antigo ===
  cstPis?: string;
  cstCofins?: string;
  cstIcms?: string;
  aliqPisAtual: number;    // % como decimal ex: 0.0165
  aliqCofinsAtual: number; // % como decimal
  aliqIcmsAtual: number;
  aliqIpiAtual: number;
  tributosAtuais: number;  // valor R$
  // === Cenário Reforma ===
  aliqIBS: number;  // % decimal — varia por NCM/setor
  aliqCBS: number;  // % decimal
  aliqIS: number;   // % decimal — Imposto Seletivo
  reducaoAliq?: number;  // % de redução (ex: 0.6 = 60% para saúde)
  creditoIBSCBS: number; // valor R$ de crédito gerado
  debitoIBSCBS: number;  // valor R$ de débito
  impostoDevidoReforma: number;
  variacaoValor: number;  // reforma - atual (positivo = aumento)
  variacaoPercent: number; // %
  // === Base Legal ===
  ncmCategoria: string;
  baseLegal: string;
  observacao?: string;
}

// --- Anomalia de CST ---
export interface AnomaliaCST {
  id: string;
  tipo: 'cst_invalido' | 'ncm_incompativel' | 'cfop_divergente' | 'credito_negado' | 'is_incidente';
  severidade: 'alta' | 'media' | 'baixa';
  descricao: string;
  ncm?: string;
  cst?: string;
  cfop?: string;
  valor?: number;
  orientacao: string;
}

// --- Diagnóstico Atual (Regime Antigo) ---
export interface DiagnosticoTributario {
  empresaId: string;
  periodo: string;
  fonte: FonteIngestao;
  parseLog: ParseLog;
  receitaTotal: number;
  tributosApurados: number; // ICMS + PIS + COFINS + IPI
  cargaTributariaEfetiva: number; // percentual decimal
  creditosAproveitados: number;
  creditosNaoAproveitados: number;
  itensPorCategoria: Record<string, number>;  // ncmCategoria -> valor R$
}

// --- Simulação da Reforma ---
export interface SimulacaoReforma {
  empresaId: string;
  periodo: string;
  regimeTributario: RegimeTributario;
  aliquotaReferenciaIBS: number; // decimal (ex: 0.177)
  aliquotaReferenciaCBS: number; // decimal (ex: 0.088)
  debitoTotal: number;
  creditoTotal: number;
  impostoDevido: number;
  impostoSeletivo: number;
  totalReforma: number;
  cargaTributariaEfetiva: number;
  itens: ItemAnalisado[];
  anomalias: AnomaliaCST[];
}

// --- Insight Tributário ---
export interface InsightTributario {
  id: string;
  empresaId: string;
  tipo: TipoInsight;
  titulo: string;
  texto: string;
  impactoEstimado?: number;
  baseLegal?: string;
  prioridade: 1 | 2 | 3; // 1 = urgente
}

// --- Action Item (OUTPUT ACTION) ---
export interface ActionItem {
  id: string;
  empresaId: string;
  prioridade: 'critica' | 'alta' | 'media';
  area: 'cadastro_erp' | 'ncm' | 'fornecedor' | 'regime' | 'credito' | 'split_payment';
  titulo: string;
  descricao: string;
  prazo?: string;
  baseLegal?: string;
}

// --- Produto Cadastrado (Bloco 0200 enriquecido) ---
export interface ProdutoCadastrado {
  codItem: string;
  descricao: string;
  ncm: string;
  unidade: string;
  tipo: string;
  cest?: string;
  aliqIcmsCadastro: number;
  // Reforma
  categoria: string;
  tratamento: string;
  aliqIBS: number;
  aliqCBS: number;
  aliqIS: number;
  reducaoAliq: number;
  baseLegal: string;
  observacao?: string;
}

// ============================================================
// TributarioStore
// ============================================================
class TributarioStore {
  private get<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }

  private set(key: string, value: unknown) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('tributarioDataChange', { detail: { key } }));
  }

  // --- SPED Files ---
  getFiles(empresaId: string): SpedFile[] {
    const allFiles = this.get<SpedFile[]>('tax_sped_files', []);
    return allFiles
      .filter(f => f.empresaId === empresaId)
      .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  }

  addFile(file: SpedFile) {
    const files = this.get<SpedFile[]>('tax_sped_files', []);
    files.push(file);
    this.set('tax_sped_files', files);
  }

  updateFile(updatedFile: SpedFile) {
    const files = this.get<SpedFile[]>('tax_sped_files', []);
    const index = files.findIndex(f => f.id === updatedFile.id);
    if (index !== -1) {
      files[index] = updatedFile;
      this.set('tax_sped_files', files);
    }
  }

  deleteFile(fileId: string) {
    const files = this.get<SpedFile[]>('tax_sped_files', []).filter(f => f.id !== fileId);
    this.set('tax_sped_files', files);
  }

  // --- Diagnóstico ---
  getDiagnostico(empresaId: string): DiagnosticoTributario | null {
    const diagnosticos = this.get<Record<string, DiagnosticoTributario>>('tax_diagnosticos', {});
    return diagnosticos[empresaId] || null;
  }

  saveDiagnostico(empresaId: string, diagnostico: DiagnosticoTributario) {
    const diagnosticos = this.get<Record<string, DiagnosticoTributario>>('tax_diagnosticos', {});
    diagnosticos[empresaId] = diagnostico;
    this.set('tax_diagnosticos', diagnosticos);
  }

  // --- Simulação ---
  getSimulacao(empresaId: string): SimulacaoReforma | null {
    const simulacoes = this.get<Record<string, SimulacaoReforma>>('tax_simulacoes', {});
    return simulacoes[empresaId] || null;
  }

  saveSimulacao(empresaId: string, simulacao: SimulacaoReforma) {
    const simulacoes = this.get<Record<string, SimulacaoReforma>>('tax_simulacoes', {});
    simulacoes[empresaId] = simulacao;
    this.set('tax_simulacoes', simulacoes);
  }

  // --- Insights ---
  getInsights(empresaId: string): InsightTributario[] {
    const allInsights = this.get<InsightTributario[]>('tax_insights', []);
    return allInsights.filter(i => i.empresaId === empresaId).sort((a, b) => a.prioridade - b.prioridade);
  }

  saveInsights(empresaId: string, insights: InsightTributario[]) {
    let allInsights = this.get<InsightTributario[]>('tax_insights', []);
    allInsights = allInsights.filter(i => i.empresaId !== empresaId);
    allInsights.push(...insights);
    this.set('tax_insights', allInsights);
  }

  // --- Action Items ---
  getActionItems(empresaId: string): ActionItem[] {
    const all = this.get<ActionItem[]>('tax_action_items', []);
    return all.filter(a => a.empresaId === empresaId).sort((a, b) => {
      const order = { critica: 0, alta: 1, media: 2 };
      return order[a.prioridade] - order[b.prioridade];
    });
  }

  saveActionItems(empresaId: string, items: ActionItem[]) {
    let all = this.get<ActionItem[]>('tax_action_items', []);
    all = all.filter(a => a.empresaId !== empresaId);
    all.push(...items);
    this.set('tax_action_items', all);
  }

  // --- Produtos (Bloco 0200 enriquecido) ---
  getProdutos(empresaId: string): ProdutoCadastrado[] {
    const all = this.get<Record<string, ProdutoCadastrado[]>>('tax_produtos', {});
    return all[empresaId] || [];
  }

  saveProdutos(empresaId: string, produtos: ProdutoCadastrado[]) {
    const all = this.get<Record<string, ProdutoCadastrado[]>>('tax_produtos', {});
    all[empresaId] = produtos;
    this.set('tax_produtos', all);
  }
}

export const tributarioStore = new TributarioStore();