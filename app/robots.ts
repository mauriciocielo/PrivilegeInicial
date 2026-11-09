import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/cliente/',
          '/consultor/',
          '/api/',
          '/perfil',
          '/reset-dados',
          '/novo-layout',
        ],
      },
    ],
    sitemap: 'https://privilegecontabilidade.cnt.br/sitemap.xml',
  };
}
