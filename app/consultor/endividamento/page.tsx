'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { store, Endividamento, uid } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import GeminiTips from '../../../components/GeminiTips';
import { toast } from 'sonner';
import { confirmAsync } from '../../../components/ConfirmProvider';

export default function EndividamentoPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [endividamentos, setEndividamentos] = useState<Endividamento[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<Endividamento | null>(null);
  const [form, setForm] = useState<Partial<Endividamento>>({});

  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [pagamentoForm, setPagamentoForm] = useState<{ id: string; paymentId?: string; data: string; valorTotal: number; valorJuros: number; valorAmortizacao: number }>({
    id: '', data: new Date().toISOString().split('T')[0], valorTotal: 0, valorJuros: 0, valorAmortizacao: 0
  });
  const [viewHistoryId, setViewHistoryId] = useState<string | null>(null);
  const [totalJurosAnoAtual, setTotalJurosAnoAtual] = useState(0);
  const [totalPagoAnoAtual, setTotalPagoAnoAtual] = useState(0);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<string>('all');

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    const data = store.getEndividamentos(eId);
    setEndividamentos(data);
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

  // Cálculos de Resumo e Filtros
  useEffect(() => {
    let sumJuros = 0;
    let sumTotal = 0;

    endividamentos.forEach(endiv => {
      endiv.pagamentos?.forEach(pagamento => {
        const pDate = new Date(pagamento.data + 'T12:00:00');
        const pYear = pDate.getFullYear();
        const pMonth = (pDate.getMonth() + 1).toString().padStart(2, '0');

        const matchYear = pYear === filterYear;
        const matchMonth = filterMonth === 'all' || pMonth === filterMonth;

        if (matchYear && matchMonth) {
          sumJuros += pagamento.valorJuros;
          sumTotal += pagamento.valorTotal;
        }
      });
    });

    setTotalJurosAnoAtual(sumJuros);
    setTotalPagoAnoAtual(sumTotal);
  }, [endividamentos, filterYear, filterMonth]);

  const maxMesesParaQuitar = useMemo(() => {
    if (endividamentos.length === 0) return 0;
    const faltantes = endividamentos.map(e => e.parcelasFaltantes || 0);
    return faltantes.length > 0 ? Math.max(...faltantes) : 0;
  }, [endividamentos]);

  // Dados para o Gráfico de Evolução da Dívida
  const chartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentTotalBalance = endividamentos.reduce((acc, e) => acc + e.valorAPagar, 0);

    const data = [];
    let runningBalance = currentTotalBalance;
    const now = new Date();

    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const y = d.getFullYear();

      data.push({
        label: `${months[mIdx]}/${y.toString().slice(2)}`,
        balance: runningBalance,
      });

      const amortizacoesMes = endividamentos.reduce((acc, e) => {
        const pagamentosNoMes = e.pagamentos?.filter(p => {
          const pDate = new Date(p.data + 'T12:00:00');
          return pDate.getMonth() === mIdx && pDate.getFullYear() === y;
        }) || [];
        return acc + pagamentosNoMes.reduce((sum, p) => sum + p.valorAmortizacao, 0);
      }, 0);

      runningBalance += amortizacoesMes;
    }

    return data.reverse();
  }, [endividamentos]);

  const generateChartPath = (data: any[], width: number, height: number) => {
    if (data.length < 2) return "";
    const maxBalance = Math.max(...data.map(d => d.balance), 0) || 1;
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (d.balance / maxBalance) * height;
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  };

  const openNew = () => {
    setEdit(null);
    setForm({
      empresaId,
      taxa: 0,
      parcela: 0,
      parcelasFaltantes: 0,
      valorQuitacao: 0,
      valorAPagar: 0,
      pagamentoMes: 0,
      pagamentos: []
    });
    setShowModal(true);
  };

  // Cálculo automático de juros e amortização
  useEffect(() => {
    if (!pagamentoForm.id || pagamentoForm.valorTotal <= 0) return;
    const endiv = endividamentos.find(e => e.id === pagamentoForm.id);
    if (!endiv) return;

    const taxaMensal = endiv.taxaTipo === 'aa' ? endiv.taxa / 12 : endiv.taxa;
    const juros = Number((endiv.valorAPagar * (taxaMensal / 100)).toFixed(2));
    const amortizacao = Number((pagamentoForm.valorTotal - juros).toFixed(2));
    if (juros !== pagamentoForm.valorJuros || amortizacao !== pagamentoForm.valorAmortizacao) {
      setPagamentoForm(prev => ({
        ...prev,
        valorJuros: juros,
        valorAmortizacao: Math.max(0, amortizacao)
      }));
    }
  }, [pagamentoForm.id, pagamentoForm.valorTotal, endividamentos]);

  const openEdit = (e: Endividamento) => {
    setEdit(e);
    setForm({ ...e });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.banco || !form.contrato) { toast.error('Preencha pelo menos Banco e Contrato.'); return; }

    const e: Endividamento = {
      id: edit?.id || uid(),
      empresaId,
      tipo: form.tipo || 'bancario',
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
      pagamentos: edit?.pagamentos || []
    };

    store.saveEndividamento(e);
    setEndividamentos(store.getEndividamentos(empresaId));
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAsync('Excluir este endividamento?'))) return;
    store.deleteEndividamento(id);
    setEndividamentos(store.getEndividamentos(empresaId));
  };

  const handleSavePagamento = () => {
    if (!pagamentoForm.id) { toast.error('Selecione um contrato.'); return; }
    const endiv = endividamentos.find(e => e.id === pagamentoForm.id);
    if (!endiv) return;

    const novoPagamento = {
      id: pagamentoForm.paymentId || uid(),
      data: pagamentoForm.data,
      valorTotal: pagamentoForm.valorTotal,
      valorJuros: pagamentoForm.valorJuros,
      valorAmortizacao: pagamentoForm.valorAmortizacao
    };

    let pagamentos = [...(endiv.pagamentos || [])];
    let diffAmortizacao = pagamentoForm.valorAmortizacao;
    let diffParcelas = 1;

    if (pagamentoForm.paymentId) {
      const index = pagamentos.findIndex(p => p.id === pagamentoForm.paymentId);
      if (index > -1) {
        diffAmortizacao = novoPagamento.valorAmortizacao - pagamentos[index].valorAmortizacao;
        diffParcelas = 0; // Já estava descontada
        pagamentos[index] = novoPagamento;
      }
    } else {
      pagamentos.push(novoPagamento);
    }

    store.saveEndividamento({
      ...endiv,
      pagamentoMes: novoPagamento.valorTotal,
      valorAPagar: Math.max(0, endiv.valorAPagar - diffAmortizacao),
      valorQuitacao: Math.max(0, endiv.valorQuitacao - diffAmortizacao),
      parcelasFaltantes: Math.max(0, endiv.parcelasFaltantes - diffParcelas),
      pagamentos
    });

    setEndividamentos(store.getEndividamentos(empresaId));
    setShowPagamentoModal(false);
  };

  const editPayment = (endiv: Endividamento, payment: { id: string, data: string, valorTotal: number, valorJuros: number, valorAmortizacao: number }) => {
    setPagamentoForm({
      id: endiv.id,
      paymentId: payment.id,
      data: payment.data,
      valorTotal: payment.valorTotal,
      valorJuros: payment.valorJuros,
      valorAmortizacao: payment.valorAmortizacao
    });
    setShowPagamentoModal(true);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Evolução do Endividamento</div>
          <div className="page-subtitle">Acompanhe empréstimos, financiamentos e obrigações</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => { setPagamentoForm({ id: '', data: new Date().toISOString().split('T')[0], valorTotal: 0, valorJuros: 0, valorAmortizacao: 0 }); setShowPagamentoModal(true); }}>
            💰 Informar Pagamento
          </button>
          <button className="btn btn-primary" onClick={openNew}>＋ Novo Endividamento</button>
        </div>
      </div>

      <div className="page-body">
        <GeminiTips empresaId={empresaId} />

        <div className="card" style={{ marginBottom: 24, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0 }}>Análise de Fluxo e Evolução</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="form-control form-control-sm" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                <option value="all">Todos os Meses</option>
                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input type="number" className="form-control form-control-sm" style={{ width: 80 }} value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} />
            </div>
          </div>

          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card orange">
              <div className="stat-icon orange">📉</div>
              <div className="stat-label">Juros Pagos no Período</div>
              <div className="stat-value">{fmt.currency(totalJurosAnoAtual)}</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon blue">💰</div>
              <div className="stat-label">Total Pago no Período</div>
              <div className="stat-value">{fmt.currency(totalPagoAnoAtual)}</div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon green">📅</div>
              <div className="stat-label">Tempo p/ Quitação Total</div>
              <div className="stat-value">{maxMesesParaQuitar} meses</div>
            </div>
          </div>

          <div style={{ height: 150, width: '100%', position: 'relative', marginTop: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Evolução do Saldo Devedor (Últimos 6 meses)</div>
            <svg width="100%" height="100%" viewBox="0 0 800 100" preserveAspectRatio="none">
              <path
                d={generateChartPath(chartData, 800, 100)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
              />
              {chartData.map((d, i) => (
                <circle
                  key={i}
                  cx={(i / (chartData.length - 1)) * 800}
                  cy={100 - (d.balance / Math.max(...chartData.map(x => x.balance), 1)) * 100}
                  r="4"
                  fill="var(--accent)"
                />
              ))}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              {chartData.map((d, i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.label}</div>
              ))}
            </div>
          </div>
        </div>


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
                  <th style={{ width: 120 }}>Ações</th>
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
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Editar" onClick={() => openEdit(e)}>✏️</button>
                        <button className="btn btn-danger btn-sm btn-icon" title="Excluir" onClick={() => handleDelete(e.id)}>🗑️</button>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Ver Histórico" onClick={() => setViewHistoryId(viewHistoryId === e.id ? null : e.id)}>📜</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {viewHistoryId && (
          <div className="card" style={{ marginTop: 16, borderLeft: '4px solid var(--accent)' }}>
            <div className="card-header">
              <div className="card-title">Histórico de Pagamentos: {endividamentos.find(x => x.id === viewHistoryId)?.banco}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewHistoryId(null)}>Fechar</button>
            </div>
            <div className="table-wrap">
              <table className="table-sm">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th style={{ textAlign: 'right' }}>Total Pago</th>
                    <th style={{ textAlign: 'right' }}>Juros</th>
                    <th style={{ textAlign: 'right' }}>Amortização</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {endividamentos.find(x => x.id === viewHistoryId)?.pagamentos?.length ? (
                    endividamentos.find(x => x.id === viewHistoryId)?.pagamentos?.map(p => (
                      <tr key={p.id}>
                        <td>{fmt.date(p.data)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt.currency(p.valorTotal)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--orange)' }}>{fmt.currency(p.valorJuros)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt.currency(p.valorAmortizacao)}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => editPayment(endividamentos.find(x => x.id === viewHistoryId)!, p)}>✏️</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} style={{ textAlign: 'center' }}>Nenhum pagamento registrado no histórico.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
                <input className="form-control" placeholder="Ex: Itaú, Bradesco..." value={form.banco || ''} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Conta</label>
                <input className="form-control" placeholder="Ag/CC" value={form.conta || ''} onChange={e => setForm(f => ({ ...f, conta: e.target.value }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contrato *</label>
                <input className="form-control" placeholder="Nº do Contrato" value={form.contrato || ''} onChange={e => setForm(f => ({ ...f, contrato: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Descrição do Contrato</label>
                <input className="form-control" placeholder="Finalidade, detalhes..." value={form.descricaoContrato || ''} onChange={e => setForm(f => ({ ...f, descricaoContrato: e.target.value }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Garantia</label>
                <input className="form-control" placeholder="Aval, Imóvel, etc." value={form.garantia || ''} onChange={e => setForm(f => ({ ...f, garantia: e.target.value }))} />
              </div>
              <div className="form-group" style={{ flex: '0 0 120px' }}>
                <label className="form-label">Taxa (%)</label>
                <input type="number" step="0.01" className="form-control" value={form.taxa || 0} onChange={e => setForm(f => ({ ...f, taxa: Number(e.target.value) }))} />
              </div>
              <div className="form-group" style={{ flex: '0 0 100px' }}>
                <label className="form-label">Período</label>
                <select className="form-control" value={form.taxaTipo || 'am'} onChange={e => setForm(f => ({ ...f, taxaTipo: e.target.value as 'am' | 'aa' }))}>
                  <option value="am">a.m.</option>
                  <option value="aa">a.a.</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Indexador</label>
                <input className="form-control" placeholder="Ex: CDI, IPCA..." value={form.indexador || ''} onChange={e => setForm(f => ({ ...f, indexador: e.target.value }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Parcelas Faltantes</label>
                <input type="number" className="form-control" value={form.parcelasFaltantes || 0} onChange={e => setForm(f => ({ ...f, parcelasFaltantes: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor da Parcela (R$)</label>
                <input type="number" step="0.01" className="form-control" value={form.parcela || 0} onChange={e => setForm(f => ({ ...f, parcela: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor de Quitação (R$)</label>
                <input type="number" step="0.01" className="form-control" value={form.valorQuitacao || 0} onChange={e => setForm(f => ({ ...f, valorQuitacao: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Total a Pagar (R$)</label>
                <input type="number" step="0.01" className="form-control" value={form.valorAPagar || 0} onChange={e => setForm(f => ({ ...f, valorAPagar: Number(e.target.value) }))} />
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
              <h2 className="modal-title">{pagamentoForm.paymentId ? 'Editar Pagamento' : 'Informar Pagamento'}</h2>
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
              <label className="form-label">Data do Pagamento</label>
              <input type="date" className="form-control" value={pagamentoForm.data} onChange={e => setPagamentoForm(f => ({ ...f, data: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Valor Total Pago (R$)</label>
              <input type="number" step="0.01" className="form-control" value={pagamentoForm.valorTotal || 0} onChange={e => setPagamentoForm(f => ({ ...f, valorTotal: Number(e.target.value) }))} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Juros Embutidos (R$)</label>
                <input type="number" step="0.01" className="form-control" value={pagamentoForm.valorJuros || 0} readOnly style={{ backgroundColor: 'var(--bg-base)' }} />
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
