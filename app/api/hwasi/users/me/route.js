export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUsers, saveUsers, getRegUsers, saveRegUsers } from '@/lib/redis';

// PATCH /api/hwasi/users/me — let the logged-in user update their own displayName + email
export async function PATCH(req) {
  const { error, status, session } = await requireAuth();
  if (error) return NextResponse.json({ error }, { status });

  const body = await req.json();
  const allowed = {};
  if (body.displayName !== undefined) allowed.displayName = String(body.displayName).trim().slice(0, 80);
  if (body.email !== undefined) allowed.email = String(body.email).trim().toLowerCase().slice(0, 120);

  // Try static users first
  const users = await getUsers();
  const idx = users.findIndex(u => u.id === session.id || u.username === session.username);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...allowed };
    await saveUsers(users);
    const { password: _, ...safe } = users[idx];
    return NextResponse.json({ ok: true, user: safe });
  }

  // Try registered users
  const regUsers = await getRegUsers();
  const ridx = regUsers.findIndex(u => u.id === session.id || u.username === session.username);
  if (ridx !== -1) {
    regUsers[ridx] = { ...regUsers[ridx], ...allowed };
    await saveRegUsers(regUsers);
    const { passwordHash: _, ...safe } = regUsers[ridx];
    return NextResponse.json({ ok: true, user: safe });
  }

  return NextResponse.json({ error: 'User not found' }, { status: 404 });
}

// GET /api/hwasi/users/me — return current user info
export async function GET(req) {
  const { error, status, session } = await requireAuth();
  if (error) return NextResponse.json({ error }, { status });

  const users = await getUsers();
  const u = users.find(u => u.id === session.id || u.username === session.username);
  if (u) {
    const { password: _, ...safe } = u;
    return NextResponse.json(safe);
  }

  const regUsers = await getRegUsers();
  const ru = regUsers.find(u => u.id === session.id || u.username === session.username);
  if (ru) {
    const { passwordHash: _, ...safe } = ru;
    return NextResponse.json(safe);
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
