export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try {
    const { payload } = await jwtVerify(cookie.value, SECRET);
    return payload;
  } catch {
    return null;
  }
}

let counter = 0;
function uid() {
  return `cmt_${Date.now().toString(36)}_${(++counter).toString(36)}`;
}

export async function GET(req) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get('id');
  if (!videoId) return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });

  try {
    const rawList = await redis.lrange(`hwasi:comments:${videoId}`, 0, 99) || [];
    const comments = rawList.map(item => {
      try { return typeof item === 'string' ? JSON.parse(item) : item; }
      catch { return null; }
    }).filter(Boolean);

    return NextResponse.json({ ok: true, comments }, {
      headers: {
        'Cache-Control': 'public, max-age=10, s-maxage=30, stale-while-revalidate=60',
      }
    });
  } catch (err) {
    return NextResponse.json({ ok: true, comments: [] });
  }
}

export async function POST(req) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Please login to post a comment' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { videoId, text } = body;
    if (!videoId || !text || !text.trim()) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    const cleanText = text.trim().slice(0, 500);

    const comment = {
      id: uid(),
      userId: user.id || user.username,
      username: user.username,
      displayName: user.displayName || user.username,
      text: cleanText,
      timestamp: new Date().toISOString()
    };

    await redis.rpush(`hwasi:comments:${videoId}`, JSON.stringify(comment));

    return NextResponse.json({ ok: true, comment });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
