require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const res = await pool.query('SELECT id, "razaoSocial", "nomeFantasia", cnpj FROM "Empresa" WHERE "razaoSocial" ILIKE \'%marcos%\' OR "razaoSocial" ILIKE \'%cancelier%\' OR "razaoSocial" ILIKE \'%assessoria%\' LIMIT 20;');
  console.log('Result:', res.rows);

  const certs = await pool.query('SELECT id, "cnpjProcurador", "origem", "razaoSocial" FROM "CertificadoProcuracao" LIMIT 10;');
  console.log('Certs:', certs.rows);

  await pool.end();
}

main().catch(console.error);
