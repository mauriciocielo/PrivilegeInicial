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
const SITE_DESC =
  'Escritório de contabilidade consultiva, BPO financeiro e planejamento tributário em Francisco Beltrão, PR. '
  + 'Abertura de empresas, escrituração fiscal, folha de pagamento, controladoria e contabilidade para agronegócio (LCDPR). '
  + 'Simples Nacional, Lucro Presumido e Lucro Real.';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://privilegecontabilidade.cnt.br'),
  title: {
    default: SITE_TITLE,
    template: '%s · Privilege Contabilidade',
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
    'recuperação tributária',
    'gestão financeira BPO',
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
        alt: 'Privilege Contabilidade e Consultoria — Francisco Beltrão, PR',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESC,
    images: ['/og-image.png'],
  },
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
    'https://www.linkedin.com/company/privilege-assessoria-cont%C3%A1bil/',
  ],
  founder: [
    {
      '@type': 'Person',
      name: 'Marcos Cancelier',
      jobTitle: 'Contador e Consultor Tributário',
      description: 'Especialista em Gestão Empresarial e Planejamento Tributário. Contador registrado no CRC-PR.',
    },
    {
      '@type': 'Person',
      name: 'Mauricio Meurer',
      jobTitle: 'Consultor Empresarial e Estratégico',
      description: 'Especialista em BPO financeiro, controladoria e expansão de negócios.',
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
          description: 'Terceirização da gestão financeira para PMEs: contas a pagar, contas a receber, conciliação diária e fluxo de caixa.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Planejamento Tributário e Gestão Fiscal',
          url: 'https://privilegecontabilidade.cnt.br/planejamento-tributario',
          description: 'Auditoria tributária, enquadramento Simples Nacional, Lucro Presumido e Lucro Real, preparação para Reforma Tributária.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Abertura de Empresas em Francisco Beltrão',
          url: 'https://privilegecontabilidade.cnt.br/abertura-de-empresa-francisco-beltrao',
          description: 'Abertura rápida e legalização completa de empresas, emissão de CNPJ, alvarás e certidões negativas.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Contabilidade para Agronegócio e LCDPR',
          url: 'https://privilegecontabilidade.cnt.br/contabilidade-agronegocio',
          description: 'Livro Caixa Digital do Produtor Rural, planejamento tributário agropecuário e gestão patrimonial para famílias produtoras.',
        },
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'UNCONFIGURED_CLIENT_ID';
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
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
