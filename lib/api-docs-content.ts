// ============================================================
// CONTEÚDO DA DOCUMENTAÇÃO DA API v1 (CP/CR)
// ============================================================
// Fonte única — components/ApiDocumentation.tsx (tela) e lib/api-docs-pdf.ts
// (exportação) renderizam os dois a partir daqui. Texto com `crase` vira
// trecho monoespaçado nos dois formatos.

export type ApiDocBloco =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'codigo'; label?: string; codigo: string }
  | { tipo: 'endpoint'; verbo: 'POST' | 'GET' | 'DELETE'; rota: string }
  | { tipo: 'erros'; itens: { codigo: string; desc: string }[] };

export interface ApiDocSecao {
  titulo: string;
  blocos: ApiDocBloco[];
}

export type InlineToken = { tipo: 'texto' | 'codigo' | 'negrito'; conteudo: string };

/** Mini-marcação: `código` vira monoespaçado, **negrito** vira negrito. Compartilhado entre a tela e o PDF. */
export function tokenizarInline(texto: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const regex = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto))) {
    if (m.index > ultimo) tokens.push({ tipo: 'texto', conteudo: texto.slice(ultimo, m.index) });
    if (m[1] !== undefined) tokens.push({ tipo: 'codigo', conteudo: m[1] });
    else tokens.push({ tipo: 'negrito', conteudo: m[2] });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) tokens.push({ tipo: 'texto', conteudo: texto.slice(ultimo) });
  return tokens;
}

const texto = (texto: string): ApiDocBloco => ({ tipo: 'texto', texto });
const codigo = (codigo: string, label?: string): ApiDocBloco => ({ tipo: 'codigo', codigo, label });
const endpoint = (verbo: 'POST' | 'GET' | 'DELETE', rota: string): ApiDocBloco => ({ tipo: 'endpoint', verbo, rota });

/** {base} é substituído pela URL real (window.location.origin ou o domínio de produção) na hora de renderizar. */
export function getApiDocSecoes(base: string): ApiDocSecao[] {
  return [
    {
      titulo: '1. Autenticação',
      blocos: [
        texto('Toda chamada exige o cabeçalho `Authorization` com um token gerado no portal — em **Empresas → Editar a empresa → Integração via API → Gerar Chave**. O token completo só é mostrado uma vez no momento da geração; guarde-o com segurança.'),
        codigo('Authorization: Bearer {prefixo}.{secret}\nContent-Type: application/json', 'Cabeçalho obrigatório em toda requisição'),
        texto('Uma chave pode ser revogada a qualquer momento pelo portal — chamadas com uma chave revogada recebem `401 Unauthorized` imediatamente.'),
      ],
    },
    {
      titulo: '2. Cadastrar sacado ou fornecedor',
      blocos: [
        endpoint('POST', '/api/v1/sacados'),
        texto('Cadastra a pessoa/empresa que deve (sacado, para Contas a Receber) ou que é paga (fornecedor, para Contas a Pagar). Se o CPF/CNPJ já existir para esta empresa, os dados são atualizados em vez de duplicados — os dígitos verificadores são validados de verdade, não só o formato.'),
        codigo(
          `{\n  "nome": "Empresa Cliente LTDA",\n  "cpfCnpj": "33.000.167/0001-01",\n  "tipo": "cliente",\n  "email": "financeiro@clienteltda.com.br",\n  "telefone": "(46) 99999-9999",\n  "endereco": "Rua Exemplo, 123",\n  "cidade": "Francisco Beltrão",\n  "estado": "PR",\n  "cep": "85601-000"\n}`,
          `POST ${base}/api/v1/sacados`
        ),
        texto('`tipo`: `"cliente"` (sacado), `"fornecedor"` ou `"ambos"`. Padrão: `"cliente"`.'),
        codigo(
          `{\n  "id": "44bc2f8e-2f40-417c-a13d-d1ede8d2fabd",\n  "nome": "Empresa Cliente LTDA",\n  "cpfCnpj": "33.000.167/0001-01",\n  "tipo": "cliente",\n  "atualizado": false\n}`,
          'Resposta — 201 (criado) ou 200 (já existia, foi atualizado)'
        ),
        texto('Guarde o `id` retornado — é ele que vai em `sacadoId`/`fornecedorId` nos lançamentos.'),
      ],
    },
    {
      titulo: '3. Lançar conta a receber',
      blocos: [
        endpoint('POST', '/api/v1/contas-receber'),
        codigo(
          `{\n  "sacadoId": "44bc2f8e-2f40-417c-a13d-d1ede8d2fabd",\n  "numeroDocumento": "NF-000123",\n  "descricao": "Venda de mercadorias",\n  "dataEmissao": "2026-09-10",\n  "dataVencimento": "2026-10-10",\n  "dataCompetencia": "2026-09-10",\n  "valorOriginal": 1000.00,\n  "acrescimos": 0,\n  "descontos": 0,\n  "documentoFiscalUrl": "https://seu-erp.com/nfe/123.xml"\n}`,
          `POST ${base}/api/v1/contas-receber`
        ),
        texto('`dataVencimento` no passado é rejeitada por padrão — some `"permitirRetroativo": true` ao payload para autorizar explicitamente (ex.: migração de saldo já vencido). Valores aceitam no máximo 2 casas decimais.'),
        codigo(
          `{\n  "id": "8ba9b259-c861-47b0-bbe4-12f7fe290bd9",\n  "status": "aberto",\n  "valorLiquido": 1000.00,\n  "dataVencimento": "2026-10-10"\n}`,
          'Resposta — 201'
        ),
      ],
    },
    {
      titulo: '4. Lançar conta a pagar',
      blocos: [
        endpoint('POST', '/api/v1/contas-pagar'),
        texto('Mesmo formato do item 3, trocando `sacadoId` por `fornecedorId` e aceitando também `centroCustoId` opcional.'),
        codigo(
          `{\n  "fornecedorId": "id-do-fornecedor",\n  "numeroDocumento": "NF-9988",\n  "dataEmissao": "2026-09-10",\n  "dataVencimento": "2026-10-05",\n  "valorOriginal": 450.00,\n  "centroCustoId": "opcional"\n}`,
          `POST ${base}/api/v1/contas-pagar`
        ),
      ],
    },
    {
      titulo: '5. Baixar (pagar) ou estornar um título',
      blocos: [
        endpoint('POST', '/api/v1/contas-receber/{id}/baixas'),
        endpoint('POST', '/api/v1/contas-pagar/{id}/baixas'),
        texto('Cada baixa é um registro somado ao título — nunca edita nem apaga uma anterior. O status (`aberto` → `parcial` → `liquidado`) é recalculado automaticamente pela soma de todas as baixas.'),
        codigo(
          `{\n  "valor": 500.00,\n  "data": "2026-09-15",\n  "formaPagamento": "PIX",\n  "observacao": "Pagamento parcial"\n}`,
          'Baixa normal (pagamento)'
        ),
        texto('Para reverter uma baixa lançada por engano, envie o `id` dela em `estornoDeId` — o valor do estorno é sempre o negativo exato da baixa original, o cliente da API não escolhe o valor (evita estorno parcial por engano):'),
        codigo(
          `{\n  "estornoDeId": "id-da-baixa-a-reverter",\n  "observacao": "Pagamento duplicado por engano"\n}`,
          'Estorno de uma baixa anterior'
        ),
      ],
    },
    {
      titulo: '6. Consultar títulos',
      blocos: [
        endpoint('GET', '/api/v1/contas-receber (ou /api/v1/contas-pagar)'),
        texto('Filtros opcionais via query string: `?status=aberto&sacadoId=...&limit=50`'),
        endpoint('GET', '/api/v1/contas-receber/{id}'),
        texto('Retorna o título com o histórico completo de baixas e o cadastro do sacado.'),
      ],
    },
    {
      titulo: '7. Exclusão e imutabilidade',
      blocos: [
        endpoint('DELETE', '/api/v1/contas-receber/{id}'),
        texto('Só é permitido enquanto o título estiver `aberto` e sem nenhuma baixa lançada. Assim que há qualquer movimentação ou conciliação, o `DELETE` retorna `409 Conflict` — a única forma de reverter a partir daí é lançar um estorno (item 5). É proposital: garante que o histórico financeiro nunca desaparece silenciosamente.'),
      ],
    },
    {
      titulo: '8. Webhooks — notificação de liquidação',
      blocos: [
        texto('Quando um título é totalmente liquidado, o sistema pode notificar uma URL do seu ERP via `POST`, assinado com HMAC-SHA256 no cabeçalho `X-Webhook-Signature` (peça ao seu consultor para configurar a assinatura de webhook desta empresa).'),
        codigo(
          `{\n  "evento": "conta_receber.liquidada",\n  "dados": {\n    "contaReceberId": "8ba9b259-...",\n    "sacadoId": "44bc2f8e-...",\n    "valorLiquido": 1000.00,\n    "liquidadoEm": "2026-09-20T14:32:00.000Z"\n  },\n  "enviadoEm": "2026-09-20T14:32:01.120Z"\n}`,
          'Corpo do webhook enviado'
        ),
      ],
    },
    {
      titulo: '9. Códigos de erro',
      blocos: [
        {
          tipo: 'erros',
          itens: [
            { codigo: '401', desc: 'token ausente, inválido ou revogado.' },
            { codigo: '404', desc: 'recurso não encontrado (ou não pertence a esta empresa).' },
            { codigo: '409', desc: 'conflito: DELETE em título já movimentado, ou baixa já estornada.' },
            { codigo: '422', desc: 'payload inválido (o corpo da resposta traz `detalhes` por campo).' },
            { codigo: '429', desc: 'muitas requisições (limite: 120/min por empresa nos POSTs, 60/min nos GETs).' },
            { codigo: '500', desc: 'erro interno; se persistir, avise o time técnico do BPO.' },
          ],
        },
      ],
    },
    {
      titulo: '10. Exemplo completo em cURL',
      blocos: [
        codigo(
          `TOKEN="{prefixo}.{secret}"\n\n# 1) cadastrar sacado\ncurl -X POST ${base}/api/v1/sacados \\\n  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\\n  -d '{"nome":"Cliente X","cpfCnpj":"33.000.167/0001-01"}'\n\n# 2) lançar conta a receber (use o id retornado acima em sacadoId)\ncurl -X POST ${base}/api/v1/contas-receber \\\n  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\\n  -d '{"sacadoId":"<id>","dataEmissao":"2026-09-10","dataVencimento":"2026-10-10","valorOriginal":1000}'\n\n# 3) dar baixa (use o id retornado acima)\ncurl -X POST ${base}/api/v1/contas-receber/<id>/baixas \\\n  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\\n  -d '{"valor":1000,"data":"2026-09-20","formaPagamento":"PIX"}'`,
          'Fluxo: sacado → título → baixa'
        ),
      ],
    },
  ];
}
