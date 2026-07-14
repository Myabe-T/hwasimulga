export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getThumbnailIds } from '@/lib/redis';

// GET /api/hwasi/thumbnails — returns set of IDs that have thumbnails
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ids = await getThumbnailIds();
  return NextResponse.json({ ids: ids.map(Number) });
}
