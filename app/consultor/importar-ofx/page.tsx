'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { parseOFX, generateSampleOFX, OFXTransaction } from '../../../lib/ofx-parser';
import { store, Lancamento, PlanoConta, Portador } from '../../../lib/store';
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
  const [ofxInfo, setOfxInfo] = useState<{ bankId?: string; acctId?: string; dtStart?: string; dtEnd?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    const ports = store.getPortadores(eId).filter(p => p.ativo);
    setPortadores(ports);
    if (ports.length > 0) setPortadorId(ports[0].id);
    setPlanoContas(store.getPlanoContas(eId).filter(p => p.nivel === 3 && p.ativo));
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || 'e1';
    load(saved);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseOFX(text);
      setOfxInfo({ bankId: result.bankId, acctId: result.acctId, dtStart: result.dtStart, dtEnd: result.dtEnd });
      // Filter already imported
      const existing = store.getLancamentos(empresaId);
      const existingIds = new Set(existing.filter(l => l.ofxId).map(l => l.ofxId));
      const newTrns = result.transactions.filter(t => !existingIds.has(t.fitId));
      setTransactions(newTrns);
      setSelected(new Set(newTrns.map(t => t.id)));
      setDone(false);
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
    setTransactions(result.transactions);
    setSelected(new Set(result.transactions.map(t => t.id)));
    setDone(false);
  };

  const toggleAll = () => {
    if (selected.size === transactions.length) setSelected(new Set());
    else setSelected(new Set(transactions.map(t => t.id)));
  };

  const handleImport = async () => {
    if (!portadorId) { alert('Selecione um portador.'); return; }
    const toImport = transactions.filter(t => selected.has(t.id));
    if (toImport.length === 0) { alert('Nenhuma transação selecionada.'); return; }
    setImporting(true);
    await new Promise(r => setTimeout(r, 800));
    toImport.forEach(t => {
      const lanc: Lancamento = {
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
        origem: 'ofx',
        ofxId: t.fitId,
        createdAt: new Date().toISOString(),
      };
      store.saveLancamento(lanc);
    });
    setImporting(false);
    setDone(true);
    setTransactions(prev => prev.filter(t => !selected.has(t.id)));
    setSelected(new Set());
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
        {done && (
          <div className="alert alert-success" style={{ marginBottom: 20 }}>
            ✅ Transações importadas com sucesso! Acesse os lançamentos para verificar.
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
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={loadSample}>
              🧪 Carregar OFX de Exemplo (Demo)
            </button>

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
                      <td style={{ fontWeight: 500, maxWidth: 250 }}>{t.description}</td>
                      <td>
                        <span className={`badge ${t.type === 'CREDIT' ? 'badge-green' : 'badge-red'}`}>
                          {t.type === 'CREDIT' ? '↑ Crédito' : '↓ Débito'}
                        </span>
                      </td>
                      <td>
                        <select
                          className="form-control"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          value={catMap[t.id] || ''}
                          onChange={e => setCatMap(m => ({ ...m, [t.id]: e.target.value }))}
                        >
                          <option value="">Auto-categorizar</option>
                          {planoContas.filter(p => p.tipo === (t.type === 'CREDIT' ? 'receita' : 'despesa')).map(p => (
                            <option key={p.id} value={p.id}>{p.codigo} - {p.descricao}</option>
                          ))}
                        </select>
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
      </div>
    </>
  );
}
