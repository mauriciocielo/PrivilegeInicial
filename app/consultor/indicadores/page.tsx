'use client';
import { useState, useEffect, useCallback } from 'react';
import { store, Empresa, IndicadorMensal } from '../../../lib/store';
import { uid } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';

export default function IndicadoresPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [indicadores, setIndicadores] = useState<IndicadorMensal[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<IndicadorMensal | null>(null);
  const [form, setForm] = useState<Partial<IndicadorMensal>>({});

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setEmpresa(store.getEmpresas().find(e => e.id === eId) || null);
    setIndicadores(store.getIndicadores(eId).sort((a, b) => b.mes.localeCompare(a.mes)));
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    const dataChangeHandler = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
      load(current);
    };
    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataChangeHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataChangeHandler);
    };
  }, [load]);

  const openNew = () => {
    setEdit(null);
    const d = new Date();
    setForm({ mes: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, faturamento: 0, compras: 0, inadimplencia: 0 });
    setShowModal(true);
  };

  const openEdit = (i: IndicadorMensal) => {
    setEdit(i);
    setForm({ ...i });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.mes) { toast.error('Informe o mês.'); return; }
    
    // Check if month already exists and we are not editing it
    if (!edit && indicadores.some(i => i.mes === form.mes)) {
      toast.success('Já existe um registro de indicadores para este mês.');
      return;
    }

    const ind: IndicadorMensal = {
      id: edit?.id || uid(),
      empresaId,
      mes: form.mes!,
      faturamento: Number(form.faturamento) || 0,
      compras: Number(form.compras) || 0,
      inadimplencia: Number(form.inadimplencia) || 0,
    };
    store.saveIndicador(ind);
    load(empresaId);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAsync('Deseja excluir este registro?'))) return;
    store.deleteIndicador(id);
    load(empresaId);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Indicadores Mensais (Manuais)</div>
          <div className="page-subtitle">{empresa?.razaoSocial} — Faturamento, Compras e Inadimplência</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNew}>＋ Informar Mês</button>
        </div>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mês de Referência</th>
                  <th style={{ textAlign: 'right' }}>Faturamento Realizado</th>
                  <th style={{ textAlign: 'right' }}>Compras Realizadas</th>
                  <th style={{ textAlign: 'right' }}>Inadimplência (%)</th>
                  <th style={{ textAlign: 'right', width: 100 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {indicadores.length === 0 ? (
                  <tr><td colSpan={5}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📊</div>
                      <h3>Nenhum indicador registrado</h3>
                      <p>Adicione os indicadores mensais para melhor acompanhamento.</p>
                    </div>
                  </td></tr>
                ) : indicadores.map(i => {
                  const [y, m] = i.mes.split('-');
                  const mesLabel = new Date(Number(y), Number(m)-1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                  return (
                    <tr key={i.id}>
                      <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{mesLabel}</td>
                      <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{fmt.currency(i.faturamento)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--red)', fontWeight: 600 }}>{fmt.currency(i.compras)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--orange)', fontWeight: 600 }}>{i.inadimplencia}%</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(i)} title="Editar">✏️</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(i.id)} title="Excluir">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{edit ? 'Editar Indicadores' : 'Novos Indicadores'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Mês (YYYY-MM) *</label>
              <input type="month" className="form-control" value={form.mes||''} onChange={e=>setForm(f=>({...f,mes:e.target.value}))} disabled={!!edit} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Faturamento Total (R$)</label>
                <input type="number" step="0.01" className="form-control" value={form.faturamento||0} onChange={e=>setForm(f=>({...f,faturamento:Number(e.target.value)}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Compras Realizadas (R$)</label>
                <input type="number" step="0.01" className="form-control" value={form.compras||0} onChange={e=>setForm(f=>({...f,compras:Number(e.target.value)}))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Inadimplência do Mês (%)</label>
              <input type="number" step="0.1" className="form-control" value={form.inadimplencia||0} onChange={e=>setForm(f=>({...f,inadimplencia:Number(e.target.value)}))} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Ex: Se você faturou R$ 100 mil e teve R$ 5 mil inadimplentes, informe 5.0
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>✓ Salvar Indicadores</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
