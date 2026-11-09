import { ImageResponse } from 'next/og';

export const alt = 'Privilege Contabilidade e Consultoria — Francisco Beltrão, PR';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #4a0000 0%, #1a0000 100%)',
          padding: '60px 80px',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          border: '12px solid #8b0000',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              fontSize: 20,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#f59e0b',
              fontWeight: 700,
            }}
          >
            PRIVILEGE CONTABILIDADE & CONSULTORIA
          </div>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '8px 18px',
              borderRadius: 99,
              fontSize: 16,
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            Francisco Beltrão · PR
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
              lineHeight: 1.1,
              color: '#ffffff',
              maxWidth: 960,
            }}
          >
            Contabilidade Consultiva e BPO Financeiro Estratégico
          </div>
          <div
            style={{
              fontSize: 22,
              color: '#d4d4d8',
              maxWidth: 880,
              lineHeight: 1.4,
            }}
          >
            Decisões seguras e estruturadas para Simples Nacional, Lucro Presumido e Lucro Real.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 20,
            paddingTop: 24,
            borderTop: '1px solid rgba(255, 255, 255, 0.15)',
            fontSize: 16,
            color: '#a1a1aa',
          }}
        >
          <span>Gestão Fiscal & Tributária</span>
          <span>·</span>
          <span>BPO Financeiro</span>
          <span>·</span>
          <span>Abertura de Empresas</span>
          <span>·</span>
          <span>Agronegócio (LCDPR)</span>
        </div>
      </div>
    ),
    { ...size }
  );
}

