export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logDeletedVideo } from '@/lib/redis';

const VALID_REASONS = ['duplicate', 'fake', 'nothing', 'broken', 'restricted'];

export async function DELETE(req, { params }) {
  const session = await getSession();
  if (!session || !['admin', 'advisor'].includes(session.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { reason } = await req.json().catch(() => ({ reason: 'nothing' }));
  if (!VALID_REASONS.includes(reason))
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  await logDeletedVideo(id, session.username, session.role, reason);
  return NextResponse.json({ ok: true, id, reason });
}
