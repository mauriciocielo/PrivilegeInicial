import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/api-auth';
import { sincronizarLoteNfseAdn } from '../../../../lib/nfse/sincronizar-adn';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/nfse/sincronizar-lote
 * Executa uma rodada de sincronização de NFS-e (ADN Nacional) para empresas aptas.
 * Aceita sessão de administrador ou CRON_SECRET via Bearer/query token.
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '') || null;
    const segredo = process.env.CRON_SECRET;
    const autorizadoCron = Boolean(segredo && token === segredo);

    if (!autorizadoCron) {
      const auth = await requireAuth(request);
      if (auth.error) return auth.error;
      if (auth.session.role !== 'administrador') {
        return NextResponse.json({ error: 'Apenas administradores podem acionar o lote global.' }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const limite = Math.max(1, Math.min(50, Number(body?.limite) || 20));
    const resultado = await sincronizarLoteNfseAdn(limite, 50_000);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    console.error('Erro em POST /api/nfse/sincronizar-lote:', error);
    return NextResponse.json({ error: 'Erro ao sincronizar lote de NFS-e.' }, { status: 500 });
  }
}
