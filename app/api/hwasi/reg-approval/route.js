export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRegApprovalRequired, setRegApprovalRequired } from '@/lib/redis';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const required = await getRegApprovalRequired();
  return NextResponse.json({ required });
}

export async function POST(req) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { required } = await req.json();
  await setRegApprovalRequired(!!required);
  return NextResponse.json({ ok: true, required: !!required });
}
