export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getPremium, getViewCount, incrementViewCount } from '@/lib/redis';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

async function getWatchLimit() {
  try {
    const { Redis } = await import('@upstash/redis/cloudflare');
    const redis = new Redis({ url: process.env.UPSTASH_REDIS_URL, token: process.env.UPSTASH_REDIS_TOKEN });
    const v = await redis.get('hwasi:watch_limit');
    return v ? Number(v) : 5;
  } catch { return 5; }
}

async function getWatchLimitMsg() {
  try {
    const { Redis } = await import('@upstash/redis/cloudflare');
    const redis = new Redis({ url: process.env.UPSTASH_REDIS_URL, token: process.env.UPSTASH_REDIS_TOKEN });
    const v = await redis.get('hwasi:watch_limit_msg');
    return v || null;
  } catch { return null; }
}

// POST /api/hwasi/views — check + increment view count
// body: { videoId, fingerprint }
// Returns: { allowed, count, limit, remaining, isPremium, hoursLeft, limitMsg }
export async function POST(req) {
  const session = await getUser(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Admin + Advisor always allowed
  if (['admin','advisor'].includes(session.role)) return NextResponse.json({ allowed: true, isPremium: true });

  // Check premium status
  const sub = await getPremium(session.sub);
  if (sub) return NextResponse.json({ allowed: true, isPremium: true, plan: sub.plan, expiresAt: sub.expiresAt });

  const FREE_LIMIT = await getWatchLimit();
  const limitMsg = await getWatchLimitMsg();

  // Track by USER ID (most reliable — each account gets their own N free views)
  const userId = session.sub || session.username;
  const userKey = `user:${userId}`;
  const count = await getViewCount(userKey);

  if (count >= FREE_LIMIT) {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const hoursLeft = Math.ceil((tomorrow - now) / 3600000);
    return NextResponse.json({ allowed: false, count, limit: FREE_LIMIT, remaining: 0, hoursLeft, limitMsg });
  }

  await incrementViewCount(userKey);
  const newCount = count + 1;
  return NextResponse.json({
    allowed: true,
    isPremium: false,
    count: newCount,
    limit: FREE_LIMIT,
    remaining: FREE_LIMIT - newCount,
    limitMsg,
  });
}

// GET /api/hwasi/views — check without incrementing
export async function GET(req) {
  const session = await getUser(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (['admin','advisor'].includes(session.role)) return NextResponse.json({ allowed: true, isPremium: true });

  const sub = await getPremium(session.sub);
  if (sub) return NextResponse.json({ allowed: true, isPremium: true, plan: sub.plan, expiresAt: sub.expiresAt });

  const FREE_LIMIT = await getWatchLimit();
  const limitMsg = await getWatchLimitMsg();

  const userId = session.sub || session.username;
  const userKey = `user:${userId}`;
  const count = await getViewCount(userKey);

  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const hoursLeft = Math.ceil((tomorrow - now) / 3600000);

  return NextResponse.json({
    allowed: count < FREE_LIMIT,
    isPremium: false,
    count,
    limit: FREE_LIMIT,
    remaining: Math.max(0, FREE_LIMIT - count),
    hoursLeft,
    limitMsg,
  });
}
