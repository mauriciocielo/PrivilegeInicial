import localFont from 'next/font/local';

// Fontes hospedadas no próprio repositório (subset latin, baixadas do Google Fonts).
// Antes usávamos next/font/google, que baixa as fontes durante o build: quando o
// download falhava (Netlify, runner do GitHub), o build inteiro quebrava.

// Inter variável (300–800)
export const inter = localFont({
  src: './inter-latin.woff2',
  weight: '300 800',
  style: 'normal',
  display: 'swap',
});

// Plus Jakarta Sans variável (200–800)
export const plusJakartaSans = localFont({
  src: './plus-jakarta-sans-latin.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
});

// Instrument Serif 400, normal e itálico
export const instrumentSerif = localFont({
  src: [
    { path: './instrument-serif-latin.woff2', weight: '400', style: 'normal' },
    { path: './instrument-serif-italic-latin.woff2', weight: '400', style: 'italic' },
  ],
  display: 'swap',
});
