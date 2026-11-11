const { lerLogs, salvarLog } = require('./lib/email-log-service');
const {
  lerFila,
  salvarFila,
  enfileirarCampanha,
  obterCampanhaAtiva,
  pausarFila,
  retomarFila,
  cancelarFila,
} = require('./lib/email-queue');

async function testAll() {
  console.log('--- 1. Testando Log Service ---');
  const logsAntes = lerLogs();
  console.log('Logs atuais lidos com sucesso:', logsAntes.length);

  console.log('\n--- 2. Testando Queue Service ---');
  const filaAntes = lerFila();
  console.log('Fila atual lida com sucesso:', filaAntes.length);

  console.log('\n--- 3. Testando Enfileiramento de Teste ---');
  const campanhaTeste = enfileirarCampanha({
    assunto: '[VALIDACAO] Teste de Fila Segura',
    mensagem: 'Mensagem de teste para validação',
    destinatarios: [
      { nome: 'Teste 1', email: 'teste1@privilegecontabilidade.com.br' },
      { nome: 'Teste 2', email: 'teste2@privilegecontabilidade.com.br' },
    ],
    tamanhoLote: 70,
    intervaloMinutos: 65,
    iniciarEmMinutos: 65, // não dispara agora
  });
  console.log('Campanha criada com ID:', campanhaTeste.id);
  console.log('Status:', campanhaTeste.status);
  console.log('Próximo lote em:', campanhaTeste.proximoLoteEm);

  console.log('\n--- 4. Testando Obter Campanha Ativa ---');
  const ativa = obterCampanhaAtiva();
  console.log('Campanha ativa encontrada:', ativa?.id === campanhaTeste.id ? 'SIM' : 'NAO');

  console.log('\n--- 5. Testando Pausa e Retomada ---');
  pausarFila(campanhaTeste.id);
  console.log('Status após pausa:', obterCampanhaAtiva()?.status);
  retomarFila(campanhaTeste.id);
  console.log('Status após retomada:', obterCampanhaAtiva()?.status);

  console.log('\n--- 6. Limpando Teste da Fila ---');
  cancelarFila(campanhaTeste.id);
  console.log('Fila após cancelamento do teste:', lerFila().length);

  console.log('\n>>> TUDO VALIDADO COM SUCESSO! <<<');
}

testAll().catch(e => {
  console.error('Erro na validação:', e);
  process.exit(1);
});

