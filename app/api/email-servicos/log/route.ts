import { NextResponse } from 'next/server';
import { lerLogs } from '../../../../lib/email-log-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tipo = url.searchParams.get('tipo');

  let logs = lerLogs();
  if (tipo) logs = logs.filter(l => l.tipo === tipo);

  return NextResponse.json({ ok: true, logs });
}
