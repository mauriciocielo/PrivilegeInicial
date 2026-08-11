import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const getFilePath = () => path.join(process.cwd(), '.ativas.json');

export async function GET() {
  try {
    const filePath = getFilePath();
    if (!fs.existsSync(filePath)) {
      return NextResponse.json([]);
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading ativas.json', error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const list = await req.json();
    const filePath = getFilePath();
    fs.writeFileSync(filePath, JSON.stringify(list), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing ativas.json', error);
    return NextResponse.json({ error: 'Failed to write' }, { status: 500 });
  }
}
