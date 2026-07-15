export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPremium, getViewCount, incrementViewCount } from '@/lib/redis';

const FREE_LIMIT = 5;

// POST /api/hwasi/views — check + increment view count
// body: { videoId, fingerprint }
// Returns: { allowed, count, limit, remaining, isPremium, hoursLeft }
export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Admin + Advisor always allowed
  if (['admin','advisor'].includes(session.role)) return NextResponse.json({ allowed: true, isPremium: true });

  // Check premium status
  const sub = await getPremium(session.sub);
  if (sub) return NextResponse.json({ allowed: true, isPremium: true, plan: sub.plan, expiresAt: sub.expiresAt });

  // Get IP from Cloudflare headers
  const ip = req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';

  const { fingerprint } = await req.json().catch(() => ({}));

  // Check both IP-based and fingerprint-based counts
  const ipCount = await getViewCount(`ip:${ip}`);
  const fpCount = fingerprint ? await getViewCount(`fp:${fingerprint}`) : 0;
  const count = Math.max(ipCount, fpCount);

  if (count >= FREE_LIMIT) {
    // Calculate hours until reset (next midnight UTC)
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const hoursLeft = Math.ceil((tomorrow - now) / 3600000);
    return NextResponse.json({ allowed: false, count, limit: FREE_LIMIT, remaining: 0, hoursLeft });
  }

  // Increment both keys
  await incrementViewCount(`ip:${ip}`);
  if (fingerprint) await incrementViewCount(`fp:${fingerprint}`);

  const newCount = count + 1;
  return NextResponse.json({
    allowed: true,
    isPremium: false,
    count: newCount,
    limit: FREE_LIMIT,
    remaining: FREE_LIMIT - newCount,
  });
}

// GET /api/hwasi/views — check without incrementing
export async function GET(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (['admin','advisor'].includes(session.role)) return NextResponse.json({ allowed: true, isPremium: true });

  const sub = await getPremium(session.sub);
  if (sub) return NextResponse.json({ allowed: true, isPremium: true, plan: sub.plan, expiresAt: sub.expiresAt });

  const ip = req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';

  const count = await getViewCount(`ip:${ip}`);
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
  });
}
