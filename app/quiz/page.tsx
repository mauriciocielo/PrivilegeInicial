'use client';

import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { Trophy, Flame, CheckCircle2, XCircle, Sparkles, Clock } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';

const OPTION_STYLES = [
  { bg: '#e21b3c', hover: '#c81633', shape: '▲', label: 'Vermelho' },
  { bg: '#1368ce', hover: '#1058b0', shape: '◆', label: 'Azul' },
  { bg: '#d89e00', hover: '#bd8a00', shape: '●', label: 'Amarelo' },
  { bg: '#26890c', hover: '#1f700a', shape: '■', label: 'Verde' },
];

const AVATARS = ['🚀', '🦁', '🦊', '🦉', '⚡', '🏆', '🎯', '💎', '🔥', '🌟', '🐼', '🦈'];

export default function PublicQuizPlayerPage() {
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('🚀');
  const [playerId, setPlayerId] = useState<string>('');
  const [session, setSession] = useState<any>(null);
  const [joining, setJoining] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const playerIdRef = useRef(playerId);
  playerIdRef.current = playerId;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlPin = params.get('pin');
    if (urlPin) setPin(urlPin.replace(/\D/g, '').slice(0, 6));

    const savedPid = localStorage.getItem('cf_quiz_player_id');
    const savedPin = localStorage.getItem('cf_quiz_last_pin');
    const savedNick = localStorage.getItem('cf_quiz_nickname');
    if (savedNick) setNickname(savedNick);
    if (savedPid && urlPin && savedPin === urlPin) {
      setPlayerId(savedPid);
      fetchSession(urlPin);
    }
  }, []);

  async function fetchSession(targetPin: string) {
    try {
      const res = await fetch(`/api/quiz-game/public?pin=${encodeURIComponent(targetPin)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && data.session) {
        setSession(data.session);
      }
    } catch {}
  }

  useEffect(() => {
    if (!session?.pin) return;
    const activePin = session.pin;

    const socket = io();
    socket.on(`quiz_update_${activePin}`, () => {
      fetchSession(activePin);
    });

    const interval = setInterval(() => {
      fetchSession(activePin);
    }, 1200);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [session?.pin]);

  useEffect(() => {
    if (!session || session.status !== 'question' || !session.question_started_at) {
      setTimeLeft(0);
      return;
    }
    const currentQ = session.questions?.[session.current_question_index];
    const limitSec = Number(currentQ?.timeLimitSec ?? 20);
    if (limitSec <= 0) {
      setTimeLeft(-1);
      return;
    }
    const startedMs = new Date(session.question_started_at).getTime();

    const updateTimer = () => {
      const elapsedSec = (Date.now() - startedMs) / 1000;
      const rem = Math.max(0, Math.ceil(limitSec - elapsedSec));
      setTimeLeft(rem);
    };

    updateTimer();
    const t = setInterval(updateTimer, 250);
    return () => clearInterval(t);
  }, [session?.status, session?.current_question_index, session?.question_started_at]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    const cleanPin = pin.replace(/\D/g, '');
    if (cleanPin.length < 4 || !nickname.trim()) {
      setErrorMsg('Digite o PIN da sala e seu apelido.');
      return;
    }

    setJoining(true);
    try {
      const res = await fetch('/api/quiz-game/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          pin: cleanPin,
          nickname: nickname.trim(),
          avatar,
          playerId: playerIdRef.current || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error || 'Não foi possível entrar na sala.');
        return;
      }
      setPlayerId(data.player.id);
      setSession(data.session);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cf_quiz_player_id', data.player.id);
        localStorage.setItem('cf_quiz_last_pin', cleanPin);
        localStorage.setItem('cf_quiz_nickname', nickname.trim());
      }
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.');
    } finally {
      setJoining(false);
    }
  }

  async function handleAnswer(optionIndex: number) {
    if (!session?.pin || !playerId || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/quiz-game/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'answer',
          pin: session.pin,
          playerId,
          optionIndex,
        }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        setSession(data.session);
      }
    } catch {} finally {
      setSubmitting(false);
    }
  }

  const me = session?.players?.find((p: any) => p.id === playerId);
  const myRank = session?.players ? session.players.findIndex((p: any) => p.id === playerId) + 1 : 0;
  const currentQ = session?.questions?.[session?.current_question_index];

  // Tela de entrada (PIN + Apelido)
  if (!session || !playerId) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #3b0000 0%, #600000 55%, #1a0505 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          color: '#fff',
        }}
      >
        <form
          onSubmit={handleJoin}
          style={{
            width: '100%',
            maxWidth: 410,
            background: '#ffffff',
            color: '#171717',
            borderRadius: 20,
            padding: 28,
            border: '1px solid #e5e5e5',
            boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <BrandLogo size={48} showText={false} />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#600000' }}>
              Privilege Quiz Arena
            </h1>
            <p style={{ fontSize: 13, color: '#666666', margin: 0 }}>
              Entre com o PIN exibido na tela para jogar ao vivo!
            </p>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
              PIN do Jogo
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Ex: 482910"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: 6,
                textAlign: 'center',
                borderRadius: 12,
                border: '2px solid #d1d5db',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
              Seu Nome / Apelido
            </label>
            <input
              type="text"
              maxLength={24}
              placeholder="Como quer aparecer no ranking?"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 12,
                border: '2px solid #d1d5db',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              Escolha seu Avatar
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {AVATARS.map(av => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setAvatar(av)}
                  style={{
                    fontSize: 22,
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    border: avatar === av ? '3px solid #600000' : '1px solid #e5e5e5',
                    background: avatar === av ? 'rgba(96, 0, 0, 0.08)' : '#f7f7f8',
                    cursor: 'pointer',
                  }}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div
              style={{
                background: '#fee2e2',
                color: '#b91c1c',
                padding: '10px 12px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={joining}
            style={{
              padding: '14px 20px',
              borderRadius: 12,
              border: 'none',
              background: '#600000',
              color: '#fff',
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 6px 0 #3b0000',
            }}
          >
            {joining ? 'Entrando...' : 'Entrar no Jogo!'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #2b0404 0%, #3b0000 55%, #170505 100%)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header do jogador */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: 'rgba(0,0,0,0.28)',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
          <span style={{ fontSize: 20 }}>{me?.avatar || avatar}</span>
          <span>{me?.nickname || nickname}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>PIN: {session.pin}</span>
          <span
            style={{
              background: '#a88948',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {me?.score ?? 0} pts
          </span>
        </div>
      </div>

      {/* Corpo dinâmico conforme o estado da partida */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          maxWidth: 680,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {session.status === 'lobby' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>{me?.avatar || avatar}</div>
            <h2 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 8px' }}>Você está dentro!</h2>
            <p style={{ fontSize: 15, opacity: 0.85, margin: 0 }}>
              Veja seu nome na tela principal. O jogo vai começar em instantes...
            </p>
            <div
              style={{
                marginTop: 24,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.12)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Sparkles size={16} /> {session.players?.length || 1} participante(s) na sala
            </div>
          </div>
        )}

        {session.status === 'question' && currentQ && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>
                Pergunta {session.current_question_index + 1} de {session.total_questions}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: timeLeft >= 0 && timeLeft <= 5 ? '#dc2626' : 'rgba(255,255,255,0.16)',
                  padding: '5px 12px',
                  borderRadius: 999,
                  fontWeight: 900,
                  fontSize: 14,
                }}
              >
                <Clock size={14} /> {timeLeft < 0 ? 'Sem limite' : `${timeLeft}s`}
              </span>
            </div>

            <div
              style={{
                background: '#fff',
                color: '#111827',
                padding: '18px 16px',
                borderRadius: 16,
                fontSize: 18,
                fontWeight: 800,
                textAlign: 'center',
                lineHeight: 1.35,
              }}
            >
              {currentQ.prompt}
            </div>

            {me?.answeredCurrent ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '36px 20px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 18,
                }}
              >
                <div style={{ fontSize: 42, marginBottom: 8 }}>⏳</div>
                <h3 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>Resposta enviada!</h3>
                <p style={{ fontSize: 14, opacity: 0.85, margin: 0 }}>
                  Aguardando os demais participantes ou o fim do tempo...
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                {currentQ.options.map((opt: string, idx: number) => {
                  const st = OPTION_STYLES[idx];
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={submitting || timeLeft === 0}
                      onClick={() => handleAnswer(idx)}
                      style={{
                        background: st.bg,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 14,
                        padding: '18px 16px',
                        minHeight: 84,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        textAlign: 'left',
                        fontSize: 15,
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 5px 0 rgba(0,0,0,0.28)',
                      }}
                    >
                      <span style={{ fontSize: 24, flexShrink: 0 }}>{st.shape}</span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(session.status === 'reveal' || session.status === 'leaderboard') && (
          <div
            style={{
              width: '100%',
              textAlign: 'center',
              padding: '34px 22px',
              borderRadius: 22,
              background: me?.lastCorrect ? '#15803d' : '#b91c1c',
              boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              {me?.lastCorrect ? <CheckCircle2 size={56} /> : <XCircle size={56} />}
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 8px' }}>
              {me?.lastCorrect ? 'Acertou!' : 'Não foi dessa vez!'}
            </h2>
            <p style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>
              {me?.lastCorrect ? `+${me.lastPoints} pontos` : '0 pontos nesta rodada'}
            </p>
            {me?.streak >= 2 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(0,0,0,0.25)',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                <Flame size={16} color="#fde047" /> Sequência de {me.streak} acertos!
              </div>
            )}
            <div style={{ fontSize: 14, opacity: 0.92 }}>
              Você está em <strong>{myRank}º lugar</strong> com <strong>{me?.score ?? 0} pts</strong>
            </div>
          </div>
        )}

        {session.status === 'finished' && (
          <div
            style={{
              width: '100%',
              textAlign: 'center',
              padding: '36px 22px',
              borderRadius: 24,
              background: 'linear-gradient(135deg, #600000 0%, #3b0000 100%)',
              border: '2px solid rgba(168, 137, 72, 0.55)',
            }}
          >
            <Trophy size={60} color="#facc15" style={{ marginBottom: 10 }} />
            <h2 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 8px' }}>Fim de Jogo!</h2>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fde047', marginBottom: 6 }}>
              {myRank === 1
                ? '🥇 1º Lugar — Campeão!'
                : myRank === 2
                ? '🥈 2º Lugar!'
                : myRank === 3
                ? '🥉 3º Lugar!'
                : `${myRank}º Lugar`}
            </div>
            <p style={{ fontSize: 16, margin: '0 0 20px', opacity: 0.9 }}>
              Pontuação final: <strong>{me?.score ?? 0} pontos</strong>
            </p>
            <button
              type="button"
              onClick={() => {
                setSession(null);
                setPlayerId('');
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('cf_quiz_player_id');
                  localStorage.removeItem('cf_quiz_last_pin');
                }
              }}
              style={{
                padding: '12px 22px',
                borderRadius: 12,
                border: 'none',
                background: '#fff',
                color: '#600000',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Entrar em outra sala
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
