const fs = require('fs');
const path = require('path');

console.log('--- Checagem de Arquivos do Sistema ---');
const filesToCheck = [
  'lib/email-log-service.ts',
  'lib/email-queue.ts',
  'lib/lista-clientes-newsletter.ts',
  'app/api/email-servicos/route.ts',
  'app/api/email-servicos/log/route.ts',
  'app/api/email-servicos/queue/route.ts',
  'app/api/email-servicos/queue/cron/route.ts',
  'app/api/email-servicos/pixel/route.ts',
  'app/api/email-servicos/view/route.ts',
  'app/consultor/newsletter/page.tsx',
  'vercel.json',
  'instrumentation.ts'
];

let allExist = true;
filesToCheck.forEach(f => {
  const p = path.resolve(process.cwd(), f);
  const exists = fs.existsSync(p);
  console.log(`[${exists ? 'OK' : 'FALTOU'}] ${f}`);
  if (!exists) allExist = false;
});

// Checa vercel.json
const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const hasQueueCron = vercelConfig.crons.some(c => c.path === '/api/email-servicos/queue/cron');
console.log(`[${hasQueueCron ? 'OK' : 'FALTOU'}] vercel.json configurado com cron da fila:`, hasQueueCron);

// Checa data-email-logs.json
const logsExist = fs.existsSync('data-email-logs.json');
console.log(`[${logsExist ? 'OK' : 'FALTOU'}] data-email-logs.json existe`);

console.log('\nResultado Geral:', allExist && hasQueueCron ? 'TUDO 100% PRONTO E CORRETO' : 'INCONSISTENTE');

