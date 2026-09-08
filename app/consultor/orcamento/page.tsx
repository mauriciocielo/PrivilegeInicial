'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { store, Empresa, OrcamentoMensal, PlanoConta, uid } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import { toast } from 'sonner';
import { Target, TrendingDown, CheckCircle, AlertTriangle } from 'lucide-react';

export default function OrcamentoPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [competencia, setCompetencia] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [orcamento, setOrcamento] = useState<OrcamentoMensal | null>(null);
  const [limites, setLimites] = useState<Record<string, number>>({});
  
  // Realizado
  const [lancamentos, setLancamentos] = useState<ReturnType<typeof store.getLancamentos>>([]);

  const load = useCallback((eId: string, comp: string) => {
    setEmpresaId(eId);
    setEmpresa(store.getEmpresas().find(e => e.id === eId) || null);
    
    if (!eId) return;
    
    const contas = store.getPlanoContas(eId).filter(c => c.tipo === 'despesa' || (c.tipo === 'receita' && c.descricao.trim().startsWith('( - )')));
    setPlanoContas(contas);
    
    const orcs = store.getOrcamentosMensais(eId);
    const atual = orcs.find(o => o.mes === comp);
    if (atual) {
      setOrcamento(atual);
      setLimites(atual.categorias);
    } else {
      setOrcamento(null);
      setLimites({});
    }

    const lancs = store.getLancamentos(eId).filter(l => l.status === 'realizado' && l.data.startsWith(comp));
    setLancamentos(lancs);

  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
    load(saved, competencia);

    const handler = (e: Event) => load((e as CustomEvent).detail, competencia);
    const dataChangeHandler = () => {
      const current = sessionStorage.getItem('cf_empresa_sel') || (store.getEmpresas()[0]?.id ?? '');
      load(current, competencia);
    };
    
    window.addEventListener('empresaChange', handler);
    window.addEventListener('cfDataChange', dataChangeHandler);
    return () => {
      window.removeEventListener('empresaChange', handler);
      window.removeEventListener('cfDataChange', dataChangeHandler);
    };
  }, [load, competencia]);

  const handleCompetenciaChange = (c: string) => {
    setCompetencia(c);
    load(empresaId, c);
  };

  const setLimite = (contaId: string, val: number) => {
    setLimites(prev => ({ ...prev, [contaId]: val }));
  };

  const handleSave = () => {
    if (!empresaId) return;
    const orc: OrcamentoMensal = {
      id: orcamento?.id || uid(),
      empresaId,
      mes: competencia,
      categorias: limites
    };
    store.saveOrcamentoMensal(orc);
    setOrcamento(orc);
    store.logAudit(empresaId, 'UPDATE', `Config · Definiu/Atualizou orçamento de ${competencia}`);
    toast.success('Orçamento salvo com sucesso!');
  };

  const resumoContas = useMemo(() => {
    const result: { id: string; codigo: string; descricao: string; orcado: number; realizado: number; burnRate: number }[] = [];
    let totalOrcado = 0;
    let totalRealizado = 0;

    planoContas.forEach(pc => {
       const orcado = limites[pc.id] || 0;
       const realizado = lancamentos.filter(l => l.planoContaId === pc.id).reduce((a, l) => a + l.valor, 0);
       
       totalOrcado += orcado;
       totalRealizado += realizado;

       if (orcado > 0 || realizado > 0) {
         result.push({
           id: pc.id,
           codigo: pc.codigo,
           descricao: pc.descricao,
           orcado,
           realizado,
           burnRate: orcado > 0 ? (realizado / orcado) * 100 : (realizado > 0 ? 100 : 0)
         });
       }
    });

    result.sort((a,b) => a.codigo.localeCompare(b.codigo));

    return { linhas: result, totalOrcado, totalRealizado, burnRateGlobal: totalOrcado > 0 ? (totalRealizado / totalOrcado) * 100 : 0 };
  }, [planoContas, limites, lancamentos]);

  const [anoLabel, mesLabel] = competencia.split('-');
  const mesAtualLabel = new Date(Number(anoLabel), Number(mesLabel)-1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <>
      <div className="page-header glass-header" style={{
        background: 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.3)',
      }}>
        <div>
          <div className="page-title">Plano Orçamentário (Budget)</div>
          <div className="page-subtitle">{empresa?.nomeFantasia || empresa?.razaoSocial} — Tetos de gastos operacionais e acompanhamento</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="month"
            className="form-control"
            value={competencia}
            onChange={e => handleCompetenciaChange(e.target.value)}
            style={{ width: 170, fontWeight: 600 }}
          />
          <button className="btn btn-primary" onClick={handleSave}>
            💾 Salvar Orçamento
          </button>
        </div>
      </div>

      <div className="page-body">
        
        {/* Painel Burn Rate Macro */}
        <div className="glass-card animate-slide-up" style={{
          marginBottom: 32, padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.03)'
        }}>
          <div>
             <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <Target size={18} color="var(--accent)" />
                <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-secondary)', fontWeight: 700 }}>Meta de Gastos: {mesAtualLabel}</div>
             </div>
             <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
                {fmt.currency(resumoContas.totalRealizado)} <span style={{ fontSize: 20, color: 'var(--text-muted)', fontWeight: 600 }}>/ {fmt.currency(resumoContas.totalOrcado)}</span>
             </div>
          </div>
          
          <div style={{ minWidth: 250 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, fontWeight: 700 }}>
                 <span style={{ color: 'var(--text-secondary)' }}>Burn Rate (Mensal)</span>
                 <span style={{ color: resumoContas.burnRateGlobal > 100 ? 'var(--red)' : resumoContas.burnRateGlobal > 85 ? 'var(--yellow)' : 'var(--green)' }}>
                   {resumoContas.burnRateGlobal.toFixed(1)}%
                 </span>
             </div>
             <div style={{ height: 10, background: 'var(--bg-hover)', borderRadius: 10, overflow: 'hidden' }}>
                 <div style={{ 
                     height: '100%', 
                     width: `${Math.min(resumoContas.burnRateGlobal, 100)}%`, 
                     background: resumoContas.burnRateGlobal > 100 ? 'var(--red)' : resumoContas.burnRateGlobal > 85 ? 'var(--amber)' : 'var(--green)',
                     transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                 }} />
             </div>
             {resumoContas.burnRateGlobal > 100 && (
               <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                 <AlertTriangle size={12} /> Orçamento Geral Estourado
               </div>
             )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Definição Limite por Categoria</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Código</th>
                  <th>Categoria de Gasto</th>
                  <th style={{ textAlign: 'right', width: 200 }}>Orçado (Teto Máximo)</th>
                  <th style={{ textAlign: 'right', width: 150 }}>Realizado Hoje</th>
                  <th style={{ width: 250 }}>Status (Burn Rate)</th>
                </tr>
              </thead>
              <tbody>
                {planoContas.filter(pc => pc.nivel >= 3).sort((a,b) => a.codigo.localeCompare(b.codigo)).map(pc => {
                   const orcado = limites[pc.id] || 0;
                   const realizado = resumoContas.linhas.find(r => r.id === pc.id)?.realizado || 0;
                   const burn = orcado > 0 ? (realizado / orcado) * 100 : (realizado > 0 ? 100 : 0);
                   const exceeds = burn > 100;
                   
                   return (
                    <tr key={pc.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{pc.codigo}</td>
                      <td style={{ fontWeight: 500 }}>{pc.descricao}</td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          style={{ textAlign: 'right', padding: '6px 12px', height: 32 }}
                          value={limites[pc.id] || ''}
                          placeholder="0,00"
                          onChange={e => setLimite(pc.id, Number(e.target.value))}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: exceeds ? 'var(--red)' : 'var(--text-main)' }}>
                         {fmt.currency(realizado)}
                      </td>
                      <td>
                        {orcado > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                             <div style={{ flex: 1, height: 6, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ 
                                  height: '100%', 
                                  width: `${Math.min(burn, 100)}%`, 
                                  background: exceeds ? 'var(--red)' : burn > 80 ? 'var(--amber)' : 'var(--green)'
                                }} />
                             </div>
                             <div style={{ fontSize: 12, fontWeight: 700, width: 45, color: exceeds ? 'var(--red)' : 'var(--text-secondary)' }}>
                                {burn.toFixed(0)}%
                             </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Não orçado</span>
                        )}
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
