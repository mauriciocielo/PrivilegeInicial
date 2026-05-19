'use client';
import { useState, useEffect, useCallback } from 'react';
import { store, Endividamento } from '../../../lib/store';
import { uid } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import GeminiTips from '../../../components/GeminiTips';

export default function EndividamentoPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [endividamentos, setEndividamentos] = useState<Endividamento[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<Endividamento | null>(null);
  const [form, setForm] = useState<Partial<Endividamento>>({});
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [pagamentoForm, setPagamentoForm] = useState<{ id: string; valorPago: number; valorJuros: number; valorAmortizacao: number }>({ id: '', valorPago: 0, valorJuros: 0, valorAmortizacao: 0 });

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setEndividamentos(store.getEndividamentos(eId));
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || 'e1';
    load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  const openNew = () => {
    setEdit(null);
    setForm({
      empresaId,
      taxa: 0,
      parcela: 0,
      parcelasFaltantes: 0,
      valorQuitacao: 0,
      valorAPagar: 0,
      pagamentoMes: 0
    });
    setShowModal(true);
  };

  const openEdit = (e: Endividamento) => {
    setEdit(e);
    setForm({ ...e });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.banco || !form.contrato) { alert('Preencha pelo menos Banco e Contrato.'); return; }
    
    const e: Endividamento = {
      id: edit?.id || uid(),
      empresaId,
      banco: form.banco!,
      conta: form.conta || '',
      contrato: form.contrato!,
      descricaoContrato: form.descricaoContrato || '',
      taxa: Number(form.taxa) || 0,
      taxaTipo: form.taxaTipo || 'am',
      indexador: form.indexador || '',
      parcela: Number(form.parcela) || 0,
      parcelasFaltantes: Number(form.parcelasFaltantes) || 0,
      valorQuitacao: Number(form.valorQuitacao) || 0,
      valorAPagar: Number(form.valorAPagar) || 0,
      garantia: form.garantia || '',
      pagamentoMes: Number(form.pagamentoMes) || 0,
    };
    
    store.saveEndividamento(e);
    setEndividamentos(store.getEndividamentos(empresaId));
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este endividamento?')) return;
    store.deleteEndividamento(id);
    setEndividamentos(store.getEndividamentos(empresaId));
  };

  const handleSavePagamento = () => {
    if (!pagamentoForm.id) { alert('Selecione um contrato.'); return; }
    const endiv = endividamentos.find(e => e.id === pagamentoForm.id);
    if (!endiv) return;
    store.saveEndividamento({ 
      ...endiv, 
      pagamentoMes: pagamentoForm.valorPago,
      valorAPagar: Math.max(0, endiv.valorAPagar - pagamentoForm.valorAmortizacao),
      valorQuitacao: Math.max(0, endiv.valorQuitacao - pagamentoForm.valorAmortizacao),
      parcelasFaltantes: Math.max(0, endiv.parcelasFaltantes - 1)
    });
    setEndividamentos(store.getEndividamentos(empresaId));
    setShowPagamentoModal(false);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Evolução do Endividamento</div>
          <div className="page-subtitle">Acompanhe empréstimos, financiamentos e obrigações</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => { setPagamentoForm({ id: '', valorPago: 0, valorJuros: 0, valorAmortizacao: 0 }); setShowPagamentoModal(true); }}>
            💰 Informar Pagamento
          </button>
          <button className="btn btn-primary" onClick={openNew}>＋ Novo Endividamento</button>
        </div>
      </div>

      <div className="page-body">
        <GeminiTips empresaId={empresaId} />
        
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Banco / Conta</th>
                  <th>Contrato</th>
                  <th>Taxa / Index.</th>
                  <th>Parcelas Faltantes</th>
                  <th>Valor da Parcela</th>
                  <th>Valor de Quitação</th>
                  <th>Total a Pagar</th>
                  <th>Garantia</th>
                  <th>Pgto. do Mês</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {endividamentos.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '32px' }}>
                      <div style={{ color: 'var(--text-muted)' }}>Nenhum endividamento cadastrado.</div>
                    </td>
                  </tr>
                ) : endividamentos.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{e.banco}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{e.conta || '-'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{e.contrato}</div>
                      {e.descricaoContrato && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{e.descricaoContrato}</div>}
                    </td>
                    <td>
                      <div>{e.taxa}% {e.taxaTipo === 'aa' ? 'a.a.' : 'a.m.'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{e.indexador || 'Pré-fixado'}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-gray">{e.parcelasFaltantes}</span>
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--red)' }}>{fmt.currency(e.parcela)}</td>
                    <td style={{ fontWeight: 600 }}>{fmt.currency(e.valorQuitacao)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--red)' }}>{fmt.currency(e.valorAPagar)}</td>
                    <td style={{ fontSize: 12 }}>{e.garantia || '-'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--green)' }}>{fmt.currency(e.pagamentoMes)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Editar" onClick={() => openEdit(e)}>✏️</button>
                        <button className="btn btn-danger btn-sm btn-icon" title="Excluir" onClick={() => handleDelete(e.id)}>🗑️</button>
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
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">{edit ? 'Editar Endividamento' : 'Novo Endividamento'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Banco *</label>
                <input className="form-control" placeholder="Ex: Itaú, Bradesco..." value={form.banco||''} onChange={e=>setForm(f=>({...f,banco:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Conta</label>
                <input className="form-control" placeholder="Ag/CC" value={form.conta||''} onChange={e=>setForm(f=>({...f,conta:e.target.value}))} />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contrato *</label>
                <input className="form-control" placeholder="Nº do Contrato" value={form.contrato||''} onChange={e=>setForm(f=>({...f,contrato:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Descrição do Contrato</label>
                <input className="form-control" placeholder="Finalidade, detalhes..." value={form.descricaoContrato||''} onChange={e=>setForm(f=>({...f,descricaoContrato:e.target.value}))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Garantia</label>
                <input className="form-control" placeholder="Aval, Imóvel, etc." value={form.garantia||''} onChange={e=>setForm(f=>({...f,garantia:e.target.value}))} />
              </div>
              <div className="form-group" style={{ flex: '0 0 120px' }}>
                <label className="form-label">Taxa (%)</label>
                <input type="number" step="0.01" className="form-control" value={form.taxa||0} onChange={e=>setForm(f=>({...f,taxa:Number(e.target.value)}))} />
              </div>
              <div className="form-group" style={{ flex: '0 0 100px' }}>
                <label className="form-label">Período</label>
                <select className="form-control" value={form.taxaTipo||'am'} onChange={e=>setForm(f=>({...f,taxaTipo:e.target.value as 'am'|'aa'}))}>
                  <option value="am">a.m.</option>
                  <option value="aa">a.a.</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Indexador</label>
                <input className="form-control" placeholder="Ex: CDI, IPCA..." value={form.indexador||''} onChange={e=>setForm(f=>({...f,indexador:e.target.value}))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Parcelas Faltantes</label>
                <input type="number" className="form-control" value={form.parcelasFaltantes||0} onChange={e=>setForm(f=>({...f,parcelasFaltantes:Number(e.target.value)}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor da Parcela (R$)</label>
                <input type="number" step="0.01" className="form-control" value={form.parcela||0} onChange={e=>setForm(f=>({...f,parcela:Number(e.target.value)}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor de Quitação (R$)</label>
                <input type="number" step="0.01" className="form-control" value={form.valorQuitacao||0} onChange={e=>setForm(f=>({...f,valorQuitacao:Number(e.target.value)}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Total a Pagar (R$)</label>
                <input type="number" step="0.01" className="form-control" value={form.valorAPagar||0} onChange={e=>setForm(f=>({...f,valorAPagar:Number(e.target.value)}))} />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>✓ Salvar Endividamento</button>
            </div>
          </div>
        </div>
      )}

      {showPagamentoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPagamentoModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Informar Pagamento do Mês</h2>
              <button className="modal-close" onClick={() => setShowPagamentoModal(false)}>✕</button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Contrato</label>
              <select className="form-control" value={pagamentoForm.id} onChange={e => setPagamentoForm(f => ({ ...f, id: e.target.value }))}>
                <option value="">Selecione um contrato...</option>
                {endividamentos.map(e => (
                  <option key={e.id} value={e.id}>{e.banco} - {e.contrato}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Valor Total Pago (R$)</label>
              <input type="number" step="0.01" className="form-control" value={pagamentoForm.valorPago || 0} onChange={e => setPagamentoForm(f => ({ ...f, valorPago: Number(e.target.value) }))} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Juros Embutidos (R$)</label>
                <input type="number" step="0.01" className="form-control" value={pagamentoForm.valorJuros || 0} onChange={e => setPagamentoForm(f => ({ ...f, valorJuros: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Amortização do Saldo (R$)</label>
                <input type="number" step="0.01" className="form-control" value={pagamentoForm.valorAmortizacao || 0} onChange={e => setPagamentoForm(f => ({ ...f, valorAmortizacao: Number(e.target.value) }))} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Este valor será abatido do saldo devedor atual.
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowPagamentoModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSavePagamento}>✓ Salvar Pagamento</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
