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
    CREATE TABLE IF NOT EXISTS email_queue (
      id VARCHAR(100) PRIMARY KEY,
      empresa_id VARCHAR(100),
      assunto TEXT NOT NULL,
      mensagem TEXT,
      somente_imagem BOOLEAN DEFAULT FALSE,
      link_imagem TEXT,
      imagens JSONB,
      total_destinatarios INT DEFAULT 0,
      tamanho_lote INT DEFAULT 70,
      intervalo_minutos INT DEFAULT 65,
      destinatarios_pendentes JSONB,
      destinatarios_enviados JSONB,
      destinatarios_falhas JSONB,
      status VARCHAR(30) DEFAULT 'aguardando',
      criado_em TIMESTAMPTZ DEFAULT NOW(),
      ultimo_lote_em TIMESTAMPTZ,
      proximo_lote_em TIMESTAMPTZ,
      erro_ultima_tentativa TEXT,
      smtp_user_custom TEXT,
      smtp_pass_custom TEXT
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id VARCHAR(100) PRIMARY KEY,
      empresa_id VARCHAR(100),
      tipo VARCHAR(50) DEFAULT 'newsletter',
      assunto TEXT,
      destinatario_email VARCHAR(255) NOT NULL,
      destinatario_nome VARCHAR(255),
      status VARCHAR(50) DEFAULT 'entregue',
      erro_mensagem TEXT,
      enviado_em TIMESTAMPTZ DEFAULT NOW(),
      visualizado_em TIMESTAMPTZ,
      baixado_em TIMESTAMPTZ,
      ip_acesso VARCHAR(100),
      user_agent TEXT,
      html TEXT
    );
  `;

  await pool.query(sql);
  console.log('TABLES email_queue AND email_logs CREATED/VERIFIED SUCCESSFULLY IN POSTGRESQL!');
  await pool.end();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});

