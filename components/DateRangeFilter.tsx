'use client';
import { useEffect, useRef, useState } from 'react';
import { CalendarRange, ChevronDown, X } from 'lucide-react';

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtShort(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as first day
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  return r;
}

const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: 'Hoje', range: () => { const t = new Date(); return [toISO(t), toISO(t)]; } },
  { label: 'Esta Semana', range: () => { const t = new Date(); return [toISO(startOfWeek(t)), toISO(t)]; } },
  { label: 'Este Mês', range: () => { const t = new Date(); return [toISO(new Date(t.getFullYear(), t.getMonth(), 1)), toISO(new Date(t.getFullYear(), t.getMonth() + 1, 0))]; } },
  { label: 'Mês Passado', range: () => { const t = new Date(); return [toISO(new Date(t.getFullYear(), t.getMonth() - 1, 1)), toISO(new Date(t.getFullYear(), t.getMonth(), 0))]; } },
  { label: 'Últimos 30 dias', range: () => { const t = new Date(); const s = new Date(); s.setDate(t.getDate() - 29); return [toISO(s), toISO(t)]; } },
  { label: 'Este Ano', range: () => { const t = new Date(); return [toISO(new Date(t.getFullYear(), 0, 1)), toISO(t)]; } },
];

export default function DateRangeFilter({
  ini,
  fim,
  onChange,
  placeholder = 'Período',
}: {
  ini: string;
  fim: string;
  onChange: (ini: string, fim: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hasValue = !!(ini || fim);
  const label = ini && fim
    ? `${fmtShort(ini)} → ${fmtShort(fim)}`
    : ini
      ? `A partir de ${fmtShort(ini)}`
      : fim
        ? `Até ${fmtShort(fim)}`
        : placeholder;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="form-control"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          color: hasValue ? 'var(--text-primary)' : 'var(--text-muted)',
          fontWeight: hasValue ? 600 : 400,
          minWidth: 190,
        }}
        title="Filtrar por período"
      >
        <CalendarRange size={14} style={{ flexShrink: 0, color: hasValue ? 'var(--accent)' : 'var(--text-muted)' }} />
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {hasValue ? (
          <X
            size={13}
            style={{ flexShrink: 0, color: 'var(--text-muted)' }}
            onClick={(e) => { e.stopPropagation(); onChange('', ''); }}
          />
        ) : (
          <ChevronDown size={13} style={{ flexShrink: 0, color: 'var(--text-muted)', transition: 'transform var(--dur-base) var(--ease-out)', transform: open ? 'rotate(180deg)' : 'none' }} />
        )}
      </button>

      {open && (
        <div
          className="dropdown-anim-down"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 500,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            padding: '14px',
            width: 300,
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 }}>De</label>
              <input
                type="date"
                className="form-control"
                value={ini}
                max={fim || undefined}
                onChange={e => onChange(e.target.value, fim)}
                style={{ fontSize: 12.5, padding: '7px 8px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 }}>Até</label>
              <input
                type="date"
                className="form-control"
                value={fim}
                min={ini || undefined}
                onChange={e => onChange(ini, e.target.value)}
                style={{ fontSize: 12.5, padding: '7px 8px' }}
              />
            </div>
          </div>

          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Atalhos</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '4px 9px' }}
                onClick={() => { const [s, e] = p.range(); onChange(s, e); }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border-light)' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { onChange('', ''); }}
              disabled={!hasValue}
            >
              Limpar
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setOpen(false)}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
