import { NextResponse } from 'next/server';
import { lerLogs, atualizarStatusLog } from '../log/route';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  // Se não informar o ID, redireciona para o site oficial da Privilege
  if (!id) {
    return NextResponse.redirect('https://privilegecontabilidade.com.br');
  }

  const logs = lerLogs();
  const item = logs.find(l => l.id === id);

  if (!item || !item.html) {
    return NextResponse.redirect('https://privilegecontabilidade.com.br');
  }

  // Registra visualização no histórico
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  const ua = req.headers.get('user-agent') || '';
  atualizarStatusLog(id, 'visualizado', ip, ua);

  // Barra de navegação oficial no topo com link para o site
  const topBarSite = `
    <div style="background: #600000; color: #ffffff; padding: 12px 18px; text-align: center; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: bold; position: sticky; top: 0; z-index: 99999; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
      <span>Privilege Contabilidade e Consultoria · Visualização Oficial</span>
      <a href="https://privilegecontabilidade.com.br" target="_blank" style="color: #fef08a; text-decoration: underline; background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 4px;">
        Acessar Nosso Site (privilegecontabilidade.com.br) &rarr;
      </a>
    </div>
  `;

  let htmlRender = item.html;
  if (htmlRender.includes('<body')) {
    htmlRender = htmlRender.replace(/(<body[^>]*>)/i, `$1${topBarSite}`);
  } else {
    htmlRender = `${topBarSite}${htmlRender}`;
  }

  return new NextResponse(htmlRender, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

