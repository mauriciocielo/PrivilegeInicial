require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const res = await pool.query('SELECT id, "razaoSocial", "nomeFantasia", cnpj FROM "Empresa" ORDER BY "razaoSocial" LIMIT 20;');
  console.log('Empresas:', res.rows);
  await pool.end();
}

main().catch(console.error);

