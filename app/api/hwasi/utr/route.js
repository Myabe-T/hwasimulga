export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');
const KEY = 'hwasi:utr_submissions';

import { redis } from '@/lib/redis';
async function getRedis() { return redis; }

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

// POST — submit UTR ID
export async function POST(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json(await encryptPayload({ error: 'Unauthorized' }), { status: 401 });
  const rawBody = await req.json();
    let utrId, plan;
    if (rawBody.cipher && rawBody.iv) {
      const decrypted = await decryptPayload(rawBody.cipher, rawBody.iv);
      if (!decrypted) return NextResponse.json(await encryptPayload({ error: 'Decryption failed. Check AES key.' }), { status: 400 });
      utrId = decrypted.utrId;
      plan = decrypted.plan;
    } else {
      utrId = rawBody.utrId;
      plan = rawBody.plan;
    }
  if (!utrId || utrId.trim().length < 6) return NextResponse.json(await encryptPayload({ error: 'Invalid UTR ID' }), { status: 400 });
  const redis = await getRedis();
  const entry = JSON.stringify({ userId: user.sub, username: user.username, displayName: user.displayName, utrId: utrId.trim(), plan: plan || 'unknown', timestamp: new Date().toISOString(), status: 'pending' });
  await redis.lpush(KEY, entry);
  await redis.ltrim(KEY, 0, 999);
  return NextResponse.json(await encryptPayload({ ok: true }));
}

// GET — admin: get all UTR submissions
export async function GET(req) {
  const user = await getUser(req);
  if (!user || !['admin','advisor'].includes(user.role)) return NextResponse.json(await encryptPayload({ error: 'Forbidden' }), { status: 403 });
  const redis = await getRedis();
  const items = await redis.lrange(KEY, 0, 199);
  const submissions = (items || []).map(i => { try { return JSON.parse(i); } catch { return null; } }).filter(Boolean);
  return NextResponse.json({ ok: true, submissions });
}

// DELETE — admin: reject/delete a UTR submission and notify user
export async function DELETE(req) {
  const user = await getUser(req);
  if (!user || !['admin','advisor'].includes(user.role)) return NextResponse.json(await encryptPayload({ error: 'Forbidden' }), { status: 403 });

  let body = {};
  try { body = await req.json(); } catch {}
  const { utrId, userId } = body;
  if (!utrId) return NextResponse.json(await encryptPayload({ error: 'utrId required' }), { status: 400 });

  const redis = await getRedis();
  const items = await redis.lrange(KEY, 0, 999);
  // Filter out the matching entry and rewrite the entire list
  const filtered = (items || []).filter(item => {
    try { return JSON.parse(item).utrId !== utrId; } catch { return true; }
  });
  const removed = filtered.length < (items || []).length;
  // Atomically replace list
  await redis.del(KEY);
  if (filtered.length > 0) {
    await redis.rpush(KEY, ...filtered);
  }

  // Send a one-time notification to the user via device-message system
  if (userId) {
    const msgKey = `hwasi:device_msg:${userId}`;
    const notification = JSON.stringify({
      msg: `⚠️ Your UTR payment ID "${utrId}" could not be verified. Please double-check your UTR/transaction ID and resubmit, or contact support.`,
      ts: Date.now(),
      type: 'utr_rejected'
    });
    await redis.set(msgKey, notification, { ex: 60 * 60 * 24 * 3 }); // expires in 3 days
  }

  return NextResponse.json(await encryptPayload({ ok: true, removed }));
}

