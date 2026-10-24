export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { setPremium, getPremium, redis } from '@/lib/redis';
import { decryptPayload } from '@/lib/crypto';

// POST /api/hwasi/redeem
// Body: { code: "FC-XXXX-XXXX" }
// Calls ForCloud API to verify & burn key, then provisions membership in Redis
export async function POST(req) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      ok: false,
      error: 'Please log in or register an account before activating your access key.',
    }, { status: 401 });
  }

  let body = {};
  try {
    const rawBody = await req.json();
    if (rawBody.cipher && rawBody.iv) {
      body = (await decryptPayload(rawBody.cipher, rawBody.iv)) || {};
    } else {
      body = rawBody;
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON request' }, { status: 400 });
  }

  const rawCode = (body.code || '').trim().toUpperCase();
  if (!rawCode) {
    return NextResponse.json({ ok: false, error: 'Please enter an access key.' }, { status: 400 });
  }

  // Validate format FC-XXXX-XXXX
  const keyRegex = /^FC-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!keyRegex.test(rawCode)) {
    return NextResponse.json({
      ok: false,
      error: 'Invalid format. Access key must look like FC-XXXX-XXXX.',
    }, { status: 400 });
  }

  try {
    // Call ForCloud API
    const fcRes = await fetch('https://forcloud.pages.dev/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: rawCode }),
    });

    const fcData = await fcRes.json().catch(() => ({}));

    // 1. If key invalid (404) or error
    if (fcRes.status === 404 || (fcData.valid === false && !fcData.usedAt)) {
      return NextResponse.json({
        ok: false,
        valid: false,
        error: fcData.error || 'Invalid access key. Please check the code and try again.',
      }, { status: 404 });
    }

    // 2. If key was already used previously (400)
    if (fcRes.status === 400 || (fcData.valid === false && fcData.usedAt)) {
      return NextResponse.json({
        ok: false,
        valid: false,
        error: fcData.error || 'This access key has already been used.',
        usedAt: fcData.usedAt || null,
      }, { status: 400 });
    }

    // 3. Valid and successfully redeemed (200)
    if (fcRes.ok && fcData.valid === true) {
      const tier = (fcData.tier || fcData.plan || 'basic').toLowerCase();
      const days = Number(fcData.days) || (tier === 'pro' ? 730 : tier === 'plus' ? 90 : 20);
      const planName = fcData.planName || (tier.charAt(0).toUpperCase() + tier.slice(1));

      // Provision membership in Redis
      await setPremium(session.sub, tier, days, `forcloud:${fcData.code}`);

      // Record transaction entry so user and admin see it in Transactions & Key Submissions
      try {
        const txEntry = JSON.stringify({
          userId: session.sub,
          username: session.username || '',
          displayName: session.displayName || session.username || '',
          utrId: fcData.code,
          code: fcData.code,
          type: 'access_key',
          plan: tier,
          planName,
          days,
          priceINR: fcData.priceINR || (tier === 'pro' ? 599 : tier === 'plus' ? 300 : 100),
          timestamp: fcData.redeemedAt || new Date().toISOString(),
          status: 'approved',
          approvedAt: fcData.redeemedAt || new Date().toISOString(),
          approvedBy: 'ForCloud License Server',
          notes: `Redeemed ${planName} Plan (${days} Days)`,
        });
        await redis.lpush('hwasi:utr_submissions', txEntry);
        await redis.ltrim('hwasi:utr_submissions', 0, 999);
      } catch (txErr) {
        console.error('Failed to record key redemption transaction:', txErr);
      }

      // Fetch fresh subscription object
      const updatedSub = await getPremium(session.sub);

      console.log(`✅ ForCloud Key Redeemed: user=${session.sub} code=${fcData.code} tier=${tier} days=${days}`);

      return NextResponse.json({
        ok: true,
        valid: true,
        code: fcData.code,
        tier,
        plan: tier,
        planName,
        days,
        priceINR: fcData.priceINR,
        redeemedAt: fcData.redeemedAt || new Date().toISOString(),
        expiresAt: updatedSub?.expiresAt,
        message: fcData.message || `Access key redeemed successfully! ${days} days ${planName} plan activated.`,
      });
    }

    // Unexpected response
    return NextResponse.json({
      ok: false,
      error: fcData.error || 'Unable to verify access key at this time. Please try again.',
    }, { status: fcRes.status || 500 });

  } catch (err) {
    console.error('ForCloud redemption error:', err);
    return NextResponse.json({
      ok: false,
      error: 'Network error communicating with license server. Please try again in a moment.',
    }, { status: 502 });
  }
}
