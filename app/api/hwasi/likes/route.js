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

export async function GET(req) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get('id');
  if (!videoId) return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });

  const user = await getUser(req);
  const userId = user?.id || user?.username || req.headers.get('cf-connecting-ip') || 'anon';
  const isAdmin = user?.role === 'admin';

  try {
    const [likesCount, dislikesCount, isLiked, isDisliked] = await Promise.all([
      isAdmin ? redis.scard(`hwasi:likes:${videoId}`) : Promise.resolve(0),
      isAdmin ? redis.scard(`hwasi:dislikes:${videoId}`) : Promise.resolve(0),
      redis.sismember(`hwasi:likes:${videoId}`, userId),
      redis.sismember(`hwasi:dislikes:${videoId}`, userId),
    ]);

    const resData = {
      liked: Boolean(isLiked),
      disliked: Boolean(isDisliked),
    };

    // Only Admin can see exact count numbers as requested
    if (isAdmin) {
      resData.likesCount = Number(likesCount || 0);
      resData.dislikesCount = Number(dislikesCount || 0);
    }

    return NextResponse.json(resData, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (e) {
    return NextResponse.json({ liked: false, disliked: false });
  }
}

export async function POST(req) {
  const user = await getUser(req);
  const userId = user?.id || user?.username || req.headers.get('cf-connecting-ip') || 'anon';
  const isAdmin = user?.role === 'admin';

  try {
    const body = await req.json();
    const { videoId, action } = body;
    if (!videoId || !action) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const likesKey = `hwasi:likes:${videoId}`;
    const dislikesKey = `hwasi:dislikes:${videoId}`;

    if (action === 'like') {
      await Promise.all([
        redis.sadd(likesKey, userId),
        redis.srem(dislikesKey, userId)
      ]);
    } else if (action === 'unlike') {
      await redis.srem(likesKey, userId);
    } else if (action === 'dislike') {
      await Promise.all([
        redis.sadd(dislikesKey, userId),
        redis.srem(likesKey, userId)
      ]);
    } else if (action === 'undislike') {
      await redis.srem(dislikesKey, userId);
    }

    const [likesCount, dislikesCount, isLiked, isDisliked] = await Promise.all([
      isAdmin ? redis.scard(likesKey) : Promise.resolve(0),
      isAdmin ? redis.scard(dislikesKey) : Promise.resolve(0),
      redis.sismember(likesKey, userId),
      redis.sismember(dislikesKey, userId),
    ]);

    const resData = {
      ok: true,
      liked: Boolean(isLiked),
      disliked: Boolean(isDisliked)
    };

    if (isAdmin) {
      resData.likesCount = Number(likesCount || 0);
      resData.dislikesCount = Number(dislikesCount || 0);
    }

    return NextResponse.json(resData);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
