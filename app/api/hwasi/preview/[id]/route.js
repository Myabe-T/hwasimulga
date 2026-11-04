export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { redis, KEYS, getPremium } from '@/lib/redis';
import { getSession } from '@/lib/auth';

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

  // 2. Insta Viral Protection: Check if this video is premium-only
  try {
    const rawCurated = await redis.get(KEYS.CURATED);
    let curated = rawCurated;
    while (typeof curated === 'string') curated = JSON.parse(curated);
    const instaviralIds = (curated?.instaviral || []).map(Number);
    if (instaviralIds.includes(num)) {
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

  // 3. Routing to correct CDN
  const videoUrl = num >= 10000
    ? `https://cdn.hindibf.com.co/${num - 10000}.mp4`
    : `https://cdn.desimms.com.co/${num}.mp4`;

  let range = req.headers.get('Range') || req.headers.get('range');
  if (!range) {
    range = 'bytes=0-2097151'; // 2MB default preview cap to save bandwidth
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; DesiHawasBot/1.0)',
    ...(range ? { Range: range } : {}),
  };

  try {
    const upstream = await fetch(videoUrl, { headers, signal: AbortSignal.timeout(15000) });
    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse('Not found', { status: upstream.status });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'video/mp4');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Content-Disposition', 'inline');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    responseHeaders.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');

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
