export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ auth: false }, { status: 401 });
  return NextResponse.json({
    auth: true, username: session.username, displayName: session.displayName,
    role: session.role, avatar: session.avatar, userId: session.sub,
  });
}
