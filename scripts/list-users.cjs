require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const res = await pool.query('SELECT id, name, email, role, "allowedRoutes", "empresaIds" FROM "User";');
  console.log('Users in DB:');
  for (const u of res.rows) {
    console.log(`- ID: ${u.id} | Name: ${u.name} | Email: ${u.email} | Role: ${u.role}`);
    console.log(`  AllowedRoutes:`, u.allowedRoutes);
    console.log(`  EmpresaIds (${u.empresaIds?.length || 0}):`, u.empresaIds?.slice(0, 5));
  }
  await pool.end();
}

main().catch(console.error);
