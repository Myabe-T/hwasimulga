export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPendingUsers, savePendingUsers, getRegUsers, saveRegUsers, SignJWT } from '@/lib/redis';
import { SignJWT as JoseSignJWT } from 'jose';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const users = await getPendingUsers();
  return NextResponse.json({ users });
}

export async function POST(req) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId, action } = await req.json(); // action: 'approve' | 'reject'
  const pending = await getPendingUsers();
  const idx = pending.findIndex(u => u.id === userId);
  if (idx === -1) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const user = pending[idx];
  pending.splice(idx, 1);
  await savePendingUsers(pending);
  if (action === 'approve') {
    const active = await getRegUsers();
    active.push(user);
    await saveRegUsers(active);
    return NextResponse.json({ ok: true, approved: true });
  }
  return NextResponse.json({ ok: true, rejected: true });
}
