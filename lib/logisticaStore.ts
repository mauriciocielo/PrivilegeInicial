export interface Veiculo {
  id: string;
  empresaId: string;
  placa: string;
  modelo: string;
  marca: string;
  ano: number;
  capacidadeTanque: number;
  status: 'ativo' | 'inativo';
  createdAt: string;
}

export interface Motorista {
  id: string;
  empresaId: string;
  nome: string;
  cnh: string;
  vencimentoCnh: string; // YYYY-MM-DD
  telefone: string;
  createdAt: string;
}

export interface GastoLogistica {
  id: string;
  empresaId: string;
  veiculoId: string;
  motoristaId?: string;
  data: string; // YYYY-MM-DD
  categoria: 'Combustível' | 'Manutenção' | 'Pedágio' | 'IPVA/Seguro' | 'Outros';
  kmAtual: number;
  litros?: number; // Apenas para combustível
  valorTotal: number;
  descricao: string;
  createdAt: string;
}

export interface ReceitaLogistica {
  id: string;
  empresaId: string;
  veiculoId: string;
  motoristaId?: string;
  data: string; // YYYY-MM-DD
  valor: number;
  descricao: string;
  createdAt: string;
}

export interface OrcamentoFrota {
  id: string;
  empresaId: string;
  veiculoId: string;
  mes: string; // YYYY-MM
  limiteGasto: number;
  createdAt: string;
}

class LogisticaStore {
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
      const parsed = JSON.parse(raw);
      this.cache[key] = parsed;
      return parsed as T;
    } catch {
      this.cache[key] = fallback;
      return fallback;
    }
  }

  private set<T>(key: string, value: T, silent = false) {
    if (typeof window === 'undefined') return;
    this.cache[key] = value;
    localStorage.setItem(key, JSON.stringify(value));
    if (!silent) window.dispatchEvent(new CustomEvent('cfDataChange', { detail: { key } }));
  }

  // --- Veiculos ---
  getVeiculos(empresaId: string): Veiculo[] {
    return this.get<Veiculo[]>('log_veiculos', []).filter(v => v.empresaId === empresaId);
  }
  getVeiculo(id: string): Veiculo | undefined {
    return this.get<Veiculo[]>('log_veiculos', []).find(v => v.id === id);
  }
  saveVeiculo(veiculo: Veiculo) {
    const list = this.get<Veiculo[]>('log_veiculos', []);
    const idx = list.findIndex(v => v.id === veiculo.id);
    if (idx >= 0) list[idx] = veiculo;
    else list.push(veiculo);
    this.set('log_veiculos', list);
  }
  deleteVeiculo(id: string) {
    const list = this.get<Veiculo[]>('log_veiculos', []).filter(v => v.id !== id);
    this.set('log_veiculos', list);
  }

  // --- Motoristas ---
  getMotoristas(empresaId: string): Motorista[] {
    return this.get<Motorista[]>('log_motoristas', []).filter(m => m.empresaId === empresaId);
  }
  saveMotorista(motorista: Motorista) {
    const list = this.get<Motorista[]>('log_motoristas', []);
    const idx = list.findIndex(m => m.id === motorista.id);
    if (idx >= 0) list[idx] = motorista;
    else list.push(motorista);
    this.set('log_motoristas', list);
  }
  deleteMotorista(id: string) {
    const list = this.get<Motorista[]>('log_motoristas', []).filter(m => m.id !== id);
    this.set('log_motoristas', list);
  }

  // --- Gastos Logistica ---
  getGastos(empresaId: string): GastoLogistica[] {
    return this.get<GastoLogistica[]>('log_gastos', []).filter(g => g.empresaId === empresaId);
  }
  saveGasto(gasto: GastoLogistica) {
    const list = this.get<GastoLogistica[]>('log_gastos', []);
    const idx = list.findIndex(g => g.id === gasto.id);
    if (idx >= 0) list[idx] = gasto;
    else list.push(gasto);
    this.set('log_gastos', list);
  }
  deleteGasto(id: string) {
    const list = this.get<GastoLogistica[]>('log_gastos', []).filter(g => g.id !== id);
    this.set('log_gastos', list);
  }

  // --- Receitas Logistica ---
  getReceitas(empresaId: string): ReceitaLogistica[] {
    return this.get<ReceitaLogistica[]>('log_receitas', []).filter(r => r.empresaId === empresaId);
  }
  saveReceita(receita: ReceitaLogistica) {
    const list = this.get<ReceitaLogistica[]>('log_receitas', []);
    const idx = list.findIndex(r => r.id === receita.id);
    if (idx >= 0) list[idx] = receita;
    else list.push(receita);
    this.set('log_receitas', list);
  }
  deleteReceita(id: string) {
    const list = this.get<ReceitaLogistica[]>('log_receitas', []).filter(r => r.id !== id);
    this.set('log_receitas', list);
  }

  // --- Orcamentos Frota ---
  getOrcamentos(empresaId: string): OrcamentoFrota[] {
    return this.get<OrcamentoFrota[]>('log_orcamentos', []).filter(o => o.empresaId === empresaId);
  }
  saveOrcamento(orcamento: OrcamentoFrota) {
    const list = this.get<OrcamentoFrota[]>('log_orcamentos', []);
    const idx = list.findIndex(o => o.id === orcamento.id);
    if (idx >= 0) list[idx] = orcamento;
    else list.push(orcamento);
    this.set('log_orcamentos', list);
  }
  deleteOrcamento(id: string) {
    const list = this.get<OrcamentoFrota[]>('log_orcamentos', []).filter(o => o.id !== id);
    this.set('log_orcamentos', list);
  }
}

export const logisticaStore = new LogisticaStore();
