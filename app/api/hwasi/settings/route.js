export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth, getSession } from '@/lib/auth';
import { getSettings, redis, KEYS } from '@/lib/redis';

export async function GET() {
  const settings = await getSettings();
  const deletedIds = await redis.smembers('hwasi:deleted:index');
  return NextResponse.json({ ...settings, deletedIds: Array.from(deletedIds || []).map(Number) });
}

export async function PUT(req) {
  const { error, status } = await requireAuth(['admin','advisor']);
  if (error) return NextResponse.json({ error }, { status });
  const body = await req.json();
  const cur = await getSettings();
  const updated = { ...cur, ...body };
  await redis.set(KEYS.SETTINGS, JSON.stringify(updated));
  return NextResponse.json(updated);
}
