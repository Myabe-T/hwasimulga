export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getDeviceData, setUserBlocked, clearDevice, clearAllDevices } from '@/lib/redis';

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

// POST — admin only: block or unblock a user (with optional reason)
export async function POST(req) {
  const user = await getUser(req);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId, blocked, reason } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  await setUserBlocked(userId, Boolean(blocked), reason || null);
  return NextResponse.json({ ok: true });
}

// DELETE — admin/advisor: remove a specific device fingerprint OR all devices for a user
export async function DELETE(req) {
  const user = await getUser(req);
  if (!user || !['admin','advisor'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId, fingerprint, clearAll } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  if (clearAll) {
    await clearAllDevices(userId);
  } else {
    if (!fingerprint) return NextResponse.json({ error: 'fingerprint required' }, { status: 400 });
    await clearDevice(userId, fingerprint);
  }
  return NextResponse.json({ ok: true });
}

