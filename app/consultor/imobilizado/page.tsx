'use client';
import { useState, useEffect, useMemo } from 'react';
import { store, type Imobilizado, uid } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';

export default function ImobilizadoPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [imobilizados, setImobilizados] = useState<Imobilizado[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Imobilizado | null>(null);
  const [form, setForm] = useState<Partial<Imobilizado>>({});

  const load = (eId: string) => {
    if (!eId) return;
    setEmpresaId(eId);
    setImobilizados(store.getImobilizados(eId));
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || '';
    if (saved) load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    const dataChangeHandler = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || '';
      if (current) load(current);
    };
    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataChangeHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataChangeHandler);
    };
  }, []);

  const openNew = () => {
    setEditItem(null);
    setForm({ empresaId, dataAquisicao: new Date().toISOString().split('T')[0], valorAquisicao: 0, taxaDepreciacao: 10 });
    setShowModal(true);
  };

  const openEdit = (i: Imobilizado) => {
    setEditItem(i);
    setForm({ ...i });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.nome || !form.dataAquisicao || form.valorAquisicao === undefined || form.taxaDepreciacao === undefined) { 
      toast.error('Preencha os campos obrigatórios.'); 
      return; 
    }
    
    const imob: Imobilizado = {
      id: editItem?.id || uid(),
      empresaId,
      nome: form.nome!,
      dataAquisicao: form.dataAquisicao!,
      valorAquisicao: Number(form.valorAquisicao) || 0,
      taxaDepreciacao: Number(form.taxaDepreciacao) || 0,
      createdAt: editItem?.createdAt || new Date().toISOString(),
    };
    
    store.saveImobilizado(imob);
    setImobilizados(store.getImobilizados(empresaId));
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAsync('Excluir este item do imobilizado?'))) return;
    store.deleteImobilizado(id);
    setImobilizados(store.getImobilizados(empresaId));
  };

  const calculos = useMemo(() => {
    let totalAquisicao = 0;
    let totalDepreciado = 0;
    let totalAtual = 0;

    const data = imobilizados.map(i => {
      const d1 = new Date(i.dataAquisicao + 'T12:00:00');
      const d2 = new Date();
      let months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      if (months < 0) months = 0;

      const depMensal = (i.valorAquisicao * (i.taxaDepreciacao / 100)) / 12;
      let depAcumulada = depMensal * months;
      if (depAcumulada > i.valorAquisicao) depAcumulada = i.valorAquisicao;

      const valorAtual = i.valorAquisicao - depAcumulada;

      totalAquisicao += i.valorAquisicao;
      totalDepreciado += depAcumulada;
      totalAtual += valorAtual;

      return {
        ...i,
        mesesUso: months,
        depAcumulada,
        valorAtual
      };
    });

    return { list: data, totalAquisicao, totalDepreciado, totalAtual };
  }, [imobilizados]);

  if (!empresaId) return (
    <div className="page-body">
      <div className="empty-state">
        <div className="empty-state-icon">🏢</div>
        <h3>Selecione uma empresa</h3>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">🏗️ Ativo Imobilizado</div>
          <div className="page-subtitle">Controle de bens, patrimônios e depreciação acumulada</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNew}>＋ Novo Bem</button>
        </div>
      </div>

      <div className="page-body">
        
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card blue">
            <div className="stat-icon blue">📦</div>
            <div className="stat-label">Valor Total de Aquisição</div>
            <div className="stat-value">{fmt.currency(calculos.totalAquisicao)}</div>
          </div>
          <div className="stat-card orange">
            <div className="stat-icon orange">📉</div>
            <div className="stat-label">Depreciação Acumulada</div>
            <div className="stat-value">{fmt.currency(calculos.totalDepreciado)}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-icon green">💰</div>
            <div className="stat-label">Valor Residual (Atual)</div>
            <div className="stat-value">{fmt.currency(calculos.totalAtual)}</div>
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bem / Descrição</th>
                  <th>Data de Aquisição</th>
                  <th style={{ textAlign: 'right' }}>Taxa Anual</th>
                  <th style={{ textAlign: 'right' }}>Vida Útil Passada</th>
                  <th style={{ textAlign: 'right' }}>Valor Original</th>
                  <th style={{ textAlign: 'right' }}>Depreciação Acum.</th>
                  <th style={{ textAlign: 'right' }}>Valor Atual</th>
                  <th style={{ width: 100 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {calculos.list.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🏗️</div>
                      <h3>Nenhum bem imobilizado cadastrado</h3>
                      <p>Clique em "+ Novo Bem" para começar o controle.</p>
                    </div>
                  </td></tr>
                ) : calculos.list.map(i => (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 600 }}>{i.nome}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{fmt.date(i.dataAquisicao)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{i.taxaDepreciacao}% a.a.</td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>{i.mesesUso} meses</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--blue)' }}>{fmt.currency(i.valorAquisicao)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--orange)' }}>{fmt.currency(i.depAcumulada)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{fmt.currency(i.valorAtual)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(i)}>✏️</button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(i.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editItem ? 'Editar Bem' : 'Novo Bem Imobilizado'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Descrição do Bem *</label>
              <input className="form-control" placeholder="Veículo, Máquina, Computador, Terreno..." value={form.nome || ''} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Data de Aquisição *</label>
                <input type="date" className="form-control" value={form.dataAquisicao || ''} onChange={e => setForm(f => ({ ...f, dataAquisicao: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor Original (R$) *</label>
                <input type="number" step="0.01" className="form-control" value={form.valorAquisicao ?? ''} onChange={e => setForm(f => ({ ...f, valorAquisicao: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Taxa Depreciação (% a.a.) *</label>
                <input type="number" step="0.01" className="form-control" value={form.taxaDepreciacao ?? ''} onChange={e => setForm(f => ({ ...f, taxaDepreciacao: Number(e.target.value) }))} />
              </div>
            </div>

            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              Lembretes de Taxas Anuais: Veículos (20%), Computadores (20%), Máquinas (10%), Móveis (10%), Imóveis (4%), Terrenos (0%).
            </div>

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>✓ Salvar Bem</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
