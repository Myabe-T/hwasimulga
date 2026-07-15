export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllReportedIds, getReports, clearReport } from '@/lib/redis';

export async function GET(req) {
  const session = await getSession();
  if (!session || !['admin', 'advisor'].includes(session.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const ids = await getAllReportedIds();
  const reports = await Promise.all(
    (ids || []).map(async id => ({ videoId: Number(id), reports: await getReports(id) }))
  );
  return NextResponse.json({ reports: reports.filter(r => r.reports.length > 0) });
}

export async function DELETE(req) {
  const session = await getSession();
  if (!session || !['admin', 'advisor'].includes(session.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { videoId } = await req.json();
  await clearReport(videoId);
  return NextResponse.json({ ok: true });
}
