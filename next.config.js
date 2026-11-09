// @ts-check
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // Necessário no Next.js 16: declara explicitamente o uso do Turbopack
  // para silenciar o erro quando plugins (ex: next-pwa) adicionam config webpack.
  turbopack: {},
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

module.exports = (phase) => {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return nextConfig;
  }

  const withPWA = require('@ducanh2912/next-pwa').default({
    dest: 'public',
    register: true,
    disable: false,
    // Nova versão assume sozinha: ativa na hora, controla as abas abertas e limpa caches antigos.
    // O componente PwaAutoUpdate recarrega a página quando o novo service worker assume.
    reloadOnOnline: true,
    workboxOptions: {
      skipWaiting: true,
      clientsClaim: true,
      cleanupOutdatedCaches: true,
    },
  });

  return withPWA(nextConfig);
};
