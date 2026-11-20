'use client';

import dynamic from 'next/dynamic';
import { TableSkeleton } from '../../../components/ui';

const ImportarOfxPage = dynamic(() => import('../../consultor/importar-ofx/page'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 28 }}>
      <TableSkeleton rows={6} cols={5} />
    </div>
  ),
});

export default function ClienteImportarOfxPage() {
  return <ImportarOfxPage />;
}
