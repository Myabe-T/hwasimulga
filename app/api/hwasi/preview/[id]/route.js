export const runtime = 'edge';

import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { id } = await params;
  const num = Number(id);
  if (!num || isNaN(num)) return new NextResponse('Bad Request', { status: 400 });

  const videoUrl = num >= 10000
    ? `https://cdn.hindibf.com.co/${num - 10000}.mp4`
    : `https://cdn.desimms.com.co/${num}.mp4`;

  const range = req.headers.get('Range') || req.headers.get('range');
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
