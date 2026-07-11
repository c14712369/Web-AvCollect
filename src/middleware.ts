import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, isValidSession } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function middleware(req: NextRequest) {
  // 本機開發（next dev）免登入；next build/start 與正式部署仍強制驗證
  if (process.env.NODE_ENV === 'development') return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const secret = process.env.APP_SECRET;
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'Server misconfigured: APP_SECRET unset' },
      { status: 500 }
    );
  }

  const cookieValue = req.cookies.get(AUTH_COOKIE)?.value;
  const valid = await isValidSession(cookieValue, secret);

  if (valid) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.*\\..*|manifest.webmanifest|robots.txt).*)',
  ],
};
