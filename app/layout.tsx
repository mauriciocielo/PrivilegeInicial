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

export const metadata: Metadata = {
  title: 'Privilege Contabilidade e Consultoria',
  description: 'Portal de gestão de fluxo de caixa para consultores e clientes. Lançamentos, importação OFX, relatórios e dashboards financeiros.',
  manifest: '/manifest.json',
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
