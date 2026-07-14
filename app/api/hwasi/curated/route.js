export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth, getSession } from '@/lib/auth';
import { getCurated, redis, KEYS } from '@/lib/redis';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await getCurated());
}

export async function PUT(req) {
  const { error, status } = await requireAuth('admin');
  if (error) return NextResponse.json({ error }, { status });
  const body = await req.json();
  const cur = await getCurated();
  const updated = { ...cur, ...body };
  await redis.set(KEYS.CURATED, JSON.stringify(updated));
  return NextResponse.json(updated);
}
