import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import TransitionProvider from '../components/TransitionProvider';
import ConfirmProvider from '../components/ConfirmProvider';
import { GoogleOAuthProvider } from '@react-oauth/google';

const fontMain = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const SITE_DESC =
  'Escritório de contabilidade consultiva e BPO financeiro em Francisco Beltrão, Paraná. '
  + 'Escrituração fiscal, folha de pagamento, abertura de empresas e planejamento tributário '
  + 'para Simples Nacional, Lucro Presumido e Lucro Real.';

export const metadata: Metadata = {
  // O título/descrição antigos falavam do portal interno — mas esta é a metadata
  // que o Google e as prévias de link (WhatsApp, LinkedIn) leem da página pública.
  title: {
    default: 'Privilege Contabilidade e Consultoria — Francisco Beltrão, PR',
    template: '%s · Privilege Contabilidade',
  },
  description: SITE_DESC,
  manifest: '/manifest.json',
  keywords: [
    'contabilidade Francisco Beltrão', 'contador Francisco Beltrão', 'BPO financeiro',
    'planejamento tributário', 'abertura de empresa', 'escritório de contabilidade Paraná',
  ],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Privilege Contabilidade e Consultoria',
    title: 'Privilege Contabilidade e Consultoria — Francisco Beltrão, PR',
    description: SITE_DESC,
    images: [{ url: '/logo.png', width: 1200, height: 630, alt: 'Privilege Contabilidade e Consultoria' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privilege Contabilidade e Consultoria',
    description: SITE_DESC,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={fontMain.className} suppressHydrationWarning>
        <GoogleOAuthProvider clientId={googleClientId}>
          <Toaster position="top-right" richColors />
          <ConfirmProvider />
          <TransitionProvider>{children}</TransitionProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
