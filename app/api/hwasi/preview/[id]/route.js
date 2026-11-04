export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { redis, KEYS, getPremium } from '@/lib/redis';
import { getSession } from '@/lib/auth';

// In-memory cache for instaviral curated list to eliminate 200-300ms Redis latency on preview requests
let cachedInstaviralIds = null;
let lastInstaviralFetch = 0;

async function getInstaviralIds() {
  const now = Date.now();
  if (cachedInstaviralIds && (now - lastInstaviralFetch < 60000)) {
    return cachedInstaviralIds;
  }
  try {
    const rawCurated = await redis.get(KEYS.CURATED);
    let curated = rawCurated;
    while (typeof curated === 'string') curated = JSON.parse(curated);
    cachedInstaviralIds = new Set((curated?.instaviral || []).map(Number));
    lastInstaviralFetch = now;
  } catch (_) {
    if (!cachedInstaviralIds) cachedInstaviralIds = new Set();
  }
  return cachedInstaviralIds;
}

export async function GET(req, { params }) {
  // 1. Block automated download managers and scrapers (IDM, wget, curl, etc.)
  const userAgent = req.headers.get('user-agent') || '';
  if (/idm|internet\s*download\s*manager|idman|download\s*accelerator|wget|curl|python-requests|aria2|jdownloader/i.test(userAgent)) {
    return new NextResponse('Access Denied: External download managers are blocked on DesiHawas.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const { id } = await params;
  const num = Number(id);
  if (!num || isNaN(num)) return new NextResponse('Bad Request', { status: 400 });

  // 2. Insta Viral Protection: Check if this video is premium-only (cached in memory)
  try {
    const instaviralIds = await getInstaviralIds();
    if (instaviralIds.has(num)) {
      const session = await getSession();
      if (!session) {
        return new NextResponse('Login and Premium required to preview Insta Viral videos.', { status: 403 });
      }
      if (session.role !== 'admin' && session.role !== 'advisor') {
        const prem = await getPremium(session.sub || session.id);
        if (!prem) {
          return new NextResponse('Premium membership required for Insta Viral videos.', { status: 403 });
        }
      }
    }
  } catch (_) {}

  // 3. Routing to correct CDN (both CDNs supported seamlessly)
  const videoUrl = num >= 10000
    ? `https://cdn.hindibf.com.co/${num - 10000}.mp4`
    : `https://cdn.desimms.com.co/${num}.mp4`;

  let range = req.headers.get('Range') || req.headers.get('range');
  
  // Range handling:
  // - Initial request with no range or bytes=0- → cap to first 1MB for instant sub-second preview start
  // - Suffix range (bytes=-500000) for reading tail moov metadata → forward directly
  // - Other range requests → cap slice to max 1MB
  if (!range || range === 'bytes=0-') {
    range = 'bytes=0-1048575';
  } else if (/^bytes=-\d+$/.test(range)) {
    // Suffix range allowed as-is (used by MP4 demuxer to find tail moov)
  } else {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : start + 1048575;
      const cappedEnd = Math.min(end, start + 1048575);
      range = `bytes=${start}-${cappedEnd}`;
    }
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; DesiHawasBot/1.0)',
    ...(range ? { Range: range } : {}),
  };

  try {
    const upstream = await fetch(videoUrl, {
      headers,
      signal: AbortSignal.timeout(12000),
      cf: {
        cacheTtl: 604800,
        cacheEverything: true,
      },
    });
    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse('Not found', { status: upstream.status });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'video/mp4');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Content-Disposition', 'inline');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    // Strong edge caching for fast repeat loads across Cloudflare POPs
    responseHeaders.set('Cache-Control', 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400');
    responseHeaders.set('CDN-Cache-Control', 'public, max-age=604800');

    if (upstream.headers.has('Content-Range')) {
      responseHeaders.set('Content-Range', upstream.headers.get('Content-Range'));
    }
    if (upstream.headers.has('Content-Length')) {
      responseHeaders.set('Content-Length', upstream.headers.get('Content-Length'));
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return new NextResponse('Preview Unavailable', { status: 500 });
  }
}
