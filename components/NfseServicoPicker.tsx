'use client';
import { useEffect, useMemo, useState } from 'react';
import { formatarCnae, sugerirServicos, type CnaeEmpresa } from '../lib/nfse/cnae-servicos';

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

function filtrar<T>(itens: T[], busca: string, texto: (i: T) => string, prioridade?: (i: T) => boolean): T[] {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean).map(t => (/^[\d.]+$/.test(t) ? t.replace(/\./g, '') : t));
  if (termos.length === 0) return [];
  const achados = itens.filter(i => { const alvo = normalizar(texto(i)); return termos.every(t => alvo.includes(t)); });
  // Ordena antes de cortar: um serviço do CNAE da empresa não pode ficar fora do limite.
  if (prioridade) achados.sort((a, b) => Number(prioridade(b)) - Number(prioridade(a)));
  return achados.slice(0, MAX_RESULTADOS);
}

export const formatarNbs = (c: string) => c.replace(/^(\d)(\d{4})(\d{2})(\d{2})$/, '$1.$2.$3.$4');

interface Props {
  cTribNac: string;
  cNbs: string;
  /** Descrição só vem quando a escolha foi de um serviço. */
  onChange: (mudanca: { cTribNac?: string; cNbs?: string; descricao?: string }) => void;
  /** CNAEs da empresa emissora: os serviços deles aparecem como principais. Null: ainda carregando. */
  cnaes?: CnaeEmpresa[] | null;
}

/** Serviços do CNAE em destaque, busca na lista nacional e NBS pela correlação oficial (Anexo VIII). */
export default function NfseServicoPicker({ cTribNac, cNbs, onChange, cnaes }: Props) {
  const [tabela, setTabela] = useState<TabelaServicos | null>(null);
  const [buscaServico, setBuscaServico] = useState('');
  const [buscaNbs, setBuscaNbs] = useState('');
  const [erro, setErro] = useState(false);

  useEffect(() => {
    carregarTabela().then(setTabela).catch(() => setErro(true));
  }, []);

  const servicoAtual = useMemo(() => tabela?.servicos.find(s => s.c === cTribNac) || null, [tabela, cTribNac]);
  const sugestoes = useMemo(() => sugerirServicos(cnaes || []), [cnaes]);
  const codigosSugeridos = useMemo(() => new Set(sugestoes.flatMap(s => s.servicos)), [sugestoes]);
  const resultadosServico = useMemo(
    () => (tabela ? filtrar(tabela.servicos, buscaServico, s => `${s.c} ${s.d}`, s => codigosSugeridos.has(s.c)) : []),
    [tabela, buscaServico, codigosSugeridos],
  );
  const descricaoServico = (codigo: string) => tabela?.servicos.find(s => s.c === codigo)?.d || '';
  const principais = sugestoes.filter(s => s.principal);
  const secundarios = sugestoes.filter(s => !s.principal && s.servicos.length > 0);
  const temSugestao = principais.some(s => s.servicos.length > 0) || secundarios.length > 0;

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
  const selecionadoStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' };
  const itemStyle = { display: 'block', width: '100%', textAlign: 'left' as const, padding: '6px 10px', fontSize: 12, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-light)', color: 'var(--text-primary)', cursor: 'pointer' };

  const botaoServico = (codigo: string) => {
    const escolhido = codigo === cTribNac;
    return (
      <button
        key={codigo}
        type="button"
        aria-pressed={escolhido}
        style={{ ...itemStyle, borderRadius: 6, border: `1px solid ${escolhido ? 'var(--accent)' : 'var(--border-light)'}`, background: 'var(--bg-card)', fontWeight: escolhido ? 600 : 400 }}
        onClick={() => onChange({ cTribNac: codigo, descricao: descricaoServico(codigo) })}
      >
        {escolhido ? '✓ ' : ''}<strong>{codigo}</strong> — {descricaoServico(codigo)}
      </button>
    );
  };
  const tituloCnae = (s: { codigo: string; descricao: string }) => `${formatarCnae(s.codigo)}${s.descricao ? ` — ${s.descricao}` : ''}`;
  const listaServicos = { display: 'flex', flexDirection: 'column' as const, gap: 4, marginTop: 4 };

  return (
    <div style={{ marginBottom: 12 }}>
      {cnaes === null && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Consultando os CNAEs da empresa...</div>}
      {cnaes && cnaes.length > 0 && tabela && (
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Serviços do CNAE da empresa</label>
          {principais.map(s => (
            <div key={s.codigo} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CNAE principal: {tituloCnae(s)}</div>
              {s.servicos.length > 0
                ? <div style={listaServicos}>{s.servicos.map(botaoServico)}</div>
                : <div style={{ fontSize: 12, marginTop: 4 }}>Sem sugestão para este CNAE. Use a busca abaixo.</div>}
            </div>
          ))}
          {secundarios.length > 0 && (
            <details style={{ marginBottom: 8 }}>
              <summary style={{ fontSize: 12, cursor: 'pointer' }}>Demais CNAEs da empresa ({secundarios.length})</summary>
              {secundarios.map(s => (
                <div key={s.codigo} style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tituloCnae(s)}</div>
                  <div style={listaServicos}>{s.servicos.map(botaoServico)}</div>
                </div>
              ))}
            </details>
          )}
          {temSugestao && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Sugestão pelo CNAE, não uma regra oficial: o código certo é o do serviço prestado nesta nota.
            </div>
          )}
        </div>
      )}

      <div className="form-group" style={{ marginBottom: 8 }}>
        <label className="form-label">Buscar outros serviços na lista nacional</label>
        <input className="form-control" placeholder={tabela ? 'Digite parte da descrição ou do código...' : 'Carregando a lista oficial...'} disabled={!tabela}
          value={buscaServico} onChange={e => setBuscaServico(e.target.value)} />
        {buscaServico.trim() && (
          <div style={listaStyle}>
            {resultadosServico.length === 0 ? <div style={{ ...itemStyle, cursor: 'default' }}>Nenhum serviço encontrado.</div> : resultadosServico.map(s => (
              <button key={s.c} type="button" style={itemStyle} onClick={() => {
                onChange({ cTribNac: s.c, descricao: s.d });
                setBuscaServico('');
              }}><strong>{s.c}</strong> — {s.d}{codigosSugeridos.has(s.c) ? ' (CNAE da empresa)' : ''}</button>
            ))}
          </div>
        )}
        {servicoAtual && (
          <div style={selecionadoStyle}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Serviço selecionado</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}><strong>{servicoAtual.c}</strong> — {servicoAtual.d}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={() => onChange({ cTribNac: '' })}>Remover</button>
          </div>
        )}
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
        {descricaoNbs && (
          <div style={selecionadoStyle}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>NBS selecionado</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}><strong>{formatarNbs(nbsDigitos)}</strong> — {descricaoNbs}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={() => onChange({ cNbs: '' })}>Remover</button>
          </div>
        )}
      </div>
    </div>
  );
}
