export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { encryptPayload, decryptPayload } from '@/lib/crypto';
import { getSession } from '@/lib/auth';
import { getPremium, setPremium, revokePremium, getAllPremiumIds, getUsers, getRegUsers, PLANS } from '@/lib/redis';

async function parseBody(req) {
  try {
    const raw = await req.json();
    if (raw && raw.cipher && raw.iv) {
      return await decryptPayload(raw.cipher, raw.iv);
    }
    return raw;
  } catch { return {}; }
}

// GET /api/hwasi/premium — admin: list all users with premium info
// GET /api/hwasi/premium?me=1 — any user: check own premium
export async function GET(req) {
  const session = await getSession();
  if (!session) return NextResponse.json(await encryptPayload({ error: 'Unauthorized' }), { status: 401 });

  const me = new URL(req.url).searchParams.get('me');
  if (me) {
    // Admin/advisor always "premium"
    if (['admin','advisor'].includes(session.role)) {
      return NextResponse.json(await encryptPayload({ premium: { plan: 'admin', isPermanent: true } }));
    }
    const sub = await getPremium(session.sub);
    return NextResponse.json(await encryptPayload({ premium: sub || null }));
  }

  if (!['admin','advisor'].includes(session.role)) {
    return NextResponse.json(await encryptPayload({ error: 'Forbidden' }), { status: 403 });
  }

  const [staticUsers, regUsers, premiumIds] = await Promise.all([getUsers(), getRegUsers(), getAllPremiumIds()]);
  const users = [...staticUsers, ...regUsers];
  const premiumMap = Object.fromEntries(
    await Promise.all(premiumIds.map(async id => [id, await getPremium(id)]))
  );
  const result = users.map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    avatar: u.avatar,
    email: u.email,
    createdAt: u.createdAt,
    // Admin/advisor are always premium - show as such
    premium: ['admin','advisor'].includes(u.role) ? { plan: 'admin', isPermanent: true } : (premiumMap[u.id] || null),
  }));
  return NextResponse.json(await encryptPayload({ users: result }));
}

// POST /api/hwasi/premium — admin: grant premium
export async function POST(req) {
  const session = await getSession();
  if (!session || !['admin','advisor'].includes(session.role)) {
    return NextResponse.json(await encryptPayload({ error: 'Forbidden' }), { status: 403 });
  }

  const body = await parseBody(req);
  const { userId, plan, days } = body || {};
  
  if (!userId || !plan) {
    return NextResponse.json(await encryptPayload({ error: 'userId and plan required' }), { status: 400 });
  }
  if (!PLANS || !PLANS[plan]) {
    // Fallback plan days
    const fallbackDays = { basic: 30, plus: 60, pro: 1095 };
    const planDays = days || fallbackDays[plan] || 30;
    await setPremium(userId, plan, planDays, session.username);
    return NextResponse.json(await encryptPayload({ ok: true }));
  }

  const planDays = days || PLANS[plan].days;
  await setPremium(userId, plan, planDays, session.username);
  return NextResponse.json(await encryptPayload({ ok: true }));
}

// DELETE /api/hwasi/premium?userId=xxx — admin: revoke
export async function DELETE(req) {
  const session = await getSession();
  if (!session || !['admin','advisor'].includes(session.role)) {
    return NextResponse.json(await encryptPayload({ error: 'Forbidden' }), { status: 403 });
  }

  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) return NextResponse.json(await encryptPayload({ error: 'userId required' }), { status: 400 });
  await revokePremium(userId);
  return NextResponse.json(await encryptPayload({ ok: true }));
}
