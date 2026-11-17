const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const sql = `
    ALTER TABLE whatsapp_chats 
    ADD COLUMN IF NOT EXISTS triage_data JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS triage_summary TEXT,
    ADD COLUMN IF NOT EXISTS triage_status VARCHAR(50) DEFAULT 'em_andamento';

    -- Exemplo de resumo de triagem em um chat existente
    UPDATE whatsapp_chats 
    SET 
      triage_status = 'transferido_humano',
      triage_summary = '📋 TRIAGEM DO ASSISTENTE:\n• Empresa: Tech Beltrão Soluções Digitais\n• Demanda: Dúvida sobre retenção de ISS na NFS-e nº 450.\n• Documentos: Já enviados no portal.\n• Ação necessária: Validação da alíquota pelo consultor fiscal.',
      bot_paused_until = NOW() + INTERVAL '40 minutes'
    WHERE id = 'chat_5546998887766';
  `;

  await pool.query(sql);
  console.log('CAMPOS DE TRIAGEM E MAPEAMENTO ADICIONADOS COM SUCESSO!');
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
