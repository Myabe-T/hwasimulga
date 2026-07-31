export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { signVideoId } from '@/lib/sign';
import { getVideoCdn } from '@/lib/redis';

// GET /api/hwasi/sign/[id] — sign a video token for download/preview (premium/admin/advisor)
export async function GET(req, { params }) {
  const { error, status } = await requireAuth(['admin', 'advisor', 'premium']);
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
  }

  try {
    // Look up CDN for this video ID (hindibf uses system IDs 10001-10243)
    const cdnInfo = await getVideoCdn(String(id));
    const token = await signVideoId(String(id), cdnInfo?.cdnId, cdnInfo?.cdnVideoId);
    const src = `/api/v/${token}`;
    return NextResponse.json({ src, token, id, cdn: cdnInfo?.cdnId || 'desimms' });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to sign video' }, { status: 500 });
  }
}
