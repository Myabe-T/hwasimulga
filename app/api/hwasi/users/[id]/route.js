export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUsers, saveUsers, getRegUsers, saveRegUsers } from '@/lib/redis';

export async function PUT(req, { params }) {
  const { error, status } = await requireAuth(['admin', 'advisor']);
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  const body = await req.json();

  // Try static users first
  const users = await getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx !== -1) {
    if (!body.password) delete body.password;
    users[idx] = { ...users[idx], ...body, id: users[idx].id };
    await saveUsers(users);
    const { password: _, ...safe } = users[idx];
    return NextResponse.json(safe);
  }

  // Try registered users
  const regUsers = await getRegUsers();
  const ridx = regUsers.findIndex(u => u.id === id);
  if (ridx !== -1) {
    if (!body.password && !body.passwordHash) { delete body.password; delete body.passwordHash; }
    regUsers[ridx] = { ...regUsers[ridx], ...body, id: regUsers[ridx].id };
    await saveRegUsers(regUsers);
    const { passwordHash: _, ...safe } = regUsers[ridx];
    return NextResponse.json(safe);
  }

  return NextResponse.json({ error: 'User not found' }, { status: 404 });
}

export async function DELETE(req, { params }) {
  const { error, status, session } = await requireAuth(['admin', 'advisor']);
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;

  // Try static users first
  const users = await getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx !== -1) {
    if (users[idx].username === session?.username)
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    users.splice(idx, 1);
    await saveUsers(users);
    return NextResponse.json({ ok: true });
  }

  // Try registered users
  const regUsers = await getRegUsers();
  const ridx = regUsers.findIndex(u => u.id === id);
  if (ridx !== -1) {
    regUsers.splice(ridx, 1);
    await saveRegUsers(regUsers);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'User not found' }, { status: 404 });
}
