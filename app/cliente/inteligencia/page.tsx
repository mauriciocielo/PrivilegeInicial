'use client';

import dynamic from 'next/dynamic';
import { TableSkeleton } from '../../../components/ui';

const InteligenciaPage = dynamic(() => import('../../consultor/inteligencia/page'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 28 }}>
      <TableSkeleton rows={6} cols={4} />
    </div>
  ),
});

export default function ClienteInteligenciaPage() {
  return <InteligenciaPage />;
}
