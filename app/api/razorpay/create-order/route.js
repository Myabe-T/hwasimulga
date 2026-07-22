export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { PLANS } from '@/lib/redis';

function getRazorpayEnv() {
  try {
    const { getRequestContext } = require('@cloudflare/next-on-pages');
    const ctx = getRequestContext();
    if (ctx?.env?.RAZORPAY_KEY_ID) return ctx.env;
  } catch {}
  return process.env;
}

// POST /api/razorpay/create-order
// Body: { plan: 'basic' | 'plus' | 'pro' }
// Returns: { orderId, amount, currency, key, plan, userId }
export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}
  const { plan } = body;

  const planData = PLANS[plan];
  if (!planData) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const env = getRazorpayEnv();
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Razorpay not configured on server. Contact admin.' }, { status: 500 });
  }

  // Build Basic Auth header (btoa is available in Edge/browser environments)
  const auth = btoa(`${keyId}:${keySecret}`);

  // Unique receipt id (max 40 chars for Razorpay)
  const receipt = `rzp_${session.sub}_${plan}_${Date.now()}`.slice(0, 40);

  const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: planData.price * 100,   // Razorpay uses paise (1 INR = 100 paise)
      currency: 'INR',
      receipt,
      notes: {
        userId: String(session.sub),
        plan,
        username: session.username || '',
      },
    }),
  });

  if (!rzpRes.ok) {
    const errText = await rzpRes.text();
    console.error('Razorpay order creation failed:', errText);
    return NextResponse.json({ error: 'Failed to create Razorpay order', details: errText }, { status: 502 });
  }

  const order = await rzpRes.json();

  return NextResponse.json({
    orderId:     order.id,
    amount:      order.amount,
    currency:    order.currency,
    key:         keyId,
    plan,
    days:        planData.days,
    userId:      String(session.sub),
    username:    session.username || '',
    displayName: session.displayName || '',
    email:       session.email || '',
  });
}
