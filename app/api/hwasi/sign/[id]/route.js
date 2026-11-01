export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { signVideoId } from '@/lib/sign';
import { getVideoCdn, getPremium } from '@/lib/redis';

// GET /api/hwasi/sign/[id] — sign a video token for download/preview (premium/admin/advisor)
export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isPrivileged = ['admin', 'advisor'].includes(session.role);
  if (!isPrivileged) {
    const sub = await getPremium(session.sub);
    if (!sub) {
      return NextResponse.json({ error: 'Premium subscription required for direct download' }, { status: 403 });
    }
  }

  const { id } = await params;
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
  }

  try {
    // Look up CDN for this video ID
    const cdnInfo = await getVideoCdn(String(id));
    const token = await signVideoId(String(id), cdnInfo?.cdnId, cdnInfo?.cdnVideoId);
    const src = `/api/v/${token}`;
    return NextResponse.json({ src, token, id, cdn: cdnInfo?.cdnId || 'desimms' });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to sign video' }, { status: 500 });
  }
}
