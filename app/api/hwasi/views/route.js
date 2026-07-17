export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getPremium, getViewCount, incrementViewCount, redis } from '@/lib/redis';
import { signVideoId } from '@/lib/sign';
import { encryptPayload } from '@/lib/crypto';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

async function getWatchLimit() {
  try {
    const v = await redis.get('hwasi:watch_limit');
    return v ? Number(v) : 5;
  } catch { return 5; }
}

async function getWatchLimitMsg() {
  try {
    const v = await redis.get('hwasi:watch_limit_msg');
    return v || null;
  } catch { return null; }
}

export async function POST(req) {
  const session = await getUser(req);
  if (!session) return NextResponse.json(await encryptPayload({ error: 'Unauthorized' }), { status: 401 });

  // Support both encrypted (from secureFetch) and plain body
  let body = {};
  try {
    const raw = await req.json();
    if (raw && raw.cipher && raw.iv) {
      const { decryptPayload } = await import('@/lib/crypto');
      body = await decryptPayload(raw.cipher, raw.iv) || {};
    } else {
      body = raw || {};
    }
  } catch { body = {}; }

  const videoId = body.videoId;

  if (!videoId) {
    return NextResponse.json(await encryptPayload({ error: 'Missing videoId' }), { status: 400 });
  }

  // Admin + Advisor always allowed
  if (['admin','advisor'].includes(session.role)) {
    const token = await signVideoId(videoId);
    return NextResponse.json(await encryptPayload({ allowed: true, isPremium: true, token }));
  }

  // Check premium status
  const sub = await getPremium(session.sub);
  if (sub) {
    const token = await signVideoId(videoId);
    return NextResponse.json(await encryptPayload({ allowed: true, isPremium: true, plan: sub.plan, expiresAt: sub.expiresAt, token }));
  }

  const FREE_LIMIT = await getWatchLimit();
  const limitMsg = await getWatchLimitMsg();

  // Track by USER ID
  const userId = session.sub || session.username;
  const userKey = `user:${userId}`;
  const count = await getViewCount(userKey);

  if (count >= FREE_LIMIT) {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const hoursLeft = Math.ceil((tomorrow - now) / 3600000);
    return NextResponse.json(await encryptPayload({ allowed: false, count, limit: FREE_LIMIT, remaining: 0, hoursLeft, limitMsg }));
  }

  await incrementViewCount(userKey);
  const newCount = count + 1;
  const token = await signVideoId(videoId);
  
  return NextResponse.json(await encryptPayload({
    allowed: true,
    isPremium: false,
    count: newCount,
    limit: FREE_LIMIT,
    remaining: FREE_LIMIT - newCount,
    limitMsg,
    token
  }));
}

export async function GET(req) {
  const session = await getUser(req);
  if (!session) return NextResponse.json(await encryptPayload({ error: 'Unauthorized' }), { status: 401 });
  if (['admin','advisor'].includes(session.role)) return NextResponse.json(await encryptPayload({ allowed: true, isPremium: true }));

  const sub = await getPremium(session.sub);
  if (sub) return NextResponse.json(await encryptPayload({ allowed: true, isPremium: true, plan: sub.plan, expiresAt: sub.expiresAt }));

  const FREE_LIMIT = await getWatchLimit();
  const limitMsg = await getWatchLimitMsg();

  const userId = session.sub || session.username;
  const userKey = `user:${userId}`;
  const count = await getViewCount(userKey);

  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const hoursLeft = Math.ceil((tomorrow - now) / 3600000);

  return NextResponse.json(await encryptPayload({
    allowed: count < FREE_LIMIT,
    isPremium: false,
    count,
    limit: FREE_LIMIT,
    remaining: Math.max(0, FREE_LIMIT - count),
    hoursLeft,
    limitMsg,
  }));
}
