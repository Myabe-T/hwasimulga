export const runtime = 'edge';

// /api/hwasi/thumb-stream/[id]
// Admin-only CORS streaming proxy for thumbnail generation.
//
// Why this works when partial-blob approach fails:
//   • Partial blob: browser gets invalid MP4 (moov offsets point to original file positions)
//   • This proxy: browser makes its OWN range requests natively, finds moov wherever it is,
//     decodes correctly. We add Access-Control-Allow-Origin so canvas can capture the frame.
//
// Chrome's media stack automatically handles non-faststart MP4s by:
//   1. Fetching initial bytes (finds ftyp/mdat)
//   2. If no moov yet, uses Content-Length to peek at file end
//   3. Makes a second range request for the last N bytes → finds moov
//   4. Fires loadedmetadata with correct duration → seek works
//
// This proxy just forwards range requests transparently and adds CORS headers.

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const CDN_BASE = 'https://cdn.desimms.com.co';
const UA = 'Mozilla/5.0 (compatible; DesiHawasBot/1.0)';

export async function GET(req, { params }) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const videoUrl = `${CDN_BASE}/${id}.mp4`;

  // Forward Range header from browser (critical for seekable streaming)
  const rangeHeader = req.headers.get('Range') || req.headers.get('range') || '';

  try {
    const upstream = await fetch(videoUrl, {
      headers: {
        ...(rangeHeader ? { 'Range': rangeHeader } : {}),
        'User-Agent': UA,
        'Accept': 'video/mp4,video/*,*/*',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse(`CDN error ${upstream.status}`, { status: 502 });
    }

    // Build response headers — forward Content-Length, Content-Range, and add CORS
    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set('Access-Control-Allow-Origin', '*');   // ← allows canvas capture
    headers.set('Access-Control-Allow-Methods', 'GET');
    headers.set('Accept-Ranges', 'bytes');             // ← browser needs this to seek
    headers.set('Cache-Control', 'no-store');

    const cl = upstream.headers.get('content-length');
    if (cl) headers.set('Content-Length', cl);

    const cr = upstream.headers.get('content-range');
    if (cr) headers.set('Content-Range', cr);

    // Stream the body — don't buffer it in memory (Cloudflare memory limit)
    return new NextResponse(upstream.body, {
      status: upstream.status, // 200 or 206
      headers,
    });
  } catch (e) {
    return new NextResponse(`Proxy error: ${e.message}`, { status: 502 });
  }
}

export async function HEAD(req, { params }) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const videoUrl = `${CDN_BASE}/${id}.mp4`;

  try {
    const upstream = await fetch(videoUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
    });

    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Accept-Ranges', 'bytes');

    const cl = upstream.headers.get('content-length');
    if (cl) headers.set('Content-Length', cl);

    return new NextResponse(null, { status: upstream.status, headers });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
