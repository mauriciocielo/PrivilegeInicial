'use client';
import { useState, useEffect } from 'react';
import { Sliders, FlaskConical, Target } from 'lucide-react';
import { store, Empresa } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

export default function SimuladorPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  
  // Real Data Baseline
  const [realRec, setRealRec] = useState(0);
  const [realDesp, setRealDesp] = useState(0);
  
  // Simulators
  const [varVendas, setVarVendas] = useState(0);
  const [varCustos, setVarCustos] = useState(0);
  const [varTributos, setVarTributos] = useState(0);
  const [demissaoPct, setDemissaoPct] = useState(0);

  useEffect(() => {
    const eid = sessionStorage.getItem('cf_empresa_sel') || store.getEmpresas()[0]?.id;
    if (!eid) return;
    setEmpresa(store.getEmpresas().find(e => e.id === eid) || null);

    const d = new Date();
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const l = store.getLancamentos(eid).filter(x => x.data.startsWith(m) && x.status === 'realizado');
    
    setRealRec(l.filter(x => x.tipo === 'receita').reduce((a,b) => a + b.valor, 0) || 100000); // 100k fallback if empty for display
    setRealDesp(l.filter(x => x.tipo === 'despesa').reduce((a,b) => a + b.valor, 0) || 75000);
  }, []);

  // What-If Math Engine
  const baseFolha = realDesp * 0.40; // Fictitious 40% of expenses is payroll
  const baseTributos = realRec * 0.15; // 15% taxes
  const baseOperacional = realDesp - baseFolha - baseTributos;

  const simRec = realRec * (1 + (varVendas / 100));
  const simFolha = baseFolha * (1 - (demissaoPct / 100));
  const simTributos = (simRec * 0.15) * (1 + (varTributos / 100));
  const simOp = baseOperacional * (1 + (varCustos / 100));
  const simDespesaTotal = simFolha + simTributos + simOp;
  const simEbitda = simRec - simDespesaTotal;

  if (!empresa) return <div style={{ padding: 40 }}>Aguardando conexão...</div>;

  return (
    <div style={{ padding: 32 }}>
      <div className="glass-header" style={{ marginBottom: 32, padding: 24, borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FlaskConical size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>Simulador de Cenários Máximos</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Teste de Hipóteses Críticas em Tempo Real: {empresa.nomeFantasia}</p>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32 }}>
        
        {/* Painel do Piloto */}
        <div className="glass-card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 32 }}>
           <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
             <Sliders size={20} color="var(--accent)" /> Variáveis Extremos de Operação
           </h2>
           
           <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontWeight: 700 }}>
                <span>Impacto nas Vendas Brutas</span>
                <span style={{ color: varVendas >= 0 ? 'var(--green)' : 'var(--red)' }}>{varVendas >= 0 ? '+' : ''}{varVendas}%</span>
              </div>
              <input type="range" min="-80" max="80" step="5" value={varVendas} onChange={e => setVarVendas(Number(e.target.value))} style={{ width: '100%', accentColor: '#10b981' }} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Efeito dominó: Simula crise sanitária, aumento de marketing, etc. Modula a linha de tributos simultaneamente.</div>
           </div>

           <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontWeight: 700 }}>
                <span>Passar a "Faca" / Demissões em Massa</span>
                <span className="badge badge-gray">Corte: -{demissaoPct}%</span>
              </div>
              <input type="range" min="0" max="100" step="10" value={demissaoPct} onChange={e => setDemissaoPct(Number(e.target.value))} style={{ width: '100%' }} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Simula a redução linear da folha de pagamento base, diminuindo imediatamente os custos fixos.</div>
           </div>

           <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontWeight: 700 }}>
                <span>Inflação de Base de Fornecedores</span>
                <span style={{ color: varCustos >= 0 ? 'var(--red)' : 'var(--green)' }}>{varCustos >= 0 ? '+' : ''}{varCustos}%</span>
              </div>
              <input type="range" min="-50" max="100" step="2" value={varCustos} onChange={e => setVarCustos(Number(e.target.value))} style={{ width: '100%', accentColor: '#ef4444' }} />
           </div>
           
           <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontWeight: 700 }}>
                <span>Impacto Fiscal do Governo</span>
                <span style={{ color: varTributos > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{varTributos >= 0 ? '+' : ''}{varTributos}% de Peso Extra</span>
              </div>
              <input type="range" min="0" max="50" step="5" value={varTributos} onChange={e => setVarTributos(Number(e.target.value))} style={{ width: '100%', accentColor: '#f59e0b' }} />
           </div>
        </div>

        {/* Super Visor Placar Final */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="glass-card" style={{ padding: '32px 24px', background: '#030712', color: '#fff', border: '1px solid #1f2937' }}>
             <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: '#6b7280', fontWeight: 800, margin: '0 0 16px 0', letterSpacing: 1 }}>E.B.I.T.D.A Projetado (Virtual)</h3>
             <div style={{ fontSize: 44, fontWeight: 900, color: simEbitda >= 0 ? '#10b981' : '#fca5a5', letterSpacing: '-1.5px', marginBottom: 8 }}>
                {fmt.currency(simEbitda)}
             </div>
             
             {simEbitda < 0 ? (
               <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                  FATAL: Nessas premissas, a empresa queima capital severamente e pode ir à falência em meses.
               </div>
             ) : (
               <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                  SAUDÁVEL: Base sólida suporta o cenário induzido mantendo giro operacional positivo.
               </div>
             )}
          </div>

          <div className="glass-card" style={{ padding: 24 }}>
             <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, marginBottom: 16 }}>Análise Macro</h3>
             <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
                <span style={{ fontWeight: 600 }}>Receita Bruta Ajustada</span>
                <span style={{ fontWeight: 800 }}>{fmt.currency(simRec)}</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
                <span style={{ fontWeight: 600 }}>Despesa Total Ajustada</span>
                <span style={{ fontWeight: 800, color: 'var(--red)' }}>- {fmt.currency(simDespesaTotal)}</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>Real Histórico Base:</span>
                <span>{fmt.currency(realRec - realDesp)} Líquido Real</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
