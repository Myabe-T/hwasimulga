export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCurated, redis, KEYS } from '@/lib/redis';

export async function GET() {
  return NextResponse.json(await getCurated(), {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
      'CDN-Cache-Control': 'public, max-age=120',
    }
  });
}

export async function PUT(req) {
  const { error, status } = await requireAuth(['admin','advisor']);
  if (error) return NextResponse.json({ error }, { status });
  const body = await req.json();
  const cur = await getCurated();
  const updated = { ...cur, ...body };
  await redis.set(KEYS.CURATED, JSON.stringify(updated));
  return NextResponse.json(updated);
}
