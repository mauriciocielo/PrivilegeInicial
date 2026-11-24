'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationBarProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange?: (nextSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export default function PaginationBar({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  itemLabel = 'registros',
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(totalItems, safePage * pageSize);

  if (totalItems <= pageSizeOptions[0] && totalPages <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '12px 16px',
        borderTop: '1px solid var(--border, #e5e5e5)',
        background: 'var(--bg-base, #fafafa)',
        fontSize: 14,
        color: 'var(--text-muted, #525252)',
      }}
    >
      <div>
        Mostrando <strong style={{ color: 'var(--text-primary, #171717)' }}>{start}–{end}</strong> de{' '}
        <strong style={{ color: 'var(--text-primary, #171717)' }}>{totalItems}</strong> {itemLabel}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {onPageSizeChange && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border, #d4d4d8)',
                background: 'var(--bg-card, #ffffff)',
                color: 'var(--text-primary, #171717)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {pageSizeOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
        )}

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '5px 10px',
              borderRadius: 8,
              border: '1px solid var(--border, #d4d4d8)',
              background: 'var(--bg-card, #ffffff)',
              color: safePage <= 1 ? 'var(--text-muted, #a3a3a3)' : 'var(--text-primary, #171717)',
              cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: safePage <= 1 ? 0.55 : 1,
            }}
          >
            <ChevronLeft size={14} /> Anterior
          </button>

          <span style={{ fontSize: 14, fontWeight: 600, padding: '0 4px', color: 'var(--text-primary, #171717)' }}>
            {safePage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '5px 10px',
              borderRadius: 8,
              border: '1px solid var(--border, #d4d4d8)',
              background: 'var(--bg-card, #ffffff)',
              color: safePage >= totalPages ? 'var(--text-muted, #a3a3a3)' : 'var(--text-primary, #171717)',
              cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: safePage >= totalPages ? 0.55 : 1,
            }}
          >
            Próxima <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
