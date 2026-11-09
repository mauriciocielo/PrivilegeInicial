import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Área do Cliente — Acesso ao Sistema',
  description: 'Portal de acesso restrito e seguro para clientes e consultores da Privilege Contabilidade e Consultoria.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  alternates: {
    canonical: 'https://privilegecontabilidade.cnt.br/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
