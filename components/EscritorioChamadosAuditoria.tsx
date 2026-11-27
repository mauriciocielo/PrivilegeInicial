'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Headphones,
  History,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface MensagemChamado {
  id: string;
  autorId: string;
  autorNome: string;
  ehSuporte: boolean;
  texto: string;
  criadoEm: string;
}

interface ChamadoItem {
  id: string;
  protocolo: string;
  escritorioId: string;
  escritorioNome: string;
  userNome: string;
  userEmail: string;
  empresaId: string | null;
  empresaNome: string | null;
  categoria: string;
  prioridade: string;
  assunto: string;
  descricao: string;
  status: 'aberto' | 'em_atendimento' | 'resolvido';
  mensagens: MensagemChamado[];
  createdAt: string;
  updatedAt: string;
}

interface EventoAuditoria {
  id: string;
  userNome: string;
  userEmail: string;
  acao: string;
  empresaNome: string | null;
  detalhes: string;
  createdAt: string;
}

const CATEGORIAS = [
  { value: 'nfse', label: 'NFS-e / Emissor Nacional (SEFIN)' },
  { value: 'certificado', label: 'Certificado A1 / Procuração' },
  { value: 'nfe', label: 'NF-e Destinadas / SEFAZ' },
  { value: 'financeiro', label: 'Financeiro / Contas a Pagar' },
  { value: 'duvida', label: 'Dúvida Operacional' },
  { value: 'melhoria', label: 'Sugestão de Melhoria' },
];

const LABELS_ACAO: Record<string, { label: string; cor: string }> = {
  nfse_emitida: { label: 'NFS-e Emitida', cor: '#15803d' },
  nfse_cancelada: { label: 'NFS-e Cancelada', cor: '#b91c1c' },
  fechamento_zip_baixado: { label: 'Fechamento ZIP', cor: '#1d4ed8' },
  equipe_membro_criado: { label: 'Auxiliar Criado', cor: '#7c3aed' },
  convite_certificado_criado: { label: 'Link A1 Gerado', cor: '#b45309' },
  certificado_recebido_cliente: { label: 'Certificado A1 Recebido', cor: '#047857' },
  chamado_aberto: { label: 'Chamado Aberto', cor: '#0369a1' },
};

export function SuporteChamadosTab({
  empresas,
  abrirModalInicial = false,
  onConsumirAbrirModal,
}: {
  empresas: Array<{ id: string; razaoSocial: string; nomeFantasia: string }>;
  abrirModalInicial?: boolean;
  onConsumirAbrirModal?: () => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const [ehAdminGeral, setEhAdminGeral] = useState(false);
  const [chamados, setChamados] = useState<ChamadoItem[]>([]);
  const [selecionado, setSelecionado] = useState<ChamadoItem | null>(null);
  const [respostaTexto, setRespostaTexto] = useState('');
  const [enviandoResposta, setEnviandoResposta] = useState(false);

  // Modal novo chamado
  const [modalNovo, setModalNovo] = useState(false);
  const [categoria, setCategoria] = useState('nfse');
  const [prioridade, setPrioridade] = useState<'normal' | 'urgente'>('normal');
  const [empresaId, setEmpresaId] = useState('');
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch('/api/escritorio/chamados');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEhAdminGeral(Boolean(data.ehAdminGeral));
        const lista: ChamadoItem[] = Array.isArray(data.chamados) ? data.chamados : [];
        setChamados(lista);
        setSelecionado((prev) => (prev ? lista.find((c) => c.id === prev.id) || null : null));
      }
    } catch {
      toast.error('Erro ao carregar chamados.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (abrirModalInicial) {
      setModalNovo(true);
      onConsumirAbrirModal?.();
    }
  }, [abrirModalInicial, onConsumirAbrirModal]);

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCriando(true);
    try {
      const res = await fetch('/api/escritorio/chamados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria, prioridade, empresaId: empresaId || null, assunto, descricao }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível abrir o chamado.');
        return;
      }
      toast.success(`Chamado #${data.protocolo} aberto! Nossa equipe já foi notificada.`);
      setModalNovo(false);
      setAssunto('');
      setDescricao('');
      setEmpresaId('');
      setPrioridade('normal');
      carregar();
    } catch {
      toast.error('Erro de conexão ao abrir chamado.');
    } finally {
      setCriando(false);
    }
  };

  const handleResponder = async (statusNovo?: 'aberto' | 'em_atendimento' | 'resolvido') => {
    if (!selecionado) return;
    if (!respostaTexto.trim() && !statusNovo) return;
    setEnviandoResposta(true);
    try {
      const res = await fetch('/api/escritorio/chamados', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selecionado.id,
          resposta: respostaTexto.trim() || undefined,
          status: statusNovo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Erro ao atualizar chamado.');
        return;
      }
      setRespostaTexto('');
      toast.success(statusNovo ? `Chamado marcado como ${statusNovo.replace('_', ' ')}.` : 'Resposta enviada!');
      carregar();
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setEnviandoResposta(false);
    }
  };

  const badgeStatus = (status: string) => {
    if (status === 'resolvido') return { bg: '#f0fdf4', fg: '#15803d', label: 'Resolvido' };
    if (status === 'em_atendimento') return { bg: '#eff6ff', fg: '#1d4ed8', label: 'Em atendimento' };
    return { bg: '#fffbeb', fg: '#b45309', label: 'Aberto' };
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selecionado ? '1fr 1.2fr' : '1fr', gap: 16 }}>
      {/* Lista de chamados */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Headphones size={18} color="var(--accent, #600000)" />
              {ehAdminGeral ? 'Central de Chamados (Todos os Escritórios)' : 'Suporte Prioritário ao Contador'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
              Abra chamados técnicos com protocolo e acompanhamento em tempo real + alerta automático no suporte.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={carregar} style={{ borderRadius: 8 }}>
              <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setModalNovo(true)}
              style={{ background: 'var(--accent, #600000)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={15} /> Abrir Chamado
            </button>
          </div>
        </div>

        {carregando ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Carregando chamados...</div>
        ) : chamados.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: '#6b7280' }}>
            Nenhum chamado aberto ainda. Clique em <strong>Abrir Chamado</strong> se precisar de ajuda da nossa equipe.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {chamados.map((c) => {
              const st = badgeStatus(c.status);
              const ativo = selecionado?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelecionado(c)}
                  style={{
                    textAlign: 'left',
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: ativo ? '2px solid var(--accent, #600000)' : '1px solid #e5e7eb',
                    background: ativo ? '#fafafa' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 12.5, color: '#111827' }}>#{c.protocolo}</span>
                      {c.prioridade === 'urgente' && (
                        <span style={{ background: '#fef2f2', color: '#b91c1c', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99 }}>
                          URGENTE
                        </span>
                      )}
                      {ehAdminGeral && (
                        <span style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 700 }}>{c.escritorioNome}</span>
                      )}
                    </div>
                    <span style={{ background: st.bg, color: st.fg, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99 }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: 14.5 }}>{c.assunto}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    {c.userNome} {c.empresaNome ? `· ${c.empresaNome}` : ''} · {new Date(c.updatedAt).toLocaleString('pt-BR')} · {c.mensagens.length} resposta(s)
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detalhe / Conversa do chamado */}
      {selecionado && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, borderBottom: '1px solid #e5e7eb', paddingBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>
                #{selecionado.protocolo} · {selecionado.escritorioNome}
              </div>
              <h3 style={{ margin: '3px 0 0', fontSize: 17, fontWeight: 800, color: '#111827' }}>{selecionado.assunto}</h3>
              {selecionado.empresaNome && (
                <div style={{ fontSize: 12.5, color: '#4b5563', marginTop: 2 }}>Empresa: <strong>{selecionado.empresaNome}</strong></div>
              )}
            </div>
            <button type="button" onClick={() => setSelecionado(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, fontSize: 13.5, color: '#1f2937', whiteSpace: 'pre-wrap' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
              {selecionado.userNome} · {new Date(selecionado.createdAt).toLocaleString('pt-BR')}
            </div>
            {selecionado.descricao}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
            {selecionado.mensagens.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: m.ehSuporte ? '#f0fdf4' : '#f3f4f6',
                  border: `1px solid ${m.ehSuporte ? '#bbf7d0' : '#e5e7eb'}`,
                  fontSize: 13.5,
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: m.ehSuporte ? '#15803d' : '#374151', marginBottom: 3 }}>
                  {m.autorNome} {m.ehSuporte ? '(Suporte)' : ''} · {new Date(m.criadoEm).toLocaleString('pt-BR')}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', color: '#111827' }}>{m.texto}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto', borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Escreva uma resposta ou atualização..."
              value={respostaTexto}
              onChange={(e) => setRespostaTexto(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {selecionado.status !== 'resolvido' ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: 12.5, color: '#15803d', borderColor: '#bbf7d0', background: '#f0fdf4' }}
                    disabled={enviandoResposta}
                    onClick={() => handleResponder('resolvido')}
                  >
                    <CheckCircle2 size={13} style={{ marginRight: 4 }} /> Marcar como Resolvido
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: 12.5 }}
                    disabled={enviandoResposta}
                    onClick={() => handleResponder('aberto')}
                  >
                    <Clock size={13} style={{ marginRight: 4 }} /> Reabrir Chamado
                  </button>
                )}
              </div>

              <button
                type="button"
                className="btn"
                disabled={enviandoResposta || !respostaTexto.trim()}
                onClick={() => handleResponder()}
                style={{ background: 'var(--accent, #600000)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Send size={13} /> {enviandoResposta ? 'Enviando...' : 'Enviar Resposta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Abrir Novo Chamado */}
      {modalNovo && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setModalNovo(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Abrir Chamado de Suporte</h3>
              <button type="button" onClick={() => setModalNovo(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCriar} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Categoria</label>
                  <select className="form-control" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                    {CATEGORIAS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Prioridade</label>
                  <select className="form-control" value={prioridade} onChange={(e) => setPrioridade(e.target.value as any)}>
                    <option value="normal">Normal</option>
                    <option value="urgente">Urgente (Bloqueia emissão)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Empresa relacionada (opcional)</label>
                <select className="form-control" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                  <option value="">— Geral do escritório —</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.nomeFantasia || emp.razaoSocial}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Assunto</label>
                <input
                  className="form-control"
                  required
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  placeholder="Ex.: Erro ao emitir NFS-e para município X"
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Descrição detalhada</label>
                <textarea
                  className="form-control"
                  required
                  rows={4}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva o ocorrido, número da nota ou mensagem de erro..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalNovo(false)}>Cancelar</button>
                <button
                  type="submit"
                  className="btn"
                  disabled={criando}
                  style={{ background: 'var(--accent, #600000)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}
                >
                  {criando ? 'Abrindo...' : 'Enviar Chamado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function AuditoriaEquipeTab() {
  const [carregando, setCarregando] = useState(true);
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [acaoFiltro, setAcaoFiltro] = useState('');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const qs = new URLSearchParams();
      if (acaoFiltro) qs.set('acao', acaoFiltro);
      if (busca.trim()) qs.set('busca', busca.trim());
      const res = await fetch(`/api/escritorio/auditoria?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setEventos(Array.isArray(data.eventos) ? data.eventos : []);
    } catch {
      toast.error('Erro ao carregar auditoria.');
    } finally {
      setCarregando(false);
    }
  }, [acaoFiltro, busca]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={18} color="var(--accent, #600000)" />
            Trilha de Auditoria da Equipe
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            Histórico completo de quem emitiu/cancelou notas, baixou fechamentos fiscais, criou auxiliares ou recebeu certificados A1.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              className="form-control"
              style={{ paddingLeft: 32, width: 220, fontSize: 13.5 }}
              placeholder="Buscar usuário ou empresa..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <select className="form-control" style={{ width: 'auto', fontSize: 13.5 }} value={acaoFiltro} onChange={(e) => setAcaoFiltro(e.target.value)}>
            <option value="">Todas as ações</option>
            {Object.entries(LABELS_ACAO).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary" onClick={carregar} style={{ borderRadius: 8 }}>
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {carregando ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Carregando trilha de auditoria...</div>
      ) : eventos.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Nenhuma atividade registrada ainda para este filtro.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Empresa</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((ev) => {
                const info = LABELS_ACAO[ev.acao] || { label: ev.acao, cor: '#374151' };
                return (
                  <tr key={ev.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12.5, color: '#6b7280' }}>
                      {new Date(ev.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: '#111827' }}>{ev.userNome}</div>
                      {ev.userEmail && <div style={{ fontSize: 11.5, color: '#6b7280' }}>{ev.userEmail}</div>}
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: 99,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: `${info.cor}18`,
                          color: info.cor,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {info.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{ev.empresaNome || '—'}</td>
                    <td style={{ fontSize: 13, color: '#4b5563' }}>{ev.detalhes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
