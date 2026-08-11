const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
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
