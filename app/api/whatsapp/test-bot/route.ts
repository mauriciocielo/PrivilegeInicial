import { NextRequest, NextResponse } from 'next/server';
import { simulateBotResponse } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = (body.text || '').trim();

    if (!text) {
      return NextResponse.json({ success: false, error: 'Texto é obrigatório' }, { status: 400 });
    }

    const result = await simulateBotResponse(text, body.triageState);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
