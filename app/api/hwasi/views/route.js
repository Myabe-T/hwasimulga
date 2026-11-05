export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getPremium, getViewCount, incrementViewCount, redis, getVideoCdn, getCurated } from '@/lib/redis';
import { signVideoId } from '@/lib/sign';
import { encryptPayload } from '@/lib/crypto';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

export async function POST(req) {
  const session = await getUser(req);

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

  // Check if video is marked as Premium (Insta Viral or curated Premium)
  const curatedData = await getCurated();
  const instaviralIds = (curatedData?.instaviral || []).map(Number);
  const premiumIds = (curatedData?.premium || []).map(Number);
  const isPremiumVideo = instaviralIds.includes(Number(videoId)) || premiumIds.includes(Number(videoId));

  // 1. Admin + Advisor always allowed
  if (session && ['admin','advisor'].includes(session.role)) {
    const cdnInfo = await getVideoCdn(videoId);
    const token = await signVideoId(videoId, cdnInfo?.cdnId, cdnInfo?.cdnVideoId);
    return NextResponse.json(await encryptPayload({ allowed: true, isPremium: true, token }));
  }

  // 2. Active Premium Subscriber
  if (session) {
    const sub = await getPremium(session.sub);
    if (sub) {
      const cdnInfo = await getVideoCdn(videoId);
      const token = await signVideoId(videoId, cdnInfo?.cdnId, cdnInfo?.cdnVideoId);
      return NextResponse.json(await encryptPayload({ allowed: true, isPremium: true, plan: sub.plan, expiresAt: sub.expiresAt, token }));
    }
  }

  // 3. Premium Video Lock: If video is Premium, non-premium members and guests are blocked
  if (isPremiumVideo) {
    return NextResponse.json(await encryptPayload({
      allowed: false,
      code: 'PREMIUM_ONLY',
      isPremiumOnly: true,
      msg: '💎 Exclusive VIP Video. Upgrade to Premium to unlock!'
    }));
  }

  // 4. Free Video Playback (Tube site model: guests & free members watch all normal videos freely!)
  const cdnInfo = await getVideoCdn(videoId);
  const token = await signVideoId(videoId, cdnInfo?.cdnId, cdnInfo?.cdnVideoId);

  return NextResponse.json(await encryptPayload({
    allowed: true,
    isGuest: !session,
    isPremium: false,
    token
  }));
}

export async function GET(req) {
  const session = await getUser(req);
  if (!session) {
    return NextResponse.json(await encryptPayload({ allowed: true, isGuest: true, isPremium: false, limit: 9999 }));
  }
  if (['admin','advisor'].includes(session.role)) {
    return NextResponse.json(await encryptPayload({ allowed: true, isPremium: true }));
  }

  const sub = await getPremium(session.sub);
  if (sub) {
    return NextResponse.json(await encryptPayload({ allowed: true, isPremium: true, plan: sub.plan, expiresAt: sub.expiresAt }));
  }

  return NextResponse.json(await encryptPayload({
    allowed: true,
    isPremium: false,
    limit: 9999,
  }));
}
