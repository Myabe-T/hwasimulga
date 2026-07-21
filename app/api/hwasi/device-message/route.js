export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { redis, KEYS } from '@/lib/redis';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

// POST — admin sends message to a user
export async function POST(req) {
  const adminUser = await getUser(req);
  if (!adminUser || adminUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId, message } = await req.json();
  if (!userId || !message) return NextResponse.json({ error: 'userId and message required' }, { status: 400 });
  const entry = JSON.stringify({ message, from: 'Admin', timestamp: new Date().toISOString(), read: false, type: 'admin' });
  // Store in HASH (single hwasi:notifications key)
  await redis.hset(KEYS.NOTIFICATIONS, { [String(userId)]: entry });
  return NextResponse.json({ ok: true });
}

// GET — viewer: get their own notification (if any), delete after read (show once)
export async function GET(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: null });

  const userId = String(user.sub || user.username);

  // Check HASH notification (new format — covers both admin msg & UTR rejection)
  const notifRaw = await redis.hget(KEYS.NOTIFICATIONS, userId);
  if (notifRaw) {
    const parsed = typeof notifRaw === 'string' ? JSON.parse(notifRaw) : notifRaw;
    await redis.hdel(KEYS.NOTIFICATIONS, userId); // show only once
    return NextResponse.json({
      message: {
        message:   parsed.message || parsed.msg,
        from:      parsed.from || (parsed.type === 'utr_rejected' ? '⚠️ Payment System' : 'Admin'),
        timestamp: parsed.timestamp || new Date(parsed.ts || Date.now()).toISOString(),
        type:      parsed.type || 'admin',
      }
    });
  }

  // Legacy fallback: check old STRING keys (hwasi:user_msg:X and hwasi:device_msg:X)
  const adminKey = `hwasi:user_msg:${userId}`;
  const adminData = await redis.get(adminKey).catch(() => null);
  if (adminData) {
    const msg = typeof adminData === 'string' ? JSON.parse(adminData) : adminData;
    await redis.del(adminKey);
    return NextResponse.json({ message: { ...msg, type: msg.type || 'admin' } });
  }
  const utrKey = `hwasi:device_msg:${userId}`;
  const utrData = await redis.get(utrKey).catch(() => null);
  if (utrData) {
    const parsed = typeof utrData === 'string' ? JSON.parse(utrData) : utrData;
    await redis.del(utrKey);
    return NextResponse.json({
      message: {
        message:   parsed.msg || parsed.message,
        from:      '⚠️ Payment System',
        timestamp: new Date(parsed.ts || Date.now()).toISOString(),
        type:      parsed.type || 'utr_rejected',
      }
    });
  }

  return NextResponse.json({ message: null });
}
