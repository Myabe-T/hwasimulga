export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { redis, getRegUsers, saveRegUsers } from '@/lib/redis';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function hashPassword(password) {
  const enc = new TextEncoder().encode(password);
  const hashBuf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/hwasi/reset-password
// body: { token, newPassword }
export async function POST(req) {
  try {
    const { token, newPassword } = await req.json();
    if (!token || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Token and new password (min 6 chars) required' }, { status: 400 });
    }

    // Verify JWT signature + expiry
    let payload;
    try {
      const result = await jwtVerify(token, SECRET);
      payload = result.payload;
    } catch {
      return NextResponse.json({ error: 'Reset link is invalid or expired. Please request a new one.' }, { status: 400 });
    }

    if (payload.type !== 'reset') {
      return NextResponse.json({ error: 'Invalid reset token' }, { status: 400 });
    }

    // Check token hasn't been used (single-use via Redis hash)
    const tokenHash = Array.from(new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
    )).map(b => b.toString(16).padStart(2, '0')).join('');

    const storedUserId = await redis.get(`reset:${tokenHash}`);
    if (!storedUserId) {
      return NextResponse.json({ error: 'Reset link has already been used or expired.' }, { status: 400 });
    }

    const userId = payload.sub;

    // Find and update user
    const regUsers = await getRegUsers();
    const userIdx = regUsers.findIndex(u => u.id === userId);

    if (userIdx === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const hashedPwd = await hashPassword(newPassword);
    regUsers[userIdx] = { ...regUsers[userIdx], password: hashedPwd, passwordChangedAt: new Date().toISOString() };

    // Save updated user list
    await saveRegUsers(regUsers);

    // Invalidate the token (single-use)
    await redis.del(`reset:${tokenHash}`);

    return NextResponse.json({ ok: true, message: 'Password updated successfully!' });
  } catch (err) {
    console.error('reset-password error:', err);
    return NextResponse.json({ error: 'Server error. Try again.' }, { status: 500 });
  }
}
