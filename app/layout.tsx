import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import TransitionProvider from '../components/TransitionProvider';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Privilege Contabilidade e Consultoria',
  description: 'Portal de gestão de fluxo de caixa para consultores e clientes. Lançamentos, importação OFX, relatórios e dashboards financeiros.',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={montserrat.className} suppressHydrationWarning>
        <Toaster position="top-right" richColors />
        <TransitionProvider>{children}</TransitionProvider>
      </body>
    </html>
  );
}
