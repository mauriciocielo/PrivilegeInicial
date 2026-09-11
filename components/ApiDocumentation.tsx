'use client';
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Documentação da API v1 (CP/CR), pensada para ser compartilhada com o time
 * técnico do ERP do cliente — a mesma referência que qualquer outra API
 * pública teria, só que embutida no portal em vez de um site separado.
 */

function CodeBlock({ children, label }: { children: string; label?: string }) {
  const copiar = () => { navigator.clipboard.writeText(children); toast.success('Copiado.'); };
  return (
    <div style={{ position: 'relative', marginTop: 8, marginBottom: 4 }}>
      {label && (
        <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 4 }}>
          {label}
        </div>
      )}
      <pre style={{
        background: '#0f1117', color: '#e2e8f0', padding: '14px 16px', borderRadius: 8,
        fontSize: 12, lineHeight: 1.6, overflowX: 'auto', margin: 0, fontFamily: 'ui-monospace, monospace',
      }}>
        <code>{children}</code>
      </pre>
      <button
        type="button"
        onClick={copiar}
        title="Copiar"
        style={{
          position: 'absolute', top: label ? 24 : 8, right: 8, background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#cbd5e1',
          fontSize: 11, padding: '3px 8px', cursor: 'pointer',
        }}
      >
        📋
      </button>
    </div>
  );
}

function Metodo({ verbo, cor }: { verbo: string; cor: string }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
      background: cor, color: '#fff', marginRight: 8, fontFamily: 'ui-monospace, monospace',
    }}>
      {verbo}
    </span>
  );
}

function Secao({ titulo, children, aberta: abertaInicial = false }: { titulo: string; children: React.ReactNode; aberta?: boolean }) {
  const [aberta, setAberta] = useState(abertaInicial);
  return (
    <div className="card" style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setAberta(a => !a)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{titulo}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', transform: aberta ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
      </button>
      {aberta && <div style={{ padding: '0 18px 18px' }}>{children}</div>}
    </div>
  );
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>{children}</p>
);

export default function ApiDocumentation() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://SEU-DOMINIO';

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>🔌 API de Integração — Contas a Pagar/Receber</h3>
        <P>
          Documentação para o time técnico do ERP do cliente conectar diretamente com o sistema:
          cadastrar sacados/fornecedores e lançar títulos a pagar/receber, com baixa e estorno.
          Envie esta página (ou o link) para quem for implementar a integração.
        </P>
        <div style={{
          display: 'flex', gap: 24, flexWrap: 'wrap', padding: '10px 14px',
          background: 'var(--bg-card2)', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: 12.5,
        }}>
          <div><strong>Base URL:</strong> <code style={{ color: 'var(--accent)' }}>{baseUrl}</code></div>
          <div><strong>Formato:</strong> JSON</div>
          <div><strong>Autenticação:</strong> Bearer token</div>
        </div>
      </div>

      <Secao titulo="1. Autenticação" aberta>
        <P>
          Toda chamada exige o cabeçalho <code>Authorization</code> com um token gerado no portal —
          em <strong>Empresas → Editar a empresa → Integração via API → Gerar Chave</strong>.
          O token completo só é mostrado uma vez no momento da geração; guarde-o com segurança.
        </P>
        <CodeBlock label="Cabeçalho obrigatório em toda requisição">
{`Authorization: Bearer {prefixo}.{secret}
Content-Type: application/json`}
        </CodeBlock>
        <P>
          Uma chave pode ser revogada a qualquer momento pelo portal — chamadas com uma chave
          revogada recebem <code>401 Unauthorized</code> imediatamente.
        </P>
      </Secao>

      <Secao titulo="2. Cadastrar sacado ou fornecedor">
        <Metodo verbo="POST" cor="#059669" /><code>/api/v1/sacados</code>
        <P>
          Cadastra a pessoa/empresa que deve (sacado, para Contas a Receber) ou que é paga
          (fornecedor, para Contas a Pagar). Se o CPF/CNPJ já existir para esta empresa, os dados
          são atualizados em vez de duplicados — os dígitos verificadores são validados de verdade,
          não só o formato.
        </P>
        <CodeBlock label={`POST ${baseUrl}/api/v1/sacados`}>
{`{
  "nome": "Empresa Cliente LTDA",
  "cpfCnpj": "33.000.167/0001-01",
  "tipo": "cliente",
  "email": "financeiro@clienteltda.com.br",
  "telefone": "(46) 99999-9999",
  "endereco": "Rua Exemplo, 123",
  "cidade": "Francisco Beltrão",
  "estado": "PR",
  "cep": "85601-000"
}`}
        </CodeBlock>
        <P>
          <code>tipo</code>: <code>"cliente"</code> (sacado), <code>"fornecedor"</code> ou{' '}
          <code>"ambos"</code>. Padrão: <code>"cliente"</code>.
        </P>
        <CodeBlock label="Resposta — 201 (criado) ou 200 (já existia, foi atualizado)">
{`{
  "id": "44bc2f8e-2f40-417c-a13d-d1ede8d2fabd",
  "nome": "Empresa Cliente LTDA",
  "cpfCnpj": "33.000.167/0001-01",
  "tipo": "cliente",
  "atualizado": false
}`}
        </CodeBlock>
        <P>Guarde o <code>id</code> retornado — é ele que vai em <code>sacadoId</code>/<code>fornecedorId</code> nos lançamentos.</P>
      </Secao>

      <Secao titulo="3. Lançar conta a receber">
        <Metodo verbo="POST" cor="#059669" /><code>/api/v1/contas-receber</code>
        <CodeBlock label={`POST ${baseUrl}/api/v1/contas-receber`}>
{`{
  "sacadoId": "44bc2f8e-2f40-417c-a13d-d1ede8d2fabd",
  "numeroDocumento": "NF-000123",
  "descricao": "Venda de mercadorias",
  "dataEmissao": "2026-09-10",
  "dataVencimento": "2026-10-10",
  "dataCompetencia": "2026-09-10",
  "valorOriginal": 1000.00,
  "acrescimos": 0,
  "descontos": 0,
  "documentoFiscalUrl": "https://seu-erp.com/nfe/123.xml"
}`}
        </CodeBlock>
        <P>
          <code>dataVencimento</code> no passado é <strong>rejeitada</strong> por padrão — some
          <code>"permitirRetroativo": true</code> ao payload para autorizar explicitamente (ex.: migração de saldo já vencido).
          Valores aceitam no máximo 2 casas decimais.
        </P>
        <CodeBlock label="Resposta — 201">
{`{
  "id": "8ba9b259-c861-47b0-bbe4-12f7fe290bd9",
  "status": "aberto",
  "valorLiquido": 1000.00,
  "dataVencimento": "2026-10-10"
}`}
        </CodeBlock>
      </Secao>

      <Secao titulo="4. Lançar conta a pagar">
        <Metodo verbo="POST" cor="#059669" /><code>/api/v1/contas-pagar</code>
        <P>Mesmo formato do item 3, trocando <code>sacadoId</code> por <code>fornecedorId</code> e aceitando também <code>centroCustoId</code> opcional.</P>
        <CodeBlock label={`POST ${baseUrl}/api/v1/contas-pagar`}>
{`{
  "fornecedorId": "id-do-fornecedor",
  "numeroDocumento": "NF-9988",
  "dataEmissao": "2026-09-10",
  "dataVencimento": "2026-10-05",
  "valorOriginal": 450.00,
  "centroCustoId": "opcional"
}`}
        </CodeBlock>
      </Secao>

      <Secao titulo="5. Baixar (pagar) ou estornar um título">
        <Metodo verbo="POST" cor="#059669" /><code>/api/v1/contas-receber/{'{id}'}/baixas</code>
        <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>·</span>
        <code style={{ fontSize: 12 }}>/api/v1/contas-pagar/{'{id}'}/baixas</code>
        <P>
          Cada baixa é um registro somado ao título — nunca edita nem apaga uma anterior. O status
          (<code>aberto</code> → <code>parcial</code> → <code>liquidado</code>) é recalculado
          automaticamente pela soma de todas as baixas.
        </P>
        <CodeBlock label="Baixa normal (pagamento)">
{`{
  "valor": 500.00,
  "data": "2026-09-15",
  "formaPagamento": "PIX",
  "observacao": "Pagamento parcial"
}`}
        </CodeBlock>
        <P>
          Para reverter uma baixa lançada por engano, envie o <code>id</code> dela em{' '}
          <code>estornoDeId</code> — o valor do estorno é sempre o negativo exato da baixa original,
          o cliente da API não escolhe o valor (evita estorno parcial por engano):
        </P>
        <CodeBlock label="Estorno de uma baixa anterior">
{`{
  "estornoDeId": "id-da-baixa-a-reverter",
  "observacao": "Pagamento duplicado por engano"
}`}
        </CodeBlock>
      </Secao>

      <Secao titulo="6. Consultar títulos">
        <Metodo verbo="GET" cor="#2563eb" /><code>/api/v1/contas-receber</code> ou <code>/api/v1/contas-pagar</code>
        <P>Filtros opcionais via query string: <code>?status=aberto&amp;sacadoId=...&amp;limit=50</code></P>
        <Metodo verbo="GET" cor="#2563eb" /><code>/api/v1/contas-receber/{'{id}'}</code>
        <P>Retorna o título com o histórico completo de baixas e o cadastro do sacado.</P>
      </Secao>

      <Secao titulo="7. Exclusão e imutabilidade">
        <Metodo verbo="DELETE" cor="#dc2626" /><code>/api/v1/contas-receber/{'{id}'}</code>
        <P>
          Só é permitido enquanto o título estiver <code>aberto</code> e sem nenhuma baixa lançada.
          Assim que há qualquer movimentação ou conciliação, o <code>DELETE</code> retorna{' '}
          <code>409 Conflict</code> — a única forma de reverter a partir daí é lançar um estorno
          (item 5). É proposital: garante que o histórico financeiro nunca desaparece silenciosamente.
        </P>
      </Secao>

      <Secao titulo="8. Webhooks — notificação de liquidação">
        <P>
          Quando um título é totalmente liquidado, o sistema pode notificar uma URL do seu ERP
          via <code>POST</code>, assinado com HMAC-SHA256 no cabeçalho{' '}
          <code>X-Webhook-Signature</code> (peça ao seu consultor para configurar a assinatura de
          webhook desta empresa).
        </P>
        <CodeBlock label="Corpo do webhook enviado">
{`{
  "evento": "conta_receber.liquidada",
  "dados": {
    "contaReceberId": "8ba9b259-...",
    "sacadoId": "44bc2f8e-...",
    "valorLiquido": 1000.00,
    "liquidadoEm": "2026-09-20T14:32:00.000Z"
  },
  "enviadoEm": "2026-09-20T14:32:01.120Z"
}`}
        </CodeBlock>
      </Secao>

      <Secao titulo="9. Códigos de erro">
        <div style={{ fontSize: 12.5, lineHeight: 2 }}>
          <div><code style={{ color: '#dc2626', fontWeight: 700 }}>401</code> — token ausente, inválido ou revogado.</div>
          <div><code style={{ color: '#dc2626', fontWeight: 700 }}>404</code> — recurso não encontrado (ou não pertence a esta empresa).</div>
          <div><code style={{ color: '#dc2626', fontWeight: 700 }}>409</code> — conflito: DELETE em título já movimentado, ou baixa já estornada.</div>
          <div><code style={{ color: '#dc2626', fontWeight: 700 }}>422</code> — payload inválido (o corpo da resposta traz <code>detalhes</code> por campo).</div>
          <div><code style={{ color: '#dc2626', fontWeight: 700 }}>429</code> — muitas requisições (limite: 120/min por empresa nos POSTs, 60/min nos GETs).</div>
          <div><code style={{ color: '#dc2626', fontWeight: 700 }}>500</code> — erro interno; se persistir, avise o time técnico do BPO.</div>
        </div>
      </Secao>

      <Secao titulo="10. Exemplo completo em cURL">
        <CodeBlock label="Fluxo: sacado → título → baixa">
{`TOKEN="{prefixo}.{secret}"

# 1) cadastrar sacado
curl -X POST ${baseUrl}/api/v1/sacados \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"nome":"Cliente X","cpfCnpj":"33.000.167/0001-01"}'

# 2) lançar conta a receber (use o id retornado acima em sacadoId)
curl -X POST ${baseUrl}/api/v1/contas-receber \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"sacadoId":"<id>","dataEmissao":"2026-09-10","dataVencimento":"2026-10-10","valorOriginal":1000}'

# 3) dar baixa (use o id retornado acima)
curl -X POST ${baseUrl}/api/v1/contas-receber/<id>/baixas \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"valor":1000,"data":"2026-09-20","formaPagamento":"PIX"}'`}
        </CodeBlock>
      </Secao>
    </div>
  );
}
