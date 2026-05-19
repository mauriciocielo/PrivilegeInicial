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
  const logoWidth = showText ? size * 3.2 : size * 2.4;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {!imageFailed ? (
        <div
          style={{
            height: logoHeight,
            width: logoWidth,
            maxWidth: '100%',
            borderRadius: 8,
            background: '#600000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: Math.max(6, Math.round(size * 0.14)),
            flexShrink: 0,
          }}
        >
          <img
            src="/logo.png"
            alt="Privilege"
            onError={() => setImageFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>
      ) : (
        <svg viewBox="0 0 100 100" width={size} height={size} style={{ flexShrink: 0 }}>
          <circle cx="50" cy="50" r="46" fill="#f8fafc" />
          <rect x="36" y="44" width="8" height="24" rx="1" fill="#600000" />
          <rect x="49" y="33" width="8" height="35" rx="1" fill="#600000" />
          <rect x="62" y="22" width="8" height="46" rx="1" fill="#600000" />
          <path d="M 28 72 L 40 55 L 49 60 L 76 26" fill="none" stroke="#600000" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 66 26 L 76 26 L 76 36" fill="none" stroke="#600000" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {showText && imageFailed && (
        <div>
          <div className="logo-text" style={{ letterSpacing: '2px', fontSize: size > 50 ? 22 : 13, fontWeight: 800 }}>PRIVILEGE</div>
          {subtitle && <div className="logo-sub">{subtitle}</div>}
        </div>
      )}
      {showText && !imageFailed && subtitle && <div className="logo-sub">{subtitle}</div>}
    </div>
  );
}
