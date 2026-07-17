export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { encryptPayload } from '@/lib/crypto';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json(await encryptPayload({ auth: false }), { status: 401 });
  
  const payload = await encryptPayload({
    auth: true, username: session.username, displayName: session.displayName,
    role: session.role, avatar: session.avatar, userId: session.sub,
  });
  return NextResponse.json(payload);
}
