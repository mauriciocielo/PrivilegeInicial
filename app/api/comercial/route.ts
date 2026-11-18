import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getComercialData, saveComercialSection } from '@/lib/comercial-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const empresaId = searchParams.get('empresaId') || 'default';
    const data = await getComercialData(empresaId);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const empresaId = body.empresaId || 'default';
    if (!body.sectionKey) {
      return NextResponse.json({ success: false, error: 'sectionKey obrigatório' }, { status: 400 });
    }
    const data = await saveComercialSection(empresaId, body.sectionKey, body.value);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
