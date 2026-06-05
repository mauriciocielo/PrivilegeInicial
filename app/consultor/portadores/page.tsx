'use client';
import { useState, useEffect, useCallback } from 'react';
import { store, Portador } from '../../../lib/store';
import { uid } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

const TIPO_LABELS: Record<string, string> = {
  conta_corrente: '🏦 Conta Corrente',
  poupanca: '💰 Poupança',
  caixa: '💵 Caixa',
  cartao: '💳 Cartão',
  outro: '📦 Outro',
};

const BANCOS_COMPE = [
  { code: '001', name: 'Banco do Brasil S.A.' },
  { code: '033', name: 'Banco Santander (Brasil) S.A.' },
  { code: '104', name: 'Caixa Econômica Federal' },
  { code: '237', name: 'Banco Bradesco S.A.' },
  { code: '341', name: 'Itaú Unibanco S.A.' },
  { code: '077', name: 'Banco Inter S.A.' },
  { code: '260', name: 'Nu Pagamentos S.A. (Nubank)' },
  { code: '336', name: 'Banco C6 S.A. (C6 Bank)' },
  { code: '290', name: 'Pagseguro Internet Instituição de Pagamento S.A. (PagBank)' },
  { code: '041', name: 'Banco do Estado do Rio Grande do Sul S.A. (Banrisul)' },
  { code: '748', name: 'Banco Cooperativo Sicredi S.A.' },
  { code: '756', name: 'Banco Cooperativo Sicoob S.A. (Sicoob)' },
  { code: '004', name: 'Banco do Nordeste do Brasil S.A.' },
  { code: '021', name: 'BANESTES S.A. Banco do Estado do Espírito Santo' },
  { code: '389', name: 'Banco Mercantil do Brasil S.A.' },
  { code: '422', name: 'Banco Safra S.A.' },
  { code: '623', name: 'Banco Pan S.A.' },
  { code: '655', name: 'Banco Votorantim S.A. (BV)' },
  { code: '136', name: 'Unicred Cooperativa' },
  { code: '133', name: 'Cresol' },
  { code: '318', name: 'Banco BMG S.A.' },
  { code: '212', name: 'Banco Original S.A.' },
  { code: '735', name: 'Banco Neon' },
  { code: '085', name: 'Cooperativa Central de Crédito Ailos (Ailos)' }
];

export default function PortadoresPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<Portador | null>(null);
  const [form, setForm] = useState<Partial<Portador>>({});
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setPortadores(store.getPortadores(eId));
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
    setForm({ tipo: 'conta_corrente', saldoInicial: 0, saldoInicialData: new Date().toISOString().split('T')[0], ativo: true, empresaId }); // Always set a default date for new
    setShowModal(true);
  };
  const openEdit = (p: Portador) => { setEdit(p); setForm({ ...p, saldoInicialData: p.saldoInicialData || new Date().toISOString().split('T')[0] }); setShowModal(true); }; // Ensure date is set for existing

  const handleSave = () => {
    if (!form.nome) { alert('Informe o nome do portador.'); return; }
    const p: Portador = {
      id: edit?.id || uid(),
      nome: form.nome!,
      tipo: form.tipo as Portador['tipo'],
      banco: form.banco,
      agencia: form.agencia,
      conta: form.conta,
      saldoInicialData: form.saldoInicialData,
      saldoInicial: Number(form.saldoInicial) || 0,
      ativo: form.ativo !== false,
      empresaId,
    };
    store.savePortador(p);
    setPortadores(store.getPortadores(empresaId));
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este portador?')) return;
    store.deletePortador(id);
    setPortadores(store.getPortadores(empresaId));
  };

  const totalSaldo = portadores.filter(p => p.ativo).reduce((a, p) => a + store.getSaldoPortador(p.id, empresaId), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Portadores</div>
          <div className="page-subtitle">Bancos, caixas e carteiras</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNew}>＋ Novo Portador</button>
        </div>
      </div>

      <div className="page-body">
        {/* Summary */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card blue">
            <div className="stat-icon blue">🏦</div>
            <div className="stat-label">Saldo Total</div>
            <div className="stat-value" style={{ fontSize: 20, color: totalSaldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt.currency(totalSaldo)}
            </div>
          </div>
          {portadores.filter(p => p.ativo).slice(0, 3).map(p => {
            const saldo = store.getSaldoPortador(p.id, empresaId);
            return (
              <div key={p.id} className={`stat-card ${saldo >= 0 ? 'green' : 'red'}`}>
                <div className={`stat-icon ${saldo >= 0 ? 'green' : 'red'}`}>💳</div>
                <div className="stat-label">{p.nome}</div>
                <div className="stat-value" style={{ fontSize: 18, color: saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt.currency(saldo)}</div>
                <div className="stat-change" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{TIPO_LABELS[p.tipo]}</div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Banco</th>
                  <th>Agência / Conta</th>
                  <th>Saldo Inicial</th>
                  <th>Saldo Atual</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {portadores.map(p => {
                  const saldo = store.getSaldoPortador(p.id, empresaId);
                  return (
                    <tr key={p.id} style={{ opacity: p.ativo ? 1 : 0.5 }}>
                      <td style={{ fontWeight: 600 }}>{p.nome}</td>
                      <td><span className="badge badge-gray">{TIPO_LABELS[p.tipo]}</span></td>
                      <td style={{ fontSize: 12 }}>{p.banco || '-'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {p.agencia ? `${p.agencia} / ${p.conta}` : '-'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{fmt.currency(p.saldoInicial)} ({fmt.date(p.saldoInicialData || '')})</td>
                      <td style={{ fontWeight: 700, color: saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt.currency(saldo)}</td>
                      <td>
                        <span className={`badge ${p.ativo ? 'badge-green' : 'badge-gray'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(p)}>✏️</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(p.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {portadores.length === 0 && (
                  <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon">🏦</div><h3>Nenhum portador cadastrado</h3></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{edit ? 'Editar Portador' : 'Novo Portador'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input className="form-control" placeholder="Ex: Banco do Brasil CC" value={form.nome || ''} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-control" value={form.tipo || 'conta_corrente'} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as Portador['tipo'] }))}>
                  <option value="conta_corrente">Conta Corrente</option>
                  <option value="poupanca">Poupança</option>
                  <option value="aplicacao">Aplicação</option>
                  <option value="caixa">Caixa</option>
                  <option value="cartao">Cartão</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            </div>
            {(form.tipo === 'conta_corrente' || form.tipo === 'poupanca' || form.tipo === 'aplicacao') && (
              <div className="form-row">
                <div className="form-group" style={{ position: 'relative' }}>
                  <style>{`
                    .bank-item-hover:hover {
                      background-color: var(--border-light, #f1f5f9) !important;
                    }
                  `}</style>
                  <label className="form-label">Banco</label>
                  <input 
                    className="form-control" 
                    placeholder="COMPE ou Nome (Ex: 001)" 
                    value={form.banco || ''} 
                    onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} 
                    onFocus={() => setBankDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setBankDropdownOpen(false), 200)}
                  />
                  {bankDropdownOpen && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        backgroundColor: 'var(--card-bg, #ffffff)',
                        border: '1px solid var(--border-light, #e2e8f0)',
                        borderRadius: '6px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        marginTop: '4px'
                      }}
                    >
                      {BANCOS_COMPE.filter(b => 
                        b.code.includes(form.banco || '') || 
                        b.name.toLowerCase().includes((form.banco || '').toLowerCase())
                      ).map(b => (
                        <div 
                          key={b.code}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '12.5px',
                            borderBottom: '1px solid var(--border-light, #e2e8f0)',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center'
                          }}
                          onMouseDown={() => {
                            setForm(f => ({ ...f, banco: `${b.code} - ${b.name}` }));
                            setBankDropdownOpen(false);
                          }}
                          className="bank-item-hover"
                        >
                          <span style={{ fontWeight: 700, color: 'var(--accent, #3182ce)', minWidth: '30px' }}>{b.code}</span>
                          <span style={{ color: 'var(--text-primary, #2d3748)' }}>{b.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Agência</label>
                  <input className="form-control" placeholder="0000-0" value={form.agencia || ''} onChange={e => setForm(f => ({ ...f, agencia: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Conta</label>
                  <input className="form-control" placeholder="00000-0" value={form.conta || ''} onChange={e => setForm(f => ({ ...f, conta: e.target.value }))} />
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Saldo Inicial (R$)</label>
              <input type="number" step="0.01" className="form-control" value={form.saldoInicial || 0} onChange={e => setForm(f => ({ ...f, saldoInicial: parseFloat(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Data do Saldo Inicial</label>
              <input type="date" className="form-control" value={form.saldoInicialData || new Date().toISOString().split('T')[0]} onChange={e => setForm(f => ({ ...f, saldoInicialData: e.target.value }))} />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>✓ Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
