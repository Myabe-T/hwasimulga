export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');
const KEY = 'hwasi:payment_settings';

async function getRedis() {
  const { Redis } = await import('@upstash/redis/cloudflare');
  return new Redis({ url: process.env.UPSTASH_REDIS_URL, token: process.env.UPSTASH_REDIS_TOKEN });
}

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

// GET — public: get payment settings
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
  const user = await getUser(req);
  if (!user) return NextResponse.json(await encryptPayload({ error: 'Unauthorized' }), { status: 401 });
  if (user.role !== 'admin') return NextResponse.json(await encryptPayload({ error: 'Forbidden' }), { status: 403 });
  try {
    const body = await req.json();
    const redis = await getRedis();
    const allowed = {
      maintenanceMode: Boolean(body.maintenanceMode),
      upiId: body.upiId || '',
      qrUrl: body.qrUrl || '',
    };
    await redis.set(KEY, JSON.stringify(allowed));
    return NextResponse.json({ ok: true, settings: allowed });
  } catch(e) {
    return NextResponse.json(await encryptPayload({ error: e.message || 'Server error' }), { status: 500 });
  }
}
