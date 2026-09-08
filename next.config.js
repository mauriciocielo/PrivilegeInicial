const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  typescript: {
    // Reativado — os erros de tipo acumulados (14x updatedAt, conferido, cache
    // stale) foram corrigidos. Deixar isso como `true` escondia regressões reais.
    ignoreBuildErrors: false,
  },
  turbopack: {},
};

if (!isDev) {
  const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
  });
  module.exports = withPWA(nextConfig);
} else {
  module.exports = nextConfig;
}
