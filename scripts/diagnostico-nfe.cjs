require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const dist = await pool.query(`
    SELECT d.*, e."razaoSocial", e.cnpj, e.uf
    FROM "NfeDistribuicao" d
    JOIN "Empresa" e ON e.id = d."empresaId"
    LIMIT 20;
  `);

  console.log('--- NfeDistribuicao registros ---');
  console.log(JSON.stringify(dist.rows, null, 2));

  const countDest = await pool.query(`SELECT count(*) FROM "NfeDestinada"`);
  console.log('Total notas em NfeDestinada:', countDest.rows[0].count);

  if (Number(countDest.rows[0].count) > 0) {
    const notas = await pool.query(`SELECT id, "chaveAcesso", "emitenteCnpj", "emitenteNome", "dataEmissao", "valorNf", "tipoOperacao" FROM "NfeDestinada" LIMIT 5`);
    console.log('Exemplos de notas:', notas.rows);
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

