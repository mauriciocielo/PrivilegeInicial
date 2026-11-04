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
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return NextResponse.json([]);
    if (auth.session.role === 'administrador') {
      return NextResponse.json(parsed);
    }
    const allowed = new Set(auth.session.empresaIds);
    return NextResponse.json(parsed.filter((item: any) => item && allowed.has(item.empresaId)));
  } catch (error) {
    console.error('Error reading ativas.json', error);
    captureError(error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  if (auth.session.role === 'cliente') {
    return NextResponse.json({ error: 'Apenas equipe interna pode atualizar atividades ativas.' }, { status: 403 });
  }
  try {
    const list = await req.json();
    if (!Array.isArray(list)) {
      return NextResponse.json({ error: 'Formato inválido' }, { status: 400 });
    }
    const filePath = getFilePath();
    if (auth.session.role === 'administrador') {
      fs.writeFileSync(filePath, JSON.stringify(list), 'utf-8');
    } else {
      const allowed = new Set(auth.session.empresaIds);
      const filteredIncoming = list.filter((item: any) => item && allowed.has(item.empresaId));
      let existingOther: any[] = [];
      if (fs.existsSync(filePath)) {
        try {
          const current = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (Array.isArray(current)) {
            existingOther = current.filter((item: any) => item && !allowed.has(item.empresaId));
          }
        } catch {
          // ignore
        }
      }
      fs.writeFileSync(filePath, JSON.stringify([...existingOther, ...filteredIncoming]), 'utf-8');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing ativas.json', error);
    captureError(error);
    return NextResponse.json({ error: 'Failed to write' }, { status: 500 });
  }
}
