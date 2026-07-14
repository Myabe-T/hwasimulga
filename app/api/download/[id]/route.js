export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { signVideoId } from '@/lib/sign';

// GET /api/download/[id] — returns signed redirect to CDN for download
// Never proxies the file through Cloudflare (avoids bandwidth limits)
export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const token = await signVideoId(id);
  // Redirect to our signed token endpoint with ?dl=1 flag for download headers
  return NextResponse.redirect(new URL(`/api/v/${token}?dl=1`, req.url), 302);
}
