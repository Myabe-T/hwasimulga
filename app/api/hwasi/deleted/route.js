export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDeletedVideos } from '@/lib/redis';

export async function GET(req) {
  const session = await getSession();
  if (!session || !['admin', 'advisor'].includes(session.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const deleted = await getDeletedVideos(200);
  return NextResponse.json({ deleted });
}
