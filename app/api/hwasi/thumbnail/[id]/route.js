export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getThumbnail, setThumbnail, deleteThumbnail } from '@/lib/redis';

const CDN_BASE = 'https://cdn.desimms.com.co';
const UA = 'Mozilla/5.0 (compatible; DesiHawasBot/1.0)';

// GET /api/hwasi/thumbnail/[id] — serve thumbnail as JPEG image
export async function GET(req, { params }) {
  const { id } = await params;
  const b64 = await getThumbnail(id);
  if (!b64) return new NextResponse('Not Found', { status: 404 });

  try {
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length < 100) return new NextResponse('Not Found', { status: 404 });
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
        'CDN-Cache-Control': 'public, max-age=604800',
      },
    });
  } catch {
    return new NextResponse('Error', { status: 500 });
  }
}

// POST /api/hwasi/thumbnail/[id] — store thumbnail (base64 dataUrl from browser)
export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { dataUrl } = body;

  if (!dataUrl || !dataUrl.startsWith('data:image/jpeg;base64,'))
    return NextResponse.json({ error: 'Invalid data — must be JPEG dataUrl' }, { status: 400 });
  if (dataUrl.length > 2_800_000)
    return NextResponse.json({ error: 'Thumbnail too large' }, { status: 413 });

  await setThumbnail(id, dataUrl);
  return NextResponse.json({ ok: true, id });
}

// PUT /api/hwasi/thumbnail/[id] — SERVER-SIDE video fetch for client-side capture
// Strategy: fetch BOTH the first 1MB AND the last 3MB of the file.
//   • First 1MB  → ftyp box + start of mdat (video frames data)
//   • Last  3MB  → moov atom (codec params, frame table, duration)
// This works for BOTH faststart MP4s (moov at start) and non-faststart (moov at end).
// The browser receives combined bytes, finds moov → initialises video → decodes frame 0.
export async function PUT(req, { params }) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const videoUrl = `${CDN_BASE}/${id}.mp4`;

  const FIRST = 2 * 1024 * 1024;  // 2MB start (ftyp + early frames)
  const LAST  = 3 * 1024 * 1024;  // 3MB end   (moov atom for non-faststart)

  try {
    // Step 1: HEAD — get Content-Length so we can compute the end range
    let contentLength = 0;
    try {
      const head = await fetch(videoUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(8000),
      });
      contentLength = Number(head.headers.get('content-length') || 0);
    } catch { /* ignore — will fall back to linear fetch */ }

    let combined;

    if (contentLength > 0 && contentLength <= FIRST + LAST) {
      // Small file — fetch everything
      const r = await fetch(videoUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) return NextResponse.json({ error: `CDN ${r.status}` }, { status: 502 });
      combined = new Uint8Array(await r.arrayBuffer());

    } else if (contentLength > FIRST + LAST) {
      // Large file — fetch start AND end in parallel (covers faststart + non-faststart)
      const startEnd = contentLength - LAST;
      const [rStart, rEnd] = await Promise.all([
        fetch(videoUrl, {
          headers: { 'Range': `bytes=0-${FIRST - 1}`, 'User-Agent': UA },
          signal: AbortSignal.timeout(15000),
        }),
        fetch(videoUrl, {
          headers: { 'Range': `bytes=${startEnd}-${contentLength - 1}`, 'User-Agent': UA },
          signal: AbortSignal.timeout(15000),
        }),
      ]);

      if ((!rStart.ok && rStart.status !== 206) || (!rEnd.ok && rEnd.status !== 206))
        return NextResponse.json({ error: 'CDN range fetch failed' }, { status: 502 });

      const [bufStart, bufEnd] = await Promise.all([rStart.arrayBuffer(), rEnd.arrayBuffer()]);
      combined = new Uint8Array(bufStart.byteLength + bufEnd.byteLength);
      combined.set(new Uint8Array(bufStart), 0);
      combined.set(new Uint8Array(bufEnd), bufStart.byteLength);

    } else {
      // Content-Length unknown — fetch 8MB from start as best-effort
      const r = await fetch(videoUrl, {
        headers: { 'Range': 'bytes=0-8388607', 'User-Agent': UA },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok && r.status !== 206)
        return NextResponse.json({ error: `CDN ${r.status}` }, { status: 502 });
      combined = new Uint8Array(await r.arrayBuffer());
    }

    if (!combined || combined.length < 500)
      return NextResponse.json({ error: 'Insufficient data' }, { status: 204 });

    return new NextResponse(combined, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(combined.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'CDN fetch error', details: e.message }, { status: 502 });
  }
}

// DELETE /api/hwasi/thumbnail/[id]
export async function DELETE(req, { params }) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  await deleteThumbnail(id);
  return NextResponse.json({ ok: true });
}
