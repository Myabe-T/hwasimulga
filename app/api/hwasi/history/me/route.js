export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getHistory } from '@/lib/redis';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const all = await getHistory(500);
  const mine = all.filter(h => h.userId === session.sub).slice(0, 50);
  return NextResponse.json(mine);
}
