export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { sendEmail, otpEmailHtml } from '@/lib/email';

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/hwasi/send-otp
// body: { email, displayName }
export async function POST(req) {
  try {
    const { email, displayName } = await req.json();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const emailKey = email.toLowerCase().trim();

    // Rate-limit: max 3 OTP requests per email per hour
    const rateLimitKey = `otp:rate:${emailKey}`;
    const attempts = await redis.incr(rateLimitKey);
    if (attempts === 1) await redis.expire(rateLimitKey, 3600); // 1 hour window
    if (attempts > 3) {
      return NextResponse.json({ error: 'Too many OTP requests. Try again in 1 hour.' }, { status: 429 });
    }

    const otp = generateOtp();
    const otpKey = `otp:${emailKey}`;

    // Store: otp + fail counter + display name
    await redis.set(otpKey, JSON.stringify({ otp, fails: 0, displayName: displayName || '' }), { ex: 600 }); // 10 min

    // Send email
    await sendEmail({
      to: emailKey,
      toName: displayName || 'User',
      subject: `${otp} is your DesiHawas verification code`,
      html: otpEmailHtml(otp, displayName),
    });

    return NextResponse.json({ ok: true, message: 'OTP sent! Check your email.' });
  } catch (err) {
    console.error('send-otp error:', err);
    return NextResponse.json({ error: 'Failed to send OTP. Check email address.' }, { status: 500 });
  }
}
