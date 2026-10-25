export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getThumbnail } from '@/lib/redis';

// GET /api/hwasi/thumb-extra/[id] — serve thumbnail (now consolidated into hwasi:thumbs)
export async function GET(req, { params }) {
  const { id } = await params;
  const dataUrl = await getThumbnail(id);
  if (!dataUrl) return new NextResponse('Not found', { status: 404 });

  try {
    let mime = 'image/jpeg';
    let b64 = dataUrl;
    if (dataUrl.startsWith('data:')) {
      const [header, raw] = dataUrl.split(',');
      mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      b64 = raw;
    }
    const buffer = Buffer.from(b64, 'base64');
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400',
        'CDN-Cache-Control': 'public, max-age=604800',
      },
    });
  } catch {
    return new NextResponse('Invalid thumbnail data', { status: 500 });
  }
}
