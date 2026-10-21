/**
 * Script para popular dados de teste no localStorage
 * Execute com: node scripts/seed-test-data.js
 */

const fs = require('fs');
const path = require('path');

// Simular localStorage
const storage = {};

function getItem(key) {
  return storage[key] || null;
}

function setItem(key, value) {
  storage[key] = value;
  console.log(`✅ [${key}] = ${value.substring(0, 100)}...`);
}

// Criar empresa de teste
const empresas = [
  {
    id: 'emp_teste_001',
    razaoSocial: 'Empresa Teste LTDA',
    nomeFantasia: 'Empresa Teste',
    cnpj: '12.345.678/0001-90',
    responsavel: 'João Silva',
    email: 'contato@empresa-teste.com',
    telefone: '(11) 99999-9999',
    atividade: 'Serviço',
    tipo: 'empresa',
    createdAt: new Date().toISOString(),
  }
];

// Atualizar usuários com empresa atribuída
const users = [
  {
    id: 'u1',
    name: 'Admin Consultor',
    email: 'consultor@sistema.com',
    password: '123456',
    role: 'administrador',
    empresaIds: ['emp_teste_001'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u2',
    name: 'João Silva',
    email: 'cliente@empresa.com',
    password: '123456',
    role: 'cliente',
    empresaIds: ['emp_teste_001'],  // ✅ Agora tem empresa atribuída!
    createdAt: new Date().toISOString(),
  },
];

// Plano de contas padrão
const planoContas = [
  { id: 'pc1', codigo: '1', descricao: 'RECEITAS OPERACIONAIS', tipo: 'receita', nivel: 1, ativo: true, empresaId: 'emp_teste_001' },
  { id: 'pc1_1_1', codigo: '1.1.1', descricao: 'Prestação de Serviços', tipo: 'receita', nivel: 3, parentId: 'pc1', ativo: true, empresaId: 'emp_teste_001' },
  { id: 'pc2', codigo: '2', descricao: 'CUSTOS OPERACIONAIS', tipo: 'despesa', nivel: 1, ativo: true, empresaId: 'emp_teste_001' },
  { id: 'pc2_1_1', codigo: '2.1.1', descricao: 'Materiais e Insumos', tipo: 'despesa', nivel: 3, parentId: 'pc2', ativo: true, empresaId: 'emp_teste_001' },
  { id: 'pc3', codigo: '3', descricao: 'DESPESAS OPERACIONAIS', tipo: 'despesa', nivel: 1, ativo: true, empresaId: 'emp_teste_001' },
  { id: 'pc3_1_1', descricao: 'Aluguel', codigo: '3.1.1', tipo: 'despesa', nivel: 3, parentId: 'pc3', ativo: true, empresaId: 'emp_teste_001' },
  { id: 'pc6', codigo: '6', descricao: 'Transferências', tipo: 'transferencia', nivel: 1, ativo: true, empresaId: 'emp_teste_001' },
  { id: 'pc6_1_1', codigo: '6.1.1', descricao: 'Transferência Entrada', tipo: 'transferencia', nivel: 3, parentId: 'pc6', ativo: true, empresaId: 'emp_teste_001' },
];

// Portadores padrão
const portadores = [
  { id: 'port_teste_1', nome: 'Conta Corrente Principal', tipo: 'conta_corrente', saldoInicial: 50000, saldoInicialData: '2024-01-01', ativo: true, empresaId: 'emp_teste_001' },
  { id: 'port_teste_2', nome: 'Caixa', tipo: 'caixa', saldoInicial: 5000, saldoInicialData: '2024-01-01', ativo: true, empresaId: 'emp_teste_001' },
];

// Lançamentos de teste criados pelo consultor
const lancamentos = [
  {
    id: 'lanc_001',
    empresaId: 'emp_teste_001',
    data: '2024-10-15',
    descricao: 'Prestação de Serviços - Cliente ABC',
    valor: 5000,
    tipo: 'receita',
    planoContaId: 'pc1_1_1',
    portadorId: 'port_teste_1',
    status: 'realizado',
    origem: 'manual',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'lanc_002',
    empresaId: 'emp_teste_001',
    data: '2024-10-10',
    descricao: 'Aluguel do Escritório',
    valor: 3000,
    tipo: 'despesa',
    planoContaId: 'pc3_1_1',
    portadorId: 'port_teste_1',
    status: 'realizado',
    origem: 'manual',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'lanc_003',
    empresaId: 'emp_teste_001',
    data: '2024-10-12',
    descricao: 'Compra de Materiais',
    valor: 1500,
    tipo: 'despesa',
    planoContaId: 'pc2_1_1',
    portadorId: 'port_teste_1',
    status: 'realizado',
    origem: 'manual',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'lanc_004',
    empresaId: 'emp_teste_001',
    data: '2024-10-18',
    descricao: 'Prestação de Serviços - Cliente XYZ',
    valor: 8000,
    tipo: 'receita',
    planoContaId: 'pc1_1_1',
    portadorId: 'port_teste_1',
    status: 'previsto',
    origem: 'manual',
    createdAt: new Date().toISOString(),
  },
];

// Salvar no localStorage (simulated)
setItem('cf_users', JSON.stringify(users));
setItem('cf_empresas', JSON.stringify(empresas));
setItem('cf_plano_contas', JSON.stringify(planoContas));
setItem('cf_portadores', JSON.stringify(portadores));
setItem('cf_lancamentos', JSON.stringify(lancamentos));
setItem('cf_storage_version', '8');

// Salvar em arquivo JSON para referência
const testData = {
  users,
  empresas,
  planoContas,
  portadores,
  lancamentos,
};

fs.writeFileSync(
  path.join(__dirname, '../test-data.json'),
  JSON.stringify(testData, null, 2)
);

console.log('\n' + '='.repeat(60));
console.log('✅ DADOS DE TESTE POPULADOS COM SUCESSO!');
console.log('='.repeat(60) + '\n');

console.log('📋 CREDENCIAIS DE TESTE:\n');
console.log('👤 CLIENTE:');
console.log('   Email: cliente@empresa.com');
console.log('   Senha: 123456');
console.log('   Empresa: emp_teste_001\n');

console.log('👨‍💼 CONSULTOR/ADMIN:');
console.log('   Email: consultor@sistema.com');
console.log('   Senha: 123456\n');

console.log('📊 DADOS CARREGADOS:');
console.log(`   ✅ ${empresas.length} empresa(s)`);
console.log(`   ✅ ${users.length} usuário(s)`);
console.log(`   ✅ ${planoContas.length} plano(s) de contas`);
console.log(`   ✅ ${portadores.length} portador(es)`);
console.log(`   ✅ ${lancamentos.length} lançamento(s)\n`);

console.log('🚀 Próximo passo: Recarregue o navegador em http://localhost:3000');
console.log('   e faça login com o cliente para ver os lançamentos!\n');
