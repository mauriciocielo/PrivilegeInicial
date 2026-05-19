'use client';
import { useState, useEffect, useCallback } from 'react';
import { store, Lancamento, PlanoConta, Portador } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

export default function ClienteExtrato() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPortador, setFiltroPortador] = useState('');
  const [search, setSearch] = useState('');
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });

  const load = useCallback((eId: string) => {
    setEmpresaId(eId);
    setLancamentos(store.getLancamentos(eId));
    setPlanoContas(store.getPlanoContas(eId));
    setPortadores(store.getPortadores(eId));
  }, []);

  useEffect(() => {
    const user = store.getCurrentUser();
    const eId = user?.empresaIds?.[0] || sessionStorage.getItem('cf_empresa_sel') || 'e1';
    load(eId);
    const handler = (e: Event) => load((e as CustomEvent).detail);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load]);

  const filtered = lancamentos
    .filter(l => !mes || l.data.startsWith(mes))
    .filter(l => !filtroTipo || l.tipo === filtroTipo)
    .filter(l => !filtroPortador || l.portadorId === filtroPortador)
    .filter(l => !search || l.descricao.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.data.localeCompare(a.data));

  const totRec = filtered.filter(l=>l.tipo==='receita'&&l.status==='realizado').reduce((a,l)=>a+l.valor,0);
  const totDesp = filtered.filter(l=>l.tipo==='despesa'&&l.status==='realizado').reduce((a,l)=>a+l.valor,0);

  const meses: string[] = [];
  const hoje = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Extrato Financeiro</div>
          <div className="page-subtitle">{filtered.length} lançamentos no período</div>
        </div>
      </div>

      <div className="page-body">
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card green">
            <div className="stat-icon green">↑</div>
            <div className="stat-label">Entradas</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(totRec)}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-icon red">↓</div>
            <div className="stat-label">Saídas</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{fmt.currency(totDesp)}</div>
          </div>
          <div className={`stat-card ${totRec-totDesp>=0?'blue':'red'}`}>
            <div className={`stat-icon ${totRec-totDesp>=0?'blue':'red'}`}>≈</div>
            <div className="stat-label">Saldo do Período</div>
            <div className="stat-value" style={{ fontSize: 18, color: totRec-totDesp>=0?'var(--green)':'var(--red)' }}>
              {fmt.currency(totRec-totDesp)}
            </div>
          </div>
        </div>

        <div className="card card-sm" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="search-bar">
              <span>🔍</span>
              <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-control" style={{ width: 'auto' }} value={mes} onChange={e => setMes(e.target.value)}>
              <option value="">Todos os meses</option>
              {meses.map(m => {
                const [y, mo] = m.split('-');
                const d = new Date(Number(y), Number(mo)-1, 1);
                return <option key={m} value={m}>{d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</option>;
              })}
            </select>
            <select className="form-control" style={{ width: 'auto' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="">Todos os tipos</option>
              <option value="receita">Entradas</option>
              <option value="despesa">Saídas</option>
            </select>
            <select className="form-control" style={{ width: 'auto' }} value={filtroPortador} onChange={e => setFiltroPortador(e.target.value)}>
              <option value="">Todos os portadores</option>
              {portadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Portador</th>
                  <th>Status</th>
                  <th style={{ textAlign:'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon">📋</div><h3>Nenhum lançamento encontrado</h3></div></td></tr>
                ) : filtered.map(l => {
                  const pc = planoContas.find(p => p.id === l.planoContaId);
                  const port = portadores.find(p => p.id === l.portadorId);
                  return (
                    <tr key={l.id}>
                      <td style={{ fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{fmt.date(l.data)}</td>
                      <td style={{ fontWeight:500 }}>{l.descricao}</td>
                      <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{pc?.descricao || '-'}</td>
                      <td style={{ fontSize:12 }}>{port?.nome || '-'}</td>
                      <td><span className={`badge ${l.status==='realizado'?'badge-blue':'badge-yellow'}`}>{l.status==='realizado'?'Realizado':'Previsto'}</span></td>
                      <td style={{ textAlign:'right', fontWeight:700, color:l.tipo==='receita'?'var(--green)':'var(--red)', whiteSpace:'nowrap' }}>
                        {l.tipo==='receita'?'+':'-'}{fmt.currency(l.valor)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
