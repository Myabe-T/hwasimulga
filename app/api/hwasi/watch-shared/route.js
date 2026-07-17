export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { encryptPayload } from '@/lib/crypto';
import { getPremium, getViewCount, incrementViewCount, redis } from '@/lib/redis';
import { signVideoId } from '@/lib/sign';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

async function getWatchLimit() {
  try { const v = await redis.get('hwasi:watch_limit'); return v ? Number(v) : 5; } catch { return 5; }
}

// POST /api/hwasi/watch-shared
// body: { shareToken } — short 12-char Redis code
export async function POST(req) {
  const session = await getUser(req);
  if (!session) {
    return NextResponse.json(await encryptPayload({ error: 'Please login to watch this video', code: 'LOGIN_REQUIRED' }), { status: 401 });
  }

  let body;
  try {
    const raw = await req.json();
    body = raw;
  } catch {
    return NextResponse.json(await encryptPayload({ error: 'Invalid request' }), { status: 400 });
  }

  const { shareToken } = body || {};
  if (!shareToken) return NextResponse.json(await encryptPayload({ error: 'Missing shareToken' }), { status: 400 });

  // Look up share code in Redis
  const stored = await redis.get(`share:${shareToken}`);
  if (!stored) {
    return NextResponse.json(await encryptPayload({ error: 'Invalid or expired share link' }), { status: 400 });
  }

  let videoId;
  try {
    const parsed = JSON.parse(stored);
    videoId = parsed.id;
  } catch {
    return NextResponse.json(await encryptPayload({ error: 'Corrupted share data' }), { status: 400 });
  }

  if (!videoId) return NextResponse.json(await encryptPayload({ error: 'Invalid share data' }), { status: 400 });

  // Admin/advisor always allowed
  if (['admin', 'advisor'].includes(session.role)) {
    const streamToken = await signVideoId(videoId);
    return NextResponse.json(await encryptPayload({ allowed: true, token: streamToken, isPremium: true }));
  }

  // Check premium from DB
  const sub = await getPremium(session.sub);
  if (sub) {
    const streamToken = await signVideoId(videoId);
    return NextResponse.json(await encryptPayload({ allowed: true, token: streamToken, isPremium: true, plan: sub.plan }));
  }

  // Check free limit from DB
  const FREE_LIMIT = await getWatchLimit();
  const userId = session.sub || session.username;
  const userKey = `user:${userId}`;
  const count = await getViewCount(userKey);

  if (count >= FREE_LIMIT) {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const hoursLeft = Math.ceil((tomorrow - now) / 3600000);
    return NextResponse.json(await encryptPayload({
      allowed: false, count, limit: FREE_LIMIT, remaining: 0, hoursLeft, code: 'LIMIT_REACHED'
    }));
  }

  await incrementViewCount(userKey);
  const streamToken = await signVideoId(videoId);
  return NextResponse.json(await encryptPayload({
    allowed: true, token: streamToken, isPremium: false,
    remaining: FREE_LIMIT - count - 1,
  }));
}
