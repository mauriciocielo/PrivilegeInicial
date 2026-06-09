import { NextResponse } from 'next/server';
import db from '../../../lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collection = searchParams.get('collection');

    if (collection === 'cf_lancamentos') {
      const lastUpdated = await db.lancamento.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      });
      return NextResponse.json({
        lastUpdate: lastUpdated?.updatedAt?.toISOString() || null
      });
    }

    return NextResponse.json({ error: 'Collection not supported' }, { status: 400 });
  } catch (error) {
    console.error('Erro no sync-status:', error);
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 });
  }
}
