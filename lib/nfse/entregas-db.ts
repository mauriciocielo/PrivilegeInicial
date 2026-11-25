import db from '../prisma';

export interface EntregaNfseInfo {
  nfseId: string;
  emailEnviadoEm: string | null;
  whatsappEnviadoEm: string | null;
  whatsappDestino: string | null;
}

let tabelaGarantida = false;

export async function ensureEntregasNfseTable() {
  if (tabelaGarantida) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS cf_nfse_entregas (
      nfse_id TEXT PRIMARY KEY,
      empresa_id TEXT NOT NULL,
      email_enviado_em TIMESTAMP,
      whatsapp_enviado_em TIMESTAMP,
      whatsapp_destino TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_cf_nfse_entregas_emp ON cf_nfse_entregas(empresa_id)`);
  tabelaGarantida = true;
}

export async function registrarEntregaNfse(params: {
  nfseId: string;
  empresaId: string;
  emailEnviado?: boolean;
  whatsappEnviado?: boolean;
  whatsappDestino?: string | null;
}) {
  if (!params.nfseId || !params.empresaId) return;
  if (!params.emailEnviado && !params.whatsappEnviado) return;
  try {
    await ensureEntregasNfseTable();
    await db.$executeRawUnsafe(
      `INSERT INTO cf_nfse_entregas (nfse_id, empresa_id, email_enviado_em, whatsapp_enviado_em, whatsapp_destino, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (nfse_id) DO UPDATE SET
         email_enviado_em = COALESCE(EXCLUDED.email_enviado_em, cf_nfse_entregas.email_enviado_em),
         whatsapp_enviado_em = COALESCE(EXCLUDED.whatsapp_enviado_em, cf_nfse_entregas.whatsapp_enviado_em),
         whatsapp_destino = COALESCE(EXCLUDED.whatsapp_destino, cf_nfse_entregas.whatsapp_destino),
         updated_at = NOW()`,
      params.nfseId,
      params.empresaId,
      params.emailEnviado ? new Date() : null,
      params.whatsappEnviado ? new Date() : null,
      params.whatsappEnviado && params.whatsappDestino ? params.whatsappDestino : null
    );
  } catch (err) {
    console.warn('Falha ao registrar entrega de NFS-e:', err);
  }
}

export async function listarEntregasEmpresa(empresaId: string): Promise<Record<string, EntregaNfseInfo>> {
  try {
    await ensureEntregasNfseTable();
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT nfse_id, email_enviado_em, whatsapp_enviado_em, whatsapp_destino
       FROM cf_nfse_entregas WHERE empresa_id = $1`,
      empresaId
    );
    const mapa: Record<string, EntregaNfseInfo> = {};
    for (const r of rows) {
      mapa[String(r.nfse_id)] = {
        nfseId: String(r.nfse_id),
        emailEnviadoEm: r.email_enviado_em ? new Date(r.email_enviado_em).toISOString() : null,
        whatsappEnviadoEm: r.whatsapp_enviado_em ? new Date(r.whatsapp_enviado_em).toISOString() : null,
        whatsappDestino: r.whatsapp_destino || null,
      };
    }
    return mapa;
  } catch {
    return {};
  }
}
