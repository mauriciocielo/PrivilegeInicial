'use client';
import { Fragment, type ReactNode } from 'react';

/**
 * Markdown simples para respostas de IA: títulos, listas, negrito, código em linha e tabelas.
 * Monta elementos React (nunca injeta HTML), então o texto da IA não executa nada.
 */
function emLinha(texto: string, chave: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    const t = m[0];
    partes.push(t.startsWith('**')
      ? <strong key={`${chave}-${i++}`}>{t.slice(2, -2)}</strong>
      : <code key={`${chave}-${i++}`} style={{ background: 'var(--bg-base)', borderRadius: 4, padding: '1px 5px', fontSize: '0.92em' }}>{t.slice(1, -1)}</code>);
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

const celulas = (linha: string) => linha.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

export default function MarkdownLeve({ texto }: { texto: string }) {
  const linhas = texto.replace(/\r\n/g, '\n').split('\n');
  const blocos: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    const t = linha.trim();
    if (!t) { i++; continue; }

    // Tabela: linha com | seguida de separador |---|
    if (t.includes('|') && /^\s*\|?\s*:?-{2,}/.test(linhas[i + 1] || '')) {
      const cab = celulas(t);
      i += 2;
      const corpo: string[][] = [];
      while (i < linhas.length && linhas[i].trim().includes('|')) { corpo.push(celulas(linhas[i])); i++; }
      blocos.push(
        <div key={k++} style={{ overflowX: 'auto', margin: '6px 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13.5, width: '100%' }}>
            <thead><tr>{cab.map((c, j) => <th key={j} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid var(--border)', fontWeight: 700, whiteSpace: 'nowrap' }}>{emLinha(c, `h${k}${j}`)}</th>)}</tr></thead>
            <tbody>{corpo.map((l, r) => <tr key={r}>{l.map((c, j) => <td key={j} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-light)', verticalAlign: 'top' }}>{emLinha(c, `c${k}${r}${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const titulo = /^(#{1,4})\s+(.*)$/.exec(t);
    if (titulo) {
      blocos.push(<div key={k++} style={{ fontWeight: 700, fontSize: titulo[1].length <= 2 ? 16 : 15, margin: '10px 0 4px' }}>{emLinha(titulo[2], `t${k}`)}</div>);
      i++;
      continue;
    }

    // Listas (com marcador ou numeradas)
    if (/^([-*•]|\d+[.)])\s+/.test(t)) {
      const numerada = /^\d/.test(t);
      const itens: string[] = [];
      while (i < linhas.length && /^([-*•]|\d+[.)])\s+/.test(linhas[i].trim())) {
        itens.push(linhas[i].trim().replace(/^([-*•]|\d+[.)])\s+/, ''));
        i++;
      }
      const Lista = numerada ? 'ol' : 'ul';
      blocos.push(
        <Lista key={k++} style={{ margin: '4px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {itens.map((it, j) => <li key={j}>{emLinha(it, `l${k}${j}`)}</li>)}
        </Lista>,
      );
      continue;
    }

    // Parágrafo: junta linhas seguidas
    const par: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !/^(#{1,4}\s|[-*•]\s|\d+[.)]\s)/.test(linhas[i].trim()) && !(linhas[i].includes('|') && /^\s*\|?\s*:?-{2,}/.test(linhas[i + 1] || ''))) {
      par.push(linhas[i].trim());
      i++;
    }
    blocos.push(<p key={k++} style={{ margin: '4px 0' }}>{par.map((p, j) => <Fragment key={j}>{j > 0 && <br />}{emLinha(p, `p${k}${j}`)}</Fragment>)}</p>);
  }
  return <>{blocos}</>;
}
