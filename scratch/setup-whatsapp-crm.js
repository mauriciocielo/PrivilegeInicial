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
    ADD COLUMN IF NOT EXISTS crm_stage VARCHAR(50) DEFAULT 'em_atendimento',
    ADD COLUMN IF NOT EXISTS crm_value NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(100) DEFAULT 'Maurício Cielo',
    ADD COLUMN IF NOT EXISTS followup_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS followup_note TEXT,
    ADD COLUMN IF NOT EXISTS internal_notes TEXT;

    -- Atualiza conversas de exemplo com dados de CRM
    UPDATE whatsapp_chats 
    SET crm_stage = 'em_atendimento', crm_value = 1850.00, followup_date = NOW() + INTERVAL '2 days', followup_note = 'Confirmar recebimento do boleto e envio do arquivo SPED'
    WHERE id = 'chat_5546991112233' AND (crm_stage IS NULL OR crm_stage = 'em_atendimento');

    UPDATE whatsapp_chats 
    SET crm_stage = 'aguardando_documentos', crm_value = 3200.00, followup_date = NOW() + INTERVAL '1 day', followup_note = 'Aguardando envio das notas fiscais de serviço para apuração de ISS'
    WHERE id = 'chat_5546998887766' AND (crm_stage IS NULL OR crm_stage = 'em_atendimento');

    UPDATE whatsapp_chats 
    SET crm_stage = 'fechado', crm_value = 4500.00, followup_date = NOW() + INTERVAL '7 days', followup_note = 'Reunião mensal de apresentação do fluxo de caixa e BPO'
    WHERE id = 'chat_5546984045566' AND (crm_stage IS NULL OR crm_stage = 'em_atendimento');
  `;

  await pool.query(sql);
  console.log('COLUNAS DE CRM ADICIONADAS COM SUCESSO A WHATSAPP_CHATS!');
  await pool.end();
}

main().catch(err => {
  console.error('Erro na migração de CRM:', err);
  process.exit(1);
});
