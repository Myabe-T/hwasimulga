export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth, getSession } from '@/lib/auth';
import { getSettings, redis, KEYS } from '@/lib/redis';
import { encryptPayload } from '@/lib/crypto';

export async function GET() {
  const session = await getSession();
  const settings = await getSettings();
  let deletedIds = [];
  if (session && (session.role === 'admin' || session.role === 'advisor')) {
    const rawDeleted = await redis.smembers('hwasi:deleted:index');
    deletedIds = Array.from(rawDeleted || []).map(Number);
  }
  const payload = await encryptPayload({ ...settings, deletedIds });
  return NextResponse.json(payload);
}

export async function PUT(req) {
  const { error, status } = await requireAuth(['admin','advisor']);
  if (error) return NextResponse.json(await encryptPayload({ error }), { status });
  const body = await req.json();
  const cur = await getSettings();
  const updated = { ...cur, ...body };
  await redis.set(KEYS.SETTINGS, JSON.stringify(updated));
  return NextResponse.json(await encryptPayload(updated));
}
