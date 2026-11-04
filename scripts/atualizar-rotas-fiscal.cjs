require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const res = await pool.query('SELECT id, email, "allowedRoutes" FROM "User" WHERE email = $1', ['fiscal@privilegecontabilidade.com.br']);
  console.log('Usuário encontrado:', res.rows[0]);

  if (res.rows[0]) {
    let routes = res.rows[0].allowedRoutes || [];
    if (!Array.isArray(routes)) routes = [];
    if (!routes.includes('/consultor/nfe-destinadas')) {
      routes.push('/consultor/nfe-destinadas');
    }
    await pool.query('UPDATE "User" SET "allowedRoutes" = $1 WHERE email = $2', [routes, 'fiscal@privilegecontabilidade.com.br']);
    console.log('✅ allowedRoutes atualizadas:', routes);
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
