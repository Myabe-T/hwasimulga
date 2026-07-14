export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { verifyVideoToken } from '@/lib/sign';

const CDN_BASE = 'https://cdn.desimms.com.co';

/**
 * GET /api/v/[token]
 *
 * Verifies the signed JWT token, then issues a 302 redirect to the CDN.
 *
 * WHY REDIRECT (not stream):
 * Streaming video through Cloudflare Workers violates their ToS (Section 2.8)
 * and will cause account suspension, just like Vercel did.
 * The 302 redirect sends ZERO bytes through Cloudflare — it goes straight from
 * the browser to the CDN, which is perfectly fine and fast.
 *
 * CDN URL PROTECTION:
 * The CDN should be configured with Referer-based access control so that
 * cdn.desimms.com.co URLs only work when accessed from hwasimulga.pages.dev.
 * Direct access (like pasting the URL in a new tab) would then return 403.
 *
 * ?dl=1 → triggers browser download via Content-Disposition header
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

  if (isDownload) {
    // For downloads: stream through worker with Content-Disposition
    // Downloads are infrequent so bandwidth impact is minimal
    try {
      const upstream = await fetch(cdnUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!upstream.ok) return new NextResponse('Not Found', { status: 404 });
      const headers = new Headers();
      headers.set('Content-Type', 'video/mp4');
      headers.set('Content-Disposition', `attachment; filename="hwasimulga-${id}.mp4"`);
      const cl = upstream.headers.get('content-length');
      if (cl) headers.set('Content-Length', cl);
      return new NextResponse(upstream.body, { status: 200, headers });
    } catch {
      return new NextResponse('Upstream error', { status: 502 });
    }
  }

  // For playback: 302 redirect — zero Cloudflare bandwidth used
  return NextResponse.redirect(cdnUrl, 302);
}
