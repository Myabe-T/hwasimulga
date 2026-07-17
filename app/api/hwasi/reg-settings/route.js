export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { redis, KEYS } from '@/lib/redis';

// Public endpoint — returns only the OTP required flag, no auth needed
// Used by the register page to know whether to show OTP step
export async function GET() {
  try {
    const raw = await redis.get(KEYS.SETTINGS);
    const settings = raw ? JSON.parse(raw) : {};
    return NextResponse.json({ otpRequired: settings.otpRequired === true });
  } catch {
    return NextResponse.json({ otpRequired: false });
  }
}
