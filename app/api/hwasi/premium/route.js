export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPremium, setPremium, revokePremium, getAllPremiumIds, getUsers, PLANS } from '@/lib/redis';

// GET /api/hwasi/premium — admin: list all users with premium info
// GET /api/hwasi/premium?me=1 — any user: check own premium
export async function GET(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const me = new URL(req.url).searchParams.get('me');
  if (me) {
    const sub = await getPremium(session.sub);
    return NextResponse.json({ premium: sub, plans: PLANS });
  }

  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [users, premiumIds] = await Promise.all([getUsers(), getAllPremiumIds()]);
  const premiumMap = Object.fromEntries(
    await Promise.all(premiumIds.map(async id => [id, await getPremium(id)]))
  );
  const result = users.map(u => ({
    ...u,
    password: undefined,
    premium: premiumMap[u.id] || null,
  }));
  return NextResponse.json({ users: result, plans: PLANS });
}

// POST /api/hwasi/premium — admin: grant premium
// body: { userId, plan, days? }
export async function POST(req) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId, plan, days } = await req.json();
  if (!userId || !plan) return NextResponse.json({ error: 'userId and plan required' }, { status: 400 });
  if (!PLANS[plan]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const planDays = days || PLANS[plan].days;
  await setPremium(userId, plan, planDays, session.username);
  return NextResponse.json({ ok: true, userId, plan, days: planDays });
}

// DELETE /api/hwasi/premium?userId=xxx — admin: revoke
export async function DELETE(req) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  await revokePremium(userId);
  return NextResponse.json({ ok: true });
}
