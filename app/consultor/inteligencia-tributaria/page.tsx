'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  tributarioStore, type SpedFile, type DiagnosticoTributario,
  type SimulacaoReforma, type InsightTributario, type ActionItem,
  type RegimeTributario, type ProdutoCadastrado,
} from '../../../lib/tributarioStore';
import { parseSped, processarDiagnostico } from '../../../lib/sped-parser';
import {
  pesquisarNCM, listarSetores, listarTratamentos,
  TRATAMENTO_LABELS, TRATAMENTO_BADGE, TRATAMENTO_COLORS,
  ALIQ_IBS, ALIQ_CBS, type NCMEntry,
} from '../../../lib/ncm-database';
import { store, type Empresa } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

type Tab = 'parsing' | 'produtos' | 'depara' | 'diagnostico' | 'simulacao' | 'insights' | 'action' | 'consulta_ncm';

const REGIMES: { value: RegimeTributario; label: string }[] = [
  { value: 'lucro_real', label: 'Lucro Real' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'simples_nacional', label: 'Simples Nacional' },
];

const PIE_COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

// ─── NCM Consulta Card ────────────────────────────────────────
function NCMCard({ entry }: { entry: NCMEntry }) {
  const [open, setOpen] = useState(false);
  const badge = TRATAMENTO_BADGE[entry.tratamento];
  const color = TRATAMENTO_COLORS[entry.tratamento];
  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
        border: `1px solid var(--border-light)`,
        background: 'var(--bg-card2)',
        transition: 'all 0.18s',
        outline: open ? `2px solid ${color}` : 'none',
      }}
      className="ncm-card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>{entry.ncm}</span>
          <span className={`badge ${badge}`} style={{ fontSize: 9, textTransform: 'uppercase' }}>
            {TRATAMENTO_LABELS[entry.tratamento]}
          </span>
          {entry.cashback && <span className="badge badge-green" style={{ fontSize: 9 }}>Cashback</span>}
          {entry.monofasico && <span className="badge badge-yellow" style={{ fontSize: 9 }}>Monofásico</span>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color }}>
          {(entry.aliqTotal * 100).toFixed(1)}%
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{entry.descricao}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{entry.categoria} · {entry.setor}</div>

      {open && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border-light)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[
              { label: 'IBS', val: `${(entry.aliqIBS * 100).toFixed(2)}%`, c: 'var(--blue)' },
              { label: 'CBS', val: `${(entry.aliqCBS * 100).toFixed(2)}%`, c: 'var(--blue)' },
              { label: 'IS', val: entry.aliqIS > 0 ? `${(entry.aliqIS * 100).toFixed(0)}%` : '—', c: 'var(--red)' },
              { label: 'Redução', val: entry.reducaoAliq > 0 ? `${(entry.reducaoAliq * 100).toFixed(0)}%` : '—', c: 'var(--green)' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-card)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{k.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: k.c }}>{k.val}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            📖 <strong>{entry.artigo}</strong> — {entry.baseLegal}
          </div>
          {entry.observacao && (
            <div style={{ fontSize: 11, color: 'var(--orange)', background: 'rgba(245,158,11,0.08)', borderRadius: 6, padding: '4px 8px' }}>
              ⚠️ {entry.observacao}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Produto Row ──────────────────────────────────────────────
function ProdutoRow({ p }: { p: ProdutoCadastrado }) {
  const badge = TRATAMENTO_BADGE[p.tratamento as keyof typeof TRATAMENTO_BADGE] || 'badge-gray';
  const aliqTotal = p.aliqIBS + p.aliqCBS + p.aliqIS;
  return (
    <tr style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.1s' }} className="table-row-hover">
      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{p.codItem}</td>
      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11 }}>{p.ncm || <span style={{ color: 'var(--red)' }}>AUSENTE</span>}</td>
      <td style={{ padding: '8px 10px', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.descricao}>{p.descricao}</td>
      <td style={{ padding: '8px 10px', fontSize: 11 }}>{p.unidade}</td>
      <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)' }}>{p.aliqIcmsCadastro > 0 ? `${p.aliqIcmsCadastro}%` : '—'}</td>
      <td style={{ padding: '8px 10px' }}>
        <span style={{ fontSize: 11 }}>{p.categoria}</span><br/>
        <span className={`badge ${badge}`} style={{ fontSize: 9, marginTop: 2 }}>
          {TRATAMENTO_LABELS[p.tratamento as keyof typeof TRATAMENTO_LABELS] || p.tratamento}
        </span>
      </td>
      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: aliqTotal === 0 ? 'var(--green)' : aliqTotal < 0.1 ? 'var(--blue)' : p.aliqIS > 0 ? 'var(--red)' : 'var(--text-primary)' }}>
        {`${(aliqTotal * 100).toFixed(2)}%`}
      </td>
      {p.aliqIS > 0 && (
        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--red)', fontWeight: 700, fontSize: 11 }}>
          IS {(p.aliqIS * 100).toFixed(0)}%
        </td>
      )}
      {!p.ncm && (
        <td style={{ padding: '8px 10px' }}>
          <span className="badge badge-red" style={{ fontSize: 9 }}>⚠ NCM OBRIGATÓRIO</span>
        </td>
      )}
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function InteligenciaTributariaPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [files, setFiles] = useState<SpedFile[]>([]);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoTributario | null>(null);
  const [simulacao, setSimulacao] = useState<SimulacaoReforma | null>(null);
  const [insights, setInsights] = useState<InsightTributario[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [produtos, setProdutos] = useState<ProdutoCadastrado[]>([]);
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState<Tab>('parsing');
  const [regime, setRegime] = useState<RegimeTributario>('lucro_real');

  // Consulta NCM
  const [ncmQuery, setNcmQuery] = useState('');
  const [ncmSetor, setNcmSetor] = useState('');
  const [ncmTratamento, setNcmTratamento] = useState('');
  const ncmDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ncmResults, setNcmResults] = useState<NCMEntry[]>(() => pesquisarNCM(''));

  // Produtos search
  const [prodSearch, setProdSearch] = useState('');
  const [prodTratamento, setProdTratamento] = useState('');

  // De/Para search
  const [deParaSearch, setDeParaSearch] = useState('');

  const loadData = useCallback((eId: string) => {
    setEmpresaId(eId);
    setFiles(tributarioStore.getFiles(eId));
    setDiagnostico(tributarioStore.getDiagnostico(eId));
    setSimulacao(tributarioStore.getSimulacao(eId));
    setInsights(tributarioStore.getInsights(eId));
    setActionItems(tributarioStore.getActionItems(eId));
    setProdutos(tributarioStore.getProdutos(eId));
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || store.getEmpresas()[0]?.id;
    if (saved) loadData(saved);
    const h = (e: Event) => loadData((e as CustomEvent).detail);
    const dataChangeHandler = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || store.getEmpresas()[0]?.id;
      if (current) loadData(current);
    };
    window.addEventListener('empresaChange', h);
    window.addEventListener('cfDataChange', dataChangeHandler);
    return () => {
      window.removeEventListener('empresaChange', h);
      window.removeEventListener('cfDataChange', dataChangeHandler);
    };
  }, [loadData]);

  // NCM debounce search
  useEffect(() => {
    if (ncmDebounce.current) clearTimeout(ncmDebounce.current);
    ncmDebounce.current = setTimeout(() => {
      let res = pesquisarNCM(ncmQuery);
      if (ncmSetor) res = res.filter(e => e.setor === ncmSetor);
      if (ncmTratamento) res = res.filter(e => e.tratamento === ncmTratamento);
      setNcmResults(res);
    }, 250);
  }, [ncmQuery, ncmSetor, ncmTratamento]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!empresaId) { alert('Selecione uma empresa antes.'); return; }
    setProcessing(true);
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      const fileData: SpedFile = {
        id: `sped_${Date.now()}`, empresaId, fileName: file.name,
        fileSize: file.size, uploadDate: new Date().toISOString(),
        status: 'enviado', content,
      };
      tributarioStore.addFile(fileData);
      try {
        fileData.status = 'processando';
        tributarioStore.updateFile(fileData);
        loadData(empresaId);
        const parsed = parseSped(content);
        fileData.fonte = parsed.fonte;
        const result = processarDiagnostico(parsed, empresaId, regime);
        tributarioStore.saveDiagnostico(empresaId, result.diagnostico);
        tributarioStore.saveSimulacao(empresaId, result.simulacao);
        tributarioStore.saveInsights(empresaId, result.insights);
        tributarioStore.saveActionItems(empresaId, result.actionItems);
        tributarioStore.saveProdutos(empresaId, result.produtos);
        fileData.status = 'concluido';
        tributarioStore.updateFile(fileData);
        loadData(empresaId);
        setTab('parsing');
      } catch (err) {
        fileData.status = 'erro';
        tributarioStore.updateFile(fileData);
        loadData(empresaId);
        alert(`Erro: ${(err as Error).message}`);
      } finally { setProcessing(false); }
    };
    reader.readAsText(file, 'latin1');
  }, [empresaId, loadData, regime]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/plain': ['.txt'] }, multiple: false,
  });

  const hasData = !!(diagnostico && simulacao);

  // Memos
  const filteredProdutos = useMemo(() => {
    let list = produtos;
    if (prodSearch) { const q = prodSearch.toLowerCase(); list = list.filter(p => p.codItem.toLowerCase().includes(q) || p.descricao.toLowerCase().includes(q) || p.ncm.includes(q) || p.categoria.toLowerCase().includes(q)); }
    if (prodTratamento) list = list.filter(p => p.tratamento === prodTratamento);
    return list;
  }, [produtos, prodSearch, prodTratamento]);

  const filteredDePara = useMemo(() => {
    if (!simulacao) return [];
    if (!deParaSearch) return simulacao.itens;
    const q = deParaSearch.toLowerCase();
    return simulacao.itens.filter(i => i.ncm.includes(q) || i.descricao.toLowerCase().includes(q) || i.cfop.includes(q) || i.ncmCategoria.toLowerCase().includes(q));
  }, [simulacao, deParaSearch]);

  const categoriaData = useMemo(() => {
    if (!diagnostico) return [];
    return Object.entries(diagnostico.itensPorCategoria).sort(([,a],[,b]) => b-a).slice(0,8).map(([name,value]) => ({ name, value }));
  }, [diagnostico]);

  const pieData = useMemo(() => {
    if (!simulacao) return [];
    const map: Record<string,number> = {};
    simulacao.itens.forEach(i => { map[i.ncmCategoria] = (map[i.ncmCategoria]||0) + i.impostoDevidoReforma; });
    return Object.entries(map).sort(([,a],[,b]) => b-a).slice(0,6).map(([name,value]) => ({ name, value }));
  }, [simulacao]);

  const setores = useMemo(() => listarSetores(), []);
  const tratamentos = useMemo(() => listarTratamentos(), []);

  // Render tabs config
  const tabs: { key: Tab; icon: string; label: string; badge?: number }[] = [
    { key: 'parsing', icon: '📂', label: 'ETL / Parsing' },
    { key: 'produtos', icon: '🏷️', label: 'Produtos', badge: produtos.length || undefined },
    { key: 'depara', icon: '🔄', label: 'De/Para' },
    { key: 'diagnostico', icon: '📊', label: 'Diagnóstico' },
    { key: 'simulacao', icon: '⚖️', label: 'Simulação' },
    { key: 'insights', icon: '💡', label: 'Insights', badge: insights.filter(i=>i.prioridade===1).length||undefined },
    { key: 'action', icon: '🎯', label: 'Ações', badge: actionItems.length||undefined },
    { key: 'consulta_ncm', icon: '🔍', label: 'Consulta NCM' },
  ];

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">⚖️ Inteligência Tributária</div>
          <div className="page-subtitle">Motor de Análise da Reforma Tributária · EC 132/2023 · LC 214/2025 · LC 227/2026</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>REGIME:</label>
          <select className="form-control" value={regime} onChange={e => setRegime(e.target.value as RegimeTributario)} style={{ fontSize: 12, padding: '5px 10px', width: 180 }}>
            {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 18 }}>

          {/* ── Left: Upload + Files + KPIs ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📥 Upload SPED</h3>
              <div {...getRootProps()} style={{ border: `2px dashed ${isDragActive ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8, padding: '20px 12px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? 'rgba(140,26,34,0.06)' : 'var(--bg-card2)', transition: 'all 0.2s' }}>
                <input {...getInputProps()} />
                {processing ? (
                  <div><div className="spinner-sm" style={{ margin: '0 auto 8px' }} /><p style={{ fontSize: 11 }}>Processando...</p></div>
                ) : (
                  <>
                    <div style={{ fontSize: 26, marginBottom: 6 }}>🗂️</div>
                    <p style={{ fontSize: 11, fontWeight: 600 }}>EFD Contribuições / ICMS IPI</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Arraste ou clique (.txt)</p>
                  </>
                )}
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>📋 Arquivos</h3>
              {files.length === 0 ? <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nenhum arquivo.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {files.map(f => (
                    <div key={f.id} style={{ padding: '7px 10px', borderRadius: 7, background: 'var(--bg-card2)', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{new Date(f.uploadDate).toLocaleDateString('pt-BR')}</span>
                        <span className={`badge badge-${f.status==='concluido'?'green':f.status==='processando'?'blue':f.status==='erro'?'red':'gray'}`} style={{ fontSize: 8 }}>{f.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {hasData && (
              <div className="card">
                <h3 style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Resumo</h3>
                {[
                  { l: 'Receita', v: fmt.currency(diagnostico!.receitaTotal), c: 'var(--green)' },
                  { l: 'Carga Atual', v: `${(diagnostico!.cargaTributariaEfetiva*100).toFixed(1)}%`, c: 'var(--text-primary)' },
                  { l: 'Carga Reforma', v: `${(simulacao!.cargaTributariaEfetiva*100).toFixed(1)}%`, c: simulacao!.cargaTributariaEfetiva > diagnostico!.cargaTributariaEfetiva ? 'var(--red)' : 'var(--green)' },
                  { l: 'IS total', v: fmt.currency(simulacao!.impostoSeletivo), c: simulacao!.impostoSeletivo>0?'var(--red)':'var(--text-muted)' },
                  { l: 'Produtos', v: `${produtos.length}`, c: 'var(--blue)' },
                  { l: 'Anomalias', v: `${simulacao!.anomalias.length}`, c: simulacao!.anomalias.length>0?'var(--red)':'var(--green)' },
                ].map(k => (
                  <div key={k.l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{k.l}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: k.c }}>{k.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Tabs ── */}
          <div className="card" style={{ display:'flex', flexDirection:'column', minHeight: 580 }}>
            <div className="tabs" style={{ flexShrink:0, flexWrap:'wrap', gap:2 }}>
              {tabs.map(t => (
                <button key={t.key} className={`tab ${tab===t.key?'active':''}`} onClick={() => setTab(t.key)} style={{ position:'relative', fontSize: 12 }}>
                  {t.icon} {t.label}
                  {t.badge! > 0 && <span style={{ position:'absolute', top:2, right:2, background:'var(--red)', color:'#fff', fontSize:8, fontWeight:700, borderRadius:20, padding:'1px 4px' }}>{t.badge}</span>}
                </button>
              ))}
            </div>

            <div style={{ flex:1, overflow:'auto', padding: '18px 0' }}>

              {/* ══ ETL / PARSING ══ */}
              {tab==='parsing' && (
                !hasData ? <div className="card-placeholder">Faça upload de um SPED EFD (.txt) para iniciar o pipeline ETL.</div> : (
                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    <div style={{ background:'var(--bg-sidebar)', borderRadius:10, border:'1px solid var(--border)', padding:16, fontFamily:'monospace', fontSize:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                        <span style={{ fontWeight:700, color:'var(--green)', fontSize:13 }}>✓ {diagnostico!.parseLog.fonte}</span>
                        <span className={`badge badge-${diagnostico!.parseLog.integridade==='ok'?'green':diagnostico!.parseLog.integridade==='parcial'?'yellow':'red'}`}>
                          {diagnostico!.parseLog.integridade.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12 }}>
                        {[['Linhas', diagnostico!.parseLog.totalLinhas.toLocaleString()],['Itens C170', diagnostico!.parseLog.totalItens.toLocaleString()],['Anomalias Leitura', diagnostico!.parseLog.anomaliasEncontradas.toString()]].map(([l,v]) => (
                          <div key={l} style={{ background:'var(--bg-card)', borderRadius:7, padding:'8px 10px' }}>
                            <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:2 }}>{l}</div>
                            <div style={{ fontSize:16, fontWeight:700 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:6 }}>BLOCOS: <span style={{ color:'var(--accent-light)' }}>{diagnostico!.parseLog.blocosEncontrados.join(' · ')}</span></div>
                      <div style={{ maxHeight:160, overflowY:'auto', borderTop:'1px solid var(--border)', paddingTop:8 }}>
                        {diagnostico!.parseLog.mensagens.map((m,i) => (
                          <div key={i} style={{ color: m.startsWith('⚠')?'var(--orange)':'var(--text-secondary)', marginBottom:2, fontSize:11 }}>{'> '}{m}</div>
                        ))}
                      </div>
                    </div>
                    {categoriaData.length > 0 && (
                      <div>
                        <h4 style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Faturamento por Categoria NCM</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={categoriaData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis type="number" tickFormatter={v => fmt.currency(v as number)} style={{ fontSize:10 }} />
                            <YAxis type="category" dataKey="name" width={160} style={{ fontSize:10 }} />
                            <Tooltip formatter={v => fmt.currency(v as number)} />
                            <Bar dataKey="value" fill="var(--primary)" radius={[0,4,4,0]} name="Valor" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* ══ PRODUTOS (Bloco 0200) ══ */}
              {tab==='produtos' && (
                produtos.length === 0 ? <div className="card-placeholder">Nenhum produto do Bloco 0200 encontrado. Processe um SPED.</div> : (
                  <div>
                    <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                      <input className="form-control" placeholder="🔍 Código, descrição, NCM, categoria..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} style={{ flex:1, minWidth:180, fontSize:13 }} />
                      <select className="form-control" value={prodTratamento} onChange={e => setProdTratamento(e.target.value)} style={{ fontSize:12, width:180 }}>
                        <option value="">Todos os tratamentos</option>
                        {tratamentos.map(t => <option key={t} value={t}>{TRATAMENTO_LABELS[t]}</option>)}
                      </select>
                      <span style={{ fontSize:12, color:'var(--text-muted)', alignSelf:'center', whiteSpace:'nowrap' }}>{filteredProdutos.length} produtos</span>
                    </div>

                    {/* KPI strip */}
                    <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                      {[
                        { label:'Total', val: produtos.length, color:'var(--text-primary)' },
                        { label:'Isentos (100%)', val: produtos.filter(p=>p.tratamento==='isencao_plena').length, color:'var(--green)' },
                        { label:'Redução 60%', val: produtos.filter(p=>p.tratamento==='reducao_60').length, color:'var(--blue)' },
                        { label:'Com IS', val: produtos.filter(p=>p.aliqIS>0).length, color:'var(--red)' },
                        { label:'Sem NCM ⚠', val: produtos.filter(p=>!p.ncm||p.ncm==='00000000').length, color:'var(--orange)' },
                      ].map(k => (
                        <div key={k.label} style={{ padding:'8px 12px', borderRadius:8, background:'var(--bg-card2)', border:'1px solid var(--border-light)', textAlign:'center', minWidth:80 }}>
                          <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>{k.label}</div>
                          <div style={{ fontSize:18, fontWeight:700, color:k.color }}>{k.val}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ overflowX:'auto' }}>
                      <table style={{ fontSize:12, width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ background:'var(--bg-card2)' }}>
                            {['Código','NCM','Descrição','Un.','ICMS Cad.','Categoria / Tratamento Reforma','Alíq. Total'].map(h => (
                              <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, borderBottom:'1px solid var(--border)', whiteSpace:'nowrap', color:'var(--text-muted)', fontSize:10, textTransform:'uppercase' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProdutos.map(p => <ProdutoRow key={p.codItem} p={p} />)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}

              {/* ══ DE/PARA POR ITEM ══ */}
              {tab==='depara' && (
                !hasData ? <div className="card-placeholder">Execute o parsing para ver a análise De/Para.</div> : (
                  <div>
                    <div style={{ display:'flex', gap:10, marginBottom:14, alignItems:'center' }}>
                      <input className="form-control" placeholder="🔍 NCM, descrição, CFOP, categoria..." value={deParaSearch} onChange={e => setDeParaSearch(e.target.value)} style={{ flex:1, fontSize:13 }} />
                      <span style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{filteredDePara.length} saídas</span>
                    </div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ fontSize:11, width:'100%', borderCollapse:'collapse', minWidth:900 }}>
                        <thead>
                          <tr style={{ background:'var(--bg-card2)', position:'sticky', top:0 }}>
                            {['NCM','Categoria','CFOP','Valor Op.','Tribut.Atual','IBS ef.','CBS ef.','IS','Crédito','Imp.Reforma','Δ','Base Legal'].map(h => (
                              <th key={h} style={{ padding:'8px 10px', textAlign: h==='NCM'||h==='Categoria'||h==='CFOP'||h==='Base Legal'?'left':'right', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap', color:'var(--text-muted)', fontSize:9, textTransform:'uppercase', fontWeight:700 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDePara.map(item => (
                            <tr key={item.id} style={{ borderBottom:'1px solid var(--border-light)' }}>
                              <td style={{ padding:'7px 10px', fontFamily:'monospace', fontWeight:700 }}>{item.ncm}</td>
                              <td style={{ padding:'7px 10px', fontSize:10 }}>
                                {item.ncmCategoria}
                                {item.reducaoAliq===1&&<span className="badge badge-green" style={{ fontSize:8,marginLeft:4 }}>ISENTO</span>}
                                {item.reducaoAliq===0.6&&<span className="badge badge-blue" style={{ fontSize:8,marginLeft:4 }}>-60%</span>}
                                {item.aliqIS>0&&<span className="badge badge-red" style={{ fontSize:8,marginLeft:4 }}>IS</span>}
                              </td>
                              <td style={{ padding:'7px 10px', fontFamily:'monospace' }}>{item.cfop}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right' }}>{fmt.currency(item.valorOperacao)}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right', color:'var(--text-secondary)' }}>{fmt.currency(item.tributosAtuais)}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right' }}>{pct(item.aliqIBS)}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right' }}>{pct(item.aliqCBS)}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right', color:item.aliqIS>0?'var(--red)':'var(--text-muted)' }}>{item.aliqIS>0?pct(item.aliqIS):'—'}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right', color:'var(--green)' }}>{fmt.currency(item.creditoIBSCBS)}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:700, color:'var(--accent)' }}>{fmt.currency(item.impostoDevidoReforma)}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:700, color:item.variacaoValor>0?'var(--red)':'var(--green)' }}>
                                {item.variacaoValor>0?'+':''}{fmt.currency(item.variacaoValor)}
                              </td>
                              <td style={{ padding:'7px 10px', fontSize:9, color:'var(--text-muted)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.baseLegal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Anomalias */}
                    {simulacao && simulacao.anomalias.length > 0 && (
                      <div style={{ marginTop:20 }}>
                        <h4 style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>⚠️ Anomalias CST/NCM ({simulacao.anomalias.length})</h4>
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          {simulacao.anomalias.map(a => (
                            <div key={a.id} style={{ padding:'10px 12px', borderRadius:8, border:`1px solid ${a.severidade==='alta'?'rgba(239,68,68,0.3)':'var(--border-light)'}`, background:a.severidade==='alta'?'rgba(239,68,68,0.05)':'var(--bg-card2)' }}>
                              <div style={{ display:'flex', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                                <span className={`badge badge-${a.severidade==='alta'?'red':a.severidade==='media'?'yellow':'gray'}`} style={{ fontSize:9 }}>{a.severidade}</span>
                                {a.ncm&&<span style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-muted)' }}>NCM {a.ncm}</span>}
                                {a.cst&&<span style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-muted)' }}>CST {a.cst}</span>}
                              </div>
                              <div style={{ fontSize:12, fontWeight:600 }}>{a.descricao}</div>
                              <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>🔧 {a.orientacao}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* ══ DIAGNÓSTICO ══ */}
              {tab==='diagnostico' && (
                !diagnostico ? <div className="card-placeholder">Faça upload de um SPED.</div> : (
                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    <div className="stat-grid">
                      {[
                        { label:'Fonte', val: diagnostico.fonte, val_color: undefined },
                        { label:'Período', val: diagnostico.periodo||'N/A', val_color: undefined },
                        { label:'Receita Total', val: fmt.currency(diagnostico.receitaTotal), val_color: 'var(--green)' },
                        { label:'Tributos Apurados', val: fmt.currency(diagnostico.tributosApurados), val_color: 'var(--red)' },
                        { label:'Carga Efetiva', val: `${(diagnostico.cargaTributariaEfetiva*100).toFixed(2)}%`, val_color: 'var(--accent)' },
                        { label:'Créditos Aproveitados', val: fmt.currency(diagnostico.creditosAproveitados), val_color: 'var(--green)' },
                        { label:'Créditos Represados', val: fmt.currency(diagnostico.creditosNaoAproveitados), val_color: 'var(--orange)' },
                      ].map(k => (
                        <div key={k.label} className="stat-card">
                          <div className="stat-label">{k.label}</div>
                          <div className="stat-value" style={{ color: k.val_color, fontSize: k.label==='Fonte'?13:undefined }}>{k.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {/* ══ SIMULAÇÃO ══ */}
              {tab==='simulacao' && (
                !simulacao ? <div className="card-placeholder">Execute um diagnóstico.</div> : (
                  <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
                    <div style={{ padding:'10px 14px', background:'rgba(140,26,34,0.07)', borderRadius:8, border:'1px solid rgba(140,26,34,0.2)', display:'flex', gap:16, flexWrap:'wrap', fontSize:12 }}>
                      <span>📌 <strong>LC 214/2025</strong> — Alíquotas de Referência:</span>
                      <span>IBS = <strong>{(ALIQ_IBS*100).toFixed(1)}%</strong></span>
                      <span>CBS = <strong>{(ALIQ_CBS*100).toFixed(1)}%</strong></span>
                      <span>Total = <strong>{((ALIQ_IBS+ALIQ_CBS)*100).toFixed(1)}%</strong></span>
                    </div>
                    <div className="stat-grid">
                      <div className="stat-card"><div className="stat-label">Débito IBS+CBS</div><div className="stat-value">{fmt.currency(simulacao.debitoTotal)}</div></div>
                      <div className="stat-card green"><div className="stat-label">Crédito Financeiro</div><div className="stat-value">{fmt.currency(simulacao.creditoTotal)}</div></div>
                      <div className="stat-card"><div className="stat-label">Imposto Devido</div><div className="stat-value" style={{ color:'var(--accent)' }}>{fmt.currency(simulacao.impostoDevido)}</div></div>
                      <div className="stat-card" style={{ border:simulacao.impostoSeletivo>0?'1px solid rgba(239,68,68,0.4)':undefined }}>
                        <div className="stat-label">Imposto Seletivo</div>
                        <div className="stat-value" style={{ color:simulacao.impostoSeletivo>0?'var(--red)':'var(--text-muted)' }}>{fmt.currency(simulacao.impostoSeletivo)}</div>
                      </div>
                      <div className="stat-card red"><div className="stat-label">Total Reforma</div><div className="stat-value">{fmt.currency(simulacao.totalReforma)}</div></div>
                      <div className={`stat-card ${simulacao.cargaTributariaEfetiva>(diagnostico?.cargaTributariaEfetiva||0)?'red':'green'}`}>
                        <div className="stat-label">Δ Carga</div>
                        <div className="stat-value">{((simulacao.cargaTributariaEfetiva-(diagnostico?.cargaTributariaEfetiva||0))*100>0?'+':'')}{((simulacao.cargaTributariaEfetiva-(diagnostico?.cargaTributariaEfetiva||0))*100).toFixed(2)} p.p.</div>
                      </div>
                    </div>
                    {pieData.length > 0 && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                        <div>
                          <h4 style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Imposto Reforma por Categoria</h4>
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} label={({ name, percent }) => `${name} ${((percent??0)*100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                              </Pie>
                              <Tooltip formatter={v => fmt.currency(v as number)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div>
                          <h4 style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Carga % Atual vs Reforma</h4>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={[
                              { name:'Atual', v: +(diagnostico?.cargaTributariaEfetiva||0)*100 },
                              { name:'Reforma', v: +simulacao.cargaTributariaEfetiva*100 },
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                              <XAxis dataKey="name" style={{ fontSize:11 }} />
                              <YAxis tickFormatter={v=>`${v}%`} style={{ fontSize:11 }} />
                              <Tooltip formatter={v=>`${(v as number).toFixed(2)}%`} />
                              <Bar dataKey="v" fill="var(--primary)" radius={[4,4,0,0]} name="Carga">
                                {[{ fill:'#64748b' },{ fill:'var(--primary)' }].map((c,i) => <Cell key={i} fill={c.fill} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* ══ INSIGHTS ══ */}
              {tab==='insights' && (
                insights.length===0 ? <div className="card-placeholder">Processe um SPED para gerar insights.</div> : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {insights.map(ins => {
                      const cfg: Record<string,{bg:string;border:string;icon:string}> = {
                        alerta:{bg:'rgba(245,158,11,0.05)',border:'rgba(245,158,11,0.3)',icon:'⚠️'},
                        oportunidade:{bg:'rgba(16,185,129,0.05)',border:'rgba(16,185,129,0.3)',icon:'💡'},
                        risco:{bg:'rgba(239,68,68,0.05)',border:'rgba(239,68,68,0.3)',icon:'🔥'},
                        estrategia:{bg:'rgba(59,130,246,0.05)',border:'rgba(59,130,246,0.3)',icon:'🎯'},
                      };
                      const c = cfg[ins.tipo]||cfg.estrategia;
                      return (
                        <div key={ins.id} style={{ padding:'12px 14px', borderRadius:10, border:`1px solid ${c.border}`, background:c.bg }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                              <span style={{ fontSize:18 }}>{c.icon}</span>
                              <span style={{ fontSize:13, fontWeight:700 }}>{ins.titulo}</span>
                              <span className={`badge badge-${ins.prioridade===1?'red':ins.prioridade===2?'yellow':'gray'}`} style={{ fontSize:9 }}>P{ins.prioridade}</span>
                            </div>
                            {ins.impactoEstimado&&<span style={{ fontSize:13,fontWeight:700,color:ins.tipo==='oportunidade'?'var(--green)':'var(--red)',whiteSpace:'nowrap' }}>{fmt.currency(ins.impactoEstimado)}</span>}
                          </div>
                          <p style={{ fontSize:13, lineHeight:1.7, margin:0 }}>{ins.texto}</p>
                          {ins.baseLegal&&<p style={{ fontSize:10, color:'var(--text-muted)', margin:'6px 0 0' }}>📖 {ins.baseLegal}</p>}
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* ══ AÇÕES ══ */}
              {tab==='action' && (
                actionItems.length===0 ? <div className="card-placeholder">Processe um SPED para gerar action items.</div> : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ padding:'10px 14px', background:'var(--bg-card2)', borderRadius:8, fontSize:12, color:'var(--text-secondary)', border:'1px solid var(--border-light)' }}>
                      ✅ Ajustes necessários no ERP para compliance com a Reforma. Base: LC 214/2025 e LC 227/2026.
                    </div>
                    {actionItems.map(act => {
                      const pc: Record<string,{border:string;badge:string}> = { critica:{border:'rgba(239,68,68,0.4)',badge:'badge-red'}, alta:{border:'rgba(245,158,11,0.4)',badge:'badge-yellow'}, media:{border:'var(--border)',badge:'badge-gray'} };
                      const s = pc[act.prioridade];
                      const icons: Record<string,string> = { cadastro_erp:'🖥️', ncm:'🏷️', fornecedor:'🤝', regime:'📋', credito:'💳', split_payment:'🏦' };
                      return (
                        <div key={act.id} style={{ padding:'12px 14px', borderRadius:10, border:`1px solid ${s.border}`, background:'var(--bg-card2)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6, flexWrap:'wrap', gap:6 }}>
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                              <span style={{ fontSize:16 }}>{icons[act.area]||'📌'}</span>
                              <span style={{ fontSize:13, fontWeight:700 }}>{act.titulo}</span>
                            </div>
                            <div style={{ display:'flex', gap:6 }}>
                              <span className={`badge ${s.badge}`} style={{ fontSize:9, textTransform:'uppercase' }}>{act.prioridade}</span>
                              <span className="badge badge-gray" style={{ fontSize:9 }}>{act.area.replace('_',' ')}</span>
                            </div>
                          </div>
                          <p style={{ fontSize:13, lineHeight:1.7, margin:'0 0 6px' }}>{act.descricao}</p>
                          <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                            {act.prazo&&<span style={{ fontSize:11, color:'var(--text-muted)' }}>⏱️ {act.prazo}</span>}
                            {act.baseLegal&&<span style={{ fontSize:11, color:'var(--text-muted)' }}>📖 {act.baseLegal}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* ══ CONSULTA NCM ══ */}
              {tab==='consulta_ncm' && (
                <div>
                  <div style={{ marginBottom:14 }}>
                    <h3 style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>🔍 Banco de Dados Tributário — Reforma</h3>
                    <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>Consulte qualquer NCM sem precisar de SPED. {pesquisarNCM('').length} entradas mapeadas pela LC 214/2025.</p>
                  </div>

                  {/* Barra de busca animada */}
                  <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                    <div style={{ flex:1, position:'relative', minWidth:220 }}>
                      <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:14, pointerEvents:'none' }}>🔍</span>
                      <input
                        className="form-control"
                        placeholder="NCM, produto, categoria, setor, artigo..."
                        value={ncmQuery}
                        onChange={e => setNcmQuery(e.target.value)}
                        style={{ paddingLeft:34, fontSize:13 }}
                        autoFocus
                      />
                      {ncmQuery && (
                        <button onClick={() => setNcmQuery('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:14 }}>✕</button>
                      )}
                    </div>
                    <select className="form-control" value={ncmSetor} onChange={e => setNcmSetor(e.target.value)} style={{ fontSize:12, width:160 }}>
                      <option value="">Todos os setores</option>
                      {setores.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="form-control" value={ncmTratamento} onChange={e => setNcmTratamento(e.target.value)} style={{ fontSize:12, width:180 }}>
                      <option value="">Todos os tratamentos</option>
                      {tratamentos.map(t => <option key={t} value={t}>{TRATAMENTO_LABELS[t]}</option>)}
                    </select>
                    <span style={{ fontSize:12, color:'var(--text-muted)', alignSelf:'center', whiteSpace:'nowrap' }}>{ncmResults.length} resultados</span>
                  </div>

                  {/* Estatísticas rápidas por tratamento */}
                  {!ncmQuery && !ncmSetor && !ncmTratamento && (
                    <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
                      {tratamentos.map(t => {
                        const count = pesquisarNCM('').filter(e => e.tratamento===t).length;
                        return (
                          <div key={t} onClick={() => setNcmTratamento(t)} style={{ padding:'7px 12px', borderRadius:8, background:'var(--bg-card2)', border:'1px solid var(--border-light)', cursor:'pointer', textAlign:'center', minWidth:110, transition:'all 0.15s' }} className="ncm-filter-chip">
                            <div style={{ fontSize:9, color:'var(--text-muted)', marginBottom:2 }}>{TRATAMENTO_LABELS[t]}</div>
                            <div style={{ fontSize:16, fontWeight:700, color: TRATAMENTO_COLORS[t] }}>{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Resultados em cards */}
                  {ncmResults.length === 0 ? (
                    <div className="card-placeholder">Nenhum NCM encontrado para "{ncmQuery}".</div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:500, overflowY:'auto', paddingRight:4 }}>
                      {ncmResults.map(e => <NCMCard key={`${e.ncm}_${e.descricao}`} entry={e} />)}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .card-placeholder { text-align:center; padding:50px 20px; color:var(--text-muted); font-size:14px; border:1px dashed var(--border-light); border-radius:var(--radius); background:var(--bg-card2); line-height:1.7; }
        .spinner-sm { width:22px; height:22px; border:2px solid rgba(140,26,34,0.2); border-radius:50%; border-top-color:var(--primary); animation:spin 0.8s cubic-bezier(.5,0,.5,1) infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .ncm-card:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,0.15); }
        .ncm-filter-chip:hover { transform:translateY(-1px); box-shadow:0 3px 8px rgba(0,0,0,0.12); border-color:var(--primary); }
        .table-row-hover:hover { background:var(--bg-card2) !important; }
      `}</style>
    </>
  );
}