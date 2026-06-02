'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtaAtendimento, Empresa, store, User } from '../../../lib/store';

export default function AtasClientePage() {
  const [atas, setAtas] = useState<AtaAtendimento[]>([]);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [consultores, setConsultores] = useState<User[]>([]);
  const [viewAta, setViewAta] = useState<AtaAtendimento | null>(null);

  const loadData = useCallback((empId: string) => {
    const user = store.getCurrentUser();
    if (!user || !user.empresaIds.includes(empId)) return;

    const emp = store.getEmpresas().find(e => e.id === empId);
    setEmpresa(emp || null);
    setAtas(store.getAtas(empId));
    setConsultores(store.getUsers().filter(u => u.role === 'consultor'));
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel');
    if (saved) loadData(saved);

    const handleEmpresaChange = (event: Event) => loadData((event as CustomEvent<string>).detail);
    const handleDataChange = () => {
      const currentEmp = sessionStorage.getItem('cf_empresa_sel');
      if (currentEmp) loadData(currentEmp);
    };

    window.addEventListener('empresaChange', handleEmpresaChange);
    window.addEventListener('cfDataChange', handleDataChange);

    return () => {
      window.removeEventListener('empresaChange', handleEmpresaChange);
      window.removeEventListener('cfDataChange', handleDataChange);
    };
  }, [loadData]);

  if (!empresa) {
    return <div className="page-body">Selecione uma empresa valida para visualizar as atas.</div>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Atas de Atendimento</div>
          <div className="page-subtitle">Historico de reunioes e consultorias da {empresa.nomeFantasia}</div>
        </div>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Data</th>
                  <th>Titulo</th>
                  <th>Consultor Responsavel</th>
                  <th style={{ width: 120 }}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {atas.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      Nenhuma ata disponivel para visualizacao.
                    </td>
                  </tr>
                ) : (
                  [...atas].sort((a, b) => b.data.localeCompare(a.data)).map(ata => (
                    <tr key={ata.id}>
                      <td style={{ fontWeight: 500 }}>{new Date(ata.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontWeight: 600 }}>{ata.titulo}</td>
                      <td>{consultores.find(c => c.id === ata.consultorId)?.name || 'Consultor'}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => setViewAta(ata)}>Visualizar</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {viewAta && (
        <div className="modal-overlay" onClick={() => setViewAta(null)}>
          <div className="modal modal-lg" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Detalhes da Ata: {viewAta.titulo}</h2>
              <button className="modal-close" onClick={() => setViewAta(null)}>x</button>
            </div>
            <div style={{ marginBottom: 20, display: 'flex', gap: 20 }}>
              <div><strong>Data:</strong> {new Date(viewAta.data + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
              <div><strong>Consultor:</strong> {consultores.find(c => c.id === viewAta.consultorId)?.name || 'Consultor'}</div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <strong>Participantes:</strong><br />
              <span style={{ color: 'var(--text-secondary)' }}>{viewAta.participantes || 'Nao informado'}</span>
            </div>
            <div className="card" style={{ padding: 20, background: 'var(--bg-base)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {viewAta.conteudo}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
