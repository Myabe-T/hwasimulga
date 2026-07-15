export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getOnlineUsers } from '@/lib/redis';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

export async function GET(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { payload } = await jwtVerify(cookie.value, SECRET);
    if (!['admin', 'advisor'].includes(payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const online = await getOnlineUsers();
    return NextResponse.json({ online });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
