const fs = require('fs');

async function testParse() {
  const dados = JSON.parse(process.argv[2]);
  console.log('Chaves de dados:', Object.keys(dados));
  console.log('Declaração número:', dados.numeroDeclaracao);
  if (dados.declaracao) {
    console.log('Declaração:', JSON.stringify(dados.declaracao, null, 2));
  }
}
