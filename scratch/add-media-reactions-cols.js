const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await pool.query(`
    ALTER TABLE whatsapp_messages
    ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS wa_key JSONB,
    ADD COLUMN IF NOT EXISTS file_name TEXT;

    ALTER TABLE whatsapp_chats
    ADD COLUMN IF NOT EXISTS remote_jid TEXT;
  `);
  console.log('COLUNAS DE MIDIA, REACOES E JID ADICIONADAS COM SUCESSO!');
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
