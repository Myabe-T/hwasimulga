export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { setPremium, PLANS } from '@/lib/redis';

function getRazorpayEnv() {
  try {
    const { getRequestContext } = require('@cloudflare/next-on-pages');
    const ctx = getRequestContext();
    if (ctx?.env?.RAZORPAY_KEY_SECRET) return ctx.env;
  } catch {}
  return process.env;
}

// Verify Razorpay payment signature using Web Crypto API (Edge-compatible)
async function verifySignature(orderId, paymentId, signature, secret) {
  try {
    const encoder = new TextEncoder();
    const message = `${orderId}|${paymentId}`;
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    const expected = Array.from(new Uint8Array(mac))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return expected === signature;
  } catch (e) {
    console.error('Signature verification error:', e);
    return false;
  }
}

// POST /api/razorpay/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan }
// Verifies signature → grants premium → returns { ok, plan, days }
export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const env = getRazorpayEnv();
  const keySecret = env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    return NextResponse.json({ error: 'Razorpay not configured on server' }, { status: 500 });
  }

  const isValid = await verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret);
  if (!isValid) {
    console.error('Invalid Razorpay signature for payment', razorpay_payment_id);
    return NextResponse.json({ error: 'Payment signature invalid. Contact support.' }, { status: 400 });
  }

  const planData = PLANS[plan];
  if (!planData) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  // Grant premium access
  await setPremium(session.sub, plan, planData.days, `razorpay:${razorpay_payment_id}`);

  console.log(`✅ Razorpay premium granted: userId=${session.sub} plan=${plan} days=${planData.days} paymentId=${razorpay_payment_id}`);

  return NextResponse.json({
    ok: true,
    plan,
    days: planData.days,
    paymentId: razorpay_payment_id,
  });
}
