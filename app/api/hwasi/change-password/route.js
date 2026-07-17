export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRegUsers, saveRegUsers, getUsers, saveUsers } from '@/lib/redis';
import { decryptPayload, encryptPayload } from '@/lib/crypto';

async function hashPassword(password) {
  const data = new TextEncoder().encode(password + 'hwasi_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json(await encryptPayload({ error: 'Unauthorized' }), { status: 401 });

  // Support both encrypted and plain body
  let oldPassword, newPassword;
  try {
    const rawBody = await req.json();
    if (rawBody.cipher && rawBody.iv) {
      const dec = await decryptPayload(rawBody.cipher, rawBody.iv);
      oldPassword = dec?.oldPassword;
      newPassword = dec?.newPassword;
    } else {
      oldPassword = rawBody.oldPassword;
      newPassword = rawBody.newPassword;
    }
  } catch (e) {
    return NextResponse.json(await encryptPayload({ error: 'Invalid request body' }), { status: 400 });
  }

  if (!oldPassword || !newPassword)
    return NextResponse.json(await encryptPayload({ error: 'Both old and new password required' }), { status: 400 });
  if (newPassword.length < 6)
    return NextResponse.json(await encryptPayload({ error: 'New password must be at least 6 characters' }), { status: 400 });

  const [staticUsers, regUsers] = await Promise.all([getUsers(), getRegUsers()]);

  // Check static users (plain password)
  const staticIdx = staticUsers.findIndex(u => u.id === session.sub);
  if (staticIdx !== -1) {
    if (staticUsers[staticIdx].password !== oldPassword) {
      return NextResponse.json(await encryptPayload({ error: 'Current password is incorrect' }), { status: 400 });
    }
    staticUsers[staticIdx].password = newPassword;
    await saveUsers(staticUsers);
    return NextResponse.json(await encryptPayload({ ok: true }));
  }

  // Check registered users (hashed password)
  const regIdx = regUsers.findIndex(u => u.id === session.sub);
  if (regIdx !== -1) {
    const oldHash = await hashPassword(oldPassword);
    if (regUsers[regIdx].passwordHash !== oldHash) {
      return NextResponse.json(await encryptPayload({ error: 'Current password is incorrect' }), { status: 400 });
    }
    regUsers[regIdx].passwordHash = await hashPassword(newPassword);
    await saveRegUsers(regUsers);
    return NextResponse.json(await encryptPayload({ ok: true }));
  }

  return NextResponse.json(await encryptPayload({ error: 'User not found' }), { status: 404 });
}
