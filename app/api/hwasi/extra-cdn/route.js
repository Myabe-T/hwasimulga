export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getExtraCdnSources, saveExtraCdnSources,
  setVideoCdnBatch, saveExtraThumbBatch,
  redis, KEYS,
} from '@/lib/redis';

// GET — list all extra CDN sources
export async function GET() {
  const { error, status } = await requireAuth(['admin', 'advisor']);
  if (error) return NextResponse.json({ error }, { status });
  const sources = await getExtraCdnSources();
  return NextResponse.json({ ok: true, sources });
}

// POST — add a new CDN source and import metadata JSON
// Body: { name, cdnId, cdnBase, videos: [{ id, title?, thumb? }] }
export async function POST(req) {
  const { error, status } = await requireAuth(['admin']);
  if (error) return NextResponse.json({ error }, { status });

  let body = {};
  try { body = await req.json(); } catch {}

  const { name, cdnId, cdnBase, videos = [] } = body;
  if (!cdnId || !cdnBase) return NextResponse.json({ error: 'cdnId and cdnBase are required' }, { status: 400 });
  if (!/^https?:\/\//.test(cdnBase)) return NextResponse.json({ error: 'cdnBase must be a valid URL' }, { status: 400 });

  // 1. Register CDN mapping for each video ID (VIDEO_CDN hash)
  if (videos.length > 0) {
    await setVideoCdnBatch(videos.map(v => ({ id: v.id, cdnId })));
  }

  // 2. Store base64 thumbnails (EXTRA_THUMBS hash)
  const withThumbs = videos.filter(v => v.thumb);
  if (withThumbs.length > 0) {
    await saveExtraThumbBatch(withThumbs.map(v => ({ id: v.id, thumb: v.thumb })));
  }

  // 3. Store titles in hwasi:video_titles
  const withTitles = videos.filter(v => v.title);
  if (withTitles.length > 0) {
    const { getVideoTitles, redis } = await import('@/lib/redis');
    const existingTitles = await getVideoTitles();
    for (const v of withTitles) existingTitles[String(v.id)] = v.title;
    await redis.set('hwasi:video_titles', JSON.stringify(existingTitles));
  }

  // 4. Save/update the CDN source entry
  const sources = await getExtraCdnSources();
  const existing = sources.findIndex(s => s.cdnId === cdnId);
  const entry = {
    name: name || cdnId,
    cdnId,
    cdnBase,
    count: videos.length,
    ids: videos.map(v => Number(v.id)),
    importedAt: new Date().toISOString(),
  };
  if (existing >= 0) {
    sources[existing] = { ...sources[existing], ...entry };
  } else {
    sources.push(entry);
  }
  await saveExtraCdnSources(sources);

  return NextResponse.json({
    ok: true,
    cdnId,
    imported: videos.length,
    withThumbs: withThumbs.length,
    withTitles: withTitles.length,
  });
}

// DELETE — remove an extra CDN source
// Body: { cdnId }
export async function DELETE(req) {
  const { error, status } = await requireAuth(['admin']);
  if (error) return NextResponse.json({ error }, { status });

  let body = {};
  try { body = await req.json(); } catch {}
  const { cdnId } = body;
  if (!cdnId) return NextResponse.json({ error: 'cdnId required' }, { status: 400 });

  const sources = await getExtraCdnSources();
  const target = sources.find(s => s.cdnId === cdnId);
  const updated = sources.filter(s => s.cdnId !== cdnId);
  await saveExtraCdnSources(updated);

  // Remove CDN mappings for this source's video IDs
  if (target?.ids?.length > 0) {
    await redis.hdel(KEYS.VIDEO_CDN, ...target.ids.map(String));
    await redis.hdel(KEYS.EXTRA_THUMBS, ...target.ids.map(String));
  }

  return NextResponse.json({ ok: true, removed: cdnId });
}
