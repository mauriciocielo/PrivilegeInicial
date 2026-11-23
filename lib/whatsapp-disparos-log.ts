import db from './prisma';

export type CategoriaDisparo =
  | 'agenda_criacao'
  | 'agenda_alteracao'
  | 'agenda_cancelamento'
  | 'agenda_lembrete_1d'
  | 'agenda_lembrete_1h'
  | 'agenda_resumo_matinal'
  | 'certificado_alerta'
  | 'relatorio';

export interface RegistroDisparoWhatsApp {
  id: string;
  categoria: string;
  destino: string;
  destinoNome: string;
  mensagem: string;
  status: 'enviado' | 'erro';
  erro: string | null;
  ownerId: string | null;
  createdAt: string;
}

let tabelaGarantida = false;

export async function ensureDisparosLogTable() {
  if (tabelaGarantida) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS whatsapp_disparos_log (
      id TEXT PRIMARY KEY,
      categoria TEXT NOT NULL,
      destino TEXT NOT NULL,
      destino_nome TEXT,
      mensagem TEXT NOT NULL,
      status TEXT NOT NULL,
      erro TEXT,
      owner_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  tabelaGarantida = true;
}

export async function registrarDisparoWhatsApp(params: {
  categoria: CategoriaDisparo;
  destino: string;
  destinoNome?: string;
  mensagem: string;
  status: 'enviado' | 'erro';
  erro?: string | null;
  ownerId?: string | null;
}): Promise<string | null> {
  try {
    await ensureDisparosLogTable();
    const id = `disp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await db.$executeRawUnsafe(
      `INSERT INTO whatsapp_disparos_log (id, categoria, destino, destino_nome, mensagem, status, erro, owner_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      id,
      params.categoria,
      params.destino,
      params.destinoNome || params.destino,
      params.mensagem,
      params.status,
      params.erro || null,
      params.ownerId || null
    );
    return id;
  } catch {
    return null;
  }
}

export async function listarDisparosWhatsApp(limit = 50): Promise<RegistroDisparoWhatsApp[]> {
  try {
    await ensureDisparosLogTable();
    const rows = await db.$queryRawUnsafe<
      Array<{
        id: string;
        categoria: string;
        destino: string;
        destino_nome: string | null;
        mensagem: string;
        status: string;
        erro: string | null;
        owner_id: string | null;
        created_at: Date;
      }>
    >(
      `SELECT id, categoria, destino, destino_nome, mensagem, status, erro, owner_id, created_at
         FROM whatsapp_disparos_log
        ORDER BY created_at DESC
        LIMIT $1`,
      Math.max(1, Math.min(200, limit))
    );
    return rows.map(r => ({
      id: r.id,
      categoria: r.categoria,
      destino: r.destino,
      destinoNome: r.destino_nome || r.destino,
      mensagem: r.mensagem,
      status: r.status === 'enviado' ? 'enviado' : 'erro',
      erro: r.erro,
      ownerId: r.owner_id,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  } catch {
    return [];
  }
}

export async function buscarDisparoWhatsAppPorId(id: string): Promise<RegistroDisparoWhatsApp | null> {
  try {
    await ensureDisparosLogTable();
    const rows = await db.$queryRawUnsafe<
      Array<{
        id: string;
        categoria: string;
        destino: string;
        destino_nome: string | null;
        mensagem: string;
        status: string;
        erro: string | null;
        owner_id: string | null;
        created_at: Date;
      }>
    >(
      `SELECT id, categoria, destino, destino_nome, mensagem, status, erro, owner_id, created_at
         FROM whatsapp_disparos_log
        WHERE id = $1
        LIMIT 1`,
      id
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      categoria: r.categoria,
      destino: r.destino,
      destinoNome: r.destino_nome || r.destino,
      mensagem: r.mensagem,
      status: r.status === 'enviado' ? 'enviado' : 'erro',
      erro: r.erro,
      ownerId: r.owner_id,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    };
  } catch {
    return null;
  }
}
