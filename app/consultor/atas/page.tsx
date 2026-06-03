'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AtaAtendimento, Empresa, store, uid, User } from '../../../lib/store';

export default function AtasConsultorPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [atas, setAtas] = useState<AtaAtendimento[]>([]);
  const [consultores, setConsultores] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editAta, setEditAta] = useState<AtaAtendimento | null>(null);
  const [form, setForm] = useState<Partial<AtaAtendimento>>({});

  const loadData = useCallback((id: string) => {
    setEmpresaId(id);
    setEmpresa(store.getEmpresas().find(e => e.id === id) || null);
    setAtas(store.getAtas(id));
    setConsultores(store.getUsers().filter(u => u.role === 'consultor' || u.role === 'administrador'));
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || 'e1';
    loadData(saved);

    const handleEmpresaChange = (event: Event) => loadData((event as CustomEvent<string>).detail);
    window.addEventListener('empresaChange', handleEmpresaChange);
    return () => window.removeEventListener('empresaChange', handleEmpresaChange);
  }, [loadData]);

  const sortedAtas = useMemo(() => [...atas].sort((a, b) => b.data.localeCompare(a.data)), [atas]);

  const openNew = () => {
    const user = store.getCurrentUser();
    setEditAta(null);
    setForm({
      empresaId,
      consultorId: user?.id || consultores[0]?.id || '',
      data: new Date().toISOString().split('T')[0],
      titulo: '',
      participantes: '',
      conteudo: '',
    });
    setShowModal(true);
  };

  const openEdit = (ata: AtaAtendimento) => {
    setEditAta(ata);
    setForm({ ...ata });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.titulo || !form.data || !form.conteudo) {
      alert('Preencha data, titulo e conteudo da ata.');
      return;
    }

    store.saveAta({
      id: editAta?.id || uid(),
      empresaId,
      consultorId: form.consultorId || store.getCurrentUser()?.id || consultores[0]?.id || '',
      data: form.data,
      titulo: form.titulo,
      participantes: form.participantes || '',
      conteudo: form.conteudo,
      createdAt: editAta?.createdAt || new Date().toISOString(),
    });

    setAtas(store.getAtas(empresaId));
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta ata de atendimento?')) return;
    store.deleteAta(id);
    setAtas(store.getAtas(empresaId));
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Atas de Atendimento</div>
          <div className="page-subtitle">
            {empresa ? `Registros de consultoria da ${empresa.nomeFantasia}` : 'Registros de consultoria'}
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNew}>Nova Ata</button>
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
                  <th>Consultor</th>
                  <th>Participantes</th>
                  <th style={{ width: 130 }}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {sortedAtas.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      Nenhuma ata cadastrada para esta empresa.
                    </td>
                  </tr>
                ) : (
                  sortedAtas.map(ata => (
                    <tr key={ata.id}>
                      <td style={{ fontWeight: 500 }}>{new Date(ata.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontWeight: 600 }}>{ata.titulo}</td>
                      <td>{consultores.find(c => c.id === ata.consultorId)?.name || 'Consultor'}</td>
                      <td>{ata.participantes || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(ata)}>Editar</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ata.id)}>Excluir</button>
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

      {showModal && (
        <div className="modal-overlay" onClick={event => event.target === event.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">{editAta ? 'Editar Ata' : 'Nova Ata'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>x</button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Data *</label>
                <input type="date" className="form-control" value={form.data || ''} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Consultor</label>
                <select className="form-control" value={form.consultorId || ''} onChange={e => setForm(f => ({ ...f, consultorId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {consultores.map(consultor => (
                    <option key={consultor.id} value={consultor.id}>{consultor.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Titulo *</label>
              <input className="form-control" value={form.titulo || ''} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Participantes</label>
              <input className="form-control" value={form.participantes || ''} onChange={e => setForm(f => ({ ...f, participantes: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Conteudo *</label>
              <textarea
                className="form-control"
                style={{ minHeight: 180, resize: 'vertical' }}
                value={form.conteudo || ''}
                onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))}
              />
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>Salvar Ata</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
