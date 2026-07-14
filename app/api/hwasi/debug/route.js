export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { redis, KEYS } from '@/lib/redis';
import { getSession } from '@/lib/auth';

// GET /api/hwasi/debug — admin only, shows raw Redis state for thumbnails
export async function GET(req) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    // Read the raw value for thumb 1
    const raw1 = await redis.get('hwasi:thumb:1');
    const raw51 = await redis.get('hwasi:thumb:51');
    const thumbsSet = await redis.smembers(KEYS.THUMBS_SET);

    const describe = (val) => {
      if (val === null || val === undefined) return { type: typeof val, value: null };
      const t = typeof val;
      if (t === 'string') return {
        type: 'string',
        length: val.length,
        first100: val.substring(0, 100),
        startsWithData: val.startsWith('data:'),
        startsWithSlash9j: val.startsWith('/9j/'),
        hasComma: val.includes(','),
        commaAt: val.indexOf(','),
      };
      if (t === 'object') return {
        type: 'object',
        keys: Object.keys(val),
        b64Preview: val.b64 ? val.b64.substring(0, 60) : null,
      };
      return { type: t, value: String(val).substring(0, 100) };
    };

    return NextResponse.json({
      thumbsSet,
      thumb1: describe(raw1),
      thumb51: describe(raw51),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
