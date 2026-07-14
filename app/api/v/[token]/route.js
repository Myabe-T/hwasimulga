export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { verifyVideoToken } from '@/lib/sign';

const CDN_BASE = 'https://cdn.desimms.com.co';

// GET /api/v/[token] — Signed Redirect
export async function GET(req, { params }) {
  const { token } = await params;
  const id = await verifyVideoToken(token);
  if (!id) return new NextResponse('Token expired or invalid', { status: 403 });

  const url = `${CDN_BASE}/${id}.mp4`;
  // Return a 302 redirect so the client fetches directly from the CDN
  // This bypasses Vercel's bandwidth completely!
  return NextResponse.redirect(url, 302);
}
