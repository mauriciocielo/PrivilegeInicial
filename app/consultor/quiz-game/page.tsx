'use client';

import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Gamepad2,
  Plus,
  Play,
  Trash2,
  Edit3,
  Sparkles,
  Users,
  Clock,
  Trophy,
  Copy,
  Check,
  Volume2,
  VolumeX,
  ArrowRight,
  RotateCcw,
  Save,
  Flame,
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  BarChart3,
} from 'lucide-react';

const OPTION_STYLES = [
  { bg: '#e21b3c', shape: '▲', name: 'Vermelho' },
  { bg: '#1368ce', shape: '◆', name: 'Azul' },
  { bg: '#d89e00', shape: '●', name: 'Amarelo' },
  { bg: '#26890c', shape: '■', name: 'Verde' },
];

interface EditableQuestion {
  id: string;
  category?: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  timeLimitSec: number;
}

function playTone(freq: number, durationMs: number, type: OscillatorType = 'sine', enabled = true) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {}
}

export default function QuizGameHostPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'arena'>('list');

  // Editor state
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDesc, setQuizDesc] = useState('');
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [savingQuiz, setSavingQuiz] = useState(false);

  // AI Generator state
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [generatingAi, setGeneratingAi] = useState(false);

  // Live Arena state
  const [session, setSession] = useState<any>(null);
  const [activeGameId, setActiveGameId] = useState<string>('');
  const [lobbyTimeOverride, setLobbyTimeOverride] = useState<number>(-1);
  const [lobbyQuestionLimit, setLobbyQuestionLimit] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLiveDash, setShowLiveDash] = useState(true);
  const [joinUrl, setJoinUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const autoRevealedQuestionRef = useRef<string>('');
  const arenaRef = useRef<HTMLDivElement>(null);

  async function loadQuizzes() {
    setLoading(true);
    try {
      const res = await fetch('/api/quiz-game', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.quizzes)) {
        setQuizzes(data.quizzes);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuizzes();
  }, []);

  async function refreshSession(pin: string) {
    try {
      const res = await fetch(`/api/quiz-game?pin=${encodeURIComponent(pin)}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.session) {
        setSession(data.session);
      }
    } catch {}
  }

  useEffect(() => {
    if (viewMode !== 'arena' || !session?.pin) return;
    const pin = session.pin;

    const socket = io();
    socket.on(`quiz_update_${pin}`, () => {
      refreshSession(pin);
    });

    const interval = setInterval(() => {
      refreshSession(pin);
    }, 1500);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [viewMode, session?.pin]);

  // Timer da pergunta + auto-reveal ao zerar
  useEffect(() => {
    if (!session || session.status !== 'question' || !session.question_started_at) {
      setTimeLeft(0);
      return;
    }
    const q = session.questions?.[session.current_question_index];
    const limitSec = Number(q?.timeLimitSec ?? 20);
    if (limitSec <= 0) {
      setTimeLeft(-1);
      return;
    }
    const startedMs = new Date(session.question_started_at).getTime();
    const qKey = `${session.pin}_${session.current_question_index}_${session.question_started_at}`;

    const tick = () => {
      const elapsed = (Date.now() - startedMs) / 1000;
      const rem = Math.max(0, Math.ceil(limitSec - elapsed));
      setTimeLeft(rem);
      if (rem <= 5 && rem > 0) {
        playTone(660, 80, 'triangle', soundOn);
      }
      if (rem === 0 && autoRevealedQuestionRef.current !== qKey) {
        autoRevealedQuestionRef.current = qKey;
        playTone(330, 320, 'sawtooth', soundOn);
        handleAdvance('reveal');
      }
    };

    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [session?.status, session?.current_question_index, session?.question_started_at, soundOn]);

  function openNewQuiz() {
    setEditingId(undefined);
    setQuizTitle('');
    setQuizDesc('');
    setQuestions([
      {
        id: `q_${Date.now()}`,
        prompt: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        timeLimitSec: 20,
      },
    ]);
    setViewMode('editor');
  }

  function openEditQuiz(q: any) {
    setEditingId(q.id);
    setQuizTitle(q.title || '');
    setQuizDesc(q.description || '');
    setQuestions(
      (q.questions || []).map((item: any, idx: number) => ({
        id: item.id || `q_${Date.now()}_${idx}`,
        category: item.category || '',
        prompt: item.prompt || '',
        options: [
          item.options?.[0] || '',
          item.options?.[1] || '',
          item.options?.[2] || '',
          item.options?.[3] || '',
        ],
        correctIndex: ([0, 1, 2, 3].includes(Number(item.correctIndex)) ? Number(item.correctIndex) : 0) as 0 | 1 | 2 | 3,
        timeLimitSec: Number(item.timeLimitSec) || 20,
      }))
    );
    setViewMode('editor');
  }

  async function handleGenerateAi() {
    if (!aiTopic.trim() || generatingAi) return;
    setGeneratingAi(true);
    try {
      const res = await fetch('/api/quiz-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_ai',
          topic: aiTopic.trim(),
          count: aiCount,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.questions)) {
        setQuestions(prev => [
          ...prev.filter(item => item.prompt.trim() !== ''),
          ...data.questions,
        ]);
        if (!quizTitle.trim()) {
          setQuizTitle(`Quiz: ${aiTopic.trim()}`);
        }
      } else {
        alert(data.error || 'Não foi possível gerar perguntas com IA.');
      }
    } catch {
      alert('Erro ao gerar perguntas com IA.');
    } finally {
      setGeneratingAi(false);
    }
  }

  async function handleSaveQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!quizTitle.trim() || questions.length === 0 || savingQuiz) return;
    const validQuestions = questions.filter(
      q => q.prompt.trim() && q.options.every(opt => opt.trim())
    );
    if (validQuestions.length === 0) {
      alert('Preencha o enunciado e as 4 opções de pelo menos 1 pergunta.');
      return;
    }

    setSavingQuiz(true);
    try {
      const res = await fetch('/api/quiz-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_quiz',
          id: editingId,
          title: quizTitle.trim(),
          description: quizDesc.trim(),
          questions: validQuestions,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadQuizzes();
        setViewMode('list');
      } else {
        alert(data.error || 'Erro ao salvar quiz');
      }
    } finally {
      setSavingQuiz(false);
    }
  }

  async function handleDeleteQuiz(id: string) {
    if (!confirm('Deseja excluir este quiz?')) return;
    await fetch('/api/quiz-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_quiz', id }),
    });
    loadQuizzes();
  }

  async function handleStartArena(
    gameId: string,
    overrideLimit?: number,
    overrideTime?: number
  ) {
    try {
      const qLim = overrideLimit !== undefined ? overrideLimit : lobbyQuestionLimit;
      const tLim = overrideTime !== undefined ? overrideTime : lobbyTimeOverride;
      const res = await fetch('/api/quiz-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_session',
          gameId,
          questionLimit: qLim > 0 ? qLim : undefined,
          timeLimitOverrideSec: tLim >= 0 ? tLim : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveGameId(gameId);
        setSession(data.session);
        setJoinUrl(data.joinUrl);
        setQrDataUrl(data.qrDataUrl);
        setViewMode('arena');
        playTone(523, 180, 'triangle', soundOn);
      } else {
        alert(data.error || 'Erro ao criar sala');
      }
    } catch {
      alert('Erro ao iniciar sala ao vivo');
    }
  }

  function toggleFullscreen() {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      arenaRef.current?.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }

  async function handleAdvance(step: 'start' | 'reveal' | 'leaderboard' | 'next' | 'finish' | 'restart') {
    if (!session?.pin) return;
    const res = await fetch('/api/quiz-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'advance_session', pin: session.pin, step }),
    });
    const data = await res.json();
    if (data.success && data.session) {
      setSession(data.session);
      if (step === 'start' || step === 'next') {
        playTone(587, 160, 'triangle', soundOn);
      } else if (step === 'reveal') {
        playTone(784, 220, 'sine', soundOn);
      } else if (step === 'finish' || data.session.status === 'finished') {
        playTone(880, 350, 'triangle', soundOn);
      }
    }
  }

  const currentQ = session?.questions?.[session?.current_question_index];
  const sortedPlayers = [...(session?.players || [])].sort((a: any, b: any) => b.score - a.score);
  const answeredCount = currentQ
    ? (session?.players || []).filter((p: any) => Boolean(p.answers?.[currentQ.id])).length
    : 0;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1240, margin: '0 auto' }}>
      {/* Cabeçalho padrão do sistema */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Gamepad2 size={24} color="var(--accent)" />
            Privilege Quiz Arena (Estilo Kahoot)
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Crie quizzes interativos com ranking ao vivo, PIN e QR Code para treinamentos, reuniões e dinâmicas de equipe.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {viewMode !== 'list' && (
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: 13 }}
            >
              ← Voltar aos Quizzes
            </button>
          )}
          {viewMode === 'list' && (
            <button
              type="button"
              onClick={openNewQuiz}
              className="btn-primary"
              style={{
                padding: '9px 16px',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Plus size={16} /> Novo Quiz
            </button>
          )}
        </div>
      </div>

      {/* MODO 1: LISTA DE QUIZZES */}
      {viewMode === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {loading ? (
            <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Carregando quizzes...
            </div>
          ) : quizzes.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhum quiz cadastrado ainda. Clique em <strong>Novo Quiz</strong> para começar!
            </div>
          ) : (
            quizzes.map(q => (
              <div
                key={q.id}
                className="card"
                style={{
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                  border: '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{q.title}</h3>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: 'var(--accent-glow)',
                        color: 'var(--accent)',
                        border: '1px solid var(--accent-border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {q.questions?.length || 0} perguntas
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.45 }}>
                    {q.description || 'Quiz corporativo interativo.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleStartArena(q.id)}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Play size={15} /> Iniciar Sala Ao Vivo
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditQuiz(q)}
                    className="btn-secondary"
                    style={{ padding: '8px 10px' }}
                    title="Editar quiz"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuiz(q.id)}
                    className="btn-secondary"
                    style={{ padding: '8px 10px', color: '#dc2626' }}
                    title="Excluir quiz"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODO 2: EDITOR DE QUIZ + GERADOR IA */}
      {viewMode === 'editor' && (
        <form onSubmit={handleSaveQuiz} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card" style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="form-label">Título do Quiz</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Treinamento Fluxo de Caixa 2027"
                value={quizTitle}
                onChange={e => setQuizTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label">Descrição (opcional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Breve resumo do tema"
                value={quizDesc}
                onChange={e => setQuizDesc(e.target.value)}
              />
            </div>
          </div>

          {/* Gerador de Perguntas com IA */}
          <div
            className="card"
            style={{
              padding: 16,
              background: 'var(--accent-glow)',
              border: '1px solid var(--accent-border)',
              display: 'flex',
              alignItems: 'flex-end',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 240 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color="var(--accent)" /> Gerar Perguntas Automaticamente com IA (Gemini)
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Digite o tema (ex: Reforma Tributária, Atendimento ao Cliente, DRE)"
                value={aiTopic}
                onChange={e => setAiTopic(e.target.value)}
              />
            </div>
            <div style={{ width: 110 }}>
              <label className="form-label">Qtd.</label>
              <select
                className="form-input"
                value={aiCount}
                onChange={e => setAiCount(Number(e.target.value))}
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={8}>8</option>
                <option value={10}>10</option>
              </select>
            </div>
            <button
              type="button"
              disabled={generatingAi || !aiTopic.trim()}
              onClick={handleGenerateAi}
              className="btn-primary"
              style={{
                padding: '10px 16px',
                fontSize: 13,
              }}
            >
              {generatingAi ? 'Gerando...' : '✨ Gerar Perguntas'}
            </button>
          </div>

          {/* Lista de Perguntas */}
          {questions.map((q, qIdx) => (
            <div key={q.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>Pergunta {qIdx + 1}</strong>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: 170, padding: '4px 8px', fontSize: 12 }}
                    placeholder="Categoria (opcional)"
                    value={q.category || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setQuestions(prev => prev.map((item, i) => (i === qIdx ? { ...item, category: val } : item)));
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    disabled={qIdx === 0}
                    onClick={() =>
                      setQuestions(prev => {
                        const next = [...prev];
                        [next[qIdx - 1], next[qIdx]] = [next[qIdx], next[qIdx - 1]];
                        return next;
                      })
                    }
                    className="btn-secondary"
                    style={{ padding: '5px 8px' }}
                    title="Mover para cima"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={qIdx === questions.length - 1}
                    onClick={() =>
                      setQuestions(prev => {
                        const next = [...prev];
                        [next[qIdx + 1], next[qIdx]] = [next[qIdx], next[qIdx + 1]];
                        return next;
                      })
                    }
                    className="btn-secondary"
                    style={{ padding: '5px 8px' }}
                    title="Mover para baixo"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <select
                    className="form-input"
                    style={{ width: 130, padding: '5px 8px', fontSize: 12 }}
                    value={q.timeLimitSec}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setQuestions(prev => prev.map((item, i) => (i === qIdx ? { ...item, timeLimitSec: val } : item)));
                    }}
                  >
                    <option value={10}>⏱️ 10s</option>
                    <option value={15}>⏱️ 15s</option>
                    <option value={20}>⏱️ 20s</option>
                    <option value={30}>⏱️ 30s</option>
                    <option value={45}>⏱️ 45s</option>
                    <option value={60}>⏱️ 60s</option>
                    <option value={0}>⏱️ Sem limite</option>
                  </select>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qIdx))}
                      className="btn-secondary"
                      style={{ color: '#dc2626', padding: '6px 10px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <input
                type="text"
                className="form-input"
                placeholder="Digite o enunciado da pergunta..."
                value={q.prompt}
                onChange={e => {
                  const val = e.target.value;
                  setQuestions(prev => prev.map((item, i) => (i === qIdx ? { ...item, prompt: val } : item)));
                }}
                required
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {q.options.map((opt, optIdx) => {
                  const st = OPTION_STYLES[optIdx];
                  const isCorrect = q.correctIndex === optIdx;
                  return (
                    <div
                      key={optIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: 8,
                        borderRadius: 10,
                        border: isCorrect ? `2px solid ${st.bg}` : '1px solid var(--border)',
                        background: isCorrect ? 'rgba(38, 137, 12, 0.08)' : 'var(--bg-card2)',
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: st.bg,
                          color: '#fff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          flexShrink: 0,
                        }}
                      >
                        {st.shape}
                      </span>
                      <input
                        type="text"
                        className="form-input"
                        style={{ flex: 1, fontSize: 13 }}
                        placeholder={`Opção ${st.name}`}
                        value={opt}
                        onChange={e => {
                          const val = e.target.value;
                          setQuestions(prev =>
                            prev.map((item, i) => {
                              if (i !== qIdx) return item;
                              const nextOpts = [...item.options] as [string, string, string, string];
                              nextOpts[optIdx] = val;
                              return { ...item, options: nextOpts };
                            })
                          );
                        }}
                        required
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name={`correct_${q.id}`}
                          checked={isCorrect}
                          onChange={() =>
                            setQuestions(prev =>
                              prev.map((item, i) =>
                                i === qIdx ? { ...item, correctIndex: optIdx as 0 | 1 | 2 | 3 } : item
                              )
                            )
                          }
                        />
                        Correta
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() =>
                setQuestions(prev => [
                  ...prev,
                  {
                    id: `q_${Date.now()}`,
                    prompt: '',
                    options: ['', '', '', ''],
                    correctIndex: 0,
                    timeLimitSec: 20,
                  },
                ])
              }
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={15} /> Adicionar Pergunta
            </button>

            <button
              type="submit"
              disabled={savingQuiz}
              className="btn-primary"
              style={{
                padding: '10px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Save size={15} /> {savingQuiz ? 'Salvando...' : 'Salvar Quiz'}
            </button>
          </div>
        </form>
      )}

      {/* MODO 3: ARENA AO VIVO (APRESENTADOR / TELÃO) */}
      {viewMode === 'arena' && session && (
        <div
          ref={arenaRef}
          style={{
            borderRadius: isFullscreen ? 0 : 20,
            background: 'linear-gradient(135deg, #3b0000 0%, #600000 58%, #1f0404 100%)',
            border: '1px solid rgba(168, 137, 72, 0.35)',
            color: '#fff',
            padding: 26,
            minHeight: isFullscreen ? '100vh' : 540,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          }}
        >
          {/* Barra superior da Arena */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700 }}>QUIZ AO VIVO</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{session.title}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                PIN: {session.pin}
              </span>
              <span
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Users size={14} /> {sortedPlayers.length}
              </span>
              <button
                type="button"
                onClick={() => setSoundOn(s => !s)}
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 999,
                  width: 36,
                  height: 36,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title={soundOn ? 'Silenciar efeitos' : 'Ativar som'}
              >
                {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button
                type="button"
                onClick={() => setShowLiveDash(d => !d)}
                style={{
                  background: showLiveDash ? '#22c55e' : 'rgba(255,255,255,0.16)',
                  border: 'none',
                  color: showLiveDash ? '#052e16' : '#fff',
                  borderRadius: 999,
                  padding: '0 12px',
                  height: 36,
                  fontWeight: 800,
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                }}
                title="Mostrar/ocultar Dashboard em tempo real"
              >
                <BarChart3 size={15} /> Dash Ao Vivo
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 999,
                  width: 36,
                  height: 36,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>

          {/* ESTADO: LOBBY */}
          {session.status === 'lobby' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'center', margin: '24px 0' }}>
              <div style={{ background: '#fff', color: '#111827', borderRadius: 18, padding: 22, textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>ENTRE PELO CELULAR EM:</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#600000', wordBreak: 'break-all', margin: '4px 0 12px' }}>
                  {joinUrl}
                </div>
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="QR Code do Quiz"
                    style={{ width: 190, height: 190, margin: '0 auto 12px', display: 'block', borderRadius: 12 }}
                  />
                )}
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>PIN DO JOGO</div>
                <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: 6, color: '#3b0000', lineHeight: 1.1 }}>
                  {session.pin}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(joinUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      background: '#f9fafb',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    {copiedLink ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                    {copiedLink ? 'Copiado!' : 'Copiar Link'}
                  </button>
                  <a
                    href={`/quiz?pin=${session.pin}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(96, 0, 0, 0.08)',
                      color: '#600000',
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <ExternalLink size={14} /> Abrir Tela Jogador
                  </a>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>
                  Aguardando Jogadores ({sortedPlayers.length})
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, minHeight: 120, alignContent: 'flex-start' }}>
                  {sortedPlayers.length === 0 ? (
                    <div style={{ opacity: 0.75, fontSize: 14 }}>
                      Peça para os participantes escanearem o QR Code ou acessarem <strong>/quiz</strong> com o PIN{' '}
                      <strong>{session.pin}</strong>...
                    </div>
                  ) : (
                    sortedPlayers.map((p: any) => (
                      <div
                        key={p.id}
                        style={{
                          background: 'rgba(255,255,255,0.16)',
                          padding: '8px 14px',
                          borderRadius: 999,
                          fontWeight: 800,
                          fontSize: 14,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>{p.avatar}</span>
                        <span>{p.nickname}</span>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', padding: '6px 10px', borderRadius: 10, fontSize: 12 }}>
                    <span>Tempo:</span>
                    <select
                      value={lobbyTimeOverride}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setLobbyTimeOverride(val);
                        if (activeGameId) handleStartArena(activeGameId, lobbyQuestionLimit, val);
                      }}
                      style={{ background: '#2b0404', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
                    >
                      <option value={-1}>Padrão do quiz</option>
                      <option value={10}>10s</option>
                      <option value={20}>20s</option>
                      <option value={30}>30s</option>
                      <option value={45}>45s</option>
                      <option value={60}>60s</option>
                      <option value={0}>Sem limite</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', padding: '6px 10px', borderRadius: 10, fontSize: 12 }}>
                    <span>Perguntas:</span>
                    <select
                      value={lobbyQuestionLimit}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setLobbyQuestionLimit(val);
                        if (activeGameId) handleStartArena(activeGameId, val, lobbyTimeOverride);
                      }}
                      style={{ background: '#2b0404', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
                    >
                      <option value={0}>Todas ({session.questions?.length || 0})</option>
                      <option value={5}>5 perguntas</option>
                      <option value={10}>10 perguntas</option>
                      <option value={15}>15 perguntas</option>
                      <option value={20}>20 perguntas</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleAdvance('start')}
                    style={{
                      padding: '14px 28px',
                      borderRadius: 12,
                      border: 'none',
                      background: '#22c55e',
                      color: '#052e16',
                      fontSize: 17,
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 6px 0 #15803d',
                    }}
                  >
                    <Play size={18} /> Iniciar Jogo Agora!
                  </button>
                  {activeGameId && (
                    <button
                      type="button"
                      onClick={() => handleStartArena(activeGameId)}
                      style={{
                        padding: '12px 18px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.28)',
                        background: 'rgba(255,255,255,0.12)',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <RefreshCw size={15} /> Nova Sala
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ESTADO: PERGUNTA ATIVA */}
          {session.status === 'question' && currentQ && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, margin: '20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>
                    Pergunta {session.current_question_index + 1} de {session.questions.length}
                  </span>
                  {currentQ.category && (
                    <span style={{ fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 999 }}>
                      {currentQ.category}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, background: 'rgba(255,255,255,0.14)', padding: '6px 14px', borderRadius: 999 }}>
                    {answeredCount} / {sortedPlayers.length} responderam
                  </span>
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      background: timeLeft >= 0 && timeLeft <= 5 ? '#dc2626' : '#f59e0b',
                      color: '#fff',
                      padding: '6px 16px',
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Clock size={18} /> {timeLeft < 0 ? 'Sem limite' : `${timeLeft}s`}
                  </span>
                </div>
              </div>

              <div
                style={{
                  background: '#fff',
                  color: '#111827',
                  padding: '28px 24px',
                  borderRadius: 18,
                  fontSize: 24,
                  fontWeight: 900,
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                {currentQ.prompt}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {currentQ.options.map((opt: string, idx: number) => {
                  const st = OPTION_STYLES[idx];
                  return (
                    <div
                      key={idx}
                      style={{
                        background: st.bg,
                        padding: '18px 20px',
                        borderRadius: 14,
                        fontSize: 17,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        boxShadow: '0 5px 0 rgba(0,0,0,0.28)',
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{st.shape}</span>
                      <span>{opt}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => handleAdvance('reveal')}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#fff',
                    color: '#312e81',
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Encerrar Tempo & Mostrar Resposta →
                </button>
              </div>
            </div>
          )}

          {/* ESTADO: REVELAÇÃO DA RESPOSTA */}
          {session.status === 'reveal' && currentQ && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, margin: '20px 0' }}>
              <div
                style={{
                  background: '#fff',
                  color: '#111827',
                  padding: '20px 22px',
                  borderRadius: 16,
                  fontSize: 20,
                  fontWeight: 900,
                  textAlign: 'center',
                }}
              >
                {currentQ.prompt}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {currentQ.options.map((opt: string, idx: number) => {
                  const st = OPTION_STYLES[idx];
                  const isCorrect = Number(currentQ.correctIndex) === idx;
                  const countForOption = (session.players || []).filter(
                    (p: any) => p.answers?.[currentQ.id]?.optionIndex === idx
                  ).length;
                  return (
                    <div
                      key={idx}
                      style={{
                        background: st.bg,
                        opacity: isCorrect ? 1 : 0.42,
                        border: isCorrect ? '4px solid #fde047' : 'none',
                        padding: '16px 18px',
                        borderRadius: 14,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 16 }}>
                        <span style={{ fontSize: 22 }}>{st.shape}</span>
                        <span>{opt}</span>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>
                        {isCorrect ? '✅ ' : ''}
                        {countForOption}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleAdvance('leaderboard')}
                  style={{
                    padding: '12px 22px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#facc15',
                    color: '#422006',
                    fontWeight: 900,
                    fontSize: 15,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  Ver Ranking <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ESTADO: RANKING PARCIAL */}
          {session.status === 'leaderboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: '20px 0' }}>
              <h2 style={{ fontSize: 26, fontWeight: 900, margin: 0, textAlign: 'center' }}>
                🏆 Placar Parcial (Top 5)
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640, width: '100%', margin: '0 auto' }}>
                {sortedPlayers.slice(0, 5).map((p: any, idx: number) => (
                  <div
                    key={p.id}
                    style={{
                      background: idx === 0 ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255,255,255,0.12)',
                      border: idx === 0 ? '2px solid #facc15' : '1px solid rgba(255,255,255,0.15)',
                      padding: '12px 18px',
                      borderRadius: 14,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 17, fontWeight: 800 }}>
                      <span style={{ width: 26 }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}</span>
                      <span style={{ fontSize: 22 }}>{p.avatar}</span>
                      <span>{p.nickname}</span>
                      {p.streak >= 2 && (
                        <span style={{ fontSize: 12, background: 'rgba(0,0,0,0.28)', padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Flame size={12} color="#fde047" /> {p.streak}x
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{p.score} pts</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => handleAdvance('next')}
                  style={{
                    padding: '12px 26px',
                    borderRadius: 12,
                    border: 'none',
                    background: '#22c55e',
                    color: '#052e16',
                    fontWeight: 900,
                    fontSize: 16,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {session.current_question_index + 1 >= session.questions.length
                    ? 'Ver Pódio Final 🏆'
                    : 'Próxima Pergunta →'}
                </button>
              </div>
            </div>
          )}

          {/* ESTADO: PÓDIO FINAL */}
          {session.status === 'finished' && (
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <Trophy size={56} color="#facc15" style={{ marginBottom: 8 }} />
              <h2 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 20px' }}>Pódio Final!</h2>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                {sortedPlayers[1] && (
                  <div style={{ background: 'rgba(255,255,255,0.14)', padding: '18px 22px', borderRadius: 16, minWidth: 160 }}>
                    <div style={{ fontSize: 32 }}>🥈</div>
                    <div style={{ fontSize: 24 }}>{sortedPlayers[1].avatar}</div>
                    <div style={{ fontWeight: 900, fontSize: 17 }}>{sortedPlayers[1].nickname}</div>
                    <div style={{ fontWeight: 800, color: '#fde047' }}>{sortedPlayers[1].score} pts</div>
                  </div>
                )}
                {sortedPlayers[0] && (
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #facc15, #eab308)',
                      color: '#422006',
                      padding: '26px 28px',
                      borderRadius: 18,
                      minWidth: 190,
                      boxShadow: '0 16px 40px rgba(250, 204, 21, 0.35)',
                    }}
                  >
                    <div style={{ fontSize: 40 }}>🥇</div>
                    <div style={{ fontSize: 30 }}>{sortedPlayers[0].avatar}</div>
                    <div style={{ fontWeight: 900, fontSize: 20 }}>{sortedPlayers[0].nickname}</div>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>{sortedPlayers[0].score} pts</div>
                  </div>
                )}
                {sortedPlayers[2] && (
                  <div style={{ background: 'rgba(255,255,255,0.14)', padding: '16px 20px', borderRadius: 16, minWidth: 150 }}>
                    <div style={{ fontSize: 30 }}>🥉</div>
                    <div style={{ fontSize: 22 }}>{sortedPlayers[2].avatar}</div>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{sortedPlayers[2].nickname}</div>
                    <div style={{ fontWeight: 800, color: '#fde047' }}>{sortedPlayers[2].score} pts</div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleAdvance('restart')}
                style={{
                  padding: '12px 24px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#fff',
                  color: '#312e81',
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <RotateCcw size={16} /> Jogar Novamente
              </button>
            </div>
          )}

          <div style={{ fontSize: 11.5, opacity: 0.7, textAlign: 'center' }}>
            Privilege Quiz Arena · Participantes entram em <strong>/quiz</strong> com o PIN <strong>{session.pin}</strong>
          </div>
        </div>
      )}

      {/* DASHBOARD DE RESPOSTAS EM TEMPO REAL */}
      {viewMode === 'arena' && session && showLiveDash && (() => {
        const playersList = sortedPlayers;
        let totalAnsAll = 0;
        let totalCorrectAll = 0;
        let totalTimeMsAll = 0;
        for (const p of playersList) {
          const ansValues = Object.values(p.answers || {}) as any[];
          for (const a of ansValues) {
            totalAnsAll++;
            if (a.correct) totalCorrectAll++;
            if (a.timeMs) totalTimeMsAll += Number(a.timeMs);
          }
        }
        const accuracyPct = totalAnsAll > 0 ? Math.round((totalCorrectAll / totalAnsAll) * 100) : 0;
        const avgTimeSec = totalAnsAll > 0 ? (totalTimeMsAll / totalAnsAll / 1000).toFixed(1) : '0.0';
        const roundPct = playersList.length > 0 ? Math.round((answeredCount / playersList.length) * 100) : 0;

        return (
          <div className="card" style={{ marginTop: 18, padding: 20, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={18} color="var(--accent)" />
                Dashboard de Respostas em Tempo Real
              </h3>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.1)', padding: '4px 10px', borderRadius: 999 }}>
                ● Atualização ao vivo (PIN {session.pin})
              </span>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
              <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>Participantes na Sala</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{playersList.length}</div>
              </div>
              <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>Respostas na Rodada</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>
                  {answeredCount}/{playersList.length}{' '}
                  <span style={{ fontSize: 13, color: 'var(--accent)' }}>({roundPct}%)</span>
                </div>
              </div>
              <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>Taxa Geral de Acerto</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, color: '#16a34a' }}>{accuracyPct}%</div>
              </div>
              <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>Tempo Médio</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{avgTimeSec}s</div>
              </div>
            </div>

            {/* Distribuição ao vivo por alternativa */}
            {currentQ && (
              <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>
                  Distribuição das respostas — Pergunta {session.current_question_index + 1}:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {currentQ.options.map((opt: string, idx: number) => {
                    const st = OPTION_STYLES[idx];
                    const count = playersList.filter((p: any) => p.answers?.[currentQ.id]?.optionIndex === idx).length;
                    const pct = playersList.length > 0 ? Math.round((count / playersList.length) * 100) : 0;
                    const showCorrectMark = session.status !== 'question' && Number(currentQ.correctIndex) === idx;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: st.bg,
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 900,
                            flexShrink: 0,
                          }}
                        >
                          {st.shape}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {opt} {showCorrectMark ? '✅' : ''}
                            </span>
                            <span style={{ fontWeight: 800 }}>
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div style={{ height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: st.bg,
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tabela ao vivo por participante */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>#</th>
                    <th style={{ padding: '8px 10px' }}>Participante</th>
                    <th style={{ padding: '8px 10px' }}>Status na Rodada</th>
                    <th style={{ padding: '8px 10px' }}>Tempo</th>
                    <th style={{ padding: '8px 10px' }}>Sequência</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Pontuação</th>
                  </tr>
                </thead>
                <tbody>
                  {playersList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted)' }}>
                        Aguardando participantes entrarem na sala...
                      </td>
                    </tr>
                  ) : (
                    playersList.map((p: any, idx: number) => {
                      const ans = currentQ ? p.answers?.[currentQ.id] : null;
                      const optStyle = ans ? OPTION_STYLES[ans.optionIndex] : null;
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 800 }}>{idx + 1}º</td>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                            <span style={{ marginRight: 6 }}>{p.avatar}</span>
                            {p.nickname}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {!currentQ ? (
                              <span style={{ color: 'var(--text-muted)' }}>Na sala</span>
                            ) : !ans ? (
                              <span style={{ color: '#d97706', fontWeight: 600 }}>⏳ Aguardando...</span>
                            ) : session.status === 'question' ? (
                              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                                {optStyle?.shape} Respondeu
                              </span>
                            ) : ans.correct ? (
                              <span style={{ color: '#16a34a', fontWeight: 700 }}>
                                ✅ Acertou (+{ans.points} pts)
                              </span>
                            ) : (
                              <span style={{ color: '#dc2626', fontWeight: 700 }}>
                                ❌ Errou ({optStyle?.shape})
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                            {ans?.timeMs ? `${(ans.timeMs / 1000).toFixed(1)}s` : '—'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {p.streak >= 2 ? `🔥 ${p.streak}x` : p.streak === 1 ? '1x' : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900 }}>
                            {p.score} pts
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
