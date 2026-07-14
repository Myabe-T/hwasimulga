export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { signVideoId } from '@/lib/sign';

// GET /api/hwasi/sign/[id] — returns a 30-min signed proxy token for this video
export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const token = await signVideoId(id);
  return NextResponse.json({ src: `/api/v/${token}`, id });
}
