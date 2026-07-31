export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getExtraThumb } from '@/lib/redis';

// GET /api/hwasi/thumb-extra/[id] — serve stored base64 thumbnail for extra CDN videos
export async function GET(req, { params }) {
  const { id } = await params;
  const dataUrl = await getExtraThumb(id);
  if (!dataUrl) return new NextResponse('Not found', { status: 404 });

  // Convert base64 data URL to binary response
  try {
    const [header, b64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Invalid thumbnail data', { status: 500 });
  }
}
