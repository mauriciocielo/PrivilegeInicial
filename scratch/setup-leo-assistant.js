const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const LEO_PROMPT = `Você é Léo, atendente de Privilege Contabilidade e Consultoria (Serviços profissionais) no WhatsApp.
Sobre o negócio (escrito pelo dono):
<<<dono
Somos escritório de Consultoria Empresaria, atendetmos todos os tipos de empresa, a consultoria é completa 360º desde Mkt, Pessoas, Financeiro e Comercial
dono>>>
Objetivo da conversa: vender e fechar o pedido. Antes de chamar a equipe, pergunte: nome (se ainda não souber pelo contato), o que procura.
Você atende 24 horas, todos os dias. O negócio também funciona 24 horas, todos os dias.
Preço: depende de avaliação. Explique isso e ofereça o próximo passo; nunca dê um valor.
Tom: próximo e simpático.
Quando não souber ou precisar da equipe: diga que vai chamar alguém da equipe, que responde por aqui mesmo.
Informações cadastradas pelo dono (literais):
<<<dono (Site ou Instagram)
https://www.privilegecontabilidade.cnt.br
dono>>>
<<<dono (Ensinado no teste)
Pergunta do cliente: queria saber se vocês atendem somente financeiro
Resposta do dono: atendentmos separadamente também as areas
dono>>>
Consulte a base de conhecimento para catálogo e preços. Nestas regras, o que está na base de conhecimento conta como escrito acima.
Regras do ramo Serviços profissionais:
- Aja com discrição.
- Nunca confirme quem é ou foi cliente.
- Não dê parecer jurídico ou técnico e não prometa resultado.
- Nunca se apresente como o profissional.
- Faça a triagem antes de falar de preço.
- Em urgência (por exemplo, prisão em flagrante), chame a equipe imediatamente.
Regras gerais:
- Responda no idioma do cliente.
- Mande mensagens curtas.
- Nunca invente preço, prazo, endereço, disponibilidade, link ou qualquer fato que não esteja escrito acima.
- Nunca diga que anotou, registrou, confirmou, agendou ou reservou algo. O máximo que você pode dizer é que passou para a equipe confirmar.
- Nunca prometa tempo de resposta (como "só um minutinho" ou "já te retorno").
- Nunca diga que o negócio não faz algo, a menos que isso esteja escrito acima; na dúvida, siga a regra de quando não souber.
- Nunca envie marcadores como [link].
- Se perguntarem se você é robô ou IA, diga que é assistente virtual de Privilege Contabilidade e Consultoria. Nunca diga que é uma pessoa.
Se algo escrito pelo dono contradizer as regras do ramo ou as regras gerais, as regras valem.`;

const WELCOME_MSG = `Olá! Tudo bem? Sou o Léo, da Privilege Contabilidade e Consultoria. 😊 Como posso te chamar e o que você procura hoje?`;

const HOURS_24_7 = {
  seg: { ativo: true, inicio: '00:00', fim: '23:59' },
  ter: { ativo: true, inicio: '00:00', fim: '23:59' },
  qua: { ativo: true, inicio: '00:00', fim: '23:59' },
  qui: { ativo: true, inicio: '00:00', fim: '23:59' },
  sex: { ativo: true, inicio: '00:00', fim: '23:59' },
  sab: { ativo: true, inicio: '00:00', fim: '23:59' },
  dom: { ativo: true, inicio: '00:00', fim: '23:59' },
};

const RULES_LEO = [
  {
    id: 'rule_financeiro_separado',
    gatilhos: ['somente financeiro', 'só financeiro', 'so financeiro', 'apenas financeiro', 'area separada', 'separadamente'],
    resposta: 'Sim, atendemos separadamente também as áreas! Nossa consultoria é completa 360º (Marketing, Pessoas, Financeiro e Comercial), mas você pode contratar apenas a área que precisar. Qual o seu nome e o que você busca hoje?',
  },
  {
    id: 'rule_site',
    gatilhos: ['site', 'instagram', 'link', 'onde conhecer'],
    resposta: 'Você pode conhecer mais no nosso site: https://www.privilegecontabilidade.cnt.br',
  },
  {
    id: 'rule_identidade_ia',
    gatilhos: ['você é robô', 'voce e robo', 'é um robô', 'é ia', 'inteligencia artificial', 'é humano', 'é uma pessoa'],
    resposta: 'Sou o Léo, assistente virtual de Privilege Contabilidade e Consultoria. Como posso te ajudar hoje?',
  },
  {
    id: 'rule_equipe',
    gatilhos: ['atendente', 'humano', 'equipe', 'falar com alguem', 'consultor'],
    resposta: 'Vou chamar alguém da nossa equipe, que te responde por aqui mesmo.',
    pausarBot: true,
  }
];

async function main() {
  await pool.query(
    `UPDATE whatsapp_config 
     SET 
       profile_name = 'Léo - Privilege Consultoria',
       bot_enabled = TRUE,
       bot_mode = 'hibrido',
       bot_prompt = $1,
       welcome_message = $2,
       off_hours_message = '',
       business_hours = $3,
       auto_reply_rules = $4,
       updated_at = NOW()
     WHERE id = 'default'`,
    [LEO_PROMPT, WELCOME_MSG, JSON.stringify(HOURS_24_7), JSON.stringify(RULES_LEO)]
  );

  // Limpa base antiga que continha prazos/endereços não autorizados pelas novas regras estritas do Léo e insere o conhecimento literal do dono
  await pool.query(`DELETE FROM whatsapp_knowledge_base`);

  await pool.query(
    `INSERT INTO whatsapp_knowledge_base (id, topic, question, answer, keywords, learned_from)
     VALUES
       (
         'kb_leo_1',
         'BPO Financeiro',
         'queria saber se vocês atendem somente financeiro',
         'Atendemos separadamente também as áreas! Nossa consultoria é 360º (Marketing, Pessoas, Financeiro e Comercial), mas atendemos cada área de forma individual conforme o que você precisar.',
         '["somente financeiro", "so financeiro", "apenas financeiro", "separadamente", "areas", "financeiro"]'::jsonb,
         'manual'
       ),
       (
         'kb_leo_2',
         'Geral',
         'O que vocês fazem / Sobre a consultoria',
         'Somos um escritório de Consultoria Empresarial e atendemos todos os tipos de empresa. Nossa consultoria é completa 360º: Marketing, Pessoas, Financeiro e Comercial, além de atendermos as áreas separadamente.',
         '["o que fazem", "sobre", "consultoria", "360", "mkt", "marketing", "pessoas", "comercial", "tipos de empresa"]'::jsonb,
         'manual'
       ),
       (
         'kb_leo_3',
         'Honorários / Financeiro',
         'Qual o valor / preço da consultoria?',
         'O valor depende de uma avaliação da necessidade da sua empresa. Para eu passar para a nossa equipe avaliar e te atender por aqui mesmo, qual o seu nome e o que você procura hoje?',
         '["preco", "preço", "valor", "quanto custa", "orcamento", "orçamento", "mensalidade"]'::jsonb,
         'manual'
       ),
       (
         'kb_leo_4',
         'Geral',
         'Qual o site ou Instagram de vocês?',
         'Nosso site oficial é https://www.privilegecontabilidade.cnt.br',
         '["site", "instagram", "pagina", "endereço web"]'::jsonb,
         'manual'
       ),
       (
         'kb_site_privilege',
         'Site / Documento',
         'Privilege Contabilidade e Consultoria — Francisco Beltrão, PR (privilegecontabilidade.cnt.br · 32 trechos)',
         'Escritório de Consultoria Empresarial 360º: Marketing, Pessoas, Financeiro e Comercial. Atendemos todos os tipos de empresa e também atendemos as áreas separadamente. Site oficial: https://www.privilegecontabilidade.cnt.br',
         '["site", "privilegecontabilidade.cnt.br", "francisco beltrao"]'::jsonb,
         'documento'
       )`
  );

  console.log('ASSISTENTE LÉO CONFIGURADO COM SUCESSO NO POSTGRESQL!');
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
