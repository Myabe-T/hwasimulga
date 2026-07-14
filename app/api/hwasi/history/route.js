export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth, getSession } from '@/lib/auth';
import { addHistory, getHistory } from '@/lib/redis';

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { videoId } = await req.json();
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 });
  await addHistory({
    userId: session.sub, username: session.username,
    displayName: session.displayName, videoId: String(videoId),
    watchedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const { error, status } = await requireAuth('admin');
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(await getHistory(500));
}
