export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
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
// body: { shareToken }
// Validates share token, checks user limits, returns video stream token
export async function POST(req) {
  const session = await getUser(req);
  if (!session) {
    return NextResponse.json(await encryptPayload({ error: 'Please login to watch this video', code: 'LOGIN_REQUIRED' }), { status: 401 });
  }

  let body;
  try {
    const raw = await req.json();
    if (raw.cipher && raw.iv) {
      body = await decryptPayload(raw.cipher, raw.iv);
    } else {
      body = raw;
    }
  } catch {
    return NextResponse.json(await encryptPayload({ error: 'Invalid request' }), { status: 400 });
  }

  const { shareToken } = body || {};
  if (!shareToken) return NextResponse.json(await encryptPayload({ error: 'Missing shareToken' }), { status: 400 });

  // Decrypt the share token
  const parts = shareToken.split('.');
  if (parts.length !== 2) return NextResponse.json(await encryptPayload({ error: 'Invalid share token' }), { status: 400 });
  
  const sharePayload = await decryptPayload(parts[0], parts[1]);
  if (!sharePayload || !sharePayload.id) {
    return NextResponse.json(await encryptPayload({ error: 'Invalid or expired share link' }), { status: 400 });
  }

  const videoId = sharePayload.id;

  // Admin/advisor always allowed
  if (['admin','advisor'].includes(session.role)) {
    const streamToken = await signVideoId(videoId);
    return NextResponse.json(await encryptPayload({ allowed: true, token: streamToken, isPremium: true }));
  }

  // Check premium from DB (never trust client-side role)
  const sub = await getPremium(session.sub);
  if (sub) {
    const streamToken = await signVideoId(videoId);
    return NextResponse.json(await encryptPayload({ allowed: true, token: streamToken, isPremium: true, plan: sub.plan }));
  }

  // CRITICAL: Always re-check limit from DB, never trust client-sent values
  const FREE_LIMIT = await getWatchLimit();
  const userId = session.sub || session.username;
  const userKey = `user:${userId}`;
  const count = await getViewCount(userKey);

  if (count >= FREE_LIMIT) {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const hoursLeft = Math.ceil((tomorrow - now) / 3600000);
    return NextResponse.json(await encryptPayload({
      allowed: false,
      count,
      limit: FREE_LIMIT,
      remaining: 0,
      hoursLeft,
      code: 'LIMIT_REACHED'
    }));
  }

  // Increment and issue stream token
  await incrementViewCount(userKey);
  const streamToken = await signVideoId(videoId);
  return NextResponse.json(await encryptPayload({
    allowed: true,
    token: streamToken,
    isPremium: false,
    remaining: FREE_LIMIT - count - 1,
  }));
}
