import { NextResponse } from 'next/server';
import { atualizarStatusLog } from '../log/route';

// GIF transparente 1x1 pixel em Base64
const PIXEL_PNG = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    const ua = req.headers.get('user-agent') || '';

    if (id) {
      atualizarStatusLog(id, 'visualizado', ip, ua);
    }
  } catch {}

  return new NextResponse(PIXEL_PNG, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

