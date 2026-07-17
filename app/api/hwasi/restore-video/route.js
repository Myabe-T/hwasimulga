export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

import { redis } from '@/lib/redis';
async function getRedis() { return redis; }

// POST — admin/advisor: restore a deleted video by ID
export async function POST(req) {
  const { error, status } = await requireAuth(['admin','advisor']);
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const redis = await getRedis();
  // Remove from deleted index
  await redis.srem('hwasi:deleted:index', String(id));
  // Remove from deleted log list matching this id (get all, filter out, re-save)
  const items = await redis.lrange('hwasi:deleted', 0, 999);
  const filtered = (items || []).filter(i => {
    try { return JSON.parse(i).id !== String(id); } catch { return true; }
  });
  await redis.del('hwasi:deleted');
  if (filtered.length > 0) {
    for (const item of filtered.slice().reverse()) {
      await redis.lpush('hwasi:deleted', item);
    }
  }
  return NextResponse.json({ ok: true });
}
