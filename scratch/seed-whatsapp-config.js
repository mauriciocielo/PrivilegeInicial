const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const check = await pool.query(`SELECT id FROM whatsapp_config WHERE id = 'default'`);
  if (check.rows.length === 0) {
    const rules = [
      {
        id: "rule_1",
        gatilhos: ["1", "boleto", "honorarios", "segunda via", "pagamento"],
        resposta: "Para consultar ou emitir a 2ª via dos seus honorários ou boletos, você também pode acessar nosso portal: https://privilegecontabilidade.cnt.br/login ou informe o CNPJ da sua empresa aqui para localizarmos."
      },
      {
        id: "rule_2",
        gatilhos: ["2", "comprovante", "anexo", "nota fiscal", "xml"],
        resposta: "Recebemos o seu documento! Nossa equipe fiscal e contábil fará o lançamento e a conciliação no sistema da Privilege."
      },
      {
        id: "rule_3",
        gatilhos: ["3", "cnd", "certidao", "certidão", "negativa", "receita federal"],
        resposta: "As certidões fiscais (Federal, Estadual e Municipal) são monitoradas automaticamente pelo nosso sistema. Caso precise de uma via atualizada em PDF, nossa equipe pode emitir em instantes!"
      },
      {
        id: "rule_4",
        gatilhos: ["4", "consultoria", "planejamento", "bpo", "abertura"],
        resposta: "Nossa divisão de consultoria estratégica lidera inteligência financeira, reestruturação de fluxo de caixa e planejamento tributário. Um de nossos consultores falará com você a seguir."
      },
      {
        id: "rule_5",
        gatilhos: ["5", "atendente", "humano", "falar", "ajuda", "pessoa"],
        resposta: "Transferindo você para um atendente humano da nossa equipe! O bot foi pausado para esta conversa e você será atendido em instantes. 👤",
        pausarBot: true
      }
    ];

    const businessHours = {
      seg: { ativo: true, inicio: "08:00", fim: "18:00" },
      ter: { ativo: true, inicio: "08:00", fim: "18:00" },
      qua: { ativo: true, inicio: "08:00", fim: "18:00" },
      qui: { ativo: true, inicio: "08:00", fim: "18:00" },
      sex: { ativo: true, inicio: "08:00", fim: "18:00" },
      sab: { ativo: false, inicio: "08:00", fim: "12:00" },
      dom: { ativo: false, inicio: "00:00", fim: "00:00" }
    };

    const quickReplies = [
      { id: "qr_1", titulo: "Chave PIX Escritório", texto: "Nossa chave PIX oficial é o CNPJ: 58.033.979/0001-84 (Privilege Consultoria LTDA)." },
      { id: "qr_2", titulo: "Endereço Físico", texto: "Nosso escritório fica na Rua Pará, 127, Sala 103, Centro – Francisco Beltrão / PR · CEP 85.601-290." },
      { id: "qr_3", titulo: "Portal do Cliente", texto: "Acesse todos os seus relatórios e conciliações em: https://privilegecontabilidade.cnt.br/login" }
    ];

    const welcomeMsg = `Olá! Seja bem-vindo(a) à *Privilege Contabilidade e Consultoria*. 📊\n\nComo podemos te ajudar hoje?\n1️⃣ - Segunda via de Boleto / Honorários\n2️⃣ - Envio de Comprovante ou Nota Fiscal\n3️⃣ - Certidões Negativas (CNDs)\n4️⃣ - Consultoria Tributária / Financeira\n5️⃣ - Falar com Atendente Humano`;
    const offHoursMsg = `Olá! Nosso horário de atendimento é de *Segunda a Sexta-feira, das 08:00 às 18:00*. ⏰\n\nSua mensagem foi registrada com sucesso e retornaremos assim que iniciarmos nosso expediente!`;
    const botPrompt = `Você é o Assistente Virtual Oficial da Privilege Contabilidade e Consultoria (CRC-PR 082974/O-7), liderada por Maurício Cielo. Seja educado, conciso, focado em contabilidade, BPO financeiro e planejamento tributário. Se não souber a resposta exata de uma empresa específica, oriente o cliente a aguardar um atendente humano.`;

    await pool.query(
      `INSERT INTO whatsapp_config (
        id, provider, api_url, api_key, instance_name, status,
        bot_enabled, bot_mode, bot_prompt, welcome_message, off_hours_message,
        business_hours, auto_reply_rules, quick_replies, human_takeover_minutes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        'default', 'evolution',
        process.env.WHATSAPP_API_URL || 'https://api.evolution-api.com',
        process.env.WHATSAPP_API_KEY || '',
        'privilege', 'desconectado',
        true, 'hibrido', botPrompt, welcomeMsg, offHoursMsg,
        JSON.stringify(businessHours), JSON.stringify(rules), JSON.stringify(quickReplies),
        30
      ]
    );
    console.log('CONFIGURAÇÃO PADRÃO INSERIDA COM SUCESSO!');
  } else {
    console.log('CONFIGURAÇÃO PADRÃO JÁ EXISTE.');
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
