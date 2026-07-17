export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

import { redis } from '@/lib/redis';
async function getRedis() { return redis; }

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

// GET — public: return current watch limit + message
export async function GET() {
  try {
    const redis = await getRedis();
    const [limit, msg] = await Promise.all([
      redis.get('hwasi:watch_limit'),
      redis.get('hwasi:watch_limit_msg'),
    ]);
    return NextResponse.json({ ok: true, limit: limit ? Number(limit) : 5, msg: msg || '' });
  } catch {
    return NextResponse.json({ ok: true, limit: 5, msg: '' });
  }
}

// PUT — admin only: set watch limit + optional message
export async function PUT(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { limit, msg } = await req.json();
    const redis = await getRedis();
    const validLimit = Math.max(1, Math.min(999, Number(limit) || 5));
    await redis.set('hwasi:watch_limit', String(validLimit));
    if (msg && msg.trim()) {
      await redis.set('hwasi:watch_limit_msg', msg.trim());
    } else {
      await redis.del('hwasi:watch_limit_msg');
    }
    return NextResponse.json({ ok: true, limit: validLimit, msg: msg?.trim() || '' });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}
