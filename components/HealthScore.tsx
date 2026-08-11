'use client';
import { useEffect, useState, useMemo } from 'react';
import { store } from '../lib/store';

export default function HealthScore({ empresaId, mesSelecionado }: { empresaId: string, mesSelecionado: string }) {
  const [score, setScore] = useState(0);
  const [details, setDetails] = useState<{ label: string; points: number; max: number }[]>([]);

  useEffect(() => {
    if (!empresaId || !mesSelecionado) return;

    const [ano, mes] = mesSelecionado.split('-').map(Number);
    const dAtual = new Date(ano, mes - 1, 1);
    const mAtualStr = `${dAtual.getFullYear()}-${String(dAtual.getMonth() + 1).padStart(2, '0')}`;
    const dAnt = new Date(ano, mes - 2, 1);
    const mAntStr = `${dAnt.getFullYear()}-${String(dAnt.getMonth() + 1).padStart(2, '0')}`;

    const lancs = store.getLancamentos(empresaId).filter(l => l.status === 'realizado');
    
    const recAtual = lancs.filter(l => l.tipo === 'receita' && l.data.startsWith(mAtualStr)).reduce((a, l) => a + l.valor, 0);
    const despAtual = lancs.filter(l => l.tipo === 'despesa' && l.data.startsWith(mAtualStr)).reduce((a, l) => a + l.valor, 0);
    const saldoAtual = recAtual - despAtual;
    const margemAtual = recAtual > 0 ? (saldoAtual / recAtual) * 100 : 0;

    const recAnt = lancs.filter(l => l.tipo === 'receita' && l.data.startsWith(mAntStr)).reduce((a, l) => a + l.valor, 0);

    const ports = store.getPortadores(empresaId);
    const dataFimPeriodo = new Date(ano, mes, 0).toISOString().split('T')[0];
    const saldoCaixa = ports.reduce((a, p) => a + store.getSaldoPortador(p.id, empresaId, dataFimPeriodo), 0);

    let totalScore = 0;
    const items = [];

    // 1. Operação Positiva (Max 300)
    let p1 = 0;
    if (saldoAtual > 0) p1 = 300;
    else if (saldoAtual > -5000 && recAtual > 0) p1 = 100;
    totalScore += p1;
    items.push({ label: 'Fluxo Mensal Positivo', points: p1, max: 300 });

    // 2. Margem de Lucro Segura (Max 250)
    let p2 = 0;
    if (margemAtual >= 20) p2 = 250;
    else if (margemAtual >= 10) p2 = 150;
    else if (margemAtual > 0) p2 = 50;
    totalScore += p2;
    items.push({ label: 'Margem de Lucratividade', points: p2, max: 250 });

    // 3. Crescimento de Receitas YoY/MoM (Max 200)
    let p3 = 0;
    if (recAtual > recAnt && recAnt > 0) p3 = 200;
    else if (recAtual === recAnt && recAtual > 0) p3 = 100;
    totalScore += p3;
    items.push({ label: 'Crescimento de Receita', points: p3, max: 200 });

    // 4. Fôlego / Reserva de Caixa para pelo menos 1 a 2x das Despesas (Max 250)
    let p4 = 0;
    const necessidadeReserva = despAtual * 1.5;
    if (saldoCaixa >= necessidadeReserva && necessidadeReserva > 0) p4 = 250;
    else if (saldoCaixa >= (despAtual * 0.8) && despAtual > 0) p4 = 150;
    else if (saldoCaixa > 0) p4 = 50;
    totalScore += p4;
    items.push({ label: 'Reserva de Emergência Ativa', points: p4, max: 250 });

    setScore(totalScore);
    setDetails(items);
  }, [empresaId, mesSelecionado]);

  // Determine color based on score (Serasa style)
  let healthColor = 'var(--red)';
  let healthLabel = 'Crítico';
  if (score >= 800) { healthColor = 'var(--green)'; healthLabel = 'Saudável - Alta Performance'; }
  else if (score >= 500) { healthColor = 'var(--yellow)'; healthLabel = 'Atenção - Margem Exígua'; }
  else if (score >= 300) { healthColor = 'var(--orange)'; healthLabel = 'Risco Moderado'; }

  const angle = Math.max(-90, Math.min(90, (score / 1000) * 180 - 90));

  if (!empresaId) return null;

  return (
    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <div>
         <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
            🌡️ Score de Saúde da Empresa
         </div>
         <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Pontuação de solidez baseada em caixa e reservas.
         </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', height: 140, overflow: 'hidden' }}>
         {/* Velocímetro semi-circle */}
         <div style={{
            position: 'absolute', top: 20, width: 220, height: 110,
            borderTopLeftRadius: 120, borderTopRightRadius: 120,
            background: 'conic-gradient(from 180deg at 50% 100%, #ef4444 0deg, #f59e0b 60deg, #eab308 100deg, #22c55e 180deg)',
            opacity: 0.2
         }} />
         
         <div style={{
            position: 'absolute', top: 20, width: 220, height: 110,
            borderTopLeftRadius: 120, borderTopRightRadius: 120,
            border: `12px solid ${healthColor}`, 
            borderBottom: 'none',
            boxSizing: 'border-box'
         }} />
         
         {/* Pointer */}
         <div style={{
            position: 'absolute', bottom: 0, left: '50%', width: 4, height: 90,
            background: 'var(--text-primary)', transformOrigin: 'bottom center',
            transform: `translateX(-50%) rotate(${angle}deg)`, borderRadius: 4,
            transition: 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
         }} />
         
         {/* Central Node */}
         <div style={{ position: 'absolute', bottom: -5, width: 14, height: 14, borderRadius: '50%', background: 'var(--text-primary)', boxShadow: '0 0 10px rgba(0,0,0,0.5)' }} />

         {/* Score Text */}
         <div style={{ position: 'absolute', bottom: -10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ background: 'var(--bg-card)', padding: '2px 14px', borderRadius: 20, boxShadow: '0 -4px 10px rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: 32, fontWeight: 900, color: healthColor, letterSpacing: -1 }}>{score}</span>
            </div>
         </div>
      </div>
      
      <div style={{ textAlign: 'center' }}>
         <div style={{ fontSize: 13, fontWeight: 700, color: healthColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>{healthLabel}</div>
         <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Meta de Excelência: 800+</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
         {details.map((d, i) => (
           <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                 <span style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
                 <span style={{ fontWeight: 600, color: d.points === d.max ? 'var(--green)' : d.points > 0 ? 'var(--yellow)' : 'var(--text-muted)' }}>
                   {d.points} / {d.max}
                 </span>
              </div>
              <div className="progress-bar" style={{ height: 4, background: 'var(--border-light)' }}>
                 <div className="progress-fill" style={{ width: `${(d.points/d.max)*100}%`, background: d.points === d.max ? 'var(--green)' : 'var(--accent)' }} />
              </div>
           </div>
         ))}
      </div>
    </div>
  );
}
