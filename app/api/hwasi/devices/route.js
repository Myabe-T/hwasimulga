export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getDeviceData, setUserBlocked } from '@/lib/redis';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

// GET — admin/advisor: returns all device data
export async function GET(req) {
  const user = await getUser(req);
  if (!user || !['admin','advisor'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const data = await getDeviceData();
  return NextResponse.json({ devices: data });
}

// POST — admin only: block or unblock a user
export async function POST(req) {
  const user = await getUser(req);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId, blocked } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  await setUserBlocked(userId, Boolean(blocked));
  return NextResponse.json({ ok: true });
}
