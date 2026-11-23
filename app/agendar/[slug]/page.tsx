'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, Clock, CheckCircle2, User, Building2, Phone, FileText, ArrowRight } from 'lucide-react';

interface DiaDisponivel {
  dateStr: string;
  label: string;
  diaSemana: string;
  horarios: string[];
}

export default function AgendarPublicoPage() {
  const params = useParams();
  const slug = String(params?.slug || 'privilege');

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [consultor, setConsultor] = useState<{ id: string; nome: string; cargo: string } | null>(null);
  const [dias, setDias] = useState<DiaDisponivel[]>([]);

  const [diaSel, setDiaSel] = useState<string>('');
  const [horarioSel, setHorarioSel] = useState<string>('');
  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [telefone, setTelefone] = useState('');
  const [assunto, setAssunto] = useState('Reunião de Consultoria / Alinhamento');
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState<{ consultor: string; dataBr: string; horario: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/agendar/${encodeURIComponent(slug)}`)
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) {
          setErro(j.error || 'Agenda não encontrada.');
          return;
        }
        setConsultor(j.consultor);
        const lista: DiaDisponivel[] = Array.isArray(j.diasDisponiveis) ? j.diasDisponiveis : [];
        setDias(lista);
        if (lista.length > 0) {
          setDiaSel(lista[0].dateStr);
        }
      })
      .catch(() => setErro('Não foi possível carregar os horários disponíveis.'))
      .finally(() => setLoading(false));
  }, [slug]);

  const diaAtual = dias.find(d => d.dateStr === diaSel);

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diaSel || !horarioSel || !nome.trim() || telefone.replace(/\D/g, '').length < 10) {
      setErro('Preencha seu nome, WhatsApp com DDD e selecione dia e horário.');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      const res = await fetch(`/api/agendar/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          empresa,
          telefone,
          assunto,
          dateStr: diaSel,
          horario: horarioSel,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao confirmar agendamento.');
      setConfirmado({ consultor: json.consultor, dataBr: json.dataBr, horario: json.horario });
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', padding: '32px 16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        {/* Header Marca Privilege */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 99, background: '#fef2f2', border: '1px solid #fecaca', color: '#600000', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Privilege Contabilidade &amp; Consultoria
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            {consultor ? `Agendar com ${consultor.nome}` : 'Agendamento Online'}
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            {consultor ? `${consultor.cargo} • Escolha o melhor dia e horário disponível` : 'Carregando agenda disponível...'}
          </p>
        </div>

        {loading ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', color: '#64748b', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
            Carregando horários livres...
          </div>
        ) : confirmado ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 36, textAlign: 'center', boxShadow: '0 10px 30px rgba(15,23,42,0.06)', border: '1px solid #bbf7d0' }}>
            <CheckCircle2 size={48} style={{ color: '#16a34a', margin: '0 auto 12px' }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Agendamento Confirmado!</h2>
            <p style={{ fontSize: 14.5, color: '#475569', margin: '0 0 20px' }}>
              Sua reunião com <strong>{confirmado.consultor}</strong> foi reservada para <strong>{confirmado.dataBr} às {confirmado.horario}</strong>.
            </p>
            <div style={{ display: 'inline-block', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#15803d', fontWeight: 600 }}>
              Enviamos a confirmação no seu WhatsApp.
            </div>
          </div>
        ) : !consultor ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 36, textAlign: 'center', color: '#b91c1c', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
            {erro || 'Link de agendamento inválido.'}
          </div>
        ) : (
          <form
            onSubmit={handleConfirmar}
            style={{
              background: '#fff',
              borderRadius: 18,
              padding: 24,
              boxShadow: '0 12px 36px rgba(15,23,42,0.07)',
              border: '1px solid #e2e8f0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 24,
            }}
          >
            {/* Coluna 1: Dia e Horário */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Calendar size={15} style={{ color: '#600000' }} /> 1. Escolha o dia
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 8, marginBottom: 20 }}>
                {dias.map(d => {
                  const ativo = diaSel === d.dateStr;
                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => {
                        setDiaSel(d.dateStr);
                        setHorarioSel('');
                      }}
                      style={{
                        padding: '9px 6px',
                        borderRadius: 10,
                        border: '1px solid',
                        borderColor: ativo ? '#600000' : '#e2e8f0',
                        background: ativo ? '#600000' : '#f8fafc',
                        color: ativo ? '#fff' : '#0f172a',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, opacity: ativo ? 0.85 : 0.6 }}>{d.diaSemana}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{d.label}</div>
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Clock size={15} style={{ color: '#600000' }} /> 2. Escolha o horário
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(diaAtual?.horarios || []).map(h => {
                  const ativo = horarioSel === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHorarioSel(h)}
                      style={{
                        padding: '9px 8px',
                        borderRadius: 9,
                        border: '1px solid',
                        borderColor: ativo ? '#600000' : '#cbd5e1',
                        background: ativo ? '#600000' : '#fff',
                        color: ativo ? '#fff' : '#0f172a',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Coluna 2: Seus Dados */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>
                3. Seus dados para confirmação
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  <User size={13} /> Seu nome *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Nome completo"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #cbd5e1', fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  <Building2 size={13} /> Empresa (opcional)
                </label>
                <input
                  type="text"
                  value={empresa}
                  onChange={e => setEmpresa(e.target.value)}
                  placeholder="Nome da sua empresa"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #cbd5e1', fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  <Phone size={13} /> WhatsApp com DDD *
                </label>
                <input
                  type="tel"
                  required
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  placeholder="(46) 99999-9999"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #cbd5e1', fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  <FileText size={13} /> Assunto da reunião
                </label>
                <input
                  type="text"
                  value={assunto}
                  onChange={e => setAssunto(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #cbd5e1', fontSize: 13.5 }}
                />
              </div>

              {erro && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12.5 }}>
                  {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={enviando || !diaSel || !horarioSel}
                style={{
                  marginTop: 6,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: !diaSel || !horarioSel ? '#94a3b8' : '#600000',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: !diaSel || !horarioSel ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {enviando ? 'Confirmando...' : 'Confirmar Agendamento'} <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
