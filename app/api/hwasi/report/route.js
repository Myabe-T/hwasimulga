export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { addReport } from '@/lib/redis';

const VALID_REASONS = ['inappropriate', 'duplicate', 'broken', 'spam', 'other'];

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { videoId, reason } = await req.json();
  if (!videoId || !reason) return NextResponse.json({ error: 'videoId + reason required' }, { status: 400 });
  if (!VALID_REASONS.includes(reason)) return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  await addReport(videoId, session.sub, session.username, reason);
  return NextResponse.json({ ok: true });
}
