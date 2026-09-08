import { NextResponse } from 'next/server';
import { generateSampleOFX } from '../../../lib/ofx-parser';
import { requireAuth } from '../../../lib/api-auth';

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const banco = searchParams.get('banco') || '001';
    
    // Simula atraso na requisição de rede do Open Finance (1200ms)
    await new Promise(r => setTimeout(r, 1200));
    
    const ofxData = generateSampleOFX(banco);
    
    return new NextResponse(ofxData, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
