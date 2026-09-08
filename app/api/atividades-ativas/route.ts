import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { captureError } from '../../../lib/sentry-helper';
import { requireAuth } from '../../../lib/api-auth';

export const dynamic = 'force-dynamic';

const getFilePath = () => path.join(process.cwd(), '.ativas.json');

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  try {
    const filePath = getFilePath();
    if (!fs.existsSync(filePath)) {
      return NextResponse.json([]);
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading ativas.json', error);
    captureError(error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  try {
    const list = await req.json();
    const filePath = getFilePath();
    fs.writeFileSync(filePath, JSON.stringify(list), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing ativas.json', error);
    captureError(error);
    return NextResponse.json({ error: 'Failed to write' }, { status: 500 });
  }
}
