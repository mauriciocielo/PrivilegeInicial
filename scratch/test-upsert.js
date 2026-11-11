const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const testCamp = {
    id: 'test_camp_1',
    assunto: 'Teste Banco',
    total_destinatarios: 5,
    tamanho_lote: 70,
    intervalo_minutos: 65,
    destinatarios_pendentes: JSON.stringify([{ email: 'teste@exemplo.com' }]),
    destinatarios_enviados: JSON.stringify([]),
    destinatarios_falhas: JSON.stringify([]),
    status: 'aguardando',
  };

  const sql = `
    INSERT INTO email_queue (id, assunto, total_destinatarios, tamanho_lote, intervalo_minutos, destinatarios_pendentes, destinatarios_enviados, destinatarios_falhas, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      destinatarios_pendentes = EXCLUDED.destinatarios_pendentes,
      destinatarios_enviados = EXCLUDED.destinatarios_enviados,
      destinatarios_falhas = EXCLUDED.destinatarios_falhas;
  `;

  await pool.query(sql, [
    testCamp.id,
    testCamp.assunto,
    testCamp.total_destinatarios,
    testCamp.tamanho_lote,
    testCamp.intervalo_minutos,
    testCamp.destinatarios_pendentes,
    testCamp.destinatarios_enviados,
    testCamp.destinatarios_falhas,
    testCamp.status,
  ]);
  console.log('UPSERT OK!');

  const res = await pool.query('SELECT * FROM email_queue WHERE id = $1', ['test_camp_1']);
  console.log('READ OK:', res.rows[0].assunto, 'Status:', res.rows[0].status);

  await pool.query('DELETE FROM email_queue WHERE id = $1', ['test_camp_1']);
  console.log('CLEANUP OK');

  await pool.end();
}

main().catch(err => {
  console.error('Error in upsert test:', err);
  process.exit(1);
});

