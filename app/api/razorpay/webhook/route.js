export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { setPremium, PLANS } from '@/lib/redis';

function getRazorpayEnv() {
  try {
    const { getRequestContext } = require('@cloudflare/next-on-pages');
    const ctx = getRequestContext();
    if (ctx?.env?.RAZORPAY_WEBHOOK_SECRET) return ctx.env;
  } catch {}
  return process.env;
}

// Verify webhook signature using Web Crypto API
async function verifyWebhookSignature(body, signature, secret) {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expected = Array.from(new Uint8Array(mac))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return expected === signature;
  } catch { return false; }
}

// POST /api/razorpay/webhook
// Called by Razorpay on payment events — backup to verify payment
export async function POST(req) {
  const env = getRazorpayEnv();
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') || '';

  // Verify webhook signature if secret is configured
  if (webhookSecret) {
    const valid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!valid) {
      console.error('Invalid Razorpay webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  }

  let event = {};
  try { event = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle payment.captured event
  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    if (!payment) return NextResponse.json({ ok: true });

    const { notes } = payment;
    const userId = notes?.userId;
    const plan   = notes?.plan;

    if (userId && plan && PLANS[plan]) {
      await setPremium(userId, plan, PLANS[plan].days, `razorpay_webhook:${payment.id}`);
      console.log(`✅ Webhook: Premium granted userId=${userId} plan=${plan} paymentId=${payment.id}`);
    }
  }

  return NextResponse.json({ ok: true });
}
