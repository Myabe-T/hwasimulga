export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { verifyVideoToken } from '@/lib/sign';

const CDN_BASE = 'https://cdn.desimms.com.co';

// GET /api/v/[token] — Signed redirect to CDN
// The CDN URL is NEVER exposed in the HTML/JS — only in the 302 redirect Location header
// Token expires in 30 minutes. Pass ?dl=1 for a download Content-Disposition.
export async function GET(req, { params }) {
  const { token } = await params;
  const id = await verifyVideoToken(token);
  if (!id) return new NextResponse('Token expired or invalid', { status: 403 });

  const url = `${CDN_BASE}/${id}.mp4`;
  const dl = new URL(req.url).searchParams.get('dl');

  // For playback: direct 302 to CDN (browsers won't expose URL in video src attribute)
  // For download: add Content-Disposition via our response first, then stream
  if (dl) {
    try {
      const upstream = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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

  return NextResponse.redirect(url, 302);
}
