// @ts-check
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['@whiskeysockets/baileys', 'pino', 'thread-stream', 'nodemailer', 'dotenv'],
  webpack(config, { isServer, nextRuntime }) {
    if (!isServer || nextRuntime === 'edge') {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        stream: false,
        zlib: false,
        http: false,
        https: false,
        url: false,
        buffer: false,
        util: false,
        events: false,
        querystring: false,
        assert: false,
      };
    }
    if (nextRuntime === 'edge') {
      config.resolve.alias = {
        ...config.resolve.alias,
        nodemailer: false,
        dotenv: false,
      };
    }
    return config;
  },
  // Necessário no Next.js 16: declara explicitamente o uso do Turbopack
  // para silenciar o erro quando plugins (ex: next-pwa) adicionam config webpack.
  turbopack: {},
  async redirects() {
    return [
      {
        source: '/novo-layout',
        destination: '/',
        permanent: true,
      },
    ];
  },
  // O WhatsApp (Baileys) precisa de um processo sempre ligado, que a Vercel não oferece.
  // Na Vercel, WHATSAPP_BACKEND_URL aponta para o servidor contínuo (Railway, rodando
  // server.js) e todas as rotas /api/whatsapp/* são repassadas para lá, com os cookies.
  // Não defina essa variável no próprio servidor contínuo, senão ele repassa para si mesmo.
  async rewrites() {
    const backend = (process.env.WHATSAPP_BACKEND_URL || '').replace(/\/+$/, '');
    if (!backend) return [];
    return {
      beforeFiles: [
        { source: '/api/whatsapp/:path*', destination: `${backend}/api/whatsapp/:path*` },
      ],
    };
  },
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
