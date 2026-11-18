import { getEmailDbPool } from './email-db';

let __comercialTableEnsured = false;

export async function ensureComercialTable() {
  const pool = getEmailDbPool();
  if (!pool) return null;

  if (!__comercialTableEnsured) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comercial_workspace (
        empresa_id TEXT PRIMARY KEY,
        data JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    __comercialTableEnsured = true;
  }
  return pool;
}

export async function getComercialData(empresaId = 'default'): Promise<Record<string, any>> {
  const pool = await ensureComercialTable();
  if (!pool) return {};
  const res = await pool.query(`SELECT data FROM comercial_workspace WHERE empresa_id = $1`, [empresaId]);
  if (res.rows.length === 0) return {};
  return typeof res.rows[0].data === 'string' ? JSON.parse(res.rows[0].data) : res.rows[0].data || {};
}

export async function saveComercialSection(
  empresaId: string,
  sectionKey: string,
  sectionValue: any
): Promise<Record<string, any>> {
  const pool = await ensureComercialTable();
  if (!pool) throw new Error('Banco de dados indisponível');

  const current = await getComercialData(empresaId);
  const nextData = {
    ...current,
    [sectionKey]: sectionValue,
  };

  await pool.query(
    `INSERT INTO comercial_workspace (empresa_id, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (empresa_id) DO UPDATE SET
       data = EXCLUDED.data,
       updated_at = NOW()`,
    [empresaId, JSON.stringify(nextData)]
  );

  return nextData;
}
