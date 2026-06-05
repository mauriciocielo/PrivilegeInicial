'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { parseOFX, generateSampleOFX, OFXTransaction } from '../../../lib/ofx-parser';
import { store, Lancamento, PlanoConta, Portador, TransactionPattern } from '../../../lib/store';
import { uid } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

export default function ImportarOFXPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [transactions, setTransactions] = useState<OFXTransaction[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [portadorId, setPortadorId] = useState('');
  const [catMap, setCatMap] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [ofxInfo, setOfxInfo] = useState<{ bankId?: string; acctId?: string; dtStart?: string; dtEnd?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Estados e funções de integração Open Finance via API
  const [bancoSync, setBancoSync] = useState('');
  const [syncingApi, setSyncingApi] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');

  const handleSyncApi = async () => {
    if (!bancoSync) { alert('Selecione um banco para sincronizar.'); return; }
    setSyncingApi(true);
    setSyncStatusText('Conectando com o servidor do banco via Open Finance...');
    
    await new Promise(r => setTimeout(r, 1200));
    setSyncStatusText('Autenticando credenciais corporativas...');
    
    await new Promise(r => setTimeout(r, 1000));
    setSyncStatusText('Requisitando extrato do período via API REST...');
    
    try {
      const response = await fetch(`/api/banco-extrato?banco=${bancoSync}`);
      if (!response.ok) throw new Error('Erro ao buscar extrato do banco.');
      const text = await response.text();
      
      const result = parseOFX(text);
      setOfxInfo({ bankId: result.bankId, acctId: result.acctId, dtStart: result.dtStart, dtEnd: result.dtEnd });
      
      // Filtrar lançamentos já importados
      const existing = store.getLancamentos(empresaId);
      const existingIds = new Set(existing.filter(l => l.ofxId).map(l => l.ofxId));
      const newTrns = result.transactions.filter(t => !existingIds.has(t.fitId));
      
      // Auto-categorizar com base nas regras contábeis aprendidas
      const newCatMap: Record<string, string> = {};
      newTrns.forEach(t => {
        const suggested = store.classifyDescription(empresaId, t.description);
        if (suggested) {
          newCatMap[t.id] = suggested;
        }
      });
      setCatMap(prev => ({ ...prev, ...newCatMap }));
      setTransactions(newTrns);
      setSelected(new Set(newTrns.map(t => t.id)));
      setDone(false);
      setSuccessMsg('');
      setSyncStatusText('Extrato importado com sucesso!');
      setTimeout(() => setSyncStatusText(''), 2000);
    } catch (e) {
      alert((e as Error).message);
      setSyncStatusText('');
    } finally {
      setSyncingApi(false);
    }
  };

  // Estados para Regras de Conciliação
  const [activeTab, setActiveTab] = useState<'import' | 'rules'>('import');
  const [rules, setRules] = useState<TransactionPattern[]>([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [rulePattern, setRulePattern] = useState('');
  const [ruleCategory, setRuleCategory] = useState('');
  const [rulesSearch, setRulesSearch] = useState('');

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    const ports = store.getPortadores(eId).filter(p => p.ativo);
    setPortadores(ports);
    if (ports.length > 0) setPortadorId(ports[0].id);
    setPlanoContas(store.getPlanoContas(eId).filter(p => p.nivel === 3 && p.ativo));
  }, []);

  const loadRules = useCallback(() => {
    setRules(store.getTransactionPatterns(empresaId));
  }, [empresaId]);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || 'e1';
    load(saved);
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail;
      load(id);
    };
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleSaveRule = () => {
    if (!rulePattern || !ruleCategory) {
      alert('Preencha o termo da descrição e a categoria.');
      return;
    }
    store.saveTransactionPattern({
      id: 'pt_' + Math.random().toString(36).slice(2, 9),
      empresaId,
      pattern: rulePattern,
      categoryId: ruleCategory
    });
    loadRules();
    setShowRuleModal(false);
    setRulePattern('');
    setRuleCategory('');
  };

  const handleDeleteRule = (id: string) => {
    if (!confirm('Excluir esta regra de autoclassificação?')) return;
    store.deleteTransactionPattern(id);
    loadRules();
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseOFX(text);
      setOfxInfo({ bankId: result.bankId, acctId: result.acctId, dtStart: result.dtStart, dtEnd: result.dtEnd });
      
      // Filtrar lançamentos já importados
      const existing = store.getLancamentos(empresaId);
      const existingIds = new Set(existing.filter(l => l.ofxId).map(l => l.ofxId));
      const newTrns = result.transactions.filter(t => !existingIds.has(t.fitId));
      
      // Auto-categorizar com base nas inteligências aprendidas
      const newCatMap: Record<string, string> = {};
      newTrns.forEach(t => {
        const suggested = store.classifyDescription(empresaId, t.description);
        if (suggested) {
          newCatMap[t.id] = suggested;
        }
      });
      setCatMap(prev => ({ ...prev, ...newCatMap }));

      setTransactions(newTrns);
      setSelected(new Set(newTrns.map(t => t.id)));
      setDone(false);
      setSuccessMsg('');
    };
    reader.readAsText(file, 'latin1');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const loadSample = () => {
    const text = generateSampleOFX();
    const result = parseOFX(text);
    setOfxInfo({ bankId: result.bankId, acctId: result.acctId, dtStart: result.dtStart, dtEnd: result.dtEnd });

    // Filtrar transações que já foram importadas (evitar duplicados)
    const existing = store.getLancamentos(empresaId);
    const existingIds = new Set(existing.map(l => l.ofxId).filter(Boolean));
    const newTrns = result.transactions.filter(t => !existingIds.has(t.fitId));

    // Auto-categorizar com base nas inteligências aprendidas
    const newCatMap: Record<string, string> = {};
    newTrns.forEach(t => {
      const suggested = store.classifyDescription(empresaId, t.description);
      if (suggested) {
        newCatMap[t.id] = suggested;
      }
    });
    setCatMap(prev => ({ ...prev, ...newCatMap }));

    setTransactions(newTrns);
    setSelected(new Set(newTrns.map(t => t.id)));
    setDone(false);
    setSuccessMsg('');
  };

  const toggleAll = () => {
    if (selected.size === transactions.length) setSelected(new Set());
    else setSelected(new Set(transactions.map(t => t.id)));
  };

  const handleReconcile = (t: OFXTransaction, manualId: string) => {
    if (!portadorId) { alert('Selecione um portador.'); return; }
    const lancamentoOfx: Lancamento = {
      id: uid(),
      empresaId,
      data: t.date,
      descricao: t.description,
      valor: t.amount,
      tipo: t.type === 'CREDIT' ? 'receita' : 'despesa',
      planoContaId: catMap[t.id] || (t.type === 'CREDIT' ? 'pc4' : 'pc30'),
      portadorId,
      status: 'realizado',
      numeroDocumento: t.checkNum,
      observacao: t.memo,
      origem: 'ofx',
      ofxId: t.fitId,
      createdAt: new Date().toISOString(),
    };
    try {
      store.reconciliar(lancamentoOfx, manualId);
      setTransactions(prev => prev.filter(item => item.id !== t.id));
      const s = new Set(selected);
      s.delete(t.id);
      setSelected(s);
      alert('Transação OFX conciliada com o lançamento previsto com sucesso!');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleImport = async () => {
    if (!portadorId) { alert('Selecione um portador.'); return; }
    const toImport = transactions.filter(t => selected.has(t.id));
    if (toImport.length === 0) { alert('Nenhuma transação selecionada.'); return; }
    setImporting(true);
    await new Promise(r => setTimeout(r, 800));
    try {
      const lancsArray = toImport.map(t => ({
        id: uid(),
        empresaId,
        data: t.date,
        descricao: t.description,
        valor: t.amount,
        tipo: (t.type === 'CREDIT' ? 'receita' : 'despesa') as 'receita' | 'despesa',
        planoContaId: catMap[t.id] || (t.type === 'CREDIT' ? 'pc4' : 'pc30'),
        portadorId,
        status: 'realizado' as 'realizado',
        numeroDocumento: t.checkNum,
        observacao: t.memo,
        origem: 'ofx' as 'ofx',
        ofxId: t.fitId,
        createdAt: new Date().toISOString(),
      }));

      const res = store.saveLancamentos(lancsArray);
      let msg = `Transações importadas com sucesso!`;
      if (res) {
        msg = `Lançamentos importados com sucesso: ${res.imported} transações importadas.`;
        if (res.skipped > 0) {
          msg += ` (${res.skipped} transações foram ignoradas pois pertencem a um período fechado).`;
        }
      }
      setSuccessMsg(msg);
      setDone(true);
      setTransactions(prev => prev.filter(t => !selected.has(t.id)));
      setSelected(new Set());
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Importar OFX</div>
          <div className="page-subtitle">Importe extratos bancários no formato OFX/QFX</div>
        </div>
      </div>

      <div className="page-body">
        {/* Abas */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-light)', paddingBottom: 12 }}>
          <button 
            className={`btn ${activeTab === 'import' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setActiveTab('import')}
          >
            📂 Importar Extrato (OFX)
          </button>
          <button 
            className={`btn ${activeTab === 'rules' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => { setActiveTab('rules'); loadRules(); }}
          >
            🧠 Regras de Autoclassificação ({rules.length})
          </button>
        </div>

        {activeTab === 'import' ? (
          <>
            {done && (
              <div className="alert alert-success" style={{ marginBottom: 20 }}>
                ✅ {successMsg || 'Transações importadas com sucesso! Acesse os lançamentos para verificar.'}
              </div>
            )}

        <div className="grid-12" style={{ marginBottom: 24 }}>
          {/* Upload area */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">1. Selecionar Arquivo</div>
            </div>

            <div
              className={`upload-area ${dragOver ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <div className="upload-icon">📂</div>
              <div className="upload-text">Arraste o arquivo OFX aqui ou clique para selecionar</div>
              <div className="upload-hint">Suporte: .ofx, .qfx (bancos brasileiros)</div>
            </div>
            <input ref={fileRef} type="file" accept=".ofx,.qfx,.txt" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

            <div style={{ textAlign: 'center', margin: '16px 0', color: 'var(--text-muted)', fontSize: 12 }}>— ou —</div>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 20 }} onClick={loadSample}>
              🧪 Carregar OFX de Exemplo (Demo)
            </button>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🔌 Conexão Direta via API (Open Finance)</span>
                <span className="badge badge-purple" style={{ fontSize: 9, padding: '2px 6px', fontWeight: 700 }}>NOVO</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: '1.4' }}>
                Sincronize o extrato bancário diretamente da conta do cooperado/cliente Sicredi e outros bancos homologados via API.
              </p>
              
              <div style={{ display: 'flex', gap: 8 }}>
                <select 
                  className="form-control" 
                  style={{ fontSize: 12.5, flex: 1 }}
                  value={bancoSync}
                  onChange={e => setBancoSync(e.target.value)}
                  disabled={syncingApi}
                >
                  <option value="">-- Selecionar Banco --</option>
                  <option value="748">Sicredi S.A. (Cooperativas)</option>
                  <option value="001">Banco do Brasil S.A.</option>
                  <option value="341">Itaú Unibanco S.A. (PJ)</option>
                  <option value="260">Nubank PJ (Open Banking)</option>
                </select>
                <button 
                  className="btn btn-primary"
                  style={{ fontSize: 12.5, background: 'linear-gradient(135deg, var(--purple) 0%, #7c3aed 100%)', borderColor: 'var(--purple)' }}
                  onClick={handleSyncApi}
                  disabled={syncingApi || !bancoSync}
                >
                  {syncingApi ? '⏳ Aguarde...' : '🔌 Conectar'}
                </button>
              </div>
              {syncStatusText && (
                <div style={{ fontSize: 11.5, color: 'var(--purple)', marginTop: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="pulse-glow" style={{ fontSize: 14 }}>📡</span> {syncStatusText}
                </div>
              )}
            </div>

            {ofxInfo && (
              <div style={{ marginTop: 20, padding: '14px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>Informações do Extrato</div>
                {ofxInfo.bankId && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Banco: <strong style={{ color: 'var(--text-primary)' }}>{ofxInfo.bankId}</strong></div>}
                {ofxInfo.acctId && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Conta: <strong style={{ color: 'var(--text-primary)' }}>{ofxInfo.acctId}</strong></div>}
                {ofxInfo.dtStart && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Período: <strong style={{ color: 'var(--text-primary)' }}>{fmt.date(ofxInfo.dtStart)} — {fmt.date(ofxInfo.dtEnd || '')}</strong></div>}
              </div>
            )}
          </div>

          {/* Config */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card card-sm">
              <div className="card-title" style={{ marginBottom: 16 }}>2. Configurar Importação</div>
              <div className="form-group">
                <label className="form-label">Portador Destino *</label>
                <select className="form-control" value={portadorId} onChange={e => setPortadorId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="alert alert-info">
                💡 As transações de débito serão lançadas como despesas e crédito como receitas. Você pode alterar a categoria individualmente antes de importar.
              </div>
            </div>

            {transactions.length > 0 && (
              <div className="card card-sm">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div className="card-title">Resumo</div>
                  <span className="badge badge-blue">{transactions.length} transações</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Selecionadas:</span>
                    <strong>{selected.size}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Créditos:</span>
                    <strong style={{ color: 'var(--green)' }}>
                      {fmt.currency(transactions.filter(t => t.type === 'CREDIT' && selected.has(t.id)).reduce((a, t) => a + t.amount, 0))}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Débitos:</span>
                    <strong style={{ color: 'var(--red)' }}>
                      {fmt.currency(transactions.filter(t => t.type === 'DEBIT' && selected.has(t.id)).reduce((a, t) => a + t.amount, 0))}
                    </strong>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
                  onClick={handleImport}
                  disabled={importing || selected.size === 0}
                >
                  {importing ? '⏳ Importando...' : `⬇ Importar ${selected.size} Lançamentos`}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Transactions table */}
        {transactions.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">3. Revisar Transações</div>
                <div className="card-subtitle">Selecione as transações a importar e categorize</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={toggleAll}>
                {selected.size === transactions.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th>Categoria</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} style={{ opacity: selected.has(t.id) ? 1 : 0.5 }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          onChange={e => {
                            const s = new Set(selected);
                            e.target.checked ? s.add(t.id) : s.delete(t.id);
                            setSelected(s);
                          }}
                          style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: 16, height: 16 }}
                        />
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmt.date(t.date)}</td>
                      <td style={{ fontWeight: 500, maxWidth: 250 }}>
                        <div>{t.description}</div>
                        {t.memo && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 'normal' }}>
                            {t.memo}
                          </div>
                        )}
                        {(() => {
                          const matches = store.getPotentialMatches({
                            empresaId,
                            data: t.date,
                            valor: t.amount,
                            tipo: t.type === 'CREDIT' ? 'receita' : 'despesa'
                          });
                          if (matches.length > 0) {
                            return (
                              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(96,0,0,0.06)', color: 'var(--accent)', borderRadius: 4, fontWeight: 600 }}>💡 Conciliação</span>
                                <button 
                                  onClick={() => handleReconcile(t, matches[0].id)}
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: '2px 6px', fontSize: 10, border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer', borderRadius: 4 }}
                                >
                                  🤝 Conciliar: "{matches[0].descricao}"
                                </button>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      <td>
                        <span className={`badge ${t.type === 'CREDIT' ? 'badge-green' : 'badge-red'}`}>
                          {t.type === 'CREDIT' ? '↑ Crédito' : '↓ Débito'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <select
                            className="form-control"
                            style={{ 
                              padding: '4px 8px', 
                              fontSize: 12,
                              border: store.classifyDescription(empresaId, t.description) ? '1.5px solid var(--accent)' : '1px solid var(--border-light)',
                              background: store.classifyDescription(empresaId, t.description) ? 'rgba(96,0,0,0.03)' : 'transparent',
                              fontWeight: store.classifyDescription(empresaId, t.description) ? 600 : 'normal'
                            }}
                            value={catMap[t.id] || ''}
                            onChange={e => setCatMap(m => ({ ...m, [t.id]: e.target.value }))}
                          >
                            <option value="">Auto-categorizar</option>
                            {planoContas.filter(p => p.tipo === (t.type === 'CREDIT' ? 'receita' : 'despesa')).map(p => (
                              <option key={p.id} value={p.id}>{p.codigo} - {p.descricao}</option>
                            ))}
                          </select>
                          {store.classifyDescription(empresaId, t.description) && (
                            <span title="Categoria auto-sugerida pela Inteligência Privilege baseada em seus lançamentos anteriores" style={{ fontSize: 14, cursor: 'help' }}>🧠</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: t.type === 'CREDIT' ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                        {t.type === 'CREDIT' ? '+' : '-'}{fmt.currency(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {transactions.length === 0 && !done && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📂</div>
              <h3>Nenhum arquivo carregado</h3>
              <p>Faça o upload de um arquivo OFX ou carregue o exemplo de demonstração.</p>
            </div>
          </div>
        )}
      </>
    ) : (
      <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="card-title">Gerenciar Regras de Autoclassificação</div>
                <div className="card-subtitle">Termos mapeados para categorias específicas na importação de OFX</div>
              </div>
              <button className="btn btn-primary" onClick={() => setShowRuleModal(true)}>
                ＋ Nova Regra
              </button>
            </div>

            <div className="card-body" style={{ padding: '0 20px 20px 20px' }}>
              <div className="search-bar" style={{ marginBottom: 16, marginTop: 16 }}>
                <span>🔍</span>
                <input 
                  placeholder="Buscar regras por descrição..." 
                  value={rulesSearch} 
                  onChange={e => setRulesSearch(e.target.value)} 
                />
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Descrição Contém (Termo)</th>
                      <th>Categoria Sugerida</th>
                      <th style={{ width: 100, textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules
                      .filter(r => !rulesSearch || r.pattern.toLowerCase().includes(rulesSearch.toLowerCase()))
                      .map(r => {
                        const pc = store.getPlanoContas(empresaId).find(p => p.id === r.categoryId);
                        return (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{r.pattern}</td>
                            <td>
                              {pc ? (
                                <span className={`badge ${pc.tipo === 'receita' ? 'badge-green' : pc.tipo === 'transferencia' ? 'badge-purple' : 'badge-red'}`}>
                                  {pc.codigo} - {pc.descricao}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Categoria não encontrada</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                className="btn btn-danger btn-sm btn-icon" 
                                onClick={() => handleDeleteRule(r.id)}
                                title="Excluir regra"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {rules.length === 0 && (
                      <tr>
                        <td colSpan={3}>
                          <div className="empty-state">
                            <div className="empty-state-icon">🧠</div>
                            <h3>Nenhuma regra configurada</h3>
                            <p>As regras são geradas automaticamente quando você categoriza lançamentos no OFX ou podem ser adicionadas manualmente clicando no botão acima.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {showRuleModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRuleModal(false)}>
          <div className="modal modal-md">
            <div className="modal-header">
              <h2 className="modal-title">Nova Regra de Autoclassificação</h2>
              <button className="modal-close" onClick={() => setShowRuleModal(false)}>✕</button>
            </div>
            
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Termo na Descrição do Extrato *</label>
              <input 
                className="form-control" 
                placeholder="Ex: IFOOD, TELEF, SICREDI, JOSÉ SILVA" 
                value={rulePattern} 
                onChange={e => setRulePattern(e.target.value)} 
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                O sistema fará correspondência parcial desse termo (sem distinção entre maiúsculas/minúsculas).
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label">Categoria de Destino *</label>
              <select
                className="form-control"
                value={ruleCategory}
                onChange={e => setRuleCategory(e.target.value)}
              >
                <option value="">-- Selecione a Categoria --</option>
                {planoContas.map(p => (
                  <option key={p.id} value={p.id}>{p.codigo} - {p.descricao} ({p.tipo === 'receita' ? 'Receita' : p.tipo === 'transferencia' ? 'Transferência' : 'Despesa'})</option>
                ))}
              </select>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowRuleModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveRule}>✓ Criar Regra</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
