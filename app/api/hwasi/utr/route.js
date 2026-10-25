export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');
const KEY = 'hwasi:key_submissions';

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

// GET — admin/advisor sees ALL; regular user sees ONLY their own
export async function GET(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json(await encryptPayload({ error: 'Unauthorized' }), { status: 401 });

  const redis = await getRedis();
  let items = await redis.lrange(KEY, 0, 999);
  if (!items || items.length === 0) items = await redis.lrange('hwasi:utr_submissions', 0, 999).catch(() => []);
  const all = (items || []).map(i => { try { return JSON.parse(i); } catch { return null; } }).filter(Boolean);

  if (['admin', 'advisor'].includes(user.role)) {
    // Admin/advisor: return all submissions
    return NextResponse.json({ ok: true, submissions: all });
  }

  // Regular user: return only their own submissions, newest first
  const mine = all.filter(s => s.userId === user.sub || s.username === user.username);
  return NextResponse.json({ ok: true, submissions: mine });
}

// DELETE — admin: reject a UTR submission (marks as rejected, keeps in history)
export async function DELETE(req) {
  const user = await getUser(req);
  if (!user || !['admin','advisor'].includes(user.role)) return NextResponse.json(await encryptPayload({ error: 'Forbidden' }), { status: 403 });

  let body = {};
  try { body = await req.json(); } catch {}
  const { utrId, userId } = body;
  if (!utrId) return NextResponse.json(await encryptPayload({ error: 'utrId required' }), { status: 400 });

  const redis = await getRedis();
  const items = await redis.lrange(KEY, 0, 999);

  // Update the matching entry's status to 'rejected' — keep it in the list
  let updated = false;
  const newItems = (items || []).map(item => {
    try {
      const parsed = JSON.parse(item);
      if (parsed.utrId === utrId) {
        updated = true;
        return JSON.stringify({ ...parsed, status: 'rejected', rejectedAt: new Date().toISOString(), rejectedBy: user.username });
      }
    } catch {}
    return item;
  });

  if (updated) {
    // Atomically replace list with updated entries
    await redis.del(KEY);
    if (newItems.length > 0) await redis.rpush(KEY, ...newItems);
  }

  // Notify user of rejection via notifications HASH
  if (userId) {
    const { KEYS } = await import('@/lib/redis');
    const notification = JSON.stringify({
      message: `⚠️ Your UTR payment ID "${utrId}" could not be verified. Please double-check your UTR/transaction ID and resubmit, or contact support.`,
      from: '⚠️ Payment System',
      timestamp: new Date().toISOString(),
      type: 'utr_rejected',
    });
    await redis.hset(KEYS.NOTIFICATIONS, { [String(userId)]: notification });
  }

  return NextResponse.json(await encryptPayload({ ok: true, updated }));
}

// PATCH — admin: approve a UTR (sets status to approved, grants premium)
export async function PATCH(req) {
  const user = await getUser(req);
  if (!user || !['admin','advisor'].includes(user.role)) return NextResponse.json(await encryptPayload({ error: 'Forbidden' }), { status: 403 });

  let body = {};
  try { body = await req.json(); } catch {}
  const { utrId, userId, plan, days } = body;
  if (!utrId || !userId) return NextResponse.json(await encryptPayload({ error: 'utrId and userId required' }), { status: 400 });

  const redis = await getRedis();
  const items = await redis.lrange(KEY, 0, 999);

  let updated = false;
  const newItems = (items || []).map(item => {
    try {
      const parsed = JSON.parse(item);
      if (parsed.utrId === utrId) {
        updated = true;
        return JSON.stringify({ ...parsed, status: 'approved', approvedAt: new Date().toISOString(), approvedBy: user.username });
      }
    } catch {}
    return item;
  });

  if (updated) {
    await redis.del(KEY);
    if (newItems.length > 0) await redis.rpush(KEY, ...newItems);
  }

  // Grant premium if plan/days provided
  if (plan && days) {
    const { setPremium } = await import('@/lib/redis');
    await setPremium(userId, plan, Number(days), user.username);
  }

  return NextResponse.json(await encryptPayload({ ok: true, updated }));
}
