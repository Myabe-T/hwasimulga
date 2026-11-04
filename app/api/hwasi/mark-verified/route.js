export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getRegUsers, saveRegUsers } from '@/lib/redis';
import { encryptPayload } from '@/lib/crypto';

// POST /api/hwasi/mark-verified
// Sets emailVerified: true in Redis database for a user
export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const emailClean = email.toLowerCase().trim();
    const regUsers = await getRegUsers();
    const userIndex = regUsers.findIndex(u => (u.email || '').toLowerCase() === emailClean);

    if (userIndex !== -1) {
      regUsers[userIndex].emailVerified = true;
      regUsers[userIndex].emailVerifiedAt = new Date().toISOString();
      await saveRegUsers(regUsers);
    }

    return NextResponse.json(await encryptPayload({ ok: true, message: 'Email marked as verified' }));
  } catch (err) {
    console.error('mark-verified error:', err);
    return NextResponse.json({ error: 'Failed to update email status' }, { status: 500 });
  }
}
