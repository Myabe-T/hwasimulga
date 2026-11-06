export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth, getSession } from '@/lib/auth';
import { getSettings, redis, KEYS } from '@/lib/redis';
import { encryptPayload } from '@/lib/crypto';

export async function GET() {
  const session = await getSession();
  let settings = await getSettings();
  while (typeof settings === 'string') {
    try { settings = JSON.parse(settings); } catch { break; }
  }
  if (settings && typeof settings === 'object') {
    delete settings.cipher;
    delete settings.iv;
  }
  let deletedIds = [];
  if (session && (session.role === 'admin' || session.role === 'advisor')) {
    const rawDeleted = await redis.smembers('hwasi:deleted:index');
    deletedIds = Array.from(rawDeleted || []).map(Number);
  }
  const payload = await encryptPayload({
    ...settings,
    start: Number(settings?.start) || 1,
    end: Number(settings?.end) || 1177,
    extraRanges: Array.isArray(settings?.extraRanges) ? settings.extraRanges : [],
    deletedIds
  });
  return NextResponse.json({
    ...payload,
    allowAnyEmailDomain: Boolean(settings?.allowAnyEmailDomain),
  });
}

export async function PUT(req) {
  const { error, status } = await requireAuth(['admin','advisor']);
  if (error) return NextResponse.json(await encryptPayload({ error }), { status });

  // Support both AES-encrypted body (from secureFetch) and plain JSON body
  let body = {};
  try {
    const raw = await req.json();
    if (raw && raw.cipher && raw.iv) {
      // Encrypted body from secureFetch — decrypt it
      const { decryptPayload } = await import('@/lib/crypto');
      body = await decryptPayload(raw.cipher, raw.iv) || {};
    } else {
      body = raw || {};
    }
  } catch { body = {}; }

  let cur = await getSettings();
  while (typeof cur === 'string') {
    try { cur = JSON.parse(cur); } catch { break; }
  }
  const updated = {
    ...cur,
    ...body,
    start: Number(body.start !== undefined ? body.start : cur.start) || 1,
    end: Number(body.end !== undefined ? body.end : cur.end) || 1177,
    extraRanges: Array.isArray(body.extraRanges !== undefined ? body.extraRanges : cur.extraRanges)
      ? (body.extraRanges !== undefined ? body.extraRanges : cur.extraRanges)
      : [],
  };
  delete updated.cipher;
  delete updated.iv;
  await redis.set(KEYS.SETTINGS, JSON.stringify(updated));
  return NextResponse.json(await encryptPayload(updated));
}
