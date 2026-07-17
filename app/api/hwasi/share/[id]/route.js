export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { encryptPayload } from '@/lib/crypto';

export async function GET(req, { params }) {
  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const encrypted = await encryptPayload({ id: Number(id), ts: Date.now() });
  const token = `${encrypted.cipher}.${encrypted.iv}`;
  return NextResponse.json({ token });
}
