import type { Metadata } from 'next';
import FormularioPerfil from '../../../components/perfil-disc/FormularioPerfil';

// O endereço carrega o token de quem responde: fora de buscadores e fora do cabeçalho Referer.
export const metadata: Metadata = {
  title: 'Perfil Comportamental',
  description: 'Formulário de perfil comportamental.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function PerfilPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <FormularioPerfil token={token} />;
}
