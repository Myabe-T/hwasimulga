export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getThumbnailIds } from '@/lib/redis';

// GET /api/hwasi/thumbnails — returns set of IDs that have thumbnails (cached at edge for 2 min)
export async function GET() {
  const ids = await getThumbnailIds();
  return NextResponse.json({ ids: ids.map(Number) }, {
    headers: {
      'Cache-Control': 'public, max-age=15, s-maxage=20, stale-while-revalidate=60',
      'CDN-Cache-Control': 'public, max-age=20',
    }
  });
}
