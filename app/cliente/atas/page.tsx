'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtaAtendimento, Empresa, store, User } from '../../../lib/store';

export default function AtasClientePage() {
  const [atas, setAtas] = useState<AtaAtendimento[]>([]);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [consultores, setConsultores] = useState<User[]>([]);
  const [viewAta, setViewAta] = useState<AtaAtendimento | null>(null);

  const consultorNome = (id: string) =>
    consultores.find(c => c.id === id)?.name || 'Consultor';

  const handlePrint = (ata: AtaAtendimento) => {
    setViewAta(ata);
    setTimeout(() => window.print(), 300);
  };

  const loadData = useCallback((empId: string) => {
    const user = store.getCurrentUser();
    if (!user || !user.empresaIds.includes(empId)) return;

    const emp = store.getEmpresas().find(e => e.id === empId);
    setEmpresa(emp || null);
    setAtas(store.getAtas(empId));
    setConsultores(store.getUsers().filter(u => u.role === 'consultor' || u.role === 'administrador'));
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
    return <div className="page-body">Selecione uma empresa válida para visualizar as atas.</div>;
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .ata-print-container,
          .ata-print-container * { visibility: visible !important; }
          .ata-print-container {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 40px !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #000 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

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
                      Nenhuma ata disponível para visualização.
                    </td>
                  </tr>
                ) : (
                  [...atas].sort((a, b) => b.data.localeCompare(a.data)).map(ata => (
                    <tr key={ata.id}>
                      <td style={{ fontWeight: 500 }}>{new Date(ata.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontWeight: 600 }}>{ata.titulo}</td>
                      <td>{consultorNome(ata.consultorId)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setViewAta(ata)}>👁 Ver</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handlePrint(ata)}>🖨 PDF</button>
                        </div>
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
        <div className="modal-overlay no-print" onClick={() => setViewAta(null)}>
          <div
            className="modal modal-lg ata-print-container"
            style={{ maxWidth: 760, background: 'var(--bg-card)' }}
            onClick={event => event.stopPropagation()}
          >
            <div className="modal-header no-print" style={{ marginBottom: 24 }}>
              <h2 className="modal-title">📄 Ata de Atendimento</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={() => window.print()}>🖨 Imprimir / Salvar PDF</button>
                <button className="modal-close" onClick={() => setViewAta(null)}>✕</button>
              </div>
            </div>

            <div style={{ padding: '0 4px' }}>
              <div style={{
                borderBottom: '3px solid var(--accent)',
                paddingBottom: 20,
                marginBottom: 24,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 6 }}>
                    Privilege Contabilidade e Consultoria
                  </div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
                    Ata de Atendimento
                  </h1>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {empresa?.nomeFantasia || empresa?.razaoSocial}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, marginBottom: 2 }}>
                    {new Date(viewAta.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                  <div>Nº {viewAta.id.slice(-8).toUpperCase()}</div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-base)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Assunto / Pauta</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{viewAta.titulo}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ background: 'var(--bg-base)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Consultor Responsável</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{consultorNome(viewAta.consultorId)}</div>
                </div>
                <div style={{ background: 'var(--bg-base)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Participantes</div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{viewAta.participantes || '—'}</div>
                </div>
              </div>

              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Conteúdo / Deliberações</div>
                <div style={{
                  background: 'var(--bg-base)', borderRadius: 10, padding: '18px 20px', border: '1px solid var(--border)',
                  fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--text-primary)',
                }}>
                  {viewAta.conteudo}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginTop: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
                  <div>
                    <div style={{ borderTop: '1px solid var(--text-muted)', paddingTop: 8, marginTop: 48, fontSize: 12, textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Assinatura do Consultor Responsável
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, marginTop: 4, color: 'var(--text-primary)' }}>
                      {consultorNome(viewAta.consultorId)}
                    </div>
                  </div>
                  <div>
                    <div style={{ borderTop: '1px solid var(--text-muted)', paddingTop: 8, marginTop: 48, fontSize: 12, textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Assinatura do Representante da Empresa
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, marginTop: 4, color: 'var(--text-primary)' }}>
                      {empresa?.nomeFantasia}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--text-muted)' }}>
                  Documento gerado em {new Date().toLocaleDateString('pt-BR')} — Privilege Contabilidade e Consultoria
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
