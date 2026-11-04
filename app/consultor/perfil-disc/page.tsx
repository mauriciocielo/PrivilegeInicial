'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { store, type Empresa } from '../../../lib/store';
import { PDF_BRAND_NAME } from '../../../lib/pdf-branding';
import { confirmAsync } from '../../../components/ConfirmProvider';
import { formatarTempoResposta, nomeTipoRespondente } from '../../../lib/perfil-disc/relatorio';

interface Avaliacao {
  id: string;
  empresaId: string;
  empresaNome: string;
  token: string | null;
  tipoRespondente: string;
  nomeRespondente: string | null;
  emailRespondente: string | null;
  cargoRespondente: string | null;
  status: string;
  createdAt: string;
  iniciadoEm: string | null;
  concluidoEm: string | null;
  tempoRespostaSeg: number | null;
  perfilNatural: string | null;
  expirado: boolean;
  expiraEm: string;
}

interface LinkCriado { id: string; token: string; nomeRespondente: string | null }

const urlDoLink = (token: string) => `${window.location.origin}/perfil/${token}`;

function mensagemConvite(token: string, nome?: string | null) {
  return [
    `Olá${nome ? `, ${nome}` : ''}!`,
    `${PDF_BRAND_NAME} convida você a responder uma avaliação de perfil comportamental.`,
    'Leva cerca de 15 minutos e não precisa de usuário nem senha. O link é pessoal, vale por 24 horas e só pode ser respondido uma vez:',
    urlDoLink(token),
  ].join('\n');
}

async function copiar(texto: string, sucesso: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(sucesso);
  } catch {
    toast.error('Não foi possível copiar automaticamente.');
  }
}

function situacao(a: Avaliacao): { texto: string; classe: string } {
  if (a.status === 'concluida') return { texto: 'Concluída', classe: 'badge-green' };
  if (a.expirado) return { texto: 'Link vencido', classe: 'badge-red' };
  if (a.iniciadoEm) return { texto: 'Em andamento', classe: 'badge-yellow' };
  return { texto: 'Aguardando resposta', classe: 'badge-gray' };
}

export default function PerfilDiscPage() {
  const router = useRouter();
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[] | null>(null);
  const [erro, setErro] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [busca, setBusca] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ empresaId: '', tipoRespondente: 'colaborador', nomeRespondente: '', emailRespondente: '', cargoRespondente: '', quantidade: 1 });
  const [criados, setCriados] = useState<LinkCriado[] | null>(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const res = await fetch('/api/perfil-disc', { cache: 'no-store' });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) { setErro(dados.error || 'Não foi possível carregar as avaliações.'); return; }
      setAvaliacoes(dados.avaliacoes);
    } catch {
      setErro('Sem conexão com o servidor.');
    }
  }, []);

  useEffect(() => {
    const usuario = store.getCurrentUser();
    const todas = store.getEmpresas();
    setEmpresas(usuario?.role === 'administrador' ? todas : todas.filter(e => usuario?.empresaIds?.includes(e.id)));
    setFiltroEmpresa(sessionStorage.getItem('cf_empresa_sel') || '');
    carregar();

    const aoTrocarEmpresa = (e: Event) => setFiltroEmpresa((e as CustomEvent<string>).detail || '');
    window.addEventListener('empresaChange', aoTrocarEmpresa);
    return () => window.removeEventListener('empresaChange', aoTrocarEmpresa);
  }, [carregar]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const grupo = filtroEmpresa.startsWith('grupo:') ? filtroEmpresa.slice('grupo:'.length) : '';
    const idsGrupo = grupo ? new Set(empresas.filter(e => e.grupoEconomico === grupo).map(e => e.id)) : null;
    return (avaliacoes || []).filter(a => {
      if (idsGrupo ? !idsGrupo.has(a.empresaId) : filtroEmpresa && a.empresaId !== filtroEmpresa) return false;
      if (filtroSituacao && situacao(a).texto !== filtroSituacao) return false;
      if (termo && !`${a.nomeRespondente || ''} ${a.cargoRespondente || ''} ${a.empresaNome}`.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [avaliacoes, busca, filtroEmpresa, filtroSituacao, empresas]);

  /** Com uma avaliação vencida, já traz os dados dela para gerar o link novo. */
  const abrirModal = (base?: Avaliacao) => {
    const selecionada = sessionStorage.getItem('cf_empresa_sel') || '';
    setForm({
      empresaId: base?.empresaId || (empresas.some(e => e.id === selecionada) ? selecionada : empresas[0]?.id || ''),
      tipoRespondente: base?.tipoRespondente || 'colaborador',
      nomeRespondente: base?.nomeRespondente || '',
      emailRespondente: base?.emailRespondente || '',
      cargoRespondente: base?.cargoRespondente || '',
      quantidade: 1,
    });
    setCriados(null);
    setModalAberto(true);
  };

  const varios = form.quantidade > 1;

  const gerar = async () => {
    if (!form.empresaId) { toast.error('Selecione a empresa.'); return; }
    setSalvando(true);
    try {
      const res = await fetch('/api/perfil-disc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          nomeRespondente: varios ? '' : form.nomeRespondente,
          emailRespondente: varios ? '' : form.emailRespondente,
        }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(dados.error || 'Não foi possível gerar o link.'); return; }
      setCriados(dados.criadas);
      await carregar();
    } catch {
      toast.error('Sem conexão com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (a: Avaliacao) => {
    const mensagem = a.status === 'concluida'
      ? `Excluir a avaliação de ${a.nomeRespondente || 'este respondente'}? O resultado será apagado e não poderá ser recuperado.`
      : a.expirado
        ? 'Excluir este link vencido da lista?'
        : 'Cancelar este link? Ele deixará de funcionar para quem já o recebeu.';
    if (!(await confirmAsync(mensagem))) return;
    try {
      const res = await fetch(`/api/perfil-disc/${a.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}));
        toast.error(dados.error || 'Não foi possível excluir.');
        return;
      }
      setAvaliacoes(lista => (lista || []).filter(x => x.id !== a.id));
      toast.success(a.status === 'concluida' ? 'Avaliação excluída.' : a.expirado ? 'Link excluído.' : 'Link cancelado.');
    } catch {
      toast.error('Sem conexão com o servidor.');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Perfil Comportamental (DISC)</div>
          <div className="page-subtitle">Gere um link para cada pessoa responder sem login. Cada link vale por 24 horas e aceita uma única resposta.</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => abrirModal()}>＋ Gerar link</button>
        </div>
      </div>

      <div className="page-body">
        <div className="card card-sm" style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: '1 1 220px' }}>
            <span>🔍</span>
            <input placeholder="Buscar por nome, cargo ou empresa..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <select className="form-control" style={{ flex: '0 1 240px' }} value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)} aria-label="Filtrar por empresa">
            <option value="">Todas as empresas</option>
            {filtroEmpresa.startsWith('grupo:') && <option value={filtroEmpresa}>Grupo {filtroEmpresa.slice('grupo:'.length)}</option>}
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>)}
          </select>
          <select className="form-control" style={{ flex: '0 1 190px' }} value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)} aria-label="Filtrar por situação">
            <option value="">Todas as situações</option>
            <option>Aguardando resposta</option>
            <option>Em andamento</option>
            <option>Concluída</option>
            <option>Link vencido</option>
          </select>
        </div>

        <div className="card">
          {erro ? (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--red)', margin: '0 0 12px' }}>{erro}</p>
              <button className="btn btn-secondary btn-sm" onClick={carregar}>Tentar de novo</button>
            </div>
          ) : avaliacoes === null ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>⏳ Carregando avaliações...</div>
          ) : visiveis.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
              {avaliacoes.length === 0 ? 'Nenhum link gerado ainda. Clique em "Gerar link" para começar.' : 'Nenhuma avaliação encontrada com estes filtros.'}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Respondente</th>
                    <th>Empresa</th>
                    <th>Situação</th>
                    <th>Perfil</th>
                    <th>Data</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map(a => {
                    const s = situacao(a);
                    return (
                      <tr key={a.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.nomeRespondente || <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Pessoa ainda não identificada</span>}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {nomeTipoRespondente(a.tipoRespondente)}{a.cargoRespondente ? ` · ${a.cargoRespondente}` : ''}{a.emailRespondente ? ` · ${a.emailRespondente}` : ''}
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>{a.empresaNome}</td>
                        <td><span className={`badge ${s.classe}`}>{s.texto}</span></td>
                        <td style={{ fontWeight: 700, fontSize: 14 }}>{a.perfilNatural || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {new Date(a.concluidoEm || a.createdAt).toLocaleDateString('pt-BR')}
                          {a.status === 'concluida' && <div style={{ color: 'var(--text-muted)' }}>{formatarTempoResposta(a.tempoRespostaSeg)}</div>}
                          {a.token && (
                            <div style={{ color: 'var(--text-muted)' }}>
                              Vence em {new Date(a.expiraEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {a.status === 'concluida' ? (
                              <button className="btn btn-primary btn-sm" onClick={() => router.push(`/consultor/perfil-disc/${a.id}`)}>Ver relatório</button>
                            ) : a.expirado ? (
                              <button className="btn btn-secondary btn-sm" onClick={() => abrirModal(a)}>Gerar novo link</button>
                            ) : a.token && (
                              <>
                                <button className="btn btn-secondary btn-sm" onClick={() => copiar(mensagemConvite(a.token!, a.nomeRespondente), 'Convite copiado.')}>Copiar convite</button>
                                <a className="btn btn-secondary btn-sm" href={`https://wa.me/?text=${encodeURIComponent(mensagemConvite(a.token, a.nomeRespondente))}`} target="_blank" rel="noreferrer">WhatsApp</a>
                              </>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={() => excluir(a)} title={a.status === 'concluida' || a.expirado ? 'Excluir da lista' : 'Cancelar link'}>
                              {a.status === 'concluida' || a.expirado ? 'Excluir' : 'Cancelar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalAberto && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !salvando && setModalAberto(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 620, maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">{criados ? 'Link pronto para enviar' : 'Gerar link de perfil comportamental'}</h2>
              <button className="modal-close" onClick={() => setModalAberto(false)} disabled={salvando}>✕</button>
            </div>

            {criados ? (
              <>
                <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                  {criados.length > 1 ? `Foram gerados ${criados.length} links. Envie um diferente para cada pessoa.` : 'Envie este link para a pessoa.'} Cada um vale por 24 horas, aceita uma única resposta e dispensa login.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', marginBottom: 14 }}>
                  {criados.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', background: 'var(--bg-hover)', borderRadius: 8 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{urlDoLink(c.token)}</span>
                      <button className="btn btn-secondary btn-sm" onClick={() => copiar(mensagemConvite(c.token, c.nomeRespondente), `Convite ${criados.length > 1 ? i + 1 : ''} copiado.`)}>Copiar</button>
                      <a className="btn btn-secondary btn-sm" href={`https://wa.me/?text=${encodeURIComponent(mensagemConvite(c.token, c.nomeRespondente))}`} target="_blank" rel="noreferrer">WhatsApp</a>
                    </div>
                  ))}
                </div>
                <div className="form-actions">
                  {criados.length > 1 && (
                    <button className="btn btn-secondary" onClick={() => copiar(criados.map(c => urlDoLink(c.token)).join('\n'), 'Todos os links copiados.')}>Copiar todos os links</button>
                  )}
                  <button className="btn btn-primary" onClick={() => setModalAberto(false)}>Concluir</button>
                </div>
              </>
            ) : (
              <>
                {empresas.length === 0 && (
                  <p role="alert" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--red)', margin: '0 0 12px' }}>
                    Seu usuário não tem empresas vinculadas. Peça a um administrador para vincular em Usuários.
                  </p>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="pd-empresa">Empresa *</label>
                    <select id="pd-empresa" className="form-control" value={form.empresaId} onChange={e => setForm(f => ({ ...f, empresaId: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {empresas.map(e => <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="pd-tipo">Quem vai responder</label>
                    <select id="pd-tipo" className="form-control" value={form.tipoRespondente} onChange={e => setForm(f => ({ ...f, tipoRespondente: e.target.value }))}>
                      <option value="colaborador">Colaborador(a)</option>
                      <option value="empresario">Empresário(a)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row" style={{ marginTop: 10 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="pd-quantidade">Quantidade de links</label>
                    <input
                      id="pd-quantidade"
                      type="number"
                      min={1}
                      max={50}
                      className="form-control"
                      value={form.quantidade}
                      onChange={e => setForm(f => ({ ...f, quantidade: Math.max(1, Math.min(50, Number(e.target.value) || 1)) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="pd-cargo">Cargo (opcional)</label>
                    <input id="pd-cargo" className="form-control" value={form.cargoRespondente} maxLength={120} onChange={e => setForm(f => ({ ...f, cargoRespondente: e.target.value }))} />
                  </div>
                </div>

                {varios ? (
                  <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '12px 0 0' }}>
                    Com vários links, cada pessoa informa o próprio nome ao abrir o formulário.
                  </p>
                ) : (
                  <div className="form-row" style={{ marginTop: 10 }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="pd-nome">Nome (opcional)</label>
                      <input id="pd-nome" className="form-control" value={form.nomeRespondente} maxLength={120} placeholder="Em branco, a pessoa informa ao abrir" onChange={e => setForm(f => ({ ...f, nomeRespondente: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="pd-email">E-mail (opcional)</label>
                      <input id="pd-email" type="email" className="form-control" value={form.emailRespondente} maxLength={160} onChange={e => setForm(f => ({ ...f, emailRespondente: e.target.value }))} />
                    </div>
                  </div>
                )}

                <div className="form-actions" style={{ marginTop: 18 }}>
                  <button className="btn btn-secondary" onClick={() => setModalAberto(false)} disabled={salvando}>Cancelar</button>
                  <button className="btn btn-primary" onClick={gerar} disabled={salvando || !form.empresaId}>
                    {salvando ? '⏳ Gerando...' : varios ? `Gerar ${form.quantidade} links` : 'Gerar link'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
