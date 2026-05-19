import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FluxoCaixa Pro — Sistema de Gestão Financeira',
  description: 'Portal de gestão de fluxo de caixa para consultores e clientes. Lançamentos, importação OFX, relatórios e dashboards financeiros.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
