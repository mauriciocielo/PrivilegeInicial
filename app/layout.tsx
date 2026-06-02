import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'FluxoCaixa Pro — Sistema de Gestão Financeira',
  description: 'Portal de gestão de fluxo de caixa para consultores e clientes. Lançamentos, importação OFX, relatórios e dashboards financeiros.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={montserrat.className}>{children}</body>
    </html>
  );
}
