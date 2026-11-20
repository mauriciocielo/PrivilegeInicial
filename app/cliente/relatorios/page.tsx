'use client';

import dynamic from 'next/dynamic';
import { TableSkeleton } from '../../../components/ui';

const RelatoriosPage = dynamic(() => import('../../consultor/relatorios/page'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 28 }}>
      <TableSkeleton rows={6} cols={5} />
    </div>
  ),
});

export default function ClienteRelatoriosPage() {
  return <RelatoriosPage />;
}
