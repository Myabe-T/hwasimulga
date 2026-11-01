export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { signVideoId } from '@/lib/sign';
import { getPremium } from '@/lib/redis';

// GET /api/download/[id] — returns signed redirect to CDN for download (Premium only)
// Never proxies the file through Cloudflare (avoids bandwidth limits)
export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const isPrivileged = ['admin', 'advisor'].includes(session.role);
  if (!isPrivileged) {
    const sub = await getPremium(session.sub);
    if (!sub) {
      return NextResponse.redirect(new URL('/premium?reason=download', req.url), 302);
    }
  }

  const { id } = await params;
  const token = await signVideoId(id);
  // Redirect to our signed token endpoint with ?dl=1 flag for download headers
  return NextResponse.redirect(new URL(`/api/v/${token}?dl=1`, req.url), 302);
}
