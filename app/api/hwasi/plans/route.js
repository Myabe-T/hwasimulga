export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getPlans, savePlans } from '@/lib/redis';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const plans = await getPlans();
  return NextResponse.json({ plans }, {
    headers: {
      'Cache-Control': 'public, max-age=120, s-maxage=300, stale-while-revalidate=600',
      'CDN-Cache-Control': 'public, max-age=300',
    }
  });
}

export async function PUT(req) {
  const { error, status } = await requireAuth(['admin']);
  if (error) return NextResponse.json({ error }, { status });
  const body = await req.json();
  if (!body.plans) return NextResponse.json({ error: 'Missing plans' }, { status: 400 });
  await savePlans(body.plans);
  return NextResponse.json({ ok: true });
}
