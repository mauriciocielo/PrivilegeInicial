import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Toaster } from 'sonner';
import TransitionProvider from '../components/TransitionProvider';
import ConfirmProvider from '../components/ConfirmProvider';
import PwaAutoUpdate from '../components/PwaAutoUpdate';
import { GoogleOAuthProvider } from '@react-oauth/google';

const fontMain = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const SITE_TITLE = 'Privilege Contabilidade e Consultoria — Francisco Beltrão, PR';
// Meta description enxuta (~151 caracteres) alinhada aos serviços buscados localmente
const SITE_DESC =
  'Contabilidade consultiva e BPO financeiro em Francisco Beltrão, PR. Abertura de empresas, fiscal, folha, planejamento tributário e agronegócio (LCDPR).';

const GOOGLE_MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=Privilege+Contabilidade+e+Consultoria+Rua+Par%C3%A1+127+Francisco+Beltr%C3%A3o+PR';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://privilegecontabilidade.cnt.br'),
  title: {
    default: SITE_TITLE,
    template: '%s | Privilege',
  },
  description: SITE_DESC,
  manifest: '/manifest.json',
  keywords: [
    'contabilidade Francisco Beltrão',
    'contador Francisco Beltrão',
    'escritório de contabilidade Francisco Beltrão PR',
    'BPO financeiro Francisco Beltrão',
    'planejamento tributário Paraná',
    'abertura de empresa Francisco Beltrão',
    'contabilidade agronegócio LCDPR',
    'contabilidade consultiva',
  ],
  authors: [{ name: 'Privilege Contabilidade e Consultoria' }],
  creator: 'Privilege Contabilidade',
  publisher: 'Privilege Contabilidade',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://privilegecontabilidade.cnt.br',
    siteName: 'Privilege Contabilidade e Consultoria',
    title: SITE_TITLE,
    description: SITE_DESC,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESC,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        verification: {
          google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
        },
      }
    : {}),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const jsonLdSchema = {
  '@context': 'https://schema.org',
  '@type': 'AccountingService',
  '@id': 'https://privilegecontabilidade.cnt.br/#organization',
  name: 'Privilege Contabilidade e Consultoria',
  alternateName: 'Privilege Consultoria',
  legalName: 'Privilege Consultoria Ltda',
  url: 'https://privilegecontabilidade.cnt.br',
  logo: 'https://privilegecontabilidade.cnt.br/privilege-logo-colorida.svg',
  image: 'https://privilegecontabilidade.cnt.br/og-image.png',
  description: SITE_DESC,
  telephone: '+55-46-3035-1018',
  email: 'contato@privilegecontabilidade.cnt.br',
  taxID: '58.033.979/0001-84',
  hasMap: GOOGLE_MAPS_URL,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Rua Pará, 127, Sala 03, Centro',
    addressLocality: 'Francisco Beltrão',
    addressRegion: 'PR',
    postalCode: '85601-290',
    addressCountry: 'BR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: -25.9926,
    longitude: -53.0561,
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '08:00',
      closes: '18:00',
    },
  ],
  priceRange: '$$',
  areaServed: [
    { '@type': 'City', name: 'Francisco Beltrão' },
    { '@type': 'AdministrativeArea', name: 'Sudoeste do Paraná' },
    { '@type': 'AdministrativeArea', name: 'Paraná' },
    { '@type': 'Country', name: 'Brasil' },
  ],
  sameAs: [
    'https://www.instagram.com/privilegefb',
    'https://www.instagram.com/marcos.cancelier',
    'https://www.instagram.com/mauricio.cielo',
    'https://www.linkedin.com/company/privilege-assessoria-cont%C3%A1bil/',
    GOOGLE_MAPS_URL,
  ],
  founder: [
    {
      '@type': 'Person',
      name: 'Marcos Cancelier',
      jobTitle: 'Sócio-Diretor · Contabilidade & Consultoria',
      identifier: 'CRC-PR 062232/O-1',
      image: 'https://privilegecontabilidade.cnt.br/foto-marcos.jpg',
      sameAs: ['https://www.instagram.com/marcos.cancelier'],
      description:
        'Contador registrado no CRC-PR 062232/O-1, Bacharel em Ciências Contábeis pela UTFPR com pós-graduações em Direito Tributário e Gestão Empresarial. Palestrante do SESCAP-PR.',
    },
    {
      '@type': 'Person',
      name: 'Mauricio Cielo',
      jobTitle: 'Sócio-Administrador · Consultoria Estratégica',
      identifier: 'CRC-PR 082974/O-7',
      image: 'https://privilegecontabilidade.cnt.br/foto-mauricio.jpg',
      sameAs: ['https://www.instagram.com/mauricio.cielo'],
      description:
        'Contador registrado no CRC-PR 082974/O-7, Bacharel em Ciências Contábeis com extensões em Auditoria e Riscos. Especialista em inteligência financeira, BPO e planejamento tributário.',
    },
  ],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Serviços Contábeis, Fiscais e Consultoria Financeira',
    itemListElement: [
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'BPO Financeiro em Francisco Beltrão',
          url: 'https://privilegecontabilidade.cnt.br/bpo-financeiro-francisco-beltrao',
          description:
            'Terceirização da gestão financeira para PMEs: contas a pagar, contas a receber, conciliação diária e fluxo de caixa.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Planejamento Tributário e Gestão Fiscal',
          url: 'https://privilegecontabilidade.cnt.br/planejamento-tributario',
          description:
            'Auditoria tributária, enquadramento Simples Nacional, Lucro Presumido e Lucro Real, preparação para Reforma Tributária.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Abertura de Empresas em Francisco Beltrão',
          url: 'https://privilegecontabilidade.cnt.br/abertura-de-empresa-francisco-beltrao',
          description:
            'Abertura rápida e legalização completa de empresas, emissão de CNPJ, alvarás e certidões negativas.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Contabilidade para Agronegócio e LCDPR',
          url: 'https://privilegecontabilidade.cnt.br/contabilidade-agronegocio',
          description:
            'Livro Caixa Digital do Produtor Rural, planejamento tributário agropecuário e gestão patrimonial para famílias produtoras.',
        },
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'UNCONFIGURED_CLIENT_ID';
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
        {gtmId && (
          <Script
            id="gtm-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${gtmId}');
              `,
            }}
          />
        )}
        {gaId && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaId}', {
                    page_path: window.location.pathname,
                  });
                `,
              }}
            />
          </>
        )}
      </head>
      <body className={fontMain.className} suppressHydrationWarning>
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        <GoogleOAuthProvider clientId={googleClientId}>
          <PwaAutoUpdate />
          <Toaster position="top-right" richColors />
          <ConfirmProvider />
          <TransitionProvider>{children}</TransitionProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
