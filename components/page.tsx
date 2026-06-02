'use client';
import { useState, useEffect, useCallback } from 'react';
import { store, type AtaAtendimento, type Empresa, type User } from '../lib/store';

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

        const handler = (e: Event) => loadData((e as CustomEvent).detail);
        window.addEventListener('empresaChange', handler);
        return () => window.removeEventListener('empresaChange', handler);
    }, [loadData]);

    if (!empresa) return <div className="page-body">Selecione uma empresa para visualizar as atas.</div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <div className="page-title">Atas de Atendimento</div>
                    <div className="page-subtitle">Histórico de reuniões e consultorias da {empresa.nomeFantasia}</div>
                </div>
            </div>

            <div className="page-body">
                <div className="card">
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 120 }}>Data</th>
                                    <th>Título</th>
                                    <th>Consultor Responsável</th>
                                    <th style={{ width: 100 }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {atas.length === 0 ? (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Nenhuma ata disponível para visualização.</td></tr>
                                ) : [...atas].sort((a, b) => b.data.localeCompare(a.data)).map(ata => (
                                    <tr key={ata.id}>
                                        <td style={{ fontWeight: 500 }}>{new Date(ata.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                        <td style={{ fontWeight: 600 }}>{ata.titulo}</td>
                                        <td>{consultores.find(c => c.id === ata.consultorId)?.name || 'Consultor'}</td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setViewAta(ata)}>👁️ Visualizar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {viewAta && (
                <div className="modal-overlay" onClick={() => setViewAta(null)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Detalhes da Ata: {viewAta.titulo}</h2>
                            <button className="modal-close" onClick={() => setViewAta(null)}>✕</button>
                        </div>
                        <div style={{ marginBottom: 20, display: 'flex', gap: 20 }}>
                            <div><strong>Data:</strong> {new Date(viewAta.data + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                            <div><strong>Consultor:</strong> {consultores.find(c => c.id === viewAta.consultorId)?.name}</div>
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <strong>Participantes:</strong><br />
                            <span style={{ color: 'var(--text-secondary)' }}>{viewAta.participantes || 'Não informado'}</span>
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