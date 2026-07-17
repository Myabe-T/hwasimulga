export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { encryptPayload } from '@/lib/crypto';
import { signVideoId } from '@/lib/sign';
import { jwtVerify } from 'jose';
import { redis } from '@/lib/redis';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

// GET /api/hwasi/share/[id]
// Returns a short Redis-stored share code instead of full AES cipher in URL
export async function GET(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const session = await getUser(req);

  // Generate a short random code and store videoId in Redis with 7-day TTL
  const code = Array.from(crypto.getRandomValues(new Uint8Array(9)))
    .map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 12);

  const shareData = { id: Number(id), ts: Date.now() };
  await redis.set(`share:${code}`, JSON.stringify(shareData), { ex: 60 * 60 * 24 * 7 });

  return NextResponse.json({ token: code });
}
