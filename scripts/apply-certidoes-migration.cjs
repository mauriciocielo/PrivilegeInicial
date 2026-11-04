require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

async function applyMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const sql = fs.readFileSync('prisma/migrations/20261104120000_certidoes_fiscais_e_agendamento/migration.sql', 'utf8');
    console.log('Applying migration...');
    await pool.query(sql);
    console.log('Migration applied successfully to PostgreSQL!');
  } catch (err) {
    console.error('Error applying migration:', err);
  } finally {
    await pool.end();
  }
}

applyMigration();

