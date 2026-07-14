export const runtime = 'edge';

import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

// CDN sources — add more here for multi-CDN support
const CDNS = [
  { id: 'desimms', base: 'https://cdn.desimms.com.co' },
];

async function isAuth() {
  try {
    const store = await cookies();
    const token = store.get('hwasi_token')?.value;
    if (!token) return false;
    await jwtVerify(token, SECRET);
    return true;
  } catch { return false; }
}

export async function GET(req, { params }) {
  if (!await isAuth()) return new NextResponse('Unauthorized', { status: 401 });
  
  const { id } = await params;
  // id format: desimms-51  OR  51 (defaults to desimms)
  let cdnBase = CDNS[0].base;
  let fileId = id;
  if (id.includes('-')) {
    const [cdnKey, ...rest] = id.split('-');
    const cdn = CDNS.find(c => c.id === cdnKey);
    if (cdn) { cdnBase = cdn.base; fileId = rest.join('-'); }
  }

  const url = `${cdnBase}/${fileId}.mp4`;
  // Bypass Vercel bandwidth by redirecting directly to CDN
  return NextResponse.redirect(url, 302);
}
