'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar, Clock, CheckCircle2, User, Building2, Phone, Mail,
  Video, MapPin, ArrowRight, ArrowLeft, ShieldCheck, Globe, MessageSquare, ExternalLink,
} from 'lucide-react';

interface DiaDisponivel {
  dateStr: string;
  label: string;
  diaSemana: string;
  horarios: string[];
}

const ASSUNTOS_RAPIDOS = [
  'Consultoria Financeira / BPO',
  'Planejamento Tributário',
  'Fechamento Mensal',
  'Abertura / Migração de Empresa',
  'Alinhamento Geral',
];

function formatarTelefoneMask(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function iniciais(nome: string): string {
  const p = (nome || 'P').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase();
}

export default function AgendarPublicoPage() {
  const params = useParams();
  const slugInicial = String(params?.slug || 'privilege');
  const [slugAtivo, setSlugAtivo] = useState(slugInicial);

  const [loading, setLoading] = useState(true);
  const [trocandoConsultor, setTrocandoConsultor] = useState(false);
  const [erro, setErro] = useState('');
  const [consultor, setConsultor] = useState<{ id: string; slug?: string; nome: string; cargo: string } | null>(null);
  const [consultores, setConsultores] = useState<Array<{ id: string; slug: string; nome: string; cargo: string }>>([]);
  const [dias, setDias] = useState<DiaDisponivel[]>([]);

  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [diaSel, setDiaSel] = useState<string>('');
  const [horarioSel, setHorarioSel] = useState<string>('');
  const [modalidade, setModalidade] = useState<'Online (Google Meet)' | 'Presencial — Escritório Privilege'>('Online (Google Meet)');
  const [assunto, setAssunto] = useState(ASSUNTOS_RAPIDOS[0]);

  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [email, setEmail] = useState('');
  const [emailsExtras, setEmailsExtras] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [confirmado, setConfirmado] = useState<{
    consultor: string;
    dataBr: string;
    dateStr: string;
    horario: string;
    assunto: string;
    modalidade: string;
    meetLink?: string | null;
    inviteGoogleEnviado?: boolean;
  } | null>(null);

  useEffect(() => {
    const primeiraCarga = !consultor;
    if (primeiraCarga) setLoading(true);
    else setTrocandoConsultor(true);

    fetch(`/api/agendar/${encodeURIComponent(slugAtivo)}`)
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) {
          setErro(j.error || 'Agenda não encontrada.');
          return;
        }
        setErro('');
        setConsultor(j.consultor);
        if (Array.isArray(j.consultores)) setConsultores(j.consultores);
        const lista: DiaDisponivel[] = Array.isArray(j.diasDisponiveis) ? j.diasDisponiveis : [];
        setDias(lista);
        setHorarioSel('');
        if (lista.length > 0) setDiaSel(lista[0].dateStr);
        else setDiaSel('');
      })
      .catch(() => setErro('Não foi possível carregar os horários disponíveis.'))
      .finally(() => {
        setLoading(false);
        setTrocandoConsultor(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugAtivo]);

  const diaAtual = dias.find(d => d.dateStr === diaSel);
  const horariosManha = (diaAtual?.horarios || []).filter(h => Number(h.split(':')[0]) < 12);
  const horariosTarde = (diaAtual?.horarios || []).filter(h => Number(h.split(':')[0]) >= 12);

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diaSel || !horarioSel || !nome.trim() || telefone.replace(/\D/g, '').length < 10 || !email.trim()) {
      setErro('Preencha seu nome completo, WhatsApp com DDD e e-mail para o invite.');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      const res = await fetch(`/api/agendar/${encodeURIComponent(consultor?.id || slugAtivo)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          empresa,
          email,
          emailsExtras,
          telefone,
          assunto,
          modalidade,
          observacoes,
          dateStr: diaSel,
          horario: horarioSel,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao confirmar agendamento.');
      setConfirmado({
        consultor: json.consultor,
        dataBr: json.dataBr,
        dateStr: json.dateStr || diaSel,
        horario: json.horario,
        assunto: json.assunto || assunto,
        modalidade: json.modalidade || modalidade,
        meetLink: json.meetLink || null,
        inviteGoogleEnviado: Boolean(json.inviteGoogleEnviado),
      });
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const buildGoogleCalendarLink = () => {
    if (!confirmado) return '#';
    const dClean = confirmado.dateStr.replace(/-/g, '');
    const [hh, mm] = confirmado.horario.split(':').map(Number);
    const startStr = `${dClean}T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`;
    const endStr = `${dClean}T${String(Math.min(23, hh + 1)).padStart(2, '0')}${String(mm).padStart(2, '0')}00`;
    const text = encodeURIComponent(`${confirmado.assunto} — Privilege Contabilidade`);
    const details = encodeURIComponent(`Reunião agendada com ${confirmado.consultor} (Privilege Contabilidade e Consultoria).`);
    const location = encodeURIComponent(confirmado.meetLink || confirmado.modalidade);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startStr}/${endStr}&ctz=America/Sao_Paulo&details=${details}&location=${location}`;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <style>{`
        .ag-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 330px;
          gap: 20px;
          align-items: start;
        }
        .ag-choice {
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-primary);
          border-radius: 10px;
          cursor: pointer;
          transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;
        }
        .ag-choice:hover {
          border-color: var(--accent-border);
          background: var(--bg-hover);
        }
        .ag-choice.active {
          border-color: var(--accent);
          background: var(--accent);
          color: #ffffff;
        }
        .ag-choice-soft.active {
          border-color: var(--accent);
          background: var(--accent-glow);
          color: var(--accent);
        }
        @media (max-width: 900px) {
          .ag-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Topbar Editorial idêntica ao Portal Privilege */}
      <header
        style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img
            src="/privilege-logo-colorida.svg"
            alt="Privilege Contabilidade"
            style={{ height: 32, width: 'auto', objectFit: 'contain' }}
            onError={e => {
              (e.currentTarget as HTMLImageElement).src = '/logo.png';
            }}
          />
          <span style={{ height: 22, width: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
            Agendamento Online
          </span>
        </div>

        <Link href="/" className="btn btn-ghost btn-sm" style={{ fontSize: 12.5 }}>
          <ArrowLeft size={14} /> Voltar ao site
        </Link>
      </header>

      <main style={{ maxWidth: 1060, margin: '0 auto', padding: '28px 20px 56px' }}>
        {/* Título Editorial do Sistema */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
            Privilege Contabilidade &amp; Consultoria
          </div>
          <h1 className="page-title" style={{ margin: 0, fontSize: 34 }}>
            {confirmado ? 'Agendamento Confirmado' : 'Agende sua Reunião'}
          </h1>
          <p className="page-subtitle" style={{ margin: '6px 0 0' }}>
            {confirmado
              ? 'Sua reserva foi registrada na agenda da nossa equipe.'
              : 'Escolha o consultor, o melhor dia e horário — enviaremos o invite por e-mail e a confirmação no WhatsApp.'}
          </p>
        </div>

        {loading ? (
          <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            Carregando horários disponíveis...
          </div>
        ) : confirmado ? (
          <div className="card" style={{ maxWidth: 620, borderTop: '3px solid var(--green)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--green-bg)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Tudo certo, {nome.split(' ')[0]}!
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Reserva confirmada com {confirmado.consultor}.
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-light)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: 'var(--text-muted)' }}>Consultor</span>
                <strong>{confirmado.consultor}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: 'var(--text-muted)' }}>Data e Horário</span>
                <strong style={{ color: 'var(--accent)' }}>{confirmado.dataBr} às {confirmado.horario}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: 'var(--text-muted)' }}>Assunto</span>
                <strong>{confirmado.assunto}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: 'var(--text-muted)' }}>Formato</span>
                <strong>{confirmado.modalidade}</strong>
              </div>
              {confirmado.meetLink && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Google Meet</span>
                  <a href={confirmado.meetLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', fontWeight: 700, textDecoration: 'underline' }}>
                    Acessar sala da reunião
                  </a>
                </div>
              )}
              {confirmado.inviteGoogleEnviado && email && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Invite enviado para</span>
                  <strong style={{ color: 'var(--green)' }}>{email}</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a
                href={buildGoogleCalendarLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ flex: '1 1 200px', justifyContent: 'center' }}
              >
                <Calendar size={15} /> Adicionar ao Google Agenda <ExternalLink size={13} />
              </a>
              <a
                href="https://wa.me/5546999800010"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ flex: '1 1 180px', justifyContent: 'center' }}
              >
                <MessageSquare size={15} /> Falar no WhatsApp
              </a>
            </div>
          </div>
        ) : !consultor ? (
          <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--red)' }}>
            {erro || 'Nenhum consultor disponível no momento.'}
          </div>
        ) : (
          <div className="ag-grid">
            {/* Coluna Principal — Formulário Editorial */}
            <div className="card" style={{ padding: '24px 26px' }}>
              {/* Stepper discreto */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, marginBottom: 20, borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {etapa}
                  </span>
                  <span className="card-title" style={{ fontSize: 22, margin: 0 }}>
                    {etapa === 1 ? 'Consultor, Data e Horário' : 'Seus Dados e Invite'}
                  </span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                  Passo {etapa} de 2
                </span>
              </div>

              {etapa === 1 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  {/* 1. Consultor */}
                  {consultores.length > 0 && (
                    <div>
                      <label className="form-label" style={{ marginBottom: 8 }}>
                        1. Escolha o Consultor {trocandoConsultor ? '(atualizando agenda...)' : ''}
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                        {consultores.map(c => {
                          const ativo = consultor?.id === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              className={`ag-choice ag-choice-soft${ativo ? ' active' : ''}`}
                              onClick={() => setSlugAtivo(c.slug || c.id)}
                              style={{ padding: '10px 12px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
                            >
                              <span
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: '50%',
                                  background: ativo ? 'var(--accent)' : 'var(--bg-secondary)',
                                  color: ativo ? '#fff' : 'var(--text-secondary)',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {iniciais(c.nome)}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</div>
                                <div style={{ fontSize: 11, opacity: 0.72 }}>{c.cargo}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 2. Formato e Assunto */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label className="form-label" style={{ marginBottom: 8 }}>2. Formato da Reunião</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {([
                          { id: 'Online (Google Meet)' as const, label: 'Online (Meet)', icon: <Video size={14} /> },
                          { id: 'Presencial — Escritório Privilege' as const, label: 'Presencial', icon: <MapPin size={14} /> },
                        ]).map(m => {
                          const ativo = modalidade === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              className={`ag-choice ag-choice-soft${ativo ? ' active' : ''}`}
                              onClick={() => setModalidade(m.id)}
                              style={{ padding: '9px 10px', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            >
                              {m.icon} {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="form-label" style={{ marginBottom: 8 }}>3. Assunto Principal</label>
                      <select
                        className="form-control"
                        value={assunto}
                        onChange={e => setAssunto(e.target.value)}
                      >
                        {ASSUNTOS_RAPIDOS.map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 4. Dia */}
                  <div>
                    <label className="form-label" style={{ marginBottom: 8 }}>4. Escolha o Dia</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
                      {dias.map(d => (
                        <button
                          key={d.dateStr}
                          type="button"
                          className={`ag-choice${diaSel === d.dateStr ? ' active' : ''}`}
                          onClick={() => {
                            setDiaSel(d.dateStr);
                            setHorarioSel('');
                          }}
                          style={{ padding: '9px 6px', textAlign: 'center' }}
                        >
                          <div style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.72, textTransform: 'uppercase' }}>{d.diaSemana}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, margin: '2px 0' }}>{d.label}</div>
                          <div style={{ fontSize: 10, opacity: 0.7 }}>{d.horarios.length} vagas</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5. Horário */}
                  <div>
                    <label className="form-label" style={{ marginBottom: 8 }}>5. Escolha o Horário (Brasília)</label>
                    {horariosManha.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Manhã</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
                          {horariosManha.map(h => (
                            <button
                              key={h}
                              type="button"
                              className={`ag-choice${horarioSel === h ? ' active' : ''}`}
                              onClick={() => setHorarioSel(h)}
                              style={{ padding: '9px 8px', fontWeight: 700, fontSize: 13 }}
                            >
                              {h}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {horariosTarde.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Tarde</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
                          {horariosTarde.map(h => (
                            <button
                              key={h}
                              type="button"
                              className={`ag-choice${horarioSel === h ? ' active' : ''}`}
                              onClick={() => setHorarioSel(h)}
                              style={{ padding: '9px 8px', fontWeight: 700, fontSize: 13 }}
                            >
                              {h}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6, borderTop: '1px solid var(--border-light)' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      disabled={!diaSel || !horarioSel}
                      onClick={() => setEtapa(2)}
                    >
                      Continuar para seus dados <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleConfirmar} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                  <div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEtapa(1)}
                      style={{ paddingLeft: 0, color: 'var(--accent)' }}
                    >
                      <ArrowLeft size={14} /> Alterar consultor, dia ou horário
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <User size={13} /> Nome Completo *
                      </label>
                      <input className="form-control" type="text" required value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Carlos Silva" autoFocus />
                    </div>
                    <div>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Building2 size={13} /> Empresa (opcional)
                      </label>
                      <input className="form-control" type="text" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nome da sua empresa" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Phone size={13} /> WhatsApp com DDD *
                      </label>
                      <input
                        className="form-control"
                        type="tel"
                        required
                        value={telefone}
                        onChange={e => setTelefone(formatarTelefoneMask(e.target.value))}
                        placeholder="(46) 99999-9999"
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Mail size={13} /> E-mail para o Invite *
                      </label>
                      <input className="form-control" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Mail size={13} /> Outros e-mails convidados no Invite (opcional)
                    </label>
                    <input
                      className="form-control"
                      type="text"
                      value={emailsExtras}
                      onChange={e => setEmailsExtras(e.target.value)}
                      placeholder="socio@empresa.com.br, financeiro@empresa.com.br"
                    />
                  </div>

                  <div>
                    <label className="form-label">Pauta ou observação (opcional)</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={observacoes}
                      onChange={e => setObservacoes(e.target.value)}
                      placeholder="Conte brevemente o que gostaria de tratar na reunião..."
                    />
                  </div>

                  {erro && (
                    <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: 12.5, fontWeight: 600 }}>
                      {erro}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 6, borderTop: '1px solid var(--border-light)' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setEtapa(1)}>
                      Voltar
                    </button>
                    <button type="submit" className="btn btn-primary btn-lg" disabled={enviando}>
                      {enviando ? 'Confirmando...' : 'Confirmar Agendamento'} <CheckCircle2 size={15} />
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Coluna Lateral — Resumo Editorial Limpo */}
            <aside className="card" style={{ padding: '22px 22px', borderTop: '3px solid var(--accent)', position: 'sticky', top: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 14 }}>
                Resumo da Reunião
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    background: 'var(--accent-glow)',
                    border: '1px solid var(--accent-border)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {iniciais(consultor.nome)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{consultor.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{consultor.cargo}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: 13, color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Calendar size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span>
                    {diaAtual && horarioSel
                      ? <strong style={{ color: 'var(--text-primary)' }}>{diaAtual.diaSemana}, {diaAtual.label} às {horarioSel}</strong>
                      : 'Selecione dia e horário'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Clock size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>Duração: 60 minutos</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  {modalidade.startsWith('Online')
                    ? <Video size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    : <MapPin size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                  <span>{modalidade}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Globe size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>Horário de Brasília (UTC-3)</span>
                </div>
              </div>

              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border-light)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontWeight: 600, marginBottom: 6 }}>
                  <ShieldCheck size={14} /> Confirmação no WhatsApp &amp; Invite
                </div>
                Rua Pará, 127, Sala 103 · Centro<br />
                Francisco Beltrão / PR
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
