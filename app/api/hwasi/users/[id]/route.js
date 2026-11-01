export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUsers, saveUsers, getRegUsers, saveRegUsers } from '@/lib/redis';

async function hashPassword(password) {
  const data = new TextEncoder().encode(password + 'hwasi_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function PUT(req, { params }) {
  const { error, status, session } = await requireAuth(['admin', 'advisor']);
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  const body = await req.json();
  const isAdmin = session?.role === 'admin';

  // Only super admin ('admin' role) is permitted to modify passwords. Advisors cannot change passwords.
  if (!isAdmin) {
    delete body.password;
    delete body.passwordHash;
  }

  // Try static users first
  const users = await getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx !== -1) {
    if (!isAdmin || !body.password) {
      delete body.password;
    }
    users[idx] = { ...users[idx], ...body, id: users[idx].id };
    await saveUsers(users);
    if (!isAdmin) {
      const { password: _, ...safe } = users[idx];
      return NextResponse.json(safe);
    }
    return NextResponse.json(users[idx]);
  }

  // Try registered users
  const regUsers = await getRegUsers();
  const ridx = regUsers.findIndex(u => u.id === id);
  if (ridx !== -1) {
    if (isAdmin && body.password && body.password !== '[Encrypted]') {
      regUsers[ridx].password = body.password;
      regUsers[ridx].passwordHash = await hashPassword(body.password);
    }
    // Update any other allowed fields (displayName, username, email, role, etc.)
    const { password: _p, passwordHash: _ph, ...otherBody } = body;
    regUsers[ridx] = { ...regUsers[ridx], ...otherBody, id: regUsers[ridx].id };
    await saveRegUsers(regUsers);
    if (!isAdmin) {
      const { passwordHash: _, password: _p2, ...safe } = regUsers[ridx];
      return NextResponse.json(safe);
    }
    return NextResponse.json({
      ...regUsers[ridx],
      password: regUsers[ridx].password || (regUsers[ridx].passwordHash ? '[Encrypted]' : '')
    });
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
