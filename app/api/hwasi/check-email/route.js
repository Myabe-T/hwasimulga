export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getRegUsers, getPendingUsers, getUsers } from '@/lib/redis';

// GET /api/hwasi/check-email?email=xxx
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email')?.toLowerCase()?.trim();
    if (!email) return NextResponse.json({ exists: false });

    const [regUsers, pendingUsers, staticUsers] = await Promise.all([
      getRegUsers(),
      getPendingUsers(),
      getUsers(),
    ]);

    const allExisting = [...regUsers, ...pendingUsers, ...staticUsers];
    const found = allExisting.some(u => (u.email || '').toLowerCase() === email);

    return NextResponse.json({ exists: found });
  } catch (err) {
    console.error('check-email error:', err);
    return NextResponse.json({ exists: false });
  }
}
