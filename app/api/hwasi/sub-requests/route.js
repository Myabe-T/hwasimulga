export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSubRequests, saveSubRequests, addSubRequest, setPremium } from '@/lib/redis';

// GET — admin sees all pending requests
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const requests = await getSubRequests();
  return NextResponse.json({ requests });
}

// POST — advisor submits a subscription request
export async function POST(req) {
  const session = await getSession();
  if (!session || !['admin','advisor'].includes(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId, userDisplayName, plan, days } = await req.json();
  if (!userId || !plan || !days) return NextResponse.json({ error: 'userId, plan, days required' }, { status: 400 });
  await addSubRequest({
    requestedFor: userId,
    requestedForDisplay: userDisplayName || userId,
    requestedBy: session.username,
    requestedByRole: session.role,
    plan, days: Number(days),
  });
  return NextResponse.json({ ok: true });
}

// PATCH — admin approves or rejects
export async function PATCH(req) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { requestId, action } = await req.json(); // action: 'approve' | 'reject'
  const requests = await getSubRequests();
  const idx = requests.findIndex(r => r.id === requestId);
  if (idx === -1) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  const r = requests[idx];
  requests[idx] = { ...r, status: action === 'approve' ? 'approved' : 'rejected', reviewedAt: new Date().toISOString() };
  await saveSubRequests(requests);
  if (action === 'approve') {
    await setPremium(r.requestedFor, r.plan, r.days, session.username);
    return NextResponse.json({ ok: true, approved: true });
  }
  return NextResponse.json({ ok: true, rejected: true });
}
