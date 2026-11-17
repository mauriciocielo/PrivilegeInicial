const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const check = await pool.query(`SELECT COUNT(*) FROM whatsapp_chats`);
  if (parseInt(check.rows[0].count, 10) === 0) {
    console.log('Inserindo conversas de demonstração...');

    const sampleChats = [
      {
        id: 'chat_5546991112233',
        phone: '+55 46 99111-2233',
        name: 'Auto Posto Alvorada LTDA',
        last_message: 'Perfeito, muito obrigado! O bot tirou a dúvida na hora.',
        unread_count: 0,
        bot_enabled: true,
        tags: ['Cliente', 'Simples Nacional', 'Combustíveis']
      },
      {
        id: 'chat_5546998887766',
        phone: '+55 46 99888-7766',
        name: 'Tech Beltrão Soluções Digitais',
        last_message: 'Bom dia! Gostaria de falar com o consultor sobre a retenção de ISS.',
        unread_count: 2,
        bot_enabled: true,
        tags: ['Cliente', 'Lucro Presumido', 'Serviços TI']
      },
      {
        id: 'chat_5546984045566',
        phone: '+55 46 98404-5566',
        name: 'Transportadora Sudoeste PR',
        last_message: '1',
        unread_count: 0,
        bot_enabled: true,
        tags: ['Cliente', 'BPO Financeiro', 'Transporte']
      }
    ];

    for (const c of sampleChats) {
      await pool.query(
        `INSERT INTO whatsapp_chats (id, phone, name, last_message, last_message_time, unread_count, bot_enabled, tags)
         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '10 minutes', $5, $6, $7)`,
        [c.id, c.phone, c.name, c.last_message, c.unread_count, c.bot_enabled, JSON.stringify(c.tags)]
      );
    }

    // Mensagens da primeira conversa
    await pool.query(
      `INSERT INTO whatsapp_messages (id, chat_id, from_me, sender_name, text, timestamp, sent_by) VALUES
       ('m1', 'chat_5546991112233', FALSE, 'Auto Posto Alvorada', 'Olá, tudo bem? Preciso da CND Federal atualizada.', NOW() - INTERVAL '25 minutes', 'cliente'),
       ('m2', 'chat_5546991112233', TRUE, 'Bot IA Privilege', 'As certidões fiscais (Federal, Estadual e Municipal) são monitoradas automaticamente pelo nosso sistema. Caso precise de uma via atualizada em PDF, nossa equipe pode emitir em instantes!', NOW() - INTERVAL '24 minutes', 'bot'),
       ('m3', 'chat_5546991112233', FALSE, 'Auto Posto Alvorada', 'Perfeito, muito obrigado! O bot tirou a dúvida na hora.', NOW() - INTERVAL '10 minutes', 'cliente')`
    );

    // Mensagens da segunda conversa
    await pool.query(
      `INSERT INTO whatsapp_messages (id, chat_id, from_me, sender_name, text, timestamp, sent_by) VALUES
       ('m4', 'chat_5546998887766', FALSE, 'Tech Beltrão', 'Bom dia! Gostaria de falar com o consultor sobre a retenção de ISS.', NOW() - INTERVAL '15 minutes', 'cliente'),
       ('m5', 'chat_5546998887766', FALSE, 'Tech Beltrão', 'Podem me ajudar por gentileza?', NOW() - INTERVAL '12 minutes', 'cliente')`
    );

    // Mensagens da terceira conversa
    await pool.query(
      `INSERT INTO whatsapp_messages (id, chat_id, from_me, sender_name, text, timestamp, sent_by) VALUES
       ('m6', 'chat_5546984045566', FALSE, 'Transportadora Sudoeste', '1', NOW() - INTERVAL '5 minutes', 'cliente'),
       ('m7', 'chat_5546984045566', TRUE, 'Bot IA Privilege', 'Para consultar ou emitir a 2ª via dos seus honorários ou boletos, você também pode acessar nosso portal: https://privilegecontabilidade.cnt.br/login ou informe o CNPJ da sua empresa aqui para localizarmos.', NOW() - INTERVAL '4 minutes', 'bot')`
    );

    console.log('Conversas e mensagens iniciais inseridas com sucesso!');
  } else {
    console.log('Conversas já existem no banco.');
  }

  await pool.end();
}

main().catch(console.error);
