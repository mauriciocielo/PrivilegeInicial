'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { store, type Endividamento, uid } from '../../../lib/store';
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

  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [ajusteForm, setAjusteForm] = useState({ id: '', mes: new Date().toISOString().slice(0,7), saldo: 0 });
  const [viewHistoryId, setViewHistoryId] = useState<string | null>(null);

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setEndividamentos(store.getEndividamentos(eId));
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

  const maxMesesParaQuitar = useMemo(() => {
    if (endividamentos.length === 0) return 0;
    const faltantes = endividamentos.map(e => e.parcelasFaltantes || 0);
    return faltantes.length > 0 ? Math.max(...faltantes) : 0;
  }, [endividamentos]);

  const totalAquisicao = endividamentos.reduce((acc,e) => acc + e.valorQuitacao, 0);
  const totalPagamentosMes = endividamentos.reduce((acc,e) => acc + (e.parcela || 0), 0);
  const currentTotalBalance = endividamentos.reduce((acc, e) => acc + e.valorAPagar, 0);

  // Gráfico Histórico simplificado
  const chartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const data = [];
    
    // Simplificando o fallback do chart. Pegamos os ultimos 6 meses e olhamos no historicoSaldos
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mesStr = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}`;
      
      let balanceInMonth = 0;
      endividamentos.forEach(e => {
        // @ts-ignore (fallback para interfaces dinâmicas criadas localmente)
        const hist = e.historicoSaldos?.find(h => h.mes === mesStr);
        if (hist) {
          balanceInMonth += hist.saldo;
        } else {
          // Fallback heuristic if no history: assume balance was higher in the past by assuming the monthly installment wasn't paid yet.
          // For a simple visualization, if no history, just plot current.
          balanceInMonth += e.valorAPagar; 
        }
      });

      data.push({
        label: `${months[d.getMonth()]}/${d.getFullYear().toString().slice(2)}`,
        balance: balanceInMonth
      });
    }

    return data;
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

  const projecaoCalendario = useMemo(() => {
    // Generate a simple cash flow projection calendar for the next 12 months based on parcels missing
    const mesesProj: { label: string; date: Date; totalExigido: number; contratosAtivos: number }[] = [];
    const now = new Date();
    for(let i=1; i<=12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        mesesProj.push({ 
            label: `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`,
            date: d,
            totalExigido: 0,
            contratosAtivos: 0
        });
    }

    endividamentos.forEach(e => {
        if(e.parcelasFaltantes > 0) {
            for(let i=0; i<Math.min(e.parcelasFaltantes, 12); i++) {
                mesesProj[i].totalExigido += e.parcela;
                mesesProj[i].contratosAtivos++;
            }
        }
    });

    return mesesProj;
  }, [endividamentos]);

  const openNew = () => {
    setEdit(null);
    setForm({
      empresaId, taxa: 0, parcela: 0, parcelasFaltantes: 0,
      valorQuitacao: 0, valorAPagar: 0, pagamentoMes: 0
    });
    setShowModal(true);
  };

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
      // @ts-ignore Preserve custom field
      historicoSaldos: edit?.historicoSaldos || [],
      updatedAt: new Date().toISOString()
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

  const handleSaveAjuste = () => {
    if (!ajusteForm.id) { toast.error('Selecione um contrato.'); return; }
    if (!ajusteForm.mes) { toast.error('Selecione o mês (YYYY-MM).'); return; }
    const endiv = endividamentos.find(e => e.id === ajusteForm.id);
    if (!endiv) return;

    // @ts-ignore
    let historico = Array.isArray(endiv.historicoSaldos) ? [...endiv.historicoSaldos] : [];
    
    // Add/Update the historic value for the specific month
    const item = { id: uid(), mes: ajusteForm.mes, saldo: ajusteForm.saldo };
    const idx = historico.findIndex(h => h.mes === ajusteForm.mes);
    if (idx > -1) historico[idx] = item;
    else historico.push(item);
    historico.sort((a,b) => a.mes.localeCompare(b.mes));

    const updated = {
        ...endiv,
        historicoSaldos: historico,
        valorAPagar: ajusteForm.saldo // Adjust current global balance as well for the table!
    };

    store.saveEndividamento(updated);
    setEndividamentos(store.getEndividamentos(empresaId));
    setShowAjusteModal(false);
    toast.success('Saldo devedor ajustado no histórico!');
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">🏦 Endividamento & Empréstimos</div>
          <div className="page-subtitle">Controle de saldos devedores mensais e previsão de caixa</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => { setAjusteForm({ id: '', mes: new Date().toISOString().slice(0,7), saldo: 0 }); setShowAjusteModal(true); }}>
            📊 Ajustar Saldo Mensal
          </button>
          <button className="btn btn-primary" onClick={openNew}>＋ Novo Empréstimo</button>
        </div>
      </div>

      <div className="page-body">
        <GeminiTips empresaId={empresaId} />

        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card red">
            <div className="stat-icon red">📉</div>
            <div className="stat-label">Saldo Devedor Total</div>
            <div className="stat-value">{fmt.currency(currentTotalBalance)}</div>
          </div>
          <div className="stat-card orange">
            <div className="stat-icon orange">💸</div>
            <div className="stat-label">Custo Fixo Mensal (Demanda de Caixa)</div>
            <div className="stat-value">{fmt.currency(totalPagamentosMes)}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-icon green">📅</div>
            <div className="stat-label">Maior Prazo Residual</div>
            <div className="stat-value">{maxMesesParaQuitar} meses</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 250px', gap: 20, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Evolução do Saldo Devedor (Últimos 6 meses)</h3>
                <div style={{ height: 160, width: '100%', position: 'relative' }}>
                    <svg width="100%" height="100%" viewBox="0 0 800 100" preserveAspectRatio="none">
                    <path d={generateChartPath(chartData, 800, 100)} fill="none" stroke="var(--red)" strokeWidth="3" />
                    {chartData.map((d, i) => (
                        <circle key={i} cx={(i / (chartData.length - 1)) * 800} cy={100 - (d.balance / Math.max(...chartData.map(x => x.balance), 1)) * 100} r="5" fill="var(--bg-card)" stroke="var(--red)" strokeWidth="2" />
                    ))}
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                    {chartData.map((d, i) => (
                        <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{d.label}</div>
                    ))}
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 13, color: 'var(--text-secondary)' }}>🗓️ Projeção de Encargos</h3>
                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {projecaoCalendario.map((p, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', backgroundColor: 'var(--bg-base)', borderRadius: 4 }}>
                            <div style={{ fontSize: 11, fontWeight: 700 }}>{p.label}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>{fmt.currency(p.totalExigido)}</div>
                                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{p.contratosAtivos} contrato(s) ativos</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 16, marginBottom: 16 }}>
             Contratos e Posição Atual
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Banco / Conta</th>
                  <th>Contrato</th>
                  <th>Taxa / Index.</th>
                  <th>Parcelas Faltantes</th>
                  <th>Valor da Parcela</th>
                  <th>Total a Pagar</th>
                  <th>Garantia</th>
                  <th style={{ width: 120 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {endividamentos.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>
                      <div style={{ color: 'var(--text-muted)' }}>Nenhum empréstimo/financiamento cadastrado.</div>
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
                    <td style={{ fontWeight: 600, color: 'var(--red)' }}>{fmt.currency(e.valorAPagar)}</td>
                    <td style={{ fontSize: 12 }}>{e.garantia || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Editar" onClick={() => openEdit(e)}>✏️</button>
                        <button className="btn btn-danger btn-sm btn-icon" title="Excluir" onClick={() => handleDelete(e.id)}>🗑️</button>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Ver Histórico de Saldos" onClick={() => setViewHistoryId(viewHistoryId === e.id ? null : e.id)}>📜</button>
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
              <div className="card-title">Histórico Mensal de Saldos: {endividamentos.find(x => x.id === viewHistoryId)?.contrato}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewHistoryId(null)}>Fechar</button>
            </div>
            <div className="table-wrap">
              <table className="table-sm">
                <thead>
                  <tr>
                    <th>Mês Competência (YYYY-MM)</th>
                    <th style={{ textAlign: 'right' }}>Saldo Registrado</th>
                  </tr>
                </thead>
                <tbody>
                  {/* @ts-ignore */}
                  {endividamentos.find(x => x.id === viewHistoryId)?.historicoSaldos?.length ? (
                    // @ts-ignore
                    endividamentos.find(x => x.id === viewHistoryId)?.historicoSaldos?.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.mes}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--red)' }}>{fmt.currency(p.saldo)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={2} style={{ textAlign: 'center', padding: 20 }}>Nenhum ajuste de saldo registrado neste contrato. Use o botão "Ajustar Saldo Mensal" no topo.</td></tr>
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
              <h2 className="modal-title">{edit ? 'Editar Contrato' : 'Novo Contrato / Empréstimo'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Banco / Instituição *</label>
                <input className="form-control" placeholder="Ex: Cresol, Bradesco..." value={form.banco || ''} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">C/C</label>
                <input className="form-control" placeholder="Opcional" value={form.conta || ''} onChange={e => setForm(f => ({ ...f, conta: e.target.value }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nº Contrato *</label>
                <input className="form-control" placeholder="123456-7" value={form.contrato || ''} onChange={e => setForm(f => ({ ...f, contrato: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Descrição / Destinação</label>
                <input className="form-control" placeholder="Capital de Giro, Financiamento Veículo..." value={form.descricaoContrato || ''} onChange={e => setForm(f => ({ ...f, descricaoContrato: e.target.value }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Garantia (Aval, Bens...)</label>
                <input className="form-control" value={form.garantia || ''} onChange={e => setForm(f => ({ ...f, garantia: e.target.value }))} />
              </div>
              <div className="form-group" style={{ flex: '0 0 120px' }}>
                <label className="form-label">Taxa De Juros</label>
                <input type="number" step="0.01" className="form-control" value={form.taxa || 0} onChange={e => setForm(f => ({ ...f, taxa: Number(e.target.value) }))} />
              </div>
              <div className="form-group" style={{ flex: '0 0 100px' }}>
                <label className="form-label">Período</label>
                <select className="form-control" value={form.taxaTipo || 'am'} onChange={e => setForm(f => ({ ...f, taxaTipo: e.target.value as 'am' | 'aa' }))}>
                  <option value="am">% a.m.</option>
                  <option value="aa">% a.a.</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Indexador</label>
                <input className="form-control" placeholder="CDI, IPCA, Fixa..." value={form.indexador || ''} onChange={e => setForm(f => ({ ...f, indexador: e.target.value }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Qtd. Parcelas Faltantes</label>
                <input type="number" className="form-control" value={form.parcelasFaltantes || 0} onChange={e => setForm(f => ({ ...f, parcelasFaltantes: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor Mensal Parcela (R$)</label>
                <input type="number" step="0.01" className="form-control" value={form.parcela || 0} onChange={e => setForm(f => ({ ...f, parcela: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Saldo Devedor Inicial / Global (R$)</label>
                <input type="number" step="0.01" className="form-control" value={form.valorAPagar || 0} onChange={e => setForm(f => ({ ...f, valorAPagar: Number(e.target.value) }))} />
              </div>
            </div>
            
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>* Ao preencher o saldo inicial e as parcelas, o sistema usará o Ajuste Mensal para preencher a tabela de evolução do contrato automaticamente.</div>

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>✓ Salvar Contrato</button>
            </div>
          </div>
        </div>
      )}

      {showAjusteModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAjusteModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Ajustar Saldo Devedor Mensal</h2>
              <button className="modal-close" onClick={() => setShowAjusteModal(false)}>✕</button>
            </div>

            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                Ao invés de informar pagamentos avulsos, basta inserir o valor do <strong>saldo devedor fornecido pelo extrato do banco</strong> no fim do mês para alimentar a curva de análise. O Saldo Devedor também será espelhado automaticamente no Balanço Patrimonial!
            </div>

            <div className="form-group">
              <label className="form-label">Contrato</label>
              <select className="form-control" value={ajusteForm.id} onChange={e => setAjusteForm(f => ({ ...f, id: e.target.value }))}>
                <option value="">Selecione um contrato...</option>
                {endividamentos.map(e => (
                  <option key={e.id} value={e.id}>{e.banco} - {e.contrato}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
                <div className="form-group">
                <label className="form-label">Competência / Mês de Atualização</label>
                <input type="month" className="form-control" value={ajusteForm.mes} onChange={e => setAjusteForm(f => ({ ...f, mes: e.target.value }))} />
                </div>

                <div className="form-group">
                <label className="form-label">Novo Saldo Devedor Deste Mês (R$)</label>
                <input type="number" step="0.01" className="form-control" value={ajusteForm.saldo || 0} onChange={e => setAjusteForm(f => ({ ...f, saldo: Number(e.target.value) }))} />
                </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowAjusteModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveAjuste}>✓ Atualizar Posição Histórica</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
