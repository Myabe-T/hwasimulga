export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { redis, getRegUsers } from '@/lib/redis';
import { sendEmail, resetEmailHtml } from '@/lib/email';
import { SignJWT } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

// POST /api/hwasi/forgot-password
// body: { email }
export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const emailKey = email.toLowerCase().trim();

    // Rate-limit: max 2 reset requests per email per hour
    const rateKey = `reset:rate:${emailKey}`;
    const count = await redis.incr(rateKey);
    if (count === 1) await redis.expire(rateKey, 3600);
    if (count > 2) {
      // Still return success to prevent email enumeration
      return NextResponse.json({ ok: true });
    }

    // Find user by email in registered users
    let foundUser = null;
    try {
      const regUsers = await getRegUsers();
      foundUser = regUsers.find(u => (u.email || '').toLowerCase() === emailKey);
    } catch {}

    // Always respond ok to prevent email enumeration attacks
    if (!foundUser) {
      return NextResponse.json({ ok: true });
    }

    // Generate a signed JWT token valid for 20 minutes
    const token = await new SignJWT({ sub: foundUser.id, email: emailKey, type: 'reset' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('20m')
      .setIssuedAt()
      .sign(SECRET);

    // Store token hash in Redis (to allow single-use invalidation)
    const tokenHash = Array.from(new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
    )).map(b => b.toString(16).padStart(2, '0')).join('');

    await redis.set(`reset:${tokenHash}`, foundUser.id, { ex: 60 * 20 }); // 20 min

    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://desihawas.pages.dev';
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: emailKey,
      toName: foundUser.displayName || foundUser.username,
      subject: 'Reset your DesiHawas password',
      html: resetEmailHtml(resetUrl, foundUser.displayName || foundUser.username),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('forgot-password error:', err);
    // Don't reveal error details to prevent enumeration
    return NextResponse.json({ ok: true });
  }
}
