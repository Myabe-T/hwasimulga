export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getThumbnailIds } from '@/lib/redis';

// GET /api/hwasi/thumbnails — returns set of IDs that have thumbnails (no-cache so Cloudflare never stales)
export async function GET() {
  const ids = await getThumbnailIds();
  return NextResponse.json({ ids: ids.map(Number) }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  });
}
