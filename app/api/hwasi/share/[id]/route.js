export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { encryptPayload } from '@/lib/crypto';
import { signVideoId } from '@/lib/sign';
import { jwtVerify } from 'jose';
import { getPremium, getViewCount, incrementViewCount, redis } from '@/lib/redis';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

async function getWatchLimit() {
  try { const v = await redis.get('hwasi:watch_limit'); return v ? Number(v) : 5; } catch { return 5; }
}

// GET /api/hwasi/share/[id] — generate encrypted share token for a video
// Now: checks if user is premium/has remaining views. Non-auth users get a limited preview token.
export async function GET(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const session = await getUser(req);

  // Always admin/advisor can share
  if (session && ['admin','advisor'].includes(session.role)) {
    const token = await signVideoId(Number(id));
    const shareToken = `${(await encryptPayload({ id: Number(id), ts: Date.now() })).cipher}.${(await encryptPayload({ id: Number(id), ts: Date.now() })).iv}`;
    return NextResponse.json({ token: shareToken });
  }

  // Premium users can share
  if (session) {
    const sub = await getPremium(session.sub);
    if (sub) {
      const shareToken = (async () => {
        const enc = await encryptPayload({ id: Number(id), ts: Date.now(), premium: true });
        return `${enc.cipher}.${enc.iv}`;
      })();
      return NextResponse.json({ token: await shareToken });
    }
  }

  // Free users: check remaining views
  if (session) {
    const FREE_LIMIT = await getWatchLimit();
    const userId = session.sub || session.username;
    const count = await getViewCount(`user:${userId}`);
    if (count >= FREE_LIMIT) {
      // Share link but viewer must be premium to play
      const enc = await encryptPayload({ id: Number(id), ts: Date.now(), limited: true });
      return NextResponse.json({ token: `${enc.cipher}.${enc.iv}`, limited: true });
    }
    const enc = await encryptPayload({ id: Number(id), ts: Date.now() });
    return NextResponse.json({ token: `${enc.cipher}.${enc.iv}` });
  }

  // Not logged in users: share link still works, but viewer is gated by their own limit
  const enc = await encryptPayload({ id: Number(id), ts: Date.now() });
  return NextResponse.json({ token: `${enc.cipher}.${enc.iv}` });
}
