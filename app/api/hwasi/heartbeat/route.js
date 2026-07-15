export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { updateSession } from '@/lib/redis';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

export async function POST(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const { payload } = await jwtVerify(cookie.value, SECRET);
    // Pull extra info from request body if provided
    const body = await req.json().catch(() => ({}));
    await updateSession(payload.sub, {
      userId:      payload.sub,
      username:    payload.username,
      displayName: payload.displayName,
      email:       body.email || null,
      role:        payload.role,
      avatar:      payload.avatar,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
