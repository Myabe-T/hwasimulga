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

  const [staticUsers, regUsers, pendingUsers] = await Promise.all([
    getUsers(),
    getRegUsers(),
    getPendingUsers()
  ]);

  // Find user to identify email and username
  let targetEmail = null;
  let targetUsername = null;

  const foundStatic = staticUsers.find(u => u.id === id);
  if (foundStatic) {
    if (foundStatic.username === session?.username)
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    targetEmail = foundStatic.email?.toLowerCase();
    targetUsername = foundStatic.username?.toLowerCase();
  }

  const foundReg = regUsers.find(u => u.id === id);
  if (foundReg) {
    targetEmail = targetEmail || foundReg.email?.toLowerCase();
    targetUsername = targetUsername || foundReg.username?.toLowerCase();
  }

  const foundPending = pendingUsers.find(u => u.id === id);
  if (foundPending) {
    targetEmail = targetEmail || foundPending.email?.toLowerCase();
    targetUsername = targetUsername || foundPending.username?.toLowerCase();
  }

  if (!foundStatic && !foundReg && !foundPending) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // 1. Permanently remove from static users
  const newStatic = staticUsers.filter(u => u.id !== id && (!targetEmail || u.email?.toLowerCase() !== targetEmail) && (!targetUsername || u.username?.toLowerCase() !== targetUsername));
  if (newStatic.length !== staticUsers.length) await saveUsers(newStatic);

  // 2. Permanently remove from registered users
  const newReg = regUsers.filter(u => u.id !== id && (!targetEmail || u.email?.toLowerCase() !== targetEmail) && (!targetUsername || u.username?.toLowerCase() !== targetUsername));
  if (newReg.length !== regUsers.length) await saveRegUsers(newReg);

  // 3. Permanently remove from pending users queue
  const newPending = pendingUsers.filter(u => u.id !== id && (!targetEmail || u.email?.toLowerCase() !== targetEmail) && (!targetUsername || u.username?.toLowerCase() !== targetUsername));
  if (newPending.length !== pendingUsers.length) await savePendingUsers(newPending);

  // 4. Permanently remove from all associated Redis hashes
  await Promise.all([
    redis.hdel(KEYS.BOOKMARKS, String(id)).catch(() => {}),
    redis.hdel(KEYS.PREMIUM, String(id)).catch(() => {}),
    targetEmail ? redis.del(`otp:rate:${targetEmail}`).catch(() => {}) : null,
    targetEmail ? redis.del(`reset:rate:${targetEmail}`).catch(() => {}) : null,
  ]);

  return NextResponse.json({ ok: true, message: 'User permanently deleted from all database stores' });
}
