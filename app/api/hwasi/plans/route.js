export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getPlans, savePlans, DEFAULT_PLANS } from '@/lib/redis';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try { const { payload } = await jwtVerify(cookie.value, SECRET); return payload; } catch { return null; }
}

// GET — public, returns all plans
export async function GET() {
  const plans = await getPlans();
  return NextResponse.json({ plans });
}

// PUT — admin only, save updated plans
export async function PUT(req) {
  const user = await getUser(req);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  // Validate structure
  const updated = {};
  for (const key of ['basic','plus','pro']) {
    if (!body[key]) continue;
    const p = body[key];
    updated[key] = {
      ...DEFAULT_PLANS[key],
      ...p,
      price: Math.max(1, Number(p.price) || DEFAULT_PLANS[key].price),
      originalPrice: Math.max(1, Number(p.originalPrice) || DEFAULT_PLANS[key].originalPrice),
      days: Math.max(1, Number(p.days) || DEFAULT_PLANS[key].days),
    };
  }
  await savePlans(updated);
  return NextResponse.json({ ok: true, plans: updated });
}
