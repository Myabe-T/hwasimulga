export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getRegUsers, saveRegUsers } from '@/lib/redis';
import { adminSetEmailVerified } from '@/lib/firebaseAdmin';

// POST /api/hwasi/users/[id]/verify
// Admin manually verifies a pending user's email in both Redis and Firebase Auth
export async function POST(req, { params }) {
  const { error, status } = await requireAuth(['admin', 'advisor']);
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const regUsers = await getRegUsers();
  const idx = regUsers.findIndex(u => u.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: 'Registered user not found' }, { status: 404 });
  }

  const user = regUsers[idx];
  regUsers[idx].emailVerified = true;
  regUsers[idx].emailVerifiedAt = new Date().toISOString();
  await saveRegUsers(regUsers);

  // Sync to Firebase Auth
  if (user.email) {
    await adminSetEmailVerified(user.email, true).catch(() => {});
  }

  return NextResponse.json({ ok: true, message: `User ${user.username} verified successfully` });
}
