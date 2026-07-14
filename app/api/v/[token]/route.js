export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { verifyVideoToken } from '@/lib/sign';

const CDN_BASE = 'https://cdn.desimms.com.co';

/**
 * GET /api/v/[token]
 *
 * STREAMS the video through Cloudflare — CDN URL is NEVER sent to the browser.
 * The <video> src stays as /api/v/<token> forever, even in "Open in new tab".
 *
 * Range requests (for seeking/scrubbing) are forwarded to the CDN so video
 * playback speed is unaffected — we just relay bytes, no extra processing.
 *
 * ?dl=1  →  adds Content-Disposition: attachment  (triggers browser download)
 */
export async function GET(req, { params }) {
  const { token } = await params;
  const id = await verifyVideoToken(token);
  if (!id) {
    return new NextResponse('Link expired. Please go back and click play again.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const cdnUrl = `${CDN_BASE}/${id}.mp4`;
  const isDownload = new URL(req.url).searchParams.get('dl') === '1';

  // Forward the Range header so seeking / partial content works at full speed
  const upstreamHeaders = new Headers();
  upstreamHeaders.set('User-Agent', 'Mozilla/5.0');
  const rangeHeader = req.headers.get('range');
  if (rangeHeader) upstreamHeaders.set('Range', rangeHeader);

  let upstream;
  try {
    upstream = await fetch(cdnUrl, { headers: upstreamHeaders });
  } catch {
    return new NextResponse('CDN unreachable', { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse('Video not found', { status: 404 });
  }

  // Build response headers
  const resHeaders = new Headers();
  resHeaders.set('Content-Type', 'video/mp4');
  resHeaders.set('Accept-Ranges', 'bytes');
  // No caching — each token is single-use scoped
  resHeaders.set('Cache-Control', 'no-store, no-cache');
  // Prevent browser from sniffing the real URL
  resHeaders.set('Referrer-Policy', 'no-referrer');

  // Forward byte-range metadata so the browser knows the file size for seeking
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) resHeaders.set('Content-Length', contentLength);
  const contentRange = upstream.headers.get('content-range');
  if (contentRange) resHeaders.set('Content-Range', contentRange);

  if (isDownload) {
    resHeaders.set('Content-Disposition', `attachment; filename="hwasimulga-${id}.mp4"`);
  }

  // Stream bytes directly — body is a ReadableStream, zero buffering in Worker
  return new NextResponse(upstream.body, {
    status: upstream.status, // 200 or 206 (partial content)
    headers: resHeaders,
  });
}
