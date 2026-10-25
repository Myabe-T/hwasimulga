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

// GET /api/hwasi/titles — supports ?id=[id] for single video title (~50 bytes) or full titles list
export async function GET(req) {
  const url = new URL(req.url);
  const singleId = url.searchParams.get('id');

  const titles = await getVideoTitles();

  // If a single video title is requested (e.g. from watch page), return just that title (~50 bytes)
  if (singleId) {
    const title = titles[String(singleId)] || `Video #${singleId}`;
    return NextResponse.json({ ok: true, id: singleId, title }, {
      headers: {
        'Cache-Control': 'public, max-age=120, s-maxage=300, stale-while-revalidate=600',
        'CDN-Cache-Control': 'public, max-age=300',
      }
    });
  }

  // Full titles list: cached at Cloudflare edge for 2 minutes
  return NextResponse.json({ titles }, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
      'CDN-Cache-Control': 'public, max-age=120',
    }
  });
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
