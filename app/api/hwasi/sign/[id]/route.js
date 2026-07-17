export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { signVideoId } from '@/lib/sign';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

// GET /api/hwasi/sign/[id] — returns a 30-min signed proxy token for this video
export async function GET(req, { params }) {
  const session = await getUser(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const token = await signVideoId(id);
  return NextResponse.json({ src: `/api/v/${token}`, id });
}
