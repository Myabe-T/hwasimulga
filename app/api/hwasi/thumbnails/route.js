export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getThumbnailIds } from '@/lib/redis';

// GET /api/hwasi/thumbnails — returns set of IDs that have thumbnails
export async function GET() {
  const ids = await getThumbnailIds();
  return NextResponse.json({ ids: ids.map(Number) });
}
