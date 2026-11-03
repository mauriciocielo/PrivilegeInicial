'use client';
import { useEffect, useMemo, useState } from 'react';

interface TabelaServicos {
  servicos: { c: string; d: string }[];
  nbs: Record<string, string>;
  correlacao: Record<string, string[]>;
}

// A tabela oficial tem mais de 100 KB: só é baixada quando alguém abre a busca.
let tabelaCarregada: Promise<TabelaServicos> | null = null;
const carregarTabela = () => {
  tabelaCarregada ||= import('../lib/nfse/dados/tabela-servicos.json').then(m => m.default as unknown as TabelaServicos);
  return tabelaCarregada;
};

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const MAX_RESULTADOS = 40;

function filtrar<T>(itens: T[], busca: string, texto: (i: T) => string): T[] {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean).map(t => (/^[\d.]+$/.test(t) ? t.replace(/\./g, '') : t));
  if (termos.length === 0) return [];
  return itens.filter(i => { const alvo = normalizar(texto(i)); return termos.every(t => alvo.includes(t)); }).slice(0, MAX_RESULTADOS);
}

export const formatarNbs = (c: string) => c.replace(/^(\d)(\d{4})(\d{2})(\d{2})$/, '$1.$2.$3.$4');

interface Props {
  cTribNac: string;
  cNbs: string;
  /** Descrição só vem quando a escolha foi de um serviço. */
  onChange: (mudanca: { cTribNac?: string; cNbs?: string; descricao?: string }) => void;
}

/** Busca na lista nacional de serviços e sugere o NBS pela correlação oficial (Anexo VIII). */
export default function NfseServicoPicker({ cTribNac, cNbs, onChange }: Props) {
  const [tabela, setTabela] = useState<TabelaServicos | null>(null);
  const [buscaServico, setBuscaServico] = useState('');
  const [buscaNbs, setBuscaNbs] = useState('');
  const [erro, setErro] = useState(false);

  useEffect(() => {
    carregarTabela().then(setTabela).catch(() => setErro(true));
  }, []);

  const servicoAtual = useMemo(() => tabela?.servicos.find(s => s.c === cTribNac) || null, [tabela, cTribNac]);
  const resultadosServico = useMemo(() => (tabela ? filtrar(tabela.servicos, buscaServico, s => `${s.c} ${s.d}`) : []), [tabela, buscaServico]);

  const sugestoesNbs = useMemo(() => {
    if (!tabela || !/^\d{6}$/.test(cTribNac)) return [];
    return (tabela.correlacao[cTribNac.slice(0, 4)] || []).map(c => ({ c, d: tabela.nbs[c] || '' }));
  }, [tabela, cTribNac]);

  const todosNbs = useMemo(() => (tabela ? Object.entries(tabela.nbs).map(([c, d]) => ({ c, d })) : []), [tabela]);
  const resultadosNbs = useMemo(() => filtrar(todosNbs, buscaNbs, n => `${n.c} ${n.d}`), [todosNbs, buscaNbs]);

  const nbsDigitos = cNbs.replace(/\D/g, '');
  const descricaoNbs = tabela?.nbs[nbsDigitos];

  if (erro) return <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Não foi possível carregar a lista oficial de serviços. Digite os códigos abaixo.</div>;

  const listaStyle = { maxHeight: 170, overflowY: 'auto' as const, border: '1px solid var(--border-light)', borderRadius: 6, marginTop: 4 };
  const itemStyle = { display: 'block', width: '100%', textAlign: 'left' as const, padding: '6px 10px', fontSize: 12, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-light)', color: 'var(--text-primary)', cursor: 'pointer' };

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="form-group" style={{ marginBottom: 8 }}>
        <label className="form-label">Buscar serviço na lista nacional</label>
        <input className="form-control" placeholder={tabela ? 'Digite parte da descrição ou do código...' : 'Carregando a lista oficial...'} disabled={!tabela}
          value={buscaServico} onChange={e => setBuscaServico(e.target.value)} />
        {buscaServico.trim() && (
          <div style={listaStyle}>
            {resultadosServico.length === 0 ? <div style={{ ...itemStyle, cursor: 'default' }}>Nenhum serviço encontrado.</div> : resultadosServico.map(s => (
              <button key={s.c} type="button" style={itemStyle} onClick={() => {
                onChange({ cTribNac: s.c, descricao: s.d });
                setBuscaServico('');
              }}><strong>{s.c}</strong> — {s.d}</button>
            ))}
          </div>
        )}
        {servicoAtual && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{servicoAtual.c}: {servicoAtual.d}</div>}
        {tabela && /^\d{6}$/.test(cTribNac) && !servicoAtual && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>O código {cTribNac} não está na lista nacional.</div>}
      </div>

      {sugestoesNbs.length > 0 && (
        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="form-label">NBS sugerido para este serviço (Anexo VIII)</label>
          <select className="form-control" value={sugestoesNbs.some(n => n.c === nbsDigitos) ? nbsDigitos : ''} onChange={e => onChange({ cNbs: e.target.value })}>
            <option value="">— Selecionar —</option>
            {sugestoesNbs.map(n => <option key={n.c} value={n.c}>{formatarNbs(n.c)} — {n.d.slice(0, 90)}</option>)}
          </select>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Sugestão: o governo ainda trata essa tabela como trabalho inicial. Confirme com a contabilidade.</div>
        </div>
      )}

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Buscar em toda a lista NBS</label>
        <input className="form-control" placeholder="Digite parte da descrição ou do código NBS..." disabled={!tabela} value={buscaNbs} onChange={e => setBuscaNbs(e.target.value)} />
        {buscaNbs.trim() && (
          <div style={listaStyle}>
            {resultadosNbs.length === 0 ? <div style={{ ...itemStyle, cursor: 'default' }}>Nenhum NBS encontrado.</div> : resultadosNbs.map(n => (
              <button key={n.c} type="button" style={itemStyle} onClick={() => { onChange({ cNbs: n.c }); setBuscaNbs(''); }}>
                <strong>{formatarNbs(n.c)}</strong> — {n.d}
              </button>
            ))}
          </div>
        )}
        {descricaoNbs && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{formatarNbs(nbsDigitos)}: {descricaoNbs}</div>}
      </div>
    </div>
  );
}
