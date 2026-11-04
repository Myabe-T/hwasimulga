export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logDeletedVideo } from '@/lib/redis';
import { decodeVideoId } from '@/lib/videoToken';

export async function DELETE(req, { params }) {
  const session = await getSession();
  if (!session || !['admin', 'advisor'].includes(session.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const rawId = decodeVideoId(id) || id;
  const { reason } = await req.json().catch(() => ({ reason: 'nothing' }));
  
  await logDeletedVideo(rawId, session.username, session.role, reason || 'other');

  return NextResponse.json({ ok: true, id: rawId, reason });
}
