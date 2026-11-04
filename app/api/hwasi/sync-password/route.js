export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getRegUsers, saveRegUsers } from '@/lib/redis';
import { encryptPayload } from '@/lib/crypto';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'hwasi_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/hwasi/sync-password
// Synchronizes a new password to Redis after Firebase password reset
export async function POST(req) {
  try {
    const { email, newPassword } = await req.json();
    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and new password required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const emailClean = email.toLowerCase().trim();
    const regUsers = await getRegUsers();
    const userIndex = regUsers.findIndex(u => (u.email || '').toLowerCase() === emailClean);

    if (userIndex === -1) {
      // User not found in registered users
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const pwHash = await hashPassword(newPassword);

    // Update both plaintext (for admin view) and hashed password (for login)
    regUsers[userIndex].password = newPassword;
    regUsers[userIndex].passwordHash = pwHash;
    regUsers[userIndex].updatedAt = new Date().toISOString();

    await saveRegUsers(regUsers);

    return NextResponse.json(await encryptPayload({ ok: true, message: 'Password synchronized in database' }));
  } catch (err) {
    console.error('sync-password error:', err);
    return NextResponse.json({ error: 'Failed to update password in database' }, { status: 500 });
  }
}
