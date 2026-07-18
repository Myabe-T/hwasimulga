export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { signVideoId } from '@/lib/sign';

// GET /api/hwasi/sign/[id] — admin/advisor only: get a stream token for any video
export async function GET(req, { params }) {
  const { error, status } = await requireAuth(['admin', 'advisor']);
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
  }

  try {
    const token = await signVideoId(String(id));
    const src = `/api/v/${token}`;
    return NextResponse.json({ src, token, id });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to sign video' }, { status: 500 });
  }
}
