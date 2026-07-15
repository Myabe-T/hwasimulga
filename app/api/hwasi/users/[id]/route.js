export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUsers, saveUsers } from '@/lib/redis';

export async function PUT(req, { params }) {
  const { error, status } = await requireAuth(['admin','advisor']);
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  const body = await req.json();
  const users = await getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // If password blank, keep old
  if (!body.password) delete body.password;
  users[idx] = { ...users[idx], ...body, id: users[idx].id };
  await saveUsers(users);
  const { password: _, ...safe } = users[idx];
  return NextResponse.json(safe);
}

export async function DELETE(req, { params }) {
  const { error, status, session } = await requireAuth(['admin','advisor']);
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  const users = await getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (users[idx].username === session?.username)
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  users.splice(idx, 1);
  await saveUsers(users);
  return NextResponse.json({ ok: true });
}
