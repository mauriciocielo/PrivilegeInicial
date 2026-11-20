'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { store, Empresa, StoreAuditLog } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import { PageHeader, KpiCard, StatusBadge, EmptyState, type BadgeTone } from '../../../components/ui';
import PaginationBar from '../../../components/ui/PaginationBar';
import { ShieldCheck, PlusCircle, Pencil, Trash2, Search, Download, Activity } from 'lucide-react';

const ACTION_TONE: Record<string, BadgeTone> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
  BLOCK: 'warning',
  BATCH: 'brand',
};

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
  BLOCK: 'Trava / Fechamento',
  BATCH: 'Lote / Importação',
};

export default function AuditoriaPage() {
  const [empresaId, setEmpresaId] = useState(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('cf_empresa_sel') : null;
    return store.getSafeEmpresaId(saved);
  });
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [logs, setLogs] = useState<StoreAuditLog[]>([]);
  const [filterAction, setFilterAction] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback((eId: string) => {
    const safeId = store.getSafeEmpresaId(eId);
    setEmpresaId(safeId);
    setEmpresa(store.getEmpresas().find(e => e.id === safeId) || null);
    if (safeId) {
      setLogs(store.getAuditLogs(safeId));
    } else {
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel');
    load(store.getSafeEmpresaId(saved));

    const handler = (e: Event) => load(store.getSafeEmpresaId((e as CustomEvent).detail));
    const dataHandler = () => load(store.getSafeEmpresaId(sessionStorage.getItem('cf_empresa_sel')));
    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataHandler);
    };
  }, [load]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter(l => {
      if (filterAction && l.action !== filterAction) return false;
      if (dateFrom && l.timestamp.slice(0, 10) < dateFrom) return false;
      if (q) {
        const hay = `${l.userName || ''} ${l.action || ''} ${l.details || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, filterAction, search, dateFrom]);

  useEffect(() => {
    setPage(1);
  }, [empresaId, filterAction, search, dateFrom]);

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  const stats = useMemo(() => {
    let creates = 0;
    let updates = 0;
    let deletes = 0;
    for (const l of filteredLogs) {
      if (l.action === 'CREATE') creates++;
      else if (l.action === 'UPDATE') updates++;
      else if (l.action === 'DELETE') deletes++;
    }
    return { total: filteredLogs.length, creates, updates, deletes };
  }, [filteredLogs]);

  const exportarCsv = () => {
    const header = ['Data', 'Hora', 'Usuario', 'Acao', 'Detalhes'];
    const linhas = filteredLogs.map(l => {
      const dt = new Date(l.timestamp);
      const data = l.timestamp.slice(0, 10);
      const hora = Number.isNaN(dt.getTime()) ? '' : dt.toTimeString().slice(0, 8);
      const esc = (s: string) => `"${String(s || '').replace(/"/g, '""')}"`;
      return [esc(data), esc(hora), esc(l.userName), esc(l.action), esc(l.details)].join(';');
    });
    const csv = '\uFEFF' + [header.join(';'), ...linhas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-${(empresa?.nomeFantasia || 'empresa').replace(/\W+/g, '_').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-body">
      <PageHeader
        title="Trilha de Auditoria"
        subtitle={`${empresa?.nomeFantasia || empresa?.razaoSocial || 'Empresa ativa'} — Registro completo de criações, alterações, exclusões e travas.`}
        badge={<StatusBadge tone="brand" dot>{stats.total} eventos</StatusBadge>}
        actions={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={exportarCsv}
            disabled={filteredLogs.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} /> Exportar CSV
          </button>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <KpiCard label="Total Filtrado" value={stats.total} icon={<Activity size={16} />} tone="neutral" />
        <KpiCard label="Criações" value={stats.creates} icon={<PlusCircle size={16} />} tone="success" />
        <KpiCard label="Alterações" value={stats.updates} icon={<Pencil size={16} />} tone="info" />
        <KpiCard label="Exclusões" value={stats.deletes} icon={<Trash2 size={16} />} tone="danger" />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-base)',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por usuário ou detalhe..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>

          <select
            className="form-control"
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            style={{ width: 'auto', minWidth: 190 }}
          >
            <option value="">Todas as ações</option>
            <option value="CREATE">Criações (CREATE)</option>
            <option value="UPDATE">Alterações (UPDATE)</option>
            <option value="DELETE">Exclusões (DELETE)</option>
            <option value="BLOCK">Fechamentos / Travas (BLOCK)</option>
            <option value="BATCH">Lotes / Importações (BATCH)</option>
          </select>

          <input
            type="date"
            className="form-control"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            title="A partir da data"
            style={{ width: 'auto' }}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 165 }}>Data e Hora</th>
                <th style={{ width: 170 }}>Usuário</th>
                <th style={{ width: 145 }}>Ação</th>
                <th>Detalhes da Operação</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map(log => {
                const dataDate = new Date(log.timestamp);
                const hora = Number.isNaN(dataDate.getTime()) ? '' : dataDate.toTimeString().substring(0, 5);
                const tone = ACTION_TONE[log.action] || 'neutral';
                const label = ACTION_LABEL[log.action] || log.action;
                return (
                  <tr key={log.id}>
                    <td style={{ fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <strong>{fmt.date(log.timestamp.split('T')[0])}</strong>
                      {hora ? ` • ${hora}` : ''}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{log.userName || 'Sistema'}</td>
                    <td>
                      <StatusBadge tone={tone}>{label}</StatusBadge>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-primary)' }}>{log.details}</td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 20 }}>
                    <EmptyState
                      icon={<ShieldCheck size={22} />}
                      title="Nenhum registro de auditoria encontrado"
                      description="As ações executadas pelos usuários nesta empresa aparecem aqui automaticamente. Tente ajustar os filtros."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={filteredLogs.length}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(1); }}
          itemLabel="eventos"
        />
      </div>
    </div>
  );
}
