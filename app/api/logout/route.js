export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { removeSession } from '@/lib/redis';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

export async function POST(req) {
  // Try to remove session from Redis before clearing cookie
  try {
    const cookie = req.cookies.get('hwasi_token');
    if (cookie?.value) {
      const { payload } = await jwtVerify(cookie.value, SECRET);
      if (payload?.sub) await removeSession(payload.sub);
    }
  } catch { /* token may already be invalid — that's fine */ }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('hwasi_token', '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 0, path: '/'
  });
  return res;
}
