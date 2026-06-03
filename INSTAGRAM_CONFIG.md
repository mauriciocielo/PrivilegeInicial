# Configuração da API do Instagram (Instagram Basic Display API)

Este guia descreve detalhadamente como obter o token de acesso (`INSTAGRAM_ACCESS_TOKEN`) necessário para exibir as postagens dinâmicas do Instagram da **Privilege Contabilidade** no feed do site.

Se nenhum token estiver configurado, o site exibirá automaticamente um feed simulado (fallback premium) contendo fotos da sede e posts estratégicos institucionais.

---

## Passo 1: Criar uma Conta de Desenvolvedor da Meta

1. Acesse o portal [Meta for Developers](https://developers.facebook.com/) e faça login com a conta do Facebook associada à página comercial da empresa.
2. Se for o seu primeiro acesso, clique em **Começar (Get Started)** no canto superior direito e siga as etapas para registrar a conta de desenvolvedor.

---

## Passo 2: Criar um Aplicativo da Meta

1. No painel principal do Meta for Developers, clique em **Meus Aplicativos (My Apps)**.
2. Clique no botão **Criar aplicativo (Create App)**.
3. Escolha o tipo de aplicativo **Outro (Other)** e avance.
4. Escolha o tipo de aplicativo **Consumidor (Consumer)** ou **Nenhum** (o tipo de aplicativo que permite acesso à API de Exibição Básica do Instagram).
5. Defina um nome de exibição para o aplicativo (ex: `Privilege Web`) e insira o seu e-mail de contato.
6. Clique em **Criar aplicativo (Create App)**.

---

## Passo 3: Adicionar o Produto "Exibição Básica do Instagram"

1. Na barra lateral esquerda do painel do seu aplicativo, clique em **Adicionar produto** (se não estiver na tela principal).
2. Localize **Exibição básica do Instagram (Instagram Basic Display)** e clique em **Configurar (Set Up)**.
3. Leia as informações na tela e clique em **Criar novo aplicativo (Create New App)** no final da página.
4. Insira um nome de identificação (pode ser o mesmo nome do app) e confirme.

---

## Passo 4: Configurar URLs do Aplicativo

Você precisará definir URLs válidas para a integração (mesmo que em ambiente de desenvolvimento):

1. Vá em **Configurações do Cliente do Instagram** (dentro do produto Exibição Básica).
2. Preencha os campos abaixo com a URL do seu site (ou uma provisória, como `https://localhost:3000/` para testes):
   - **URLs válidas de redirecionamento do OAuth**
   - **Desautorizar URL de redirecionamento**
   - **URL de redirecionamento de solicitação de exclusão de dados**
3. Clique em **Salvar alterações**.

---

## Passo 5: Adicionar um Usuário de Teste do Instagram

Como o aplicativo não passou pela revisão pública da Meta, você precisa adicionar a conta oficial do Instagram como testadora para gerar o token:

1. No menu lateral, acesse **Funções (Roles)** -> **Funções (Roles)**.
2. Role até a seção **Testadores do Instagram (Instagram Testers)**.
3. Clique em **Adicionar testadores do Instagram (Add Instagram Testers)**.
4. Insira o nome de usuário da conta do Instagram oficial (ex: `privilgefb`) e clique em **Enviar**.
5. Agora, **faça login na conta do Instagram** (`privilgefb`) em um navegador.
6. Acesse as **Configurações** da conta do Instagram -> **Apps e sites** -> **Testadores**.
7. Aceite o convite do seu aplicativo de desenvolvimento.

---

## Passo 6: Gerar o Token de Acesso

1. Volte ao painel do [Meta for Developers](https://developers.facebook.com/).
2. No menu lateral esquerdo, expanda **Instagram** e clique em **Exibição básica (Basic Display)**.
3. Role a página até a seção **Gerador de token do Instagram (User Token Generator)**.
4. Você deverá ver a conta do Instagram aceita listada.
5. Clique no botão **Generate Token (Gerar Token)** ao lado do nome do usuário.
6. Faça login na conta do Instagram se solicitado e autorize a permissão de leitura de mídia.
7. Copie o token gerado (uma chave longa contendo letras e números).

> [!WARNING]
> Este token expira a cada 60 dias por padrão. A rota da API do site foi desenhada com cache automático, mas caso o token expire, será necessário renová-lo ou gerar um novo seguindo este passo.

---

## Passo 7: Inserir o Token no Projeto

### Desenvolvimento Local
Abra o arquivo `.env` localizado na raiz do projeto e insira o token na variável correspondente:

```env
INSTAGRAM_ACCESS_TOKEN="SEU_TOKEN_COPIADO_AQUI"
```

### Produção (Vercel ou Railway)
Se o site estiver implantado em uma plataforma de nuvem (como Railway ou Vercel), adicione a variável de ambiente diretamente no painel administrativo do serviço:
- **Nome da Variável**: `INSTAGRAM_ACCESS_TOKEN`
- **Valor**: O token longo gerado.

Depois de salvar e reiniciar os servidores, as postagens mais recentes do feed da **Privilege Contabilidade** começarão a carregar em tempo real no feed do site!
