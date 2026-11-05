export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth, getSession } from '@/lib/auth';
import { addHistory, getHistory, recordVideoView, recordDailyVisitor, getTopWatchedVideos, getVisitorStats } from '@/lib/redis';

export async function POST(req) {
  const session = await getSession();
  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const videoId = body.videoId;
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 });

  // Admin watches are not stored in public user history
  if (session?.role === 'admin') return NextResponse.json({ ok: true, skipped: true });

  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';
  const ua = req.headers.get('user-agent') || '';

  // 1. Record in real-time view counter leaderboard
  await recordVideoView(videoId);

  // 2. Track unique visitor by IP hash
  await recordDailyVisitor(ip, ua);

  // 3. Add to history log (both members and guests)
  await addHistory({
    userId: session ? session.sub : null,
    username: session ? session.username : 'guest',
    displayName: session ? (session.displayName || session.username) : 'Guest Visitor',
    isGuest: !session,
    ip: ip.split(',')[0].trim(),
    videoId: String(videoId),
    watchedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const { error, status } = await requireAuth(['admin', 'advisor']);
  if (error) return NextResponse.json({ error }, { status });

  const [historyList, topVideos, visitorStats] = await Promise.all([
    getHistory(10000),
    getTopWatchedVideos(10),
    getVisitorStats(),
  ]);

  return NextResponse.json({
    ok: true,
    history: historyList,
    topVideos,
    visitorStats,
  });
}
