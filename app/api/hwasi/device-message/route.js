export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { redis } from '@/lib/redis';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

// POST — admin sends message to a user
export async function POST(req) {
  const adminUser = await getUser(req);
  if (!adminUser || adminUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId, message } = await req.json();
  if (!userId || !message) return NextResponse.json({ error: 'userId and message required' }, { status: 400 });
  const key = `hwasi:user_msg:${userId}`;
  const entry = JSON.stringify({ message, from: 'Admin', timestamp: new Date().toISOString(), read: false });
  await redis.set(key, entry, { ex: 60 * 60 * 24 * 7 });
  return NextResponse.json({ ok: true });
}

// GET — viewer: get their own message (if any), also checks UTR rejection key
export async function GET(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: null });

  const userId = user.sub || user.username;

  // Check admin message first
  const adminKey = `hwasi:user_msg:${userId}`;
  const adminData = await redis.get(adminKey);
  if (adminData) {
    const msg = typeof adminData === 'string' ? JSON.parse(adminData) : adminData;
    await redis.del(adminKey);
    return NextResponse.json({ message: msg });
  }

  // Check UTR rejection notification (set by UTR DELETE route)
  const utrKey = `hwasi:device_msg:${userId}`;
  const utrData = await redis.get(utrKey);
  if (utrData) {
    const parsed = typeof utrData === 'string' ? JSON.parse(utrData) : utrData;
    await redis.del(utrKey); // show only once
    return NextResponse.json({
      message: {
        message: parsed.msg || parsed.message,
        from: '⚠️ Payment System',
        timestamp: new Date(parsed.ts || Date.now()).toISOString(),
        type: parsed.type || 'utr_rejected'
      }
    });
  }

  return NextResponse.json({ message: null });
}
