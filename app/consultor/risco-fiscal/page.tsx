'use client';
import { useState, useEffect } from 'react';
import { AlertTriangle, Fingerprint, ShieldAlert, BadgeInfo } from 'lucide-react';
import { store, Empresa, Lancamento } from '../../../lib/store';
import { fmt } from '../../../lib/reports';

export default function RiscoFiscalPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [infracoes, setInfracoes] = useState<Lancamento[]>([]);

  useEffect(() => {
    const load = () => {
      const eid = sessionStorage.getItem('cf_empresa_sel') || store.getEmpresas()[0]?.id;
      if (!eid) return;
      const emp = store.getEmpresas().find(e => e.id === eid);
      setEmpresa(emp || null);

      // Algoritmo de Malha Fina Fictício (cruza valores altos sem documento fiscal no sistema)
      const lancs = store.getLancamentos(eid);
      const riscos = lancs.filter(l => {
         const anyL = l as any;
         return (l.tipo === 'despesa' && l.valor > 4500 && !anyL.anexoUrl && (anyL.categoria?.includes('Saque') || anyL.categoria?.includes('Diretoria') || l.descricao.includes('Pix')));
      });
      setInfracoes(riscos);
    };
    load();
    window.addEventListener('cfDataChange', load);
    window.addEventListener('empresaChange', load);
  }, []);

  if (!empresa) return <div style={{ padding: 40 }}>Carregando malha fiscal...</div>;
  const riscoTotal = infracoes.reduce((a,b) => a + b.valor, 0);

  return (
    <div style={{ padding: 32 }}>
      <div className="glass-header" style={{ marginBottom: 32, padding: 24, borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>Malha Fina & Auditoria de Risco</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Motor de detecção de fraudes contábeis e passivos invisíveis de {empresa.nomeFantasia}</p>
          </div>
        </div>
      </div>
      
      <div className="glass-card" style={{ padding: 32, marginBottom: 32, background: infracoes.length > 0 ? 'linear-gradient(135deg, rgba(82, 8, 13, 0.9) 0%, rgba(140, 26, 34, 0.9) 100%)' : 'var(--bg-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
             <h2 style={{ fontSize: 24, fontWeight: 900, color: infracoes.length > 0 ? '#fff' : 'var(--text-primary)', margin: '0 0 8px 0' }}>Score de Risco Vigente</h2>
             <p style={{ color: infracoes.length > 0 ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>O robô Privilege cruzou a ausência de XMLs baseados contra depósitos/Pix superiores a limite base.</p>
          </div>
          <div style={{ textAlign: 'right' }}>
             <div style={{ fontSize: 12, color: infracoes.length > 0 ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Passivo Oculto Mapeado</div>
             <div style={{ fontSize: 36, fontWeight: 900, color: infracoes.length > 0 ? '#fca5a5' : 'var(--green)' }}>
                {infracoes.length > 0 ? fmt.currency(riscoTotal) : 'Zero'}
             </div>
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Evidências Fiscais Suspeitas ({infracoes.length})</h3>
      {infracoes.length === 0 ? (
        <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
           <BadgeInfo size={32} color="var(--green)" style={{ marginBottom: 16 }} />
           <p style={{ fontWeight: 700 }}>Nenhum risco severo de Evasão/Sonegação detectado.</p>
           <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>As transações acima de R$ 4.500 no caixa possuem aderência fiscal ou descritivo rastreável.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {infracoes.map(inf => (
            <div key={inf.id} className="glass-card" style={{ padding: 20, borderLeft: '4px solid #ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                     <ShieldAlert size={16} color="#ef4444"/>
                     <span style={{ fontWeight: 800, color: '#ef4444' }}>Retenção de Tributo Possível vs Despesa Indocumentada</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{inf.descricao}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Data da Evasão: {fmt.date(inf.data)} | Banco Origem Omitido | ID: {inf.id.substring(0,8)}</div>
               </div>
               <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--red)' }}>{fmt.currency(inf.valor)}</div>
                  <button className="btn btn-secondary" style={{ marginTop: 8, padding: '4px 12px', fontSize: 11 }}>Investigar / Requisitar Prova</button>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
