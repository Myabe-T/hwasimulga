export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getThumbnail, setThumbnail, deleteThumbnail } from '@/lib/redis';

const CDN_BASE = 'https://cdn.desimms.com.co';

// GET /api/hwasi/thumbnail/[id] — serve thumbnail as JPEG image
export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const b64 = await getThumbnail(id); // returns raw base64 (no prefix)
  if (!b64) return new NextResponse('Not Found', { status: 404 });

  try {
    // b64 is raw base64 string — convert directly to buffer
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length < 100) return new NextResponse('Not Found', { status: 404 });
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Error', { status: 500 });
  }
}

// POST /api/hwasi/thumbnail/[id] — store thumbnail from browser (base64 dataUrl)
export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { dataUrl } = body;

  if (!dataUrl || !dataUrl.startsWith('data:image/jpeg;base64,')) {
    return NextResponse.json({ error: 'Invalid data — must be JPEG dataUrl' }, { status: 400 });
  }
  if (dataUrl.length > 2_800_000) {
    return NextResponse.json({ error: 'Thumbnail too large' }, { status: 413 });
  }

  await setThumbnail(id, dataUrl);
  return NextResponse.json({ ok: true, id });
}

// PUT /api/hwasi/thumbnail/[id] — SERVER-SIDE generation (no CORS issue!)
// Fetches video from CDN server-side, extracts first-frame proxy URL
export async function PUT(req, { params }) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const videoUrl = `${CDN_BASE}/${id}.mp4`;

  try {
    // Fetch first 512KB of the video from CDN server-side (no CORS on server!)
    const resp = await fetch(videoUrl, {
      headers: {
        'Range': 'bytes=0-8388607',  // 8MB — covers moov atom for most MP4s
        'User-Agent': 'Mozilla/5.0 (compatible; HwasimulgaBot/1.0)',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok && resp.status !== 206) {
      return NextResponse.json({ error: `CDN returned ${resp.status}`, missing: true }, { status: 404 });
    }

    // Return the video bytes directly — admin browser will create a Blob URL from this
    // and capture the frame client-side (same-origin Blob = no CORS taint)
    const contentType = resp.headers.get('content-type') || 'video/mp4';
    const contentRange = resp.headers.get('content-range');
    const buf = await resp.arrayBuffer();

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buf.byteLength),
        'X-Content-Range': contentRange || '',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'CDN fetch failed', details: e.message }, { status: 502 });
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
