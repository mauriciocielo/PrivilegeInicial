'use client';
import { useState } from 'react';

interface BrandLogoProps {
  size?: number;
  showText?: boolean;
  subtitle?: string;
}

export default function BrandLogo({ size = 48, showText = true, subtitle }: BrandLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const logoHeight = size;
  // A imagem original é horizontal, então deixamos a largura flexível ou proporcional (~ 3.5x a altura)
  const logoWidth = logoHeight * 3.5;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {!imageFailed ? (
        <div
          style={{
            height: logoHeight,
            width: 'auto',
            minWidth: 120,
            maxWidth: 240,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: 0,
            flexShrink: 0,
          }}
        >
          <img
            src="/logo.png"
            alt="Privilege Contabilidade e Consultoria"
            onError={() => setImageFailed(true)}
            style={{ height: '100%', width: 'auto', objectFit: 'contain', display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: size, 
            height: size, 
            borderRadius: 12, 
            background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <svg viewBox="0 0 100 100" width={size * 0.65} height={size * 0.65} style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
              <rect x="36" y="44" width="8" height="24" rx="4" fill="var(--accent)" />
              <rect x="49" y="33" width="8" height="35" rx="4" fill="var(--accent)" />
              <rect x="62" y="22" width="8" height="46" rx="4" fill="var(--accent)" />
              <path d="M 28 72 L 40 55 L 49 60 L 76 26" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 66 26 L 76 26 L 76 36" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          
          {showText && (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div className="logo-text" style={{ 
                letterSpacing: '3px', 
                fontSize: size > 40 ? 18 : 14, 
                fontWeight: 800, 
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                background: 'linear-gradient(90deg, #111827 0%, #4b5563 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.1
              }}>
                PRIVILEGE
              </div>
              {subtitle && (
                <div className="logo-sub" style={{ 
                  fontSize: 10, 
                  color: 'var(--text-secondary)', 
                  letterSpacing: '1px', 
                  textTransform: 'uppercase', 
                  fontWeight: 700,
                  marginTop: 2
                }}>
                  {subtitle}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
