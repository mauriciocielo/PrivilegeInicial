require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const res = await pool.query('SELECT id, name, "allowedRoutes" FROM "User" WHERE id = \'u_fiscal_privilege\' OR email ILIKE \'%fiscal%\';');
  console.log('Found users:', res.rows);

  for (const user of res.rows) {
    const current = Array.isArray(user.allowedRoutes) ? user.allowedRoutes : [];
    if (!current.includes('/consultor/cnd-federal')) {
      const updated = [...current, '/consultor/cnd-federal'];
      await pool.query('UPDATE "User" SET "allowedRoutes" = $1 WHERE id = $2;', [updated, user.id]);
      console.log(`Updated user ${user.id} (${user.name}) allowedRoutes to:`, updated);
    } else {
      console.log(`User ${user.id} already has /consultor/cnd-federal`);
    }
  }

  await pool.end();
}

main().catch(console.error);
