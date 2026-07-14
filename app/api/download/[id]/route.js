export const runtime = 'edge';

import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

const CDNS = [
  { id: 'desimms', base: 'https://cdn.desimms.com.co' },
];

export async function GET(req, { params }) {
  try {
    const store = await cookies();
    const token = store.get('hwasi_token')?.value;
    if (!token) return new NextResponse('Unauthorized', { status: 401 });
    await jwtVerify(token, SECRET);
  } catch {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { id } = await params;
  let cdnBase = CDNS[0].base;
  let fileId = id;
  if (id.includes('-')) {
    const [cdnKey, ...rest] = id.split('-');
    const cdn = CDNS.find(c => c.id === cdnKey);
    if (cdn) { cdnBase = cdn.base; fileId = rest.join('-'); }
  }

  const url = `${cdnBase}/${fileId}.mp4`;
  try {
    const upstream = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!upstream.ok) return new NextResponse('Not Found', { status: 404 });

    const resHeaders = new Headers();
    resHeaders.set('content-type', 'video/mp4');
    resHeaders.set('content-disposition', `attachment; filename="video-${fileId}.mp4"`);
    const cl = upstream.headers.get('content-length');
    if (cl) resHeaders.set('content-length', cl);

    return new NextResponse(upstream.body, { status: 200, headers: resHeaders });
  } catch {
    return new NextResponse('Upstream error', { status: 502 });
  }
}
