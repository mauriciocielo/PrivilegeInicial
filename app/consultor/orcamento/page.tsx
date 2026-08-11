'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { store, Empresa, OrcamentoMensal, PlanoConta, Lancamento } from '../../../lib/store';
import { uid } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

export default function OrcamentoPage() {
  const [empresaId, setEmpresaId] = useState('e1');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1); // Default to next month for budget
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [lancsHistorico, setLancsHistorico] = useState<Lancamento[]>([]);
  const [mesesMedia, setMesesMedia] = useState(3);
  const [orcamento, setOrcamento] = useState<OrcamentoMensal | null>(null);
  
  const [valores, setValores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [replicarFuturo, setReplicarFuturo] = useState(false);

  const load = useCallback((eId: string, mes: string, qtdMeses: number) => {
    setEmpresaId(eId);
    setEmpresa(store.getEmpresas().find(e => e.id === eId) || null);
    
    const plano = store.getPlanoContas(eId).filter(p => p.nivel === 3 && p.ativo);
    setPlanoContas(plano.sort((a,b) => a.codigo.localeCompare(b.codigo)));

    // Find if budget exists for this month
    const orc = store.getOrcamentos(eId).find(o => o.mes === mes);
    if (orc) {
      setOrcamento(orc);
      setValores(orc.categorias);
    } else {
      setOrcamento(null);
      setValores({});
    }

    // Load historical month logic for averages
    const [y, m] = mes.split('-');
    const baseDate = new Date(Number(y), Number(m)-1, 1);
    
    const dHist = new Date(baseDate); dHist.setMonth(dHist.getMonth() - qtdMeses);
    const mHist = `${dHist.getFullYear()}-${String(dHist.getMonth()+1).padStart(2,'0')}`;
    const allLancs = store.getLancamentos(eId).filter(l => l.status === 'realizado');
    const lHist = allLancs.filter(l => l.data >= mHist && l.data < mes);
    setLancsHistorico(lHist);

  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    load(saved, mesSelecionado, mesesMedia);
    const handler = (e: Event) => load((e as CustomEvent).detail, mesSelecionado, mesesMedia);
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, [load, mesSelecionado, mesesMedia]);

  const calcMedia = (pcId: string) => {
    const sum = lancsHistorico.filter(l => l.planoContaId === pcId).reduce((a, l) => a + l.valor, 0);
    return sum / mesesMedia;
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      let currentMonthStr = mesSelecionado;
      let monthsToSave = replicarFuturo ? 12 : 1;
      
      for (let i = 0; i < monthsToSave; i++) {
        // Find existing for this month
        const existing = store.getOrcamentos(empresaId).find(o => o.mes === currentMonthStr);
        const o: OrcamentoMensal = {
          id: existing?.id || uid(),
          empresaId,
          mes: currentMonthStr,
          categorias: valores,
        };
        store.saveOrcamento(o);
        if (i === 0) setOrcamento(o);

        // increment month
        const [yy, mm] = currentMonthStr.split('-');
        let nY = Number(yy); let nM = Number(mm) + 1;
        if (nM > 12) { nM = 1; nY++; }
        currentMonthStr = `${nY}-${String(nM).padStart(2, '0')}`;
      }
      
      setSaving(false);
      setReplicarFuturo(false);
      alert(replicarFuturo ? 'Orçamento salvo e replicado para os próximos 11 meses!' : 'Orçamento salvo com sucesso!');
    }, 400);
  };

  const setValor = (id: string, val: number) => {
    setValores(v => ({ ...v, [id]: val }));
  };

  const mesesOptions: string[] = [];
  const hoje = new Date();
  for (let i = -1; i <= 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    mesesOptions.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  const recSum = planoContas.filter(p => p.tipo === 'receita').reduce((a, p) => a + (valores[p.id] || 0), 0);
  const despSum = planoContas.filter(p => p.tipo === 'despesa').reduce((a, p) => a + (valores[p.id] || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Orçamento Mensal</div>
          <div className="page-subtitle">{empresa?.razaoSocial} — Planejamento Financeiro baseado no Fluxo de Caixa</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 12 }}>
          <select 
            className="form-control" 
            value={mesSelecionado} 
            onChange={e => setMesSelecionado(e.target.value)}
            style={{ width: 160 }}
          >
            {mesesOptions.map(m => {
              const [y, mo] = m.split('-');
              const d = new Date(Number(y), Number(mo)-1, 1);
              return <option key={m} value={m}>{d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</option>;
            })}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: 'var(--bg-card)', padding: '0 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
            <label style={{ color: 'var(--text-secondary)' }}>Média base: </label>
            <select 
              value={mesesMedia} 
              onChange={e => setMesesMedia(Number(e.target.value))}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              {[1, 2, 3, 4, 6, 12, 24].map(n => (
                <option key={n} value={n}>{n} {n === 1 ? 'mês' : 'meses'}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: 'var(--bg-card)', padding: '0 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
            <input type="checkbox" id="rep" checked={replicarFuturo} onChange={e => setReplicarFuturo(e.target.checked)} />
            <label htmlFor="rep">Replicar para os próximos 11 meses</label>
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Salvando...' : '✓ Salvar Orçamento'}
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card green">
            <div className="stat-icon green">↑</div>
            <div className="stat-label">Receitas (Orçadas)</div>
            <div className="stat-value">{fmt.currency(recSum)}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-icon red">↓</div>
            <div className="stat-label">Despesas (Orçadas)</div>
            <div className="stat-value">{fmt.currency(despSum)}</div>
          </div>
          <div className={`stat-card ${recSum - despSum >= 0 ? 'blue' : 'red'}`}>
            <div className={`stat-icon ${recSum - despSum >= 0 ? 'blue' : 'red'}`}>≈</div>
            <div className="stat-label">Resultado Projetado</div>
            <div className="stat-value" style={{ color: recSum - despSum >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt.currency(recSum - despSum)}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Categorias e Contas Analíticas</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Plano de Contas</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Média ({mesesMedia} {mesesMedia === 1 ? 'Mês' : 'Meses'})</th>
                  <th style={{ width: 200, textAlign: 'right' }}>Valor Orçado (R$)</th>
                </tr>
              </thead>
              <tbody>
                {planoContas.map(pc => {
                  const media = calcMedia(pc.id);
                  return (
                    <tr key={pc.id}>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pc.codigo}</td>
                      <td style={{ fontWeight: 500 }}>{pc.descricao}</td>
                      <td>
                        <span className={`badge ${pc.tipo === 'receita' ? 'badge-blue' : 'badge-red'}`}>
                          {pc.tipo === 'receita' ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        {fmt.currency(media)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input 
                          type="number" 
                          step="0.01" 
                          className="form-control" 
                          style={{ textAlign: 'right', width: '100%' }}
                          value={valores[pc.id] || ''}
                          placeholder="0.00"
                          onChange={e => setValor(pc.id, Number(e.target.value))}
                        />
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
