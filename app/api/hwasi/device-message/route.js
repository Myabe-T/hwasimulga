export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function getRedis() {
  const { Redis } = await import('@upstash/redis/cloudflare');
  return new Redis({ url: process.env.UPSTASH_REDIS_URL, token: process.env.UPSTASH_REDIS_TOKEN });
}

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
  const redis = await getRedis();
  const key = `hwasi:user_msg:${userId}`;
  const entry = JSON.stringify({ message, from: 'Admin', timestamp: new Date().toISOString(), read: false });
  await redis.set(key, entry, { ex: 60 * 60 * 24 * 7 }); // expire in 7 days
  return NextResponse.json({ ok: true });
}

// GET — viewer: get their own message (if any)
export async function GET(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: null });
  const redis = await getRedis();
  const key = `hwasi:user_msg:${user.sub}`;
  const data = await redis.get(key);
  if (!data) return NextResponse.json({ message: null });
  const msg = typeof data === 'string' ? JSON.parse(data) : data;
  // Mark as read by deleting it after fetch
  await redis.del(key);
  return NextResponse.json({ message: msg });
}
