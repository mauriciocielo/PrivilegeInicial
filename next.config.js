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
};

module.exports = (phase) => {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return nextConfig;
  }

  const withPWA = require('@ducanh2912/next-pwa').default({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: false,
  });

  return withPWA(nextConfig);
};
