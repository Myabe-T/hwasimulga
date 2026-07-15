export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getVideoTitles, setVideoTitle } from '@/lib/redis';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try {
    const { payload } = await jwtVerify(cookie.value, SECRET);
    return payload;
  } catch { return null; }
}

// GET /api/hwasi/titles — returns all titles (public, for gallery)
export async function GET() {
  const titles = await getVideoTitles();
  return NextResponse.json({ titles });
}

// POST /api/hwasi/titles — set a title (admin/advisor only)
export async function POST(req) {
  const user = await getUser(req);
  if (!user || !['admin', 'advisor'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const { id, title } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const titles = await setVideoTitle(id, title ?? '');
  return NextResponse.json({ ok: true, titles });
}
