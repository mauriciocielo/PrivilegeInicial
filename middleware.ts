import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  
  // Redirecionamento permanente (301) de www para sem www
  if (host.startsWith('www.')) {
    const newHost = host.replace(/^www\./, '');
    const newUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${newHost}`);
    return NextResponse.redirect(newUrl, 301);
  }

  // Redirecionamento 301 de /novo-layout para a home oficial /
  if (request.nextUrl.pathname === '/novo-layout' || request.nextUrl.pathname === '/novo-layout/') {
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt, og-image.png, etc.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|og-image.png).*)',
  ],
};

