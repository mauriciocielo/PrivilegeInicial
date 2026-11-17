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
    CREATE TABLE IF NOT EXISTS whatsapp_knowledge_base (
      id VARCHAR(100) PRIMARY KEY,
      topic VARCHAR(100) DEFAULT 'Geral',
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      keywords JSONB DEFAULT '[]',
      learned_from VARCHAR(50) DEFAULT 'manual',
      usage_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_wa_kb_topic ON whatsapp_knowledge_base (topic);

    -- Insere primeiras lições ensinadas padrão para o escritório
    INSERT INTO whatsapp_knowledge_base (id, topic, question, answer, keywords, learned_from)
    VALUES
      (
        'kb_1',
        'Tributário / Fiscal',
        'Qual o prazo de envio do SPED Fiscal e SPED Contribuições?',
        'O SPED Fiscal e a EFD Contribuições devem ser transmitidos mensalmente até o 15º dia útil do segundo mês subsequente. Nossa equipe fiscal da Privilege realiza a apuração e fechamento com antecedência para validar todos os créditos.',
        '["sped", "prazo sped", "efd", "arquivo fiscal", "data sped"]'::jsonb,
        'manual'
      ),
      (
        'kb_2',
        'Honorários / Financeiro',
        'Como funciona o pagamento dos honorários contábeis?',
        'Nossos honorários têm vencimento padrão todo dia 20 de cada mês. O boleto e a NFS-e são enviados automaticamente por e-mail e ficam disponíveis no portal do cliente (privilegecontabilidade.cnt.br). Também aceitamos chave PIX CNPJ: 58.033.979/0001-84.',
        '["honorarios", "pagamento", "boleto", "vencimento", "pix", "fatura"]'::jsonb,
        'manual'
      ),
      (
        'kb_3',
        'DP / Folha',
        'Qual a documentação necessária para admissão de um novo colaborador?',
        'Para admissão, precisamos de: RG, CPF, Carteira de Trabalho Digital, Título de Eleitor, Comprovante de Residência, ASO Admissional (Exame Médico), Certidão de Casamento/Nascimento dos Filhos e número do PIS. O envio dos dados deve ser feito com pelo menos 48h de antecedência do início das atividades.',
        '["admissao", "admitir", "contratar", "documentos funcionario", "exame admissional", "registro"]'::jsonb,
        'manual'
      ),
      (
        'kb_4',
        'CND / Regularidade',
        'Como emitir a Certidão Negativa de Débitos (CND)?',
        'A Privilege possui monitoramento automático 24/7 das certidões Federal (Receita/PGFN), Estadual (Receita Estadual PR) e Municipal. Caso precise de uma via em PDF atualizada agora, basta solicitar informando seu CNPJ que emitimos de imediato.',
        '["cnd", "certidao", "certidão", "negativa", "receita federal", "regularidade fiscal"]'::jsonb,
        'manual'
      )
    ON CONFLICT (id) DO NOTHING;
  `;

  await pool.query(sql);
  console.log('TABELA DE APRENDIZADO (whatsapp_knowledge_base) CRIADA COM SUCESSO!');
  await pool.end();
}

main().catch(err => {
  console.error('Erro na criação da base de conhecimento:', err);
  process.exit(1);
});
