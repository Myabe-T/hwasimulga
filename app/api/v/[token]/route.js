export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { verifyVideoToken } from '@/lib/sign';

// CDN base URL lookup by cdnId
const CDN_BASES = {
  desimms:  'https://cdn.desimms.com.co',
  hindibf:  'https://cdn.hindibf.com.co',
};
const DEFAULT_CDN = CDN_BASES.desimms;

/**
 * GET /api/v/[token]
 *
 * Verifies the signed JWT token, then issues a 302 redirect to the CDN.
 *
 * WHY REDIRECT (not stream):
 * Streaming video through Cloudflare Workers violates their ToS (Section 2.8)
 * and will cause account suspension, just like Vercel did.
 * The 302 redirect sends ZERO bytes through Cloudflare — it goes straight from
 * the browser to the CDN, which is perfectly fine and fast.
 *
 * CDN URL PROTECTION:
 * The CDN should be configured with Referer-based access control so that
 * cdn.desimms.com.co URLs only work when accessed from DesiHawas.pages.dev.
 * Direct access (like pasting the URL in a new tab) would then return 403.
 *
 * ?dl=1 → triggers browser download via Content-Disposition header
 */
export async function GET(req, { params }) {
  // Block automated download managers and scrapers (IDM, Wget, curl, etc.)
  const userAgent = req.headers.get('user-agent') || '';
  if (/idm|internet\s*download\s*manager|idman|download\s*accelerator|wget|curl|python-requests|aria2/i.test(userAgent)) {
    return new NextResponse('Access Denied: External download managers are blocked on DesiHawas.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const { token } = await params;
  const result = await verifyVideoToken(token);
  if (!result) {
    return new NextResponse('Link expired. Please go back and click play again.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const { id, cdn, cid } = result;
  const cdnBase = (cdn && CDN_BASES[cdn]) ? CDN_BASES[cdn] : DEFAULT_CDN;
  // cid = actual video ID on that CDN (may differ from system gallery ID)
  const cdnVideoId = cid || id;
  const cdnUrl = `${cdnBase}/${cdnVideoId}.mp4`;
  const isDownload = new URL(req.url).searchParams.get('dl') === '1';

  // Both downloads and playback issue a clean 302 redirect directly to the external CDN.
  // This sends ZERO bytes through Cloudflare Workers (avoiding edge runtime timeouts,
  // 502/524 errors, and Cloudflare ToS bandwidth restrictions).
  return NextResponse.redirect(cdnUrl, 302);
}
