export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

// POST /api/hwasi/verify-otp
// body: { email, otp }
// Returns: { ok: true, verified: true } — actual registration happens separately in /api/register
export async function POST(req) {
  try {
    const { email, otp } = await req.json();
    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP required' }, { status: 400 });
    }

    const emailKey = email.toLowerCase().trim();
    const otpKey = `otp:${emailKey}`;

    const stored = await redis.get(otpKey);
    if (!stored) {
      return NextResponse.json({ error: 'OTP expired or not found. Please request a new one.' }, { status: 400 });
    }

    let parsed;
    try { parsed = JSON.parse(stored); } catch {
      return NextResponse.json({ error: 'Invalid OTP data. Request a new one.' }, { status: 400 });
    }

    // Brute-force protection: max 5 wrong attempts
    if (parsed.fails >= 5) {
      await redis.del(otpKey);
      return NextResponse.json({ error: 'Too many wrong attempts. Request a new OTP.' }, { status: 429 });
    }

    if (String(parsed.otp) !== String(otp).trim()) {
      // Increment fail counter
      parsed.fails = (parsed.fails || 0) + 1;
      const ttl = await redis.ttl(otpKey);
      await redis.set(otpKey, JSON.stringify(parsed), { ex: ttl > 0 ? ttl : 60 });
      const remaining = 5 - parsed.fails;
      return NextResponse.json({ error: `Wrong OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` }, { status: 400 });
    }

    // OTP correct — mark verified, keep for 5 min for registration to complete
    await redis.set(otpKey, JSON.stringify({ ...parsed, verified: true }), { ex: 300 });

    return NextResponse.json({ ok: true, verified: true });
  } catch (err) {
    console.error('verify-otp error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
