export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');
const KEY = 'hwasi:utr_submissions';

async function getRedis() {
  const { Redis } = await import('@upstash/redis/cloudflare');
  return new Redis({ url: process.env.UPSTASH_REDIS_URL, token: process.env.UPSTASH_REDIS_TOKEN });
}

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

// POST — submit UTR ID
export async function POST(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json(await encryptPayload({ error: 'Unauthorized' }), { status: 401 });
  const rawBody = await req.json();
    let utrId, plan;
    if (rawBody.cipher && rawBody.iv) {
      const decrypted = await decryptPayload(rawBody.cipher, rawBody.iv);
      if (!decrypted) return NextResponse.json(await encryptPayload({ error: 'Decryption failed. Check AES key.' }), { status: 400 });
      utrId = decrypted.utrId;
      plan = decrypted.plan;
    } else {
      utrId = rawBody.utrId;
      plan = rawBody.plan;
    }
  if (!utrId || utrId.trim().length < 6) return NextResponse.json(await encryptPayload({ error: 'Invalid UTR ID' }), { status: 400 });
  const redis = await getRedis();
  const entry = JSON.stringify({ userId: user.sub, username: user.username, displayName: user.displayName, utrId: utrId.trim(), plan: plan || 'unknown', timestamp: new Date().toISOString(), status: 'pending' });
  await redis.lpush(KEY, entry);
  await redis.ltrim(KEY, 0, 999);
  return NextResponse.json(await encryptPayload({ ok: true }));
}

// GET — admin: get all UTR submissions
export async function GET(req) {
  const user = await getUser(req);
  if (!user || !['admin','advisor'].includes(user.role)) return NextResponse.json(await encryptPayload({ error: 'Forbidden' }), { status: 403 });
  const redis = await getRedis();
  const items = await redis.lrange(KEY, 0, 199);
  const submissions = (items || []).map(i => { try { return JSON.parse(i); } catch { return null; } }).filter(Boolean);
  return NextResponse.json({ ok: true, submissions });
}
