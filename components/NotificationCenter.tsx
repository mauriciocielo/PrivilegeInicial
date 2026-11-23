'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell, AlertTriangle, AlertCircle, Activity, RefreshCw, CheckCircle2,
  MessageSquare, Mail, FileWarning, ShieldAlert, Wallet, ChevronRight,
} from 'lucide-react';
import type { NotificacaoSistema } from '../app/api/system/notificacoes/route';

interface NotificationCenterProps {
  empresaId: string;
  role: string;
  pendenciasReconciliacao: number;
  onNavigate: (href: string) => void;
}

export default function NotificationCenter({
  empresaId,
  role,
  pendenciasReconciliacao,
  onNavigate,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [itensApi, setItensApi] = useState<NotificacaoSistema[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : '';
      const res = await fetch(`/api/system/notificacoes${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.itens)) setItensApi(data.itens);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregar();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      carregar();
    }, 60_000);
    return () => clearInterval(timer);
  }, [carregar]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const itens: NotificacaoSistema[] = [
    ...itensApi,
    ...(pendenciasReconciliacao > 0
      ? [{
          id: 'conciliacao-pendente',
          tipo: 'alerta' as const,
          categoria: 'financeiro' as const,
          titulo: `${pendenciasReconciliacao} conciliação(ões) pendente(s)`,
          descricao: 'Movimentações bancárias aguardando classificação.',
          href: role === 'cliente' ? '/cliente/extrato' : '/consultor/importar-ofx',
          count: pendenciasReconciliacao,
        }]
      : []),
  ];

  const criticos = itens.filter(i => i.tipo === 'erro').length;
  const alertas = itens.filter(i => i.tipo === 'alerta').length;
  const ativos = itens.filter(i => i.tipo === 'ativo').length;
  const totalBadge = criticos + alertas;

  const corBadge = criticos > 0 ? '#dc2626' : alertas > 0 ? '#d97706' : ativos > 0 ? '#16a34a' : '#737373';
  const bgBotao = criticos > 0
    ? '#fef2f2'
    : alertas > 0
    ? '#fffbeb'
    : ativos > 0
    ? '#f0fdf4'
    : '#ffffff';
  const borderBotao = criticos > 0
    ? '#fecaca'
    : alertas > 0
    ? '#fde68a'
    : ativos > 0
    ? '#bbf7d0'
    : '#e5e5e5';

  const iconeItem = (item: NotificacaoSistema) => {
    if (item.categoria === 'whatsapp') return <MessageSquare size={14} />;
    if (item.categoria === 'email') return <Mail size={14} />;
    if (item.categoria === 'certificado') return <ShieldAlert size={14} />;
    if (item.categoria === 'fiscal') return <FileWarning size={14} />;
    if (item.categoria === 'financeiro') return <Wallet size={14} />;
    if (item.tipo === 'erro') return <AlertCircle size={14} />;
    if (item.tipo === 'ativo') return <Activity size={14} />;
    return <AlertTriangle size={14} />;
  };

  const estiloTipo = (tipo: NotificacaoSistema['tipo']) => {
    if (tipo === 'erro') return { bg: '#fef2f2', color: '#dc2626' };
    if (tipo === 'alerta') return { bg: '#fffbeb', color: '#d97706' };
    if (tipo === 'ativo') return { bg: '#f0fdf4', color: '#15803d' };
    return { bg: '#eff6ff', color: '#2563eb' };
  };

  return (
    <div ref={popoverRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) carregar();
        }}
        title="Central de Notificações e Status 24h"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: totalBadge > 0 || ativos > 0 ? '5px 10px' : '6px 8px',
          borderRadius: 99,
          background: bgBotao,
          color: corBadge,
          border: `1px solid ${borderBotao}`,
          fontSize: 11.5,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <Bell size={14} />
        {totalBadge > 0 && <span>{totalBadge}</span>}
        {totalBadge === 0 && ativos > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
            <span>24h</span>
          </span>
        )}
      </button>

      {open && (
        <div
          className="dropdown-anim-up"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            width: 360,
            maxWidth: 'calc(100vw - 24px)',
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-primary, #171717)',
            border: '1px solid var(--border, #e5e5e5)',
            borderRadius: 16,
            boxShadow: '0 20px 44px rgba(0, 0, 0, 0.14)',
            zIndex: 1005,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid var(--border, #ececec)',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Central de Alertas &amp; 24h</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #737373)' }}>
                {itens.length === 0 ? 'Tudo operando normalmente' : `${itens.length} aviso${itens.length > 1 ? 's' : ''} ativo${itens.length > 1 ? 's' : ''}`}
              </div>
            </div>
            <button
              type="button"
              onClick={carregar}
              disabled={loading}
              title="Atualizar agora"
              style={{
                background: 'var(--bg-base, #f4f4f5)',
                border: 'none',
                borderRadius: 8,
                padding: 6,
                cursor: 'pointer',
                color: 'var(--text-muted, #525252)',
                display: 'flex',
              }}
            >
              <RefreshCw size={13} style={{ animation: loading ? 'spin 0.9s linear infinite' : undefined }} />
            </button>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto', padding: 8 }}>
            {itens.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted, #737373)' }}>
                <CheckCircle2 size={24} style={{ color: '#16a34a', marginBottom: 6 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #171717)' }}>Nenhuma pendência crítica</div>
                <div style={{ fontSize: 11.5, marginTop: 3 }}>Certificados, notas fiscais e robôs 24h estão em dia.</div>
              </div>
            ) : (
              itens.map(item => {
                const st = estiloTipo(item.tipo);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onNavigate(item.href);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 10px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-base, #f8f8f8)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: st.bg,
                        color: st.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {iconeItem(item)}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>
                        {item.titulo}
                      </span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted, #737373)', marginTop: 2, lineHeight: 1.35 }}>
                        {item.descricao}
                      </span>
                    </span>
                    <ChevronRight size={14} style={{ color: 'var(--text-muted, #a3a3a3)', flexShrink: 0, marginTop: 6 }} />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
