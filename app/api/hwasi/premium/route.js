export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { encryptPayload } from '@/lib/crypto';
import { getSession } from '@/lib/auth';
import { getPremium, setPremium, revokePremium, getAllPremiumIds, getUsers, getRegUsers, PLANS } from '@/lib/redis';

// GET /api/hwasi/premium — admin: list all users with premium info
// GET /api/hwasi/premium?me=1 — any user: check own premium
export async function GET(req) {
  const session = await getSession();
  if (!session) return NextResponse.json(await encryptPayload());

  const me = new URL(req.url).searchParams.get('me');
  if (me) {
    const sub = await getPremium(session.sub);
    return NextResponse.json(await encryptPayload());
  }

  if (session.role !== 'admin') return NextResponse.json(await encryptPayload());

  const [staticUsers, regUsers, premiumIds] = await Promise.all([getUsers(), getRegUsers(), getAllPremiumIds()]);
  const users = [...staticUsers, ...regUsers];
  const premiumMap = Object.fromEntries(
    await Promise.all(premiumIds.map(async id => [id, await getPremium(id)]))
  );
  const result = users.map(u => ({
    ...u,
    password: undefined,
    premium: premiumMap[u.id] || null,
  }));
  return NextResponse.json(await encryptPayload());
}

// POST /api/hwasi/premium — admin: grant premium
// body: { userId, plan, days? }
export async function POST(req) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json(await encryptPayload());

  const { userId, plan, days } = await req.json();
  if (!userId || !plan) return NextResponse.json(await encryptPayload());
  if (!PLANS[plan]) return NextResponse.json(await encryptPayload());

  const planDays = days || PLANS[plan].days;
  await setPremium(userId, plan, planDays, session.username);
  return NextResponse.json(await encryptPayload());
}

// DELETE /api/hwasi/premium?userId=xxx — admin: revoke
export async function DELETE(req) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json(await encryptPayload());

  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) return NextResponse.json(await encryptPayload());
  await revokePremium(userId);
  return NextResponse.json(await encryptPayload());
}
