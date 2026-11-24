'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, SmilePlus, Send, ShieldCheck } from 'lucide-react';

interface ClimaQuestion {
  id: number;
  categoria: string;
  texto: string;
}

function ClimaPublicForm() {
  const searchParams = useSearchParams();
  const empresaId = searchParams.get('empresaId') || 'default';

  const [questions, setQuestions] = useState<ClimaQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [respondente, setRespondente] = useState('');
  const [setor, setSetor] = useState('');
  const [notas, setNotas] = useState<Record<number, number>>({});

  useEffect(() => {
    fetch(`/api/clima/public?empresaId=${encodeURIComponent(empresaId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.questions)) {
          setQuestions(d.questions);
        } else {
          setError('Não foi possível carregar as perguntas.');
        }
      })
      .catch(() => setError('Erro de conexão ao carregar pesquisa.'))
      .finally(() => setLoading(false));
  }, [empresaId]);

  const categorias = Array.from(new Set(questions.map((q) => q.categoria)));
  const totalRespondidas = Object.keys(notas).length;
  const progresso = questions.length > 0 ? Math.round((totalRespondidas / questions.length) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalRespondidas < questions.length) {
      setError(`Por favor, responda todas as ${questions.length} perguntas (${totalRespondidas} respondidas até agora).`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/clima/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          respondente: respondente.trim() || 'Anônimo',
          setor: setor.trim() || 'Geral',
          notas,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
      } else {
        setError(json.error || 'Erro ao enviar suas respostas.');
      }
    } catch {
      setError('Falha de conexão ao enviar respostas.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary, #0f1117)', color: 'var(--text-primary, #f8fafc)' }}>
        Carregando Pesquisa de Clima...
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'var(--bg-primary, #0f1117)', color: 'var(--text-primary, #f8fafc)' }}>
        <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '32px 24px', textAlign: 'center' }}>
          <CheckCircle2 size={56} color="#16a34a" style={{ margin: '0 auto 14px' }} />
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px' }}>Respostas Enviadas!</h1>
          <p style={{ fontSize: '15.5px', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, margin: 0 }}>
            Muito obrigado pela sua participação. Suas respostas foram registradas com segurança na tabulação da Pesquisa de Clima Organizacional.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary, #0f1117)', color: 'var(--text-primary, #f8fafc)', padding: '20px 14px 48px' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        {/* Header */}
        <div className="card" style={{ padding: '22px 20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <SmilePlus size={26} color="var(--accent, #8c1a22)" />
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Pesquisa de Clima Organizacional</h1>
          </div>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary, #94a3b8)', margin: '0 0 14px', lineHeight: 1.5 }}>
            Avalie cada afirmação de <strong>0</strong> (Discordo Totalmente) a <strong>10</strong> (Concordo Totalmente). Sua sinceridade ajuda a construir um ambiente melhor.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted, #94a3b8)' }}>
              <ShieldCheck size={14} color="#16a34a" /> Participação segura · Celular ou Computador
            </span>
            <strong>{totalRespondidas} / {questions.length} ({progresso}%)</strong>
          </div>
          <div style={{ height: '8px', background: 'var(--bg-secondary, #1e293b)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${progresso}%`, height: '100%', background: 'var(--accent, #8c1a22)', transition: 'width 0.25s ease' }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Identificação Opcional */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div>
                <label className="form-label">Nome (opcional — deixe em branco para anônimo)</label>
                <input
                  className="form-input"
                  placeholder="Ex: Anônimo"
                  value={respondente}
                  onChange={(e) => setRespondente(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Setor / Área (opcional)</label>
                <input
                  className="form-input"
                  placeholder="Ex: Comercial, Operações, Adm..."
                  value={setor}
                  onChange={(e) => setSetor(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Perguntas por Categoria */}
          {categorias.map((cat) => (
            <div key={cat} className="card" style={{ padding: '18px 20px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent, #f87171)', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {cat}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {questions
                  .filter((q) => q.categoria === cat)
                  .map((q) => (
                    <div key={q.id} style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border, #262b36)' }}>
                      <div style={{ fontSize: '15.5px', fontWeight: 600, marginBottom: '10px', lineHeight: 1.45 }}>
                        <span style={{ color: 'var(--accent, #f87171)', marginRight: '6px' }}>{q.id}ª.</span>
                        {q.texto}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, minmax(0, 1fr))', gap: '4px' }}>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                          const active = notas[q.id] === n;
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setNotas((prev) => ({ ...prev, [q.id]: n }))}
                              style={{
                                height: '38px',
                                borderRadius: '8px',
                                border: active ? '2px solid #fff' : '1px solid var(--border, #334155)',
                                background: active
                                  ? n >= 9
                                    ? '#16a34a'
                                    : n >= 7
                                    ? '#eab308'
                                    : '#dc2626'
                                  : 'var(--bg-secondary, #161b26)',
                                color: active ? '#fff' : 'var(--text-primary, #e2e8f0)',
                                fontWeight: 700,
                                fontSize: '14.5px',
                                cursor: 'pointer',
                              }}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
                        <span>0 = Discordo Totalmente</span>
                        <span>5 = Neutro</span>
                        <span>10 = Concordo Totalmente</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(220, 38, 38, 0.15)', border: '1px solid #dc2626', color: '#fca5a5', fontSize: '15px', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Send size={18} />
            {submitting ? 'Enviando respostas...' : 'Enviar Minhas Respostas'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ClimaPublicPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>}>
      <ClimaPublicForm />
    </Suspense>
  );
}
