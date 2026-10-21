# 🔐 Credenciais de Teste - Sistema de Fluxo de Caixa

## Atualização de Dados (2026-10-20)

Os dados de teste foram atualizados e o servidor foi reiniciado com os seguintes dados:

### ✅ Usuários de Teste

#### 1. **Cliente** (acesso ao portal cliente)
- **Email**: `cliente@empresa.com`
- **Senha**: `123456`
- **ID da Empresa**: `emp_teste_001`
- **Função**: Pode visualizar dados financeiros da empresa atribuída

#### 2. **Consultor/Admin** (acesso completo)
- **Email**: `consultor@sistema.com`
- **Senha**: `123456`
- **ID da Empresa**: `emp_teste_001`
- **Função**: Pode criar, editar e excluir lançamentos

#### 3. **Privilege Consultoria** (acesso admin)
- **Email**: `consultoria@privilegecontabilidade.com.br`
- **Senha**: `145236`
- **ID da Empresa**: `emp_teste_001`
- **Função**: Admin com acesso completo

---

## 📊 Dados de Teste Carregados

### Empresa
- **ID**: `emp_teste_001`
- **Nome Fantasia**: Empresa Teste
- **CNPJ**: 12.345.678/0001-90
- **Responsável**: João Silva

### Portadores
1. **Conta Corrente Principal** - Saldo R$ 50.000,00
2. **Caixa** - Saldo R$ 5.000,00

### Lançamentos (4 registros)
1. **Prestação de Serviços - Cliente ABC** (15/10/2024)
   - Valor: R$ 5.000,00
   - Tipo: Receita
   - Status: Realizado

2. **Aluguel do Escritório** (10/10/2024)
   - Valor: R$ 3.000,00
   - Tipo: Despesa
   - Status: Realizado

3. **Compra de Materiais** (12/10/2024)
   - Valor: R$ 1.500,00
   - Tipo: Despesa
   - Status: Realizado

4. **Prestação de Serviços - Cliente XYZ** (18/10/2024)
   - Valor: R$ 8.000,00
   - Tipo: Receita
   - Status: Previsto

---

## 🧪 Como Testar

### Teste 1: Login como Cliente
1. Acesse `http://localhost:3000`
2. Faça login com email: `cliente@empresa.com` / senha: `123456`
3. Verifique se o **Dashboard** carrega os dados da empresa `emp_teste_001`
4. Clique em **Lançamentos** e veja os 4 registros de teste

### Teste 2: Verificar Sincronização
1. Abra dois navegadores (um com cliente, outro com consultor)
2. No portal do cliente, verifique os lançamentos listados
3. No portal do consultor, crie um novo lançamento
4. No portal do cliente, recarregue e veja o novo lançamento aparecer

### Teste 3: Verificar Plano de Contas
1. Acesse a seção de **Plano de Contas**
2. Verifique se aparece a estrutura padrão com contas associadas a `emp_teste_001`

---

## 🔧 Resolução do Problema Original

✅ **Problema Resolvido**: 
- Usuários clientes agora têm a empresa `emp_teste_001` atribuída (`empresaIds: ['emp_teste_001']`)
- O frontend foi corrigido em 5 arquivos para inicializar dinamicamente o `empresaId` a partir do usuário autenticado
- Os dados agora aparecem no portal cliente

### Arquivos Modificados
1. ✅ `app/cliente/dashboard/page.tsx` - Inicialização dinâmica
2. ✅ `app/cliente/lancamentos/page.tsx` - Inicialização dinâmica
3. ✅ `app/cliente/extrato/page.tsx` - Inicialização dinâmica
4. ✅ `app/cliente/inteligencia/page.tsx` - Inicialização dinâmica
5. ✅ `app/cliente/importar-ofx/page.tsx` - Inicialização dinâmica
6. ✅ `lib/store.ts` - Dados de teste populados em `DEFAULT_USERS` e `DEFAULT_EMPRESAS`

---

## 📝 Notas

- Os dados de teste são carregados automaticamente na inicialização
- Todos os usuários têm acesso à empresa `emp_teste_001`
- A autenticação ainda funciona com RBAC (role-based access control)
- O servidor está rodando em `http://localhost:3000`

---

**Próximo Passo**: Abra seu navegador, faça login e teste!
