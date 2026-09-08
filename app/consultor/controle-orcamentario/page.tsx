'use client';
import { useState, useEffect } from 'react';
import { Presentation, ShieldAlert, Target } from 'lucide-react';
import { store, Empresa } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

export default function OrcamentoPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [gastosPorCategoria, setGastosPorCategoria] = useState<{cat: string, total: number}[]>([]);
  const [orcamentos, setOrcamentos] = useState<Record<string, number>>({
    'Administrativo e Escritório': 25000,
    'Fornecedores (CMV)': 120000,
    'Folha de Pagamento': 95000,
    'Impostos e Taxas': 30000,
    'Marketing e Vendas': 15000,
  });

  useEffect(() => {
    const load = () => {
      const eid = sessionStorage.getItem('cf_empresa_sel') || store.getEmpresas()[0]?.id;
      if (!eid) return;
      const emp = store.getEmpresas().find(e => e.id === eid);
      setEmpresa(emp || null);

      const d = new Date();
      const mesAtual = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const lancs = store.getLancamentos(eid).filter(l => l.tipo === 'despesa' && l.data.startsWith(mesAtual));
      
      const g: Record<string, number> = {};
      lancs.forEach(l => {
        const anyL = l as any;
        const cat = anyL.categoria || 'Outros';
        g[cat] = (g[cat] || 0) + l.valor;
      });
      setGastosPorCategoria(Object.entries(g).map(([cat, total]) => ({cat, total})).sort((a,b) => b.total - a.total));
    };
    load();
    window.addEventListener('empresaChange', load);
    return () => window.removeEventListener('empresaChange', load);
  }, []);

  const totalGasto = gastosPorCategoria.reduce((a,b) => a + b.total, 0);
  const totalOrcado = Object.values(orcamentos).reduce((a,b) => a + b, 0);

  if (!empresa) return <div style={{ padding: 40 }}>Carregando dados...</div>;

  return (
    <div style={{ padding: 32 }}>
      <div className="glass-header" style={{ marginBottom: 32, padding: 24, borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Presentation size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>Budget & Controle Orçamentário</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Análise de Consumo Mensal: {empresa.nomeFantasia}</p>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 350px) 1fr', gap: 32 }}>
        <div className="glass-card" style={{ padding: 28, background: 'rgba(255,255,255,0.6)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Target size={18} color="var(--accent)"/> Travar Orçamentos
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.keys(orcamentos).map(cat => (
              <div key={cat}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>{cat}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                   <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>R$</span>
                   <input 
                     type="number" 
                     className="form-control" 
                     value={orcamentos[cat]} 
                     onChange={e => setOrcamentos({...orcamentos, [cat]: Number(e.target.value)})}
                     style={{ background: '#fff' }}
                   />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Termômetro de Consumo</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Mês Atual: O que foi efetivamente pago comparado ao teto estipulado.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
               <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Gasto vs Planejado</div>
               <div style={{ fontSize: 22, fontWeight: 900, color: totalGasto > totalOrcado ? 'var(--red)' : 'var(--text-primary)' }}>
                 {fmt.currency(totalGasto)} / {fmt.currency(totalOrcado)}
               </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {Object.keys(orcamentos).map(cat => {
              const limite = orcamentos[cat];
              const gasto = gastosPorCategoria.find(g => g.cat === cat)?.total || 0;
              const pct = limite > 0 ? Math.min((gasto / limite) * 100, 150) : 0;
              
              let fill = 'var(--green)';
              if (pct > 75) fill = '#f59e0b';
              if (pct > 95) fill = 'var(--red)';

              return (
                <div key={cat} style={{ background: 'rgba(255,255,255,0.7)', padding: 16, borderRadius: 12, border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{cat}</span>
                    <span style={{ fontWeight: 800, color: fill }}>{pct.toFixed(1)}% consumido</span>
                  </div>
                  
                  <div style={{ height: 12, background: 'var(--border)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: fill, width: `${Math.min(pct, 100)}%`, transition: 'width 1s ease' }} />
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: '100%', borderLeft: pct > 100 ? '2px solid red' : 'none', zIndex: 10 }} />
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                    <span>Efetivo: {fmt.currency(gasto)}</span>
                    <span>Teto Líder: {fmt.currency(limite)}</span>
                  </div>

                  {pct > 100 && (
                    <div style={{ marginTop: 12, background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                       <ShieldAlert size={14} /> Teto estourado em {fmt.currency(Math.max(0, gasto - limite))}! Avalie paralisação de compras.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
