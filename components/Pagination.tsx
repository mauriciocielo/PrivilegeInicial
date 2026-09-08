'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 200],
}: PaginationProps) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  // Janela de números de página ao redor da atual, pra não listar centenas de botões.
  const pageNumbers: number[] = [];
  const windowSize = 2;
  for (let p = Math.max(1, page - windowSize); p <= Math.min(totalPages, page + windowSize); p++) {
    pageNumbers.push(p);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '12px 4px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Mostrando <strong>{start}</strong>–<strong>{end}</strong> de <strong>{totalItems}</strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {onPageSizeChange && (
          <select
            className="form-control"
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            style={{ fontSize: 12, padding: '4px 8px', width: 'auto', marginRight: 8 }}
          >
            {pageSizeOptions.map(n => (
              <option key={n} value={n}>{n} por página</option>
            ))}
          </select>
        )}

        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPageChange(1)} title="Primeira página">«</button>
        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} title="Página anterior">‹</button>

        {pageNumbers[0] > 1 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>…</span>}
        {pageNumbers.map(p => (
          <button
            key={p}
            className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onPageChange(p)}
            style={{ minWidth: 32 }}
          >
            {p}
          </button>
        ))}
        {pageNumbers[pageNumbers.length - 1] < totalPages && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>…</span>}

        <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} title="Próxima página">›</button>
        <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} title="Última página">»</button>
      </div>
    </div>
  );
}
