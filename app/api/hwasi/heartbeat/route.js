export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { updateSession, recordDevice, isUserBlocked } from '@/lib/redis';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

export async function POST(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const { payload } = await jwtVerify(cookie.value, SECRET);

    // Check if user is blocked
    const blocked = await isUserBlocked(payload.sub);
    if (blocked) {
      return NextResponse.json({ ok: false, blocked: true }, { status: 403 });
    }

    // Pull extra info from request body
    const body = await req.json().catch(() => ({}));

    // Update online session
    await updateSession(payload.sub, {
      userId:      payload.sub,
      username:    payload.username,
      displayName: payload.displayName,
      email:       body.email || null,
      role:        payload.role,
      avatar:      payload.avatar,
    });

    // Record device fingerprint if provided
    if (body.fingerprint) {
      await recordDevice(payload.sub, body.fingerprint, payload.username, payload.displayName, body.deviceLabel || null);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
