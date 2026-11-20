'use client';

import dynamic from 'next/dynamic';
import { TableSkeleton } from '../../../components/ui';

const NfsePainel = dynamic(() => import('../../../components/NfsePainel'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 28 }}>
      <TableSkeleton rows={6} cols={6} />
    </div>
  ),
});

export default function NfseClientePage() {
  return <NfsePainel modoCliente />;
}
