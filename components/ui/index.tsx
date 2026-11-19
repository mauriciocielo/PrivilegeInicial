'use client';

import type { CSSProperties, ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  style,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="ui-page-header" style={style}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="ui-page-title">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="ui-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="ui-page-actions">{actions}</div>}
    </div>
  );
}

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONE_MAP: Record<BadgeTone, { bg: string; color: string; border: string }> = {
  neutral: { bg: '#f4f4f5', color: '#3f3f46', border: '#e4e4e7' },
  brand: { bg: 'rgba(96, 0, 0, 0.08)', color: '#600000', border: 'rgba(96, 0, 0, 0.2)' },
  success: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  warning: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  danger: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  info: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
};

export function StatusBadge({
  children,
  tone = 'neutral',
  dot = false,
  style,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  style?: CSSProperties;
}) {
  const t = TONE_MAP[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        borderRadius: 99,
        fontSize: 11.5,
        fontWeight: 600,
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.color }} />}
      {children}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: BadgeTone;
  onClick?: () => void;
}) {
  const accent = TONE_MAP[tone].color;
  return (
    <div
      className="ui-kpi-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="ui-kpi-label">{label}</span>
        {icon && (
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: TONE_MAP[tone].bg,
              color: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="ui-kpi-value" style={{ color: tone === 'neutral' ? undefined : accent }}>
        {value}
      </div>
      {hint && <div className="ui-kpi-hint">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty-state">
      {icon && <div className="ui-empty-icon">{icon}</div>}
      <div className="ui-empty-title">{title}</div>
      {description && <div className="ui-empty-desc">{description}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className="ui-skeleton"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: 12,
            alignItems: 'center',
          }}
        >
          {Array.from({ length: cols }).map((__, c) => (
            <SkeletonBlock key={c} height={14} width={c === 0 ? '70%' : '90%'} />
          ))}
        </div>
      ))}
    </div>
  );
}
