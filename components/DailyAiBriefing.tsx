'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, ArrowRight, Lightbulb } from 'lucide-react';
import { store } from '../lib/store';
import type { BriefingDiaPayload, PrioridadeBriefing } from '../app/api/ai/briefing-dia/route';

interface DailyAiBriefingProps {
  empresaId?: string;
}

const TOM_STYLE: Record<PrioridadeBriefing['tom'], { bg: string; border: string; color: string }> = {
  critico: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
  atencao: { bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
  positivo: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
  info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
};

export default function DailyAiBriefing({ empresaId = '' }: DailyAiBriefingProps) {
  const router = useRouter();
  const [data, setData] = useState<BriefingDiaPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const hojeKey = typeof window !== 'undefined' ? new Date().toISOString().slice(0, 10) : '';
  const uid = typeof window !== 'undefined' ? store.getCurrentUser()?.id || 'u' : 'u';
  const cacheKey = `cf_briefing_dia_${uid}_${empresaId || 'all'}_${hojeKey}`;
  const collapseKey = `cf_briefing_collapsed_${uid}_${hojeKey}`;

  const carregar = useCallback(async (forcar = false) => {
    if (!forcar && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setData(JSON.parse(cached));
          return;
        }
      } catch {
        // ignora
      }
    }

    setLoading(true);
    try {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : '';
      const res = await fetch(`/api/ai/briefing-dia${qs}`);
      if (!res.ok) return;
      const json: BriefingDiaPayload = await res.json();
      setData(json);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(cacheKey, JSON.stringify(json)); } catch {}
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [cacheKey, empresaId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCollapsed(localStorage.getItem(collapseKey) === '1');
    }
    carregar(false);
  }, [carregar, collapseKey]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(collapseKey, next ? '1' : '0'); } catch {}
    }
  };

  if (!data && !loading) return null;

  if (collapsed && data) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={toggleCollapsed}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 99,
            border: '1px solid rgba(96, 0, 0, 0.2)',
            background: 'var(--bg-card, #ffffff)',
            color: '#600000',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Sparkles size={14} />
          <span>Ver Briefing do Dia ({data.prioridades.length} insight{data.prioridades.length > 1 ? 's' : ''})</span>
          <ChevronDown size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: 20,
        borderRadius: 18,
        border: '1px solid rgba(96, 0, 0, 0.16)',
        background: 'linear-gradient(135deg, var(--bg-card, #ffffff) 0%, rgba(96, 0, 0, 0.03) 100%)',
        padding: '16px 18px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: '#600000',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={15} />
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15.5, color: 'var(--text-primary, #171717)' }}>
                {data?.saudacao || 'Briefing do Dia'}
              </strong>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: 'rgba(96, 0, 0, 0.08)',
                  color: '#600000',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {data?.fonte === 'ia' ? 'Privilege IA • Hoje' : 'Resumo do Dia'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => carregar(true)}
            disabled={loading}
            title="Atualizar insights do dia"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 9px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e5e5)',
              background: 'var(--bg-card, #ffffff)',
              color: 'var(--text-muted, #525252)',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 0.9s linear infinite' : undefined }} />
            <span>{loading ? 'Analisando...' : 'Atualizar'}</span>
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Recolher briefing"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '5px 7px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e5e5)',
              background: 'var(--bg-card, #ffffff)',
              color: 'var(--text-muted, #525252)',
              cursor: 'pointer',
            }}
          >
            <ChevronUp size={14} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div style={{ fontSize: 14.5, color: 'var(--text-muted)' }}>Gerando seus insights executivos do dia...</div>
      ) : data && (
        <>
          <p style={{ fontSize: 15, color: 'var(--text-primary, #262626)', margin: '0 0 12px', lineHeight: 1.45 }}>
            {data.resumoExecutivo}
          </p>

          {/* Cards de prioridades */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
              marginBottom: 12,
            }}
          >
            {data.prioridades.map((p, idx) => {
              const st = TOM_STYLE[p.tom] || TOM_STYLE.info;
              return (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: st.bg,
                    border: `1px solid ${st.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: st.color }}>{p.titulo}</div>
                    <div style={{ fontSize: 13.5, color: '#3f3f46', marginTop: 3, lineHeight: 1.35 }}>{p.detalhe}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(p.href)}
                    style={{
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: '#ffffff',
                      color: st.color,
                      border: `1px solid ${st.border}`,
                      borderRadius: 8,
                      padding: '4px 9px',
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {p.acaoLabel} <ArrowRight size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Dica estratégica */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '9px 12px',
              borderRadius: 10,
              background: 'var(--bg-base, #fafafa)',
              border: '1px solid var(--border, #ececec)',
              fontSize: 14,
              color: 'var(--text-secondary, #525252)',
              lineHeight: 1.4,
            }}
          >
            <Lightbulb size={15} style={{ color: '#b45309', flexShrink: 0, marginTop: 1 }} />
            <span><strong>Dica do dia:</strong> {data.dicaEstrategica}</span>
          </div>
        </>
      )}
    </div>
  );
}
