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

  // Always request only the first 1.8MB slice for lightweight, fast hover preview
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; DesiHawasBot/1.0)',
    'Range': 'bytes=0-1887436',
  };

  try {
    const upstream = await fetch(videoUrl, { headers, signal: AbortSignal.timeout(12000) });
    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse('Not found', { status: upstream.status });
    }

    const chunkBuffer = await upstream.arrayBuffer();

    const responseHeaders = new Headers();
    // Use application/octet-stream — IDM Chrome Extension completely ignores binary data streams!
    // Never send video/mp4 over the wire for previews so IDM sniffer is NEVER triggered.
    responseHeaders.set('Content-Type', 'application/octet-stream');
    responseHeaders.set('Content-Length', String(chunkBuffer.byteLength));
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Content-Disposition', 'inline');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    // Strong edge caching so Cloudflare caches this 1.8MB slice for instant repeated loads
    responseHeaders.set('Cache-Control', 'public, max-age=604800, s-maxage=604800, immutable');
    responseHeaders.set('CDN-Cache-Control', 'public, max-age=604800');

    // Return status 200 OK — NEVER 206 Partial Content, NEVER expose Content-Range with upstream 300MB total size!
    return new NextResponse(chunkBuffer, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err) {
    return new NextResponse('Preview Unavailable', { status: 500 });
  }
}
