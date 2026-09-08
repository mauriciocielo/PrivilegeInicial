'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AtaAtendimento, Empresa, store, uid, User } from '../../../lib/store';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';

export default function AtasConsultorPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [atas, setAtas] = useState<AtaAtendimento[]>([]);
  const [consultores, setConsultores] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editAta, setEditAta] = useState<AtaAtendimento | null>(null);
  const [form, setForm] = useState<Partial<AtaAtendimento>>({});
  const [viewAta, setViewAta] = useState<AtaAtendimento | null>(null);

  const loadData = useCallback((id: string) => {
    setEmpresaId(id);
    setEmpresa(store.getEmpresas().find(e => e.id === id) || null);
    setAtas(store.getAtas(id));
    setConsultores(store.getUsers().filter(u => u.role === 'consultor' || u.role === 'administrador'));
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    loadData(saved);

    const handleEmpresaChange = (event: Event) => loadData((event as CustomEvent<string>).detail);
    const handleDataChange = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
      loadData(current);
    };
    window.addEventListener('empresaChange', handleEmpresaChange);
    window.addEventListener('cfDataChange', handleDataChange);
    return () => {
      window.removeEventListener('empresaChange', handleEmpresaChange);
      window.removeEventListener('cfDataChange', handleDataChange);
    };
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
      toast.error('Preencha data, título e conteúdo da ata.');
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

  const handleDelete = async (id: string) => {
    if (!(await confirmAsync('Excluir esta ata de atendimento?'))) return;
    store.deleteAta(id);
    setAtas(store.getAtas(empresaId));
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handlePrintAta = (ata: AtaAtendimento) => {
    setViewAta(ata);
    setIsGeneratingPdf(false);
  };

  const generateRealPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const element = document.getElementById('ata-print-area');
      if (!element) return;
      
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Força um estilo de bloco fixo A4 no HTML2Canvas para não distorcer espaços
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        width: 794,
        windowWidth: 794
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
      
      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }
      
      pdf.save(`Ata_${viewAta?.id.slice(-6)}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar o PDF da ata.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const consultorNome = (id: string) =>
    consultores.find(c => c.id === id)?.name || 'Consultor';

  return (
    <>
      {/* CSS de impressão da ata */}
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
          <div className="page-subtitle">
            {empresa ? `Registros de consultoria da ${empresa.nomeFantasia}` : 'Registros de consultoria'}
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNew}>+ Nova Ata</button>
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
                  <th>Consultor</th>
                  <th>Participantes</th>
                  <th style={{ width: 170 }}>Ações</th>
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
                      <td>{consultorNome(ata.consultorId)}</td>
                      <td>{ata.participantes || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setViewAta(ata)}>👁 Ver</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handlePrintAta(ata)}>🖨 PDF</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(ata)}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ata.id)}>🗑️</button>
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

      {/* Modal edição / criação */}
      {showModal && (
        <div className="modal-overlay" onClick={event => event.target === event.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">{editAta ? 'Editar Ata' : 'Nova Ata'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Data *</label>
                <input type="date" className="form-control" value={form.data || ''} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Consultor Responsável</label>
                <select className="form-control" value={form.consultorId || ''} onChange={e => setForm(f => ({ ...f, consultorId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {consultores.map(consultor => (
                    <option key={consultor.id} value={consultor.id}>{consultor.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Título *</label>
              <input className="form-control" value={form.titulo || ''} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Participantes</label>
              <input className="form-control" placeholder="Ex: João Silva, Maria Santos..." value={form.participantes || ''} onChange={e => setForm(f => ({ ...f, participantes: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Conteúdo / Pauta *</label>
              <textarea
                className="form-control"
                style={{ minHeight: 200, resize: 'vertical' }}
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

      {/* Modal visualização / impressão */}
      {viewAta && (
        <div className="modal-overlay no-print" onClick={e => e.target === e.currentTarget && setViewAta(null)}>
          <div
            className="modal modal-lg ata-print-container"
            style={{ maxWidth: 850, background: 'var(--bg-card)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho da modal — oculto na impressão */}
            <div className="modal-header no-print" style={{ marginBottom: 24 }}>
              <h2 className="modal-title">📄 Visualizar Ata</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={generateRealPDF}
                  disabled={isGeneratingPdf}
                >
                  {isGeneratingPdf ? 'Gerando PDF...' : '🖨 Baixar PDF'}
                </button>
                <button className="modal-close" onClick={() => setViewAta(null)}>✕</button>
              </div>
            </div>

            <div id="ata-print-area" style={{ 
              padding: '60px', 
              minHeight: '1123px', /* Força tamanho A4 nativo */
              background: '#fff', 
              color: '#000', 
              width: '794px', 
              margin: '0 auto', 
              boxSizing: 'border-box',
              fontFamily: 'sans-serif',
              letterSpacing: 'normal' 
            }}>
              {/* Cabeçalho da ata */}
              <div style={{
                borderBottom: '3px solid #8c1a22',
                paddingBottom: 24,
                marginBottom: 32,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  <img src={typeof window !== "undefined" ? window.location.origin + "/logo.png" : "/logo.png"} alt="Logo" style={{ height: 45, marginBottom: 8, objectFit: 'contain', objectPosition: 'left' }} crossOrigin="anonymous" />
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#8c1a22', marginBottom: 12 }}>
                    Privilege Contabilidade e Consultoria
                  </div>
                  <h1 style={{ fontSize: 24, fontWeight: 700, color: '#000', margin: 0, lineHeight: 1.2 }}>
                    Ata de Atendimento
                  </h1>
                  <div style={{ fontSize: 14, color: '#4b5563', marginTop: 4, fontWeight: 600, textTransform: 'uppercase' }}>
                    {empresa?.nomeFantasia || empresa?.razaoSocial}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, color: '#4b5563' }}>
                  <div style={{ fontWeight: 700, color: '#000', fontSize: 15, marginBottom: 2 }}>
                    {new Date(viewAta.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                  <div>Nº {viewAta.id.substring(0, 8).toUpperCase()}</div>
                </div>
              </div>

              {/* Título */}
              <div style={{ background: 'var(--bg-base)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Assunto / Pauta</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{viewAta.titulo}</div>
              </div>

              {/* Informações */}
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

              {/* Conteúdo */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Conteúdo / Deliberações</div>
                <div style={{
                  background: '#f9fafb',
                  borderRadius: 10,
                  padding: '18px 20px',
                  border: '1px solid #e5e7eb',
                  fontSize: 14,
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap',
                  color: '#1f2937',
                }}>
                  {viewAta.conteudo}
                </div>
              </div>

              {/* Rodapé da ata */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginTop: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
                  <div>
                    <div style={{ borderTop: '1px solid #9ca3af', paddingTop: 8, marginTop: 48, fontSize: 12, textAlign: 'center', color: '#4b5563' }}>
                      Assinatura do Consultor Responsável
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, marginTop: 4, color: '#111827' }}>
                      {consultorNome(viewAta.consultorId)}
                    </div>
                  </div>
                  <div>
                    <div style={{ borderTop: '1px solid #9ca3af', paddingTop: 8, marginTop: 48, fontSize: 12, textAlign: 'center', color: '#4b5563' }}>
                      Assinatura do Representante da Empresa
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, marginTop: 4, color: '#111827' }}>
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
