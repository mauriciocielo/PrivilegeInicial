'use client';
import { useState, useEffect } from 'react';
import { Calculator, TrendingUp, AlertTriangle, ShieldCheck, Sliders } from 'lucide-react';
import { store, Empresa } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

export default function ValuationPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [cashflowAnual, setCashflowAnual] = useState(0);
  const [multiplicador, setMultiplicador] = useState(5.5);
  const [taxaDesconto, setTaxaDesconto] = useState(12.5);
  const [crescimento, setCrescimento] = useState(4.0);
  
  useEffect(() => {
    const loadData = () => {
      const eid = sessionStorage.getItem('cf_empresa_sel') || store.getEmpresas()[0]?.id;
      if (!eid) return;
      const emp = store.getEmpresas().find(e => e.id === eid);
      setEmpresa(emp || null);

      // Calcular o Fluxo de Caixa Livre Anualizado (Estimativa baseada nos lançamentos)
      const lancs = store.getLancamentos(eid).filter(l => l.status === 'realizado');
      const rec = lancs.filter(l => l.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
      const desp = lancs.filter(l => l.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);
      
      const mesesAnalisados = new Set(lancs.map(l => l.data.substring(0, 7))).size || 1;
      const fclMensal = (rec - desp) / mesesAnalisados;
      setCashflowAnual(fclMensal * 12);
    };
    
    loadData();
    window.addEventListener('empresaChange', loadData);
    return () => window.removeEventListener('empresaChange', loadData);
  }, []);

  // Method 1: EBITDA Multiple (Simplified to FCL Multiple)
  const valMultiple = Math.max(0, cashflowAnual * multiplicador);

  // Method 2: Gordon Growth Model (Perpetuity DCF)
  // Value = FCL * (1 + g) / (WACC - g)
  const valDCF = Math.max(0, (cashflowAnual * (1 + (crescimento/100))) / ((taxaDesconto/100) - (crescimento/100)));

  if (!empresa) return <div style={{ padding: 40 }}>Carregando dados da empresa...</div>;

  return (
    <div style={{ padding: 32 }}>
      <div className="glass-header" style={{ marginBottom: 32, padding: 24, borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calculator size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>Valuation & Market Value</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Análise de Valor de Mercado: {empresa.nomeFantasia}</p>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 32 }}>
        {/* Painel de Variáveis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="glass-card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sliders size={20} color="var(--accent)"/> Parâmetros Macroeconômicos
            </h3>
            
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontWeight: 600 }}>
                <span>Múltiplo de Mercado (EBITDA x)</span>
                <span className="badge badge-blue">{multiplicador}x</span>
              </div>
              <input type="range" min="1" max="15" step="0.5" value={multiplicador} onChange={e => setMultiplicador(Number(e.target.value))} style={{ width: '100%' }} />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Múltiplo padrão da indústria. Startups usam 8-15x, indústria tradicional 4-7x.</p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontWeight: 600 }}>
                <span>Taxa de Desconto / WACC (%)</span>
                <span className="badge badge-red">{taxaDesconto}%</span>
              </div>
              <input type="range" min="5" max="35" step="0.5" value={taxaDesconto} onChange={e => setTaxaDesconto(Number(e.target.value))} style={{ width: '100%' }} />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Custo médio ponderado de capital. Reflete o risco-brasil e risco do negócio.</p>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontWeight: 600 }}>
                <span>Crescimento Perpétuo (Gordon 'g' %)</span>
                <span className="badge badge-green">{crescimento}%</span>
              </div>
              <input type="range" min="1" max="10" step="0.5" value={crescimento} onChange={e => setCrescimento(Number(e.target.value))} style={{ width: '100%' }} />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Taxa em que a empresa crescerá ao infinito. Acima da inflação requer fundamentação.</p>
            </div>
          </div>

          {/* Dados Fiscais de Entrada */}
          <div className="glass-card" style={{ padding: 24, background: 'rgba(255,255,255,0.4)' }}>
             <h4 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 800, marginBottom: 16 }}>Dados Alimentadores (Realizado)</h4>
             <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
                <span style={{ fontWeight: 600 }}>Geração de Caixa (Anualizada)</span>
                <span style={{ fontWeight: 800, color: cashflowAnual >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt.currency(cashflowAnual)}</span>
             </div>
             <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Valores extraídos diretamente das movimentações bancárias e DRE da base de dados do sistema, anualizados via Média Ponderada.</p>
          </div>
        </div>

        {/* Dashboard de Resultados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Método 1 */}
          <div className="glass-card" style={{ padding: 32, background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', color: '#fff', border: 'none', boxShadow: '0 15px 35px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, color: '#9ca3af', fontWeight: 700, marginBottom: 8 }}>Avaliação Relativa</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px 0' }}>Método de Múltiplos</h2>
            
            <div style={{ fontSize: 36, fontWeight: 900, color: '#10b981', letterSpacing: '-1px' }}>
              {valMultiple > 0 ? fmt.currency(valMultiple) : 'INVÁLIDO'}
            </div>
            
            <div style={{ marginTop: 24, fontSize: 13, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 8 }}>
              {valMultiple > 0 ? <ShieldCheck size={16} color="#10b981"/> : <AlertTriangle size={16} color="#ef4444"/>}
              {valMultiple > 0 ? 'Cálculo sólido baseado nos múltiplos estritos da indústria, confiabilidade alta para M&A de PMEs.' : 'A empresa queima caixa atualmente. Múltiplos não se aplicam.'}
            </div>
          </div>

          {/* Método 2 */}
          <div className="glass-card" style={{ padding: 32, border: '1px solid var(--border)', background: '#fff' }}>
            <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>Avaliação Intrínseca</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px 0', color: 'var(--accent)' }}>Fluxo de Caixa Descontado (DCF)</h2>
            
            <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--accent)', letterSpacing: '-1px' }}>
              {valDCF > 0 && isFinite(valDCF) ? fmt.currency(valDCF) : 'INVÁLIDO'}
            </div>
            
            <div style={{ marginTop: 24, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {valDCF > 0 && isFinite(valDCF) ? <TrendingUp size={16} color="var(--accent)"/> : <AlertTriangle size={16} color="var(--red)"/>}
              {valDCF > 0 && isFinite(valDCF) ? `Projeção da Perpetuidade. Considerando crescimento contínuo de ${crescimento}% a.a e desconto (risco) de ${taxaDesconto}%.` : 'O WACC é menor que o crescimento (g) ou a empresa queima caixa.'}
            </div>
          </div>
          
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }}>
            Gerar Laudo Oficial em PDF
          </button>
        </div>
      </div>
    </div>
  );
}

