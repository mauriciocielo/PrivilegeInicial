'use client';

import dynamic from 'next/dynamic';
import { TableSkeleton } from '../../../components/ui';

const LancamentosPage = dynamic(() => import('../../consultor/lancamentos/page'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 28 }}>
      <TableSkeleton rows={8} cols={6} />
    </div>
  ),
});

export default function ClienteLancamentosPage() {
  return <LancamentosPage />;
}
