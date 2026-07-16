export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const KEY = 'hwasi:payment_settings';

async function getRedis() {
  const { Redis } = await import('@upstash/redis/cloudflare');
  return new Redis({ url: process.env.UPSTASH_REDIS_URL, token: process.env.UPSTASH_REDIS_TOKEN });
}

// GET — public: get payment settings (maintenance mode, upiId, qrUrl)
export async function GET() {
  try {
    const redis = await getRedis();
    const data = await redis.get(KEY);
    const settings = data ? (typeof data === 'string' ? JSON.parse(data) : data) : {};
    return NextResponse.json({ ok: true, settings });
  } catch(e) {
    return NextResponse.json({ ok: false, settings: {} });
  }
}

// PUT — admin only: update payment settings
export async function PUT(req) {
  const { error, status } = await requireAuth(['admin']);
  if (error) return NextResponse.json({ error }, { status });
  const body = await req.json();
  const redis = await getRedis();
  // Only allow specific keys
  const allowed = { maintenanceMode: Boolean(body.maintenanceMode), upiId: body.upiId || '', qrUrl: body.qrUrl || '' };
  await redis.set(KEY, JSON.stringify(allowed));
  return NextResponse.json({ ok: true, settings: allowed });
}
