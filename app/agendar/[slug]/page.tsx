'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
    if (!diaSel || !horarioSel || !nome.trim() || telefone.replace(/\D/g, '').length < 10) {
      setErro('Preencha seu nome completo e WhatsApp com DDD.');
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
    const location = encodeURIComponent(confirmado.modalidade);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startStr}/${endStr}&ctz=America/Sao_Paulo&details=${details}&location=${location}`;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top right, #f8eaea 0%, #f8fafc 45%, #f1f5f9 100%)',
        padding: '28px 16px 48px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <style>{`
        .ag-shell {
          width: 100%;
          max-width: 960px;
          background: #ffffff;
          border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(15, 23, 42, 0.10), 0 4px 16px rgba(96, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr);
        }
        .ag-slot-btn {
          padding: 10px 8px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          font-weight: 700;
          font-size: 13.5px;
          cursor: pointer;
          transition: all .15s ease;
        }
        .ag-slot-btn:hover { border-color: #600000; background: #fef2f2; color: #600000; }
        .ag-slot-btn.active { background: #600000; border-color: #600000; color: #ffffff; box-shadow: 0 4px 12px rgba(96,0,0,0.25); }
        .ag-day-btn {
          padding: 10px 6px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #0f172a;
          cursor: pointer;
          text-align: center;
          transition: all .15s ease;
        }
        .ag-day-btn:hover { border-color: #600000; background: #fef2f2; }
        .ag-day-btn.active { background: #600000; border-color: #600000; color: #ffffff; box-shadow: 0 6px 16px rgba(96,0,0,0.22); }
        .ag-input {
          width: 100%;
          padding: 11px 13px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: border-color .15s ease, box-shadow .15s ease;
          box-sizing: border-box;
        }
        .ag-input:focus { border-color: #600000; box-shadow: 0 0 0 3px rgba(96,0,0,0.1); }
        @media (max-width: 820px) {
          .ag-shell { grid-template-columns: 1fr; }
        }
      `}</style>

      {loading ? (
        <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 18, padding: 48, textAlign: 'center', color: '#64748b', boxShadow: '0 12px 36px rgba(15,23,42,0.08)' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', border: '3px solid #f1f5f9', borderTopColor: '#600000', margin: '0 auto 14px' }} className="animate-spin" />
          <div style={{ fontWeight: 700, color: '#0f172a' }}>Carregando agenda da Privilege...</div>
        </div>
      ) : confirmado ? (
        <div style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 22, padding: '36px 32px', textAlign: 'center', boxShadow: '0 24px 60px rgba(15,23,42,0.1)', border: '1px solid #bbf7d0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle2 size={36} />
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#15803d', marginBottom: 6 }}>
            Reserva Confirmada
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
            Tudo certo, {nome.split(' ')[0]}!
          </h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '0 0 22px', lineHeight: 1.5 }}>
            Enviamos a confirmação no seu WhatsApp. Nossa equipe já foi notificada.
          </p>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18, textAlign: 'left', marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: '#64748b' }}>Consultor</span>
              <strong style={{ color: '#0f172a' }}>{confirmado.consultor}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: '#64748b' }}>Data e Horário</span>
              <strong style={{ color: '#600000' }}>{confirmado.dataBr} às {confirmado.horario}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: '#64748b' }}>Assunto</span>
              <strong style={{ color: '#0f172a' }}>{confirmado.assunto}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: '#64748b' }}>Formato</span>
              <strong style={{ color: '#0f172a' }}>{confirmado.modalidade}</strong>
            </div>
            {confirmado.meetLink && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Google Meet</span>
                <a href={confirmado.meetLink} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'underline' }}>
                  Acessar sala da reunião
                </a>
              </div>
            )}
            {confirmado.inviteGoogleEnviado && email && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: '#64748b' }}>Invite enviado</span>
                <strong style={{ color: '#15803d' }}>{email}</strong>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a
              href={buildGoogleCalendarLink()}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: '1 1 200px',
                padding: '12px 16px',
                borderRadius: 11,
                background: '#600000',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 13.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
              }}
            >
              <Calendar size={15} /> Adicionar ao Google Agenda <ExternalLink size={13} />
            </a>
            <a
              href="https://wa.me/5546999800010"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: '1 1 180px',
                padding: '12px 16px',
                borderRadius: 11,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 13.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
              }}
            >
              <MessageSquare size={15} /> Falar no WhatsApp
            </a>
          </div>
        </div>
      ) : !consultor ? (
        <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 18, padding: 36, textAlign: 'center', color: '#b91c1c', boxShadow: '0 12px 36px rgba(15,23,42,0.08)' }}>
          {erro || 'Link de agendamento inválido.'}
        </div>
      ) : (
        <div className="ag-shell">
          {/* Painel Esquerdo — Marca Privilege + Resumo da Reunião */}
          <div
            style={{
              background: 'linear-gradient(155deg, #4a0404 0%, #600000 58%, #360202 100%)',
              color: '#fff',
              padding: '30px 26px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 24,
            }}
          >
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#fca5a5', marginBottom: 18 }}>
                Privilege Contabilidade
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 20 }}>
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.14)',
                    border: '1.5px solid rgba(255,255,255,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {iniciais(consultor.nome)}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>{consultor.nome}</div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{consultor.cargo}</div>
                </div>
              </div>

              <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.25, marginBottom: 14 }}>
                {assunto}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.88)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Clock size={15} style={{ color: '#fca5a5', flexShrink: 0 }} />
                  <span>Duração estimada: 60 min</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  {modalidade.startsWith('Online') ? (
                    <Video size={15} style={{ color: '#fca5a5', flexShrink: 0 }} />
                  ) : (
                    <MapPin size={15} style={{ color: '#fca5a5', flexShrink: 0 }} />
                  )}
                  <span>{modalidade}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Globe size={15} style={{ color: '#fca5a5', flexShrink: 0 }} />
                  <span>Horário de Brasília (UTC-3)</span>
                </div>
              </div>

              {/* Resumo dinâmico do horário escolhido */}
              {diaAtual && horarioSel && (
                <div style={{ marginTop: 22, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fecaca', marginBottom: 4 }}>
                    Horário Selecionado
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>
                    {diaAtual.diaSemana}, {diaAtual.label} às {horarioSel}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 16, fontSize: 11.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                <ShieldCheck size={14} style={{ color: '#86efac' }} /> Confirmação automática via WhatsApp
              </div>
              Rua Pará, 127, Sala 103 • Francisco Beltrão/PR
            </div>
          </div>

          {/* Painel Direito — Etapas Limpas */}
          <div style={{ padding: '28px 28px 30px' }}>
            {/* Indicador de Etapa */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#600000', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {etapa}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                  {etapa === 1 ? 'Escolha data, horário e formato' : 'Informe seus dados para confirmar'}
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Etapa {etapa} de 2</span>
            </div>

            {etapa === 1 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Seletor de Consultor */}
                {consultores.length > 1 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                      Com qual consultor deseja falar? {trocandoConsultor ? '(atualizando horários...)' : ''}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {consultores.map(c => {
                        const ativo = consultor?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSlugAtivo(c.slug || c.id)}
                            style={{
                              padding: '7px 12px',
                              borderRadius: 10,
                              border: '1.5px solid',
                              borderColor: ativo ? '#600000' : '#e2e8f0',
                              background: ativo ? '#fef2f2' : '#fff',
                              color: ativo ? '#600000' : '#334155',
                              fontSize: 12.5,
                              fontWeight: ativo ? 800 : 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 7,
                            }}
                          >
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: ativo ? '#600000' : '#e2e8f0',
                                color: ativo ? '#fff' : '#475569',
                                fontSize: 10,
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {iniciais(c.nome)}
                            </span>
                            {c.nome}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Formato */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Formato da Reunião</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {([
                      { id: 'Online (Google Meet)' as const, label: 'Online (Google Meet)', icon: <Video size={14} /> },
                      { id: 'Presencial — Escritório Privilege' as const, label: 'Presencial no Escritório', icon: <MapPin size={14} /> },
                    ]).map(m => {
                      const ativo = modalidade === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setModalidade(m.id)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1.5px solid',
                            borderColor: ativo ? '#600000' : '#e2e8f0',
                            background: ativo ? '#fef2f2' : '#fff',
                            color: ativo ? '#600000' : '#334155',
                            fontWeight: 700,
                            fontSize: 12.5,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          {m.icon} {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Assunto rápido */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Qual o tema principal?</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ASSUNTOS_RAPIDOS.map(item => {
                      const ativo = assunto === item;
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setAssunto(item)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 99,
                            border: '1px solid',
                            borderColor: ativo ? '#600000' : '#e2e8f0',
                            background: ativo ? '#600000' : '#f8fafc',
                            color: ativo ? '#fff' : '#334155',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dias */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Selecione o dia</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
                    {dias.map(d => (
                      <button
                        key={d.dateStr}
                        type="button"
                        className={`ag-day-btn${diaSel === d.dateStr ? ' active' : ''}`}
                        onClick={() => {
                          setDiaSel(d.dateStr);
                          setHorarioSel('');
                        }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 700, opacity: diaSel === d.dateStr ? 0.85 : 0.6 }}>{d.diaSemana}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, margin: '2px 0' }}>{d.label}</div>
                        <div style={{ fontSize: 10, opacity: diaSel === d.dateStr ? 0.85 : 0.55 }}>{d.horarios.length} vagas</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Horários Manhã e Tarde */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Selecione o horário</div>
                  {horariosManha.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Manhã</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
                        {horariosManha.map(h => (
                          <button key={h} type="button" className={`ag-slot-btn${horarioSel === h ? ' active' : ''}`} onClick={() => setHorarioSel(h)}>
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {horariosTarde.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Tarde</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
                        {horariosTarde.map(h => (
                          <button key={h} type="button" className={`ag-slot-btn${horarioSel === h ? ' active' : ''}`} onClick={() => setHorarioSel(h)}>
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!diaSel || !horarioSel}
                  onClick={() => setEtapa(2)}
                  style={{
                    marginTop: 4,
                    padding: '13px 18px',
                    borderRadius: 11,
                    border: 'none',
                    background: !diaSel || !horarioSel ? '#cbd5e1' : '#600000',
                    color: '#fff',
                    fontSize: 14.5,
                    fontWeight: 700,
                    cursor: !diaSel || !horarioSel ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  Continuar para seus dados <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <button
                  type="button"
                  onClick={() => setEtapa(1)}
                  style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#600000', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0 }}
                >
                  <ArrowLeft size={14} /> Alterar dia ou horário
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                      <User size={13} /> Seu nome completo *
                    </label>
                    <input className="ag-input" type="text" required value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Carlos Silva" autoFocus />
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                      <Building2 size={13} /> Empresa
                    </label>
                    <input className="ag-input" type="text" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nome da empresa" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                      <Phone size={13} /> WhatsApp com DDD *
                    </label>
                    <input
                      className="ag-input"
                      type="tel"
                      required
                      value={telefone}
                      onChange={e => setTelefone(formatarTelefoneMask(e.target.value))}
                      placeholder="(46) 99999-9999"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                      <Mail size={13} /> E-mail para o Invite *
                    </label>
                    <input className="ag-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                    <Mail size={13} /> Outros e-mails convidados no Invite (opcional)
                  </label>
                  <input
                    className="ag-input"
                    type="text"
                    value={emailsExtras}
                    onChange={e => setEmailsExtras(e.target.value)}
                    placeholder="socio@empresa.com.br, financeiro@empresa.com.br"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                    Pauta ou observação (opcional)
                  </label>
                  <textarea
                    className="ag-input"
                    rows={3}
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                    placeholder="Conte brevemente o que gostaria de tratar na reunião..."
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {erro && (
                  <div style={{ padding: '10px 12px', borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12.5, fontWeight: 600 }}>
                    {erro}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  style={{
                    marginTop: 4,
                    padding: '13px 18px',
                    borderRadius: 11,
                    border: 'none',
                    background: '#600000',
                    color: '#fff',
                    fontSize: 14.5,
                    fontWeight: 700,
                    cursor: enviando ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 8px 20px rgba(96,0,0,0.25)',
                  }}
                >
                  {enviando ? 'Confirmando reserva...' : 'Confirmar Agendamento'} <CheckCircle2 size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
