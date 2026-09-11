'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { getApiDocSecoes, tokenizarInline, type ApiDocBloco } from '../lib/api-docs-content';

/**
 * Documentação da API v1 (CP/CR), pensada para ser compartilhada com o time
 * técnico do ERP do cliente. O conteúdo vem de lib/api-docs-content.ts —
 * mesma fonte usada pela exportação em PDF (lib/api-docs-pdf.ts), para as
 * duas nunca ficarem desalinhadas.
 */

function Inline({ texto }: { texto: string }) {
  return (
    <>
      {tokenizarInline(texto).map((t, i) =>
        t.tipo === 'codigo'
          ? <code key={i} style={{ background: 'var(--bg-card2)', padding: '1px 5px', borderRadius: 4, fontSize: '0.93em' }}>{t.conteudo}</code>
          : t.tipo === 'negrito'
          ? <strong key={i}>{t.conteudo}</strong>
          : <span key={i}>{t.conteudo}</span>
      )}
    </>
  );
}

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

const METODO_COR: Record<string, string> = { POST: '#059669', GET: '#2563eb', DELETE: '#dc2626' };

function Bloco({ bloco }: { bloco: ApiDocBloco }) {
  if (bloco.tipo === 'texto') {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 10 }}><Inline texto={bloco.texto} /></p>;
  }
  if (bloco.tipo === 'codigo') {
    return <CodeBlock label={bloco.label}>{bloco.codigo}</CodeBlock>;
  }
  if (bloco.tipo === 'endpoint') {
    return (
      <div style={{ marginBottom: 6 }}>
        <span style={{
          display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
          background: METODO_COR[bloco.verbo], color: '#fff', marginRight: 8, fontFamily: 'ui-monospace, monospace',
        }}>
          {bloco.verbo}
        </span>
        <code style={{ fontSize: 12.5 }}>{bloco.rota}</code>
      </div>
    );
  }
  // erros
  return (
    <div style={{ fontSize: 12.5, lineHeight: 2 }}>
      {bloco.itens.map(it => (
        <div key={it.codigo}>
          <code style={{ color: '#dc2626', fontWeight: 700 }}>{it.codigo}</code> — <Inline texto={it.desc} />
        </div>
      ))}
    </div>
  );
}

function Secao({ titulo, blocos, aberta: abertaInicial = false }: { titulo: string; blocos: ApiDocBloco[]; aberta?: boolean }) {
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
      {aberta && <div style={{ padding: '0 18px 18px' }}>{blocos.map((b, i) => <Bloco key={i} bloco={b} />)}</div>}
    </div>
  );
}

export default function ApiDocumentation() {
  const [exportando, setExportando] = useState(false);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://SEU-DOMINIO';
  const secoes = getApiDocSecoes(baseUrl);

  const exportarPdf = async () => {
    setExportando(true);
    try {
      const { gerarApiDocsPdf } = await import('../lib/api-docs-pdf');
      await gerarApiDocsPdf(baseUrl);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar o PDF da documentação.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>🔌 API de Integração — Contas a Pagar/Receber</h3>
          <button type="button" className="btn btn-primary btn-sm" onClick={exportarPdf} disabled={exportando}>
            {exportando ? 'Gerando...' : '📄 Exportar PDF'}
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>
          Documentação para o time técnico do ERP do cliente conectar diretamente com o sistema:
          cadastrar sacados/fornecedores e lançar títulos a pagar/receber, com baixa e estorno.
          Envie o PDF (ou o link desta página) para quem for implementar a integração.
        </p>
        <div style={{
          display: 'flex', gap: 24, flexWrap: 'wrap', padding: '10px 14px',
          background: 'var(--bg-card2)', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: 12.5,
        }}>
          <div><strong>Base URL:</strong> <code style={{ color: 'var(--accent)' }}>{baseUrl}</code></div>
          <div><strong>Formato:</strong> JSON</div>
          <div><strong>Autenticação:</strong> Bearer token</div>
        </div>
      </div>

      {secoes.map((s, i) => (
        <Secao key={s.titulo} titulo={s.titulo} blocos={s.blocos} aberta={i === 0} />
      ))}
    </div>
  );
}
