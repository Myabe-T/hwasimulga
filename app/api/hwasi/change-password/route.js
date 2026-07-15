export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRegUsers, saveRegUsers } from '@/lib/redis';

async function hashPassword(password) {
  const data = new TextEncoder().encode(password + 'hwasi_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { oldPassword, newPassword } = await req.json();
  if (!oldPassword || !newPassword)
    return NextResponse.json({ error: 'Both old and new password required' }, { status: 400 });
  if (newPassword.length < 6)
    return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
  const users = await getRegUsers();
  const idx = users.findIndex(u => u.id === session.sub);
  if (idx === -1) return NextResponse.json({ error: 'User not found (static accounts use admin panel)' }, { status: 404 });
  const oldHash = await hashPassword(oldPassword);
  if (users[idx].passwordHash !== oldHash)
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
  users[idx].passwordHash = await hashPassword(newPassword);
  await saveRegUsers(users);
  return NextResponse.json({ ok: true });
}
