'use client';
import { useState, useEffect, useCallback } from 'react';
import { store, Empresa, StoreAuditLog } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

export default function AuditoriaPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [logs, setLogs] = useState<StoreAuditLog[]>([]);
  const [filterAction, setFilterAction] = useState('');

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setEmpresa(store.getEmpresas().find(e => e.id === eId) || null);
    
    if (eId) {
      setLogs(store.getAuditLogs(eId));
    } else {
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    load(saved);

    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  const filteredLogs = logs.filter(l => filterAction ? l.action === filterAction : true);

  return (
    <>
      <div className="page-header glass-header" style={{
        background: 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.3)',
      }}>
        <div>
          <div className="page-title">Trilha de Auditoria de Elite (Audit Trail)</div>
          <div className="page-subtitle">{empresa?.nomeFantasia || empresa?.razaoSocial} — Controle de segurança, edições de balanço e ações executadas.</div>
        </div>
        <div className="header-actions">
          <select className="form-control" value={filterAction} onChange={e => setFilterAction(e.target.value)}>
            <option value="">Todas Ações</option>
            <option value="CREATE">Registros Criados (CREATE)</option>
            <option value="UPDATE">Edições e Alterações (UPDATE)</option>
            <option value="DELETE">Exclusões (DELETE)</option>
            <option value="BLOCK">Fechamentos e Travas (BLOCK)</option>
            <option value="BATCH">Importações em Massa (BATCH)</option>
          </select>
        </div>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Data e Hora</th>
                  <th style={{ width: 140 }}>Usuário</th>
                  <th style={{ width: 100 }}>Ação</th>
                  <th style={{ width: 120 }}>Entidade</th>
                  <th>Visualização de Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => {
                  const dataDate = new Date(log.timestamp);
                  const hora = dataDate.toTimeString().substring(0, 5);
                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        <strong>{fmt.date(log.timestamp.split('T')[0])}</strong> • {hora}
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.userName}</td>
                      <td>
                        <span className={`badge badge-amber`}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>-</td>
                      <td style={{ fontSize: 13, color: 'var(--text-main)' }}>{log.details}</td>
                    </tr>
                  )
                })}
                
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">
                        <div className="empty-state-icon">🛡️</div>
                        <h3>Nenhum registro de auditoria encontrado</h3>
                        <p>As ações dos usuários nesta empresa aparecerão aqui.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
