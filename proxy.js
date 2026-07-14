import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

// Public paths — no auth needed
const PUBLIC = ['/login', '/api/login', '/api/logout'];

export async function proxy(req) {
  const { pathname } = req.nextUrl;

  // Static assets — always pass through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.svg')
  ) {
    return NextResponse.next();
  }

  // Public routes
  if (PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Verify JWT
  const token = req.cookies.get('hwasi_token')?.value;
  if (!token) {
    // API calls → 401, page requests → redirect to login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  let payload;
  try {
    const result = await jwtVerify(token, SECRET);
    payload = result.payload;
  } catch {
    const res = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', req.url));
    res.cookies.set('hwasi_token', '', { maxAge: 0, path: '/' });
    return res;
  }

  // Admin-only page guard
  if (pathname.startsWith('/admin') && payload.role !== 'admin') {
    return NextResponse.redirect(new URL('/gallery', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)).*)',
  ],
};
