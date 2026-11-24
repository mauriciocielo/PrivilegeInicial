import db from './prisma';

export type TarefaStatus = 'a_fazer' | 'em_andamento' | 'aguardando' | 'concluida';
export type TarefaPrioridade = 'baixa' | 'media' | 'alta' | 'urgente';
export type TarefaDestinoTipo = 'usuario' | 'cliente' | 'ambos';

export interface TarefaSubtarefa {
  id: string;
  titulo: string;
  concluida: boolean;
}

export interface TarefaComentario {
  id: string;
  autorId: string;
  autorNome: string;
  autorRole: string;
  texto: string;
  criadoEm: string;
}

export interface TarefaAnexo {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  dataUrl: string;
  enviadoPor: string;
  criadoEm: string;
}

export interface TarefaRecord {
  id: string;
  titulo: string;
  descricao: string;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  categoria: string;
  destinoTipo: TarefaDestinoTipo;
  empresaId: string | null;
  empresaNome?: string | null;
  responsavelUserId: string | null;
  responsavelNome?: string | null;
  responsavelPhone?: string | null;
  criadoPorUserId: string;
  criadoPorNome: string;
  prazo: string | null;
  recorrente: boolean;
  recorrenciaDia: number | null;
  visivelCliente: boolean;
  subtarefas: TarefaSubtarefa[];
  comentarios: TarefaComentario[];
  anexos: TarefaAnexo[];
  notificadoWhatsappEm: string | null;
  concluidaEm: string | null;
  createdAt: string;
  updatedAt: string;
}

let tabelaGarantida = false;

export async function ensureTarefasTable() {
  if (tabelaGarantida) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS cf_tarefas (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'a_fazer',
      prioridade TEXT NOT NULL DEFAULT 'media',
      categoria TEXT NOT NULL DEFAULT '',
      destino_tipo TEXT NOT NULL DEFAULT 'usuario',
      empresa_id TEXT,
      responsavel_user_id TEXT,
      criado_por_user_id TEXT NOT NULL,
      criado_por_nome TEXT NOT NULL,
      prazo TEXT,
      recorrente BOOLEAN NOT NULL DEFAULT FALSE,
      recorrencia_dia INTEGER,
      visivel_cliente BOOLEAN NOT NULL DEFAULT TRUE,
      subtarefas JSONB NOT NULL DEFAULT '[]'::jsonb,
      comentarios JSONB NOT NULL DEFAULT '[]'::jsonb,
      anexos JSONB NOT NULL DEFAULT '[]'::jsonb,
      notificado_whatsapp_em TIMESTAMP,
      concluida_em TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_cf_tarefas_status ON cf_tarefas(status)`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_cf_tarefas_empresa ON cf_tarefas(empresa_id)`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_cf_tarefas_resp ON cf_tarefas(responsavel_user_id)`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_cf_tarefas_prazo ON cf_tarefas(prazo)`);
  tabelaGarantida = true;
}

export function mapRowToTarefa(row: any): TarefaRecord {
  const parseArr = <T,>(val: any): T[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  return {
    id: String(row.id),
    titulo: String(row.titulo || ''),
    descricao: String(row.descricao || ''),
    status: (['a_fazer', 'em_andamento', 'aguardando', 'concluida'].includes(row.status)
      ? row.status
      : 'a_fazer') as TarefaStatus,
    prioridade: (['baixa', 'media', 'alta', 'urgente'].includes(row.prioridade)
      ? row.prioridade
      : 'media') as TarefaPrioridade,
    categoria: String(row.categoria || ''),
    destinoTipo: (['usuario', 'cliente', 'ambos'].includes(row.destino_tipo)
      ? row.destino_tipo
      : 'usuario') as TarefaDestinoTipo,
    empresaId: row.empresa_id || null,
    empresaNome: row.empresa_nome || null,
    responsavelUserId: row.responsavel_user_id || null,
    responsavelNome: row.responsavel_nome || null,
    responsavelPhone: row.responsavel_phone || null,
    criadoPorUserId: String(row.criado_por_user_id || ''),
    criadoPorNome: String(row.criado_por_nome || ''),
    prazo: row.prazo || null,
    recorrente: Boolean(row.recorrente),
    recorrenciaDia: row.recorrencia_dia != null ? Number(row.recorrencia_dia) : null,
    visivelCliente: Boolean(row.visivel_cliente),
    subtarefas: parseArr<TarefaSubtarefa>(row.subtarefas),
    comentarios: parseArr<TarefaComentario>(row.comentarios),
    anexos: parseArr<TarefaAnexo>(row.anexos),
    notificadoWhatsappEm: row.notificado_whatsapp_em ? new Date(row.notificado_whatsapp_em).toISOString() : null,
    concluidaEm: row.concluida_em ? new Date(row.concluida_em).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export function calcularProximoPrazoMensal(prazoAtual: string | null, recorrenciaDia: number | null): string {
  const base = prazoAtual && /^\d{4}-\d{2}-\d{2}$/.test(prazoAtual)
    ? new Date(`${prazoAtual}T12:00:00`)
    : new Date();
  const ano = base.getFullYear();
  const mes = base.getMonth() + 1; // +1 mês (0-based -> próximo)
  const diaDesejado = recorrenciaDia && recorrenciaDia >= 1 && recorrenciaDia <= 31
    ? recorrenciaDia
    : base.getDate();
  const ultimoDiaProximoMes = new Date(ano, mes + 1, 0).getDate();
  const diaFinal = Math.min(diaDesejado, ultimoDiaProximoMes);
  const prox = new Date(ano, mes, diaFinal);
  const y = prox.getFullYear();
  const m = String(prox.getMonth() + 1).padStart(2, '0');
  const d = String(prox.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isConsultorOrAdmin(role: string): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'administrador' || r === 'admin' || r === 'consultor';
}
