'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { store, Empresa } from '../../../lib/store';
import { fmt } from '../../../lib/reports';
import AIInsights from '../../../components/AIInsights';
import HealthScore from '../../../components/HealthScore';

// Ocultamos o Header padrão e Sidebar no globals.css via print helpers
export default function ReportBoardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState('');
  const [loading, setLoading] = useState(true);
  const [indicadores, setIndicadores] = useState<any>(null);
  const [totais, setTotais] = useState({ rec: 0, desp: 0, saldo: 0, portadores: 0 });
  const [lancsRecentes, setLancsRecentes] = useState<any[]>([]);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eid = searchParams?.get('empresaId') || sessionStorage.getItem('cf_empresa_sel') || store.getEmpresas()[0]?.id;
    const mes = searchParams?.get('mes') || (() => {
      const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    })();

    if (!eid) {
      router.push('/consultor/dashboard');
      return;
    }

    const emp = store.getEmpresas().find(e => e.id === eid);
    setEmpresa(emp || null);
    setMesSelecionado(mes);

    // Calc Data
    const lancs = store.getLancamentos(eid).filter(l => l.status === 'realizado');
    const lancsMs = lancs.filter(l => l.data.startsWith(mes));
    
    const rec = lancsMs.filter(l => l.tipo === 'receita').reduce((a, l) => a + l.valor, 0);
    const desp = lancsMs.filter(l => l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0);
    
    const ports = store.getPortadores(eid);
    const [ano, mo] = mes.split('-');
    const dataFim = new Date(Number(ano), Number(mo), 0).toISOString().split('T')[0];
    const totalCaixa = ports.reduce((a, p) => a + store.getSaldoPortador(p.id, eid, dataFim), 0);

    setTotais({ rec, desp, saldo: rec - desp, portadores: totalCaixa });
    setIndicadores(store.getIndicadores(eid).find(i => i.mes === mes));
    setLancsRecentes([...lancsMs].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5));

    setLoading(false);
  }, [searchParams, router]);

  const handleExportPDF = async () => {
    if (!reportRef.current || !empresa) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#F9FAFB',
        windowWidth: 794 // A4 width at 96 DPI
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Privilege_Finance_${empresa.nomeFantasia.replace(/\s+/g,'_')}_${mesSelecionado}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar relatório.');
    }
  };

  if (loading || !empresa) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando dados estruturados...</div>;

  const [a, m] = mesSelecionado.split('-');
  const mesExtenso = new Date(Number(a), Number(m)-1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div style={{ background: 'var(--bg-default)', minHeight: '100vh', padding: 24 }}>
      {/* Controles de Acesso (Não Impressos) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <button className="btn btn-secondary" onClick={() => router.back()}>← Voltar ao Dashboard</button>
        <button className="btn btn-primary" onClick={handleExportPDF}>
          🖨️ PDF: Gerar Report Board
        </button>
      </div>

      {/* A4 Container */}
      <div 
        ref={reportRef} 
        style={{ 
          width: '794px', // A4 exato padrão
          margin: '0 auto', 
          background: '#F9FAFB', 
          padding: '40px',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden'
        }}
        className="pdf-container"
      >
        {/* Cabecalho Premium */}
        <div style={{ borderBottom: '2px solid var(--accent)', paddingBottom: 24, marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>
              Privilege Consultoria
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#030712', margin: '8px 0 4px 0' }}>Finance Report</h1>
            <div style={{ fontSize: 16, color: 'var(--text-secondary)' }}>Mês de Analise: {mesExtenso}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{empresa.nomeFantasia}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>CNPJ: {empresa.cnpj || 'Não cadastrado'}</div>
            <div style={{ marginTop: 12, background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 20, fontSize: 12, display: 'inline-block' }}>
               Gerado em {new Date().toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>

        {/* Resumo Executivo (Totais) */}
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16, textTransform: 'uppercase' }}>1. Resumo Executivo Operacional</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
           <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Ingressos (Realizado)</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--green)', marginTop: 8 }}>{fmt.currency(totais.rec)}</div>
           </div>
           <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Saídas (Realizado)</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--red)', marginTop: 8 }}>{fmt.currency(totais.desp)}</div>
           </div>
           <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid var(--border-light)', borderTop: `4px solid ${totais.saldo >= 0 ? 'var(--green)' : 'var(--red)'}` }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Resultado Líquido</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: totais.saldo >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 8 }}>{fmt.currency(totais.saldo)}</div>
           </div>
           <div style={{ background: '#030712', padding: 20, borderRadius: 12, color: '#fff' }}>
              <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Saldo Acumulado (Em Caixa)</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 8 }}>{fmt.currency(totais.portadores)}</div>
           </div>
        </div>

        {/* Intelligence (Side by side with Score) */}
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16, textTransform: 'uppercase' }}>2. Inteligência e Performance</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, marginBottom: 32 }}>
           <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border-light)', overflow: 'hidden' }}>
              <AIInsights empresaId={empresa.id} mesSelecionado={mesSelecionado} />
           </div>
           <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border-light)' }}>
              <HealthScore empresaId={empresa.id} mesSelecionado={mesSelecionado} />
           </div>
        </div>

        {/* Recent Transactions */}
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16, textTransform: 'uppercase' }}>3. Principais Movimentações</h2>
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid var(--border-light)' }}>
           <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
             <thead>
               <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                 <th style={{ padding: '12px 8px' }}>Data</th>
                 <th style={{ padding: '12px 8px' }}>Descrição / Histórico</th>
                 <th style={{ padding: '12px 8px' }}>Impacto</th>
               </tr>
             </thead>
             <tbody>
               {lancsRecentes.map(l => (
                 <tr key={l.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                   <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{fmt.date(l.data)}</td>
                   <td style={{ padding: '12px 8px', fontWeight: 600 }}>{l.descricao}</td>
                   <td style={{ padding: '12px 8px', fontWeight: 700, color: l.tipo === 'receita' ? 'var(--green)' : 'var(--red)' }}>
                     {l.tipo === 'receita' ? '+' : '-'} {fmt.currency(l.valor)}
                   </td>
                 </tr>
               ))}
               {lancsRecentes.length === 0 && (
                 <tr>
                   <td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Sem movimentações neste período</td>
                 </tr>
               )}
             </tbody>
           </table>
        </div>

        {/* Rodapé do Relatório */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
           <div>Privilege Consultoria Financeira - Report Automático e Confidencial</div>
           <div>Página Única</div>
        </div>
      </div>
    </div>
  );
}
