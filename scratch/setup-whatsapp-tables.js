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
    CREATE TABLE IF NOT EXISTS whatsapp_config (
      id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
      provider VARCHAR(50) DEFAULT 'evolution',
      api_url TEXT,
      api_key TEXT,
      instance_name VARCHAR(100) DEFAULT 'privilege',
      status VARCHAR(50) DEFAULT 'desconectado',
      phone_number VARCHAR(50),
      profile_name VARCHAR(100),
      profile_pic TEXT,
      qr_code TEXT,
      bot_enabled BOOLEAN DEFAULT TRUE,
      bot_mode VARCHAR(50) DEFAULT 'hibrido',
      bot_prompt TEXT,
      welcome_message TEXT,
      off_hours_message TEXT,
      business_hours JSONB,
      auto_reply_rules JSONB,
      quick_replies JSONB,
      human_takeover_minutes INT DEFAULT 30,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS whatsapp_chats (
      id VARCHAR(100) PRIMARY KEY,
      phone VARCHAR(50) NOT NULL,
      name VARCHAR(150),
      profile_pic TEXT,
      last_message TEXT,
      last_message_time TIMESTAMPTZ DEFAULT NOW(),
      unread_count INT DEFAULT 0,
      bot_enabled BOOLEAN DEFAULT TRUE,
      bot_paused_until TIMESTAMPTZ,
      tags JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id VARCHAR(100) PRIMARY KEY,
      chat_id VARCHAR(100) NOT NULL,
      from_me BOOLEAN DEFAULT FALSE,
      sender_name VARCHAR(150),
      text TEXT,
      media_type VARCHAR(50) DEFAULT 'text',
      media_url TEXT,
      status VARCHAR(50) DEFAULT 'recebido',
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      sent_by VARCHAR(50) DEFAULT 'cliente'
    );

    CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_id ON whatsapp_messages (chat_id, timestamp ASC);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_last_msg ON whatsapp_chats (last_message_time DESC);
  `;

  await pool.query(sql);
  console.log('TABELAS DO WHATSAPP E BOT CRIADAS COM SUCESSO NO POSTGRESQL!');
  await pool.end();
}

main().catch(err => {
  console.error('Erro na criação das tabelas:', err);
  process.exit(1);
});
