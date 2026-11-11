const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const res = await pool.query(`SELECT id, name, email, role, "empresaIds" FROM "User" ORDER BY role, name`);
  console.log('Usuários no banco:');
  res.rows.forEach(u => {
    console.log(`- [${u.role}] ${u.name} (${u.email}) -> empresas: ${JSON.stringify(u.empresaIds)}`);
  });
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

