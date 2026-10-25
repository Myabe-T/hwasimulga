export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getThumbnailIds } from '@/lib/redis';

// GET /api/hwasi/thumbnails — returns set of IDs that have thumbnails (cached at edge for 2 min)
export async function GET() {
  const ids = await getThumbnailIds();
  return NextResponse.json({ ids: ids.map(Number) }, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
      'CDN-Cache-Control': 'public, max-age=120',
    }
  });
}
