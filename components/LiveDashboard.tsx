'use client';
import { useEffect, useState } from 'react';

const BAR_HEIGHTS_1 = [55, 70, 48, 82, 65, 90, 75, 88, 60, 95, 72, 100];
const BAR_HEIGHTS_2 = [60, 65, 52, 78, 70, 85, 80, 82, 65, 90, 78, 95];

export default function LiveDashboard() {
  const [activeSet, setActiveSet] = useState(1);
  const [pulse, setPulse] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Initial grow animation
    const timer = setTimeout(() => setLoaded(true), 100);
    
    // Live update interval
    const interval = setInterval(() => {
      setActiveSet(prev => (prev === 1 ? 2 : 1));
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
    }, 4500);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const currentBars = activeSet === 1 ? BAR_HEIGHTS_1 : BAR_HEIGHTS_2;
  const currentResult = activeSet === 1 ? 'R$ 966K' : 'R$ 972K';
  const currentPulseValue = activeSet === 1 ? '▲ 12.4%' : '▲ 12.8%';

  return (
    <div className="hero-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="hero-card-title">Dashboard Financeiro</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span 
            className="dash-badge badge-g" 
            style={{ 
              transform: pulse ? 'scale(1.08)' : 'scale(1)',
              transition: 'transform 0.4s ease-out',
              display: 'inline-block'
            }}
          >
            {currentPulseValue}
          </span>
          <span className="dash-badge badge-b">Nov/26</span>
        </div>
      </div>
      <div className="dash-row">
        {[
          { label: 'Receita Bruta', value: 'R$ 1.2M' },
          { label: 'Impostos', value: 'R$ 234K' },
          { label: 'Resultado', value: currentResult },
        ].map(({ label, value }) => (
          <div key={label} className="dash-kpi">
            <div className="dash-kpi-val" style={{ transition: 'opacity 0.3s', opacity: pulse ? 0.7 : 1 }}>{value}</div>
            <div className="dash-kpi-label">{label}</div>
          </div>
        ))}
      </div>
      <div className="dash-bar">
        {currentBars.map((targetHeight, i) => {
          const isLatest = i === 11;
          const isBRAND = isLatest; // We use a hardcoded color for brand, maybe pass as prop but let's use #600000
          const color = isBRAND ? '#600000' : (i > 8 ? '#60000088' : '#E2E8F0');
          // For initial load, we stagger the heights of the bars
          return (
            <div
              key={i}
              className="dash-bar-item"
              style={{
                height: loaded ? `${targetHeight}%` : '0%',
                background: color,
                transition: `height 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 50}ms`,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="dash-badge badge-g">● Fluxo Positivo</span>
        <span className="dash-badge badge-r">⚠ 3 Venc. Essa Semana</span>
      </div>
      <div style={{ marginTop: 16, padding: '12px 14px', background: '#F8FAFC', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>Próx. Obrigação: DCTF</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#600000' }}>15/08/2026</span>
      </div>
    </div>
  );
}
