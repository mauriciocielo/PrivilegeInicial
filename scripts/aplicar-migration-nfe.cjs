const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const sqlPath = path.join(__dirname, '..', 'prisma', 'migrations', '20261104090000_nfe_destinadas', 'migration.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Conectando ao PostgreSQL...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    console.log('Executando migration para NfeDistribuicao e NfeDestinada...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration aplicada com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.message && err.message.includes('already exists')) {
      console.log('⚠️ As tabelas ou restrições já existem no banco:', err.message);
    } else {
      console.error('❌ Erro ao aplicar migration:', err);
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main();

