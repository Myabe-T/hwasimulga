export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { encryptPayload } from '@/lib/crypto';
import { signVideoId } from '@/lib/sign';
import { jwtVerify } from 'jose';
import { redis, KEYS } from '@/lib/redis';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

// GET /api/hwasi/share/[id]
// Returns a short code stored in hwasi:shares HASH (single key for all share tokens)
export async function GET(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const code = Array.from(crypto.getRandomValues(new Uint8Array(9)))
    .map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 12);

  const shareData = JSON.stringify({
    id: Number(id),
    ts: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Store in HASH — one key for all share tokens
  await redis.hset(KEYS.SHARES, { [code]: shareData });

  return NextResponse.json({ token: code });
}
