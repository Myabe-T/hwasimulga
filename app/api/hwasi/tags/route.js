export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

async function getUser(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return null;
  try {
    const { payload } = await jwtVerify(cookie.value, SECRET);
    return payload;
  } catch {
    return null;
  }
}

// Popular keyword dictionary to extract smart tags from video titles
const DEFAULT_TAG_KEYWORDS = [
  'bhabhi', 'boobs', 'boob', 'sexy', 'hot', 'mms', 'leaked', 'viral',
  'girlfriend', 'gf', 'tamil', 'mallu', 'desi', 'milf', 'wife', 'aunt',
  'cheating', 'threesome', 'blowjob', 'creampie', 'pussy', 'dick', 'couple',
  'teen', 'maid', 'daughter', 'hidden', 'scandal', 'romance', 'hindi', 'mature', 'cute'
];

function extractDefaultTags(title) {
  if (!title) return ['desi', 'exclusive', 'viral'];
  const lower = title.toLowerCase();
  const matched = [];

  for (const kw of DEFAULT_TAG_KEYWORDS) {
    if (lower.includes(kw)) {
      matched.push(kw);
      if (matched.length >= 4) break;
    }
  }

  // If fewer than 2 matched, extract significant alphanumeric words (> 3 chars)
  if (matched.length < 2) {
    const stopWords = new Set(['with', 'and', 'the', 'for', 'this', 'that', 'from', 'video', 'full', 'your', 'have', 'more', 'part', 'desi']);
    const words = lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
    for (const w of words) {
      if (!matched.includes(w)) {
        matched.push(w);
        if (matched.length >= 3) break;
      }
    }
  }

  if (matched.length === 0) matched.push('desi', 'viral', 'exclusive');
  return matched.slice(0, 3);
}

// GET /api/hwasi/tags?videoId=<id>&title=<title>
export async function GET(req) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get('videoId') || url.searchParams.get('id');
  const title = url.searchParams.get('title') || '';

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  const user = await getUser(req);
  const currentUserId = user?.id || user?.username || null;
  const isAdminOrAdvisor = user?.role === 'admin' || user?.role === 'advisor';

  try {
    const raw = await redis.get(`hwasi:tags:${videoId}`);
    let tags = [];

    if (raw) {
      tags = typeof raw === 'string' ? JSON.parse(raw) : raw;
    }

    // If no tags exist yet, generate default tags from title
    if (!tags || tags.length === 0) {
      const defTags = extractDefaultTags(title);
      tags = defTags.map((t, idx) => ({
        id: `def_${idx}_${t}`,
        tag: t,
        userId: 'system',
        username: 'DesiHawas',
        isDefault: true,
        addedAt: new Date().toISOString()
      }));
    }

    // Mark tags that the current user can delete or edit
    const annotatedTags = tags.map(t => ({
      ...t,
      canDelete: Boolean(
        isAdminOrAdvisor ||
        (!t.isDefault && currentUserId && (t.userId === currentUserId || t.username === user?.username))
      )
    }));

    // Check if the current user has already added their 1 allowed tag
    const userTagCount = tags.filter(t => !t.isDefault && currentUserId && (t.userId === currentUserId || t.username === user?.username)).length;

    return NextResponse.json({
      ok: true,
      tags: annotatedTags,
      totalTags: tags.length,
      maxTags: 10,
      userHasAdded: userTagCount >= 1,
      canAddMore: tags.length < 10 && (isAdminOrAdvisor || userTagCount === 0),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=60',
      }
    });
  } catch (err) {
    return NextResponse.json({ ok: false, tags: [], error: err.message }, { status: 500 });
  }
}

// POST /api/hwasi/tags
// Body: { videoId: number|string, tag: string, title?: string }
export async function POST(req) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to add a tag' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { videoId, tag, title } = body;

    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }

    const cleanTag = (tag || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').slice(0, 25);
    if (!cleanTag || cleanTag.length < 2) {
      return NextResponse.json({ error: 'Tag must be between 2 and 25 characters' }, { status: 400 });
    }

    const currentUserId = user.id || user.username;
    const isAdminOrAdvisor = user.role === 'admin' || user.role === 'advisor';

    const key = `hwasi:tags:${videoId}`;
    const raw = await redis.get(key);
    let tags = [];

    if (raw) {
      tags = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } else {
      // Initialize with default tags from title so existing suggestions remain
      const defTags = extractDefaultTags(title || '');
      tags = defTags.map((t, idx) => ({
        id: `def_${idx}_${t}`,
        tag: t,
        userId: 'system',
        username: 'DesiHawas',
        isDefault: true,
        addedAt: new Date().toISOString()
      }));
    }

    // Check total limit (max 10 tags per video)
    if (tags.length >= 10) {
      return NextResponse.json({ error: 'This video has reached the maximum limit of 10 tags' }, { status: 400 });
    }

    // Check duplicate tag
    if (tags.some(t => t.tag.toLowerCase() === cleanTag)) {
      return NextResponse.json({ error: `Tag "${cleanTag}" is already added to this video` }, { status: 400 });
    }

    // Regular users can only add 1 tag per video
    if (!isAdminOrAdvisor) {
      const userExisting = tags.find(t => !t.isDefault && (t.userId === currentUserId || t.username === user.username));
      if (userExisting) {
        return NextResponse.json({
          error: `You have already added tag "${userExisting.tag}". You can edit or delete your existing tag.`,
          existingTag: userExisting
        }, { status: 400 });
      }
    }

    const newTag = {
      id: `tag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      tag: cleanTag,
      userId: currentUserId,
      username: user.username,
      displayName: user.displayName || user.username,
      isDefault: false,
      addedAt: new Date().toISOString(),
    };

    tags.push(newTag);
    await redis.set(key, JSON.stringify(tags));

    const annotatedTags = tags.map(t => ({
      ...t,
      canDelete: Boolean(
        isAdminOrAdvisor ||
        (!t.isDefault && currentUserId && (t.userId === currentUserId || t.username === user.username))
      )
    }));

    return NextResponse.json({
      ok: true,
      message: 'Tag added successfully',
      tags: annotatedTags,
      totalTags: tags.length,
    });
  } catch (err) {
    console.error('POST /api/hwasi/tags error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/hwasi/tags
// Body: { videoId: number|string, tagId?: string, tag?: string }
export async function DELETE(req) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to delete a tag' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { videoId, tagId, tag } = body;

    if (!videoId || (!tagId && !tag)) {
      return NextResponse.json({ error: 'Missing videoId and tagId/tag' }, { status: 400 });
    }

    const currentUserId = user.id || user.username;
    const isAdminOrAdvisor = user.role === 'admin' || user.role === 'advisor';

    const key = `hwasi:tags:${videoId}`;
    const raw = await redis.get(key);
    if (!raw) {
      return NextResponse.json({ error: 'No tags found for this video' }, { status: 404 });
    }

    let tags = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const targetIndex = tags.findIndex(t => (tagId && t.id === tagId) || (tag && t.tag.toLowerCase() === tag.toLowerCase()));

    if (targetIndex === -1) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const targetTag = tags[targetIndex];

    // Only Admin/Advisor or the user who created this tag can delete it
    const isOwner = !targetTag.isDefault && (targetTag.userId === currentUserId || targetTag.username === user.username);
    if (!isAdminOrAdvisor && !isOwner) {
      return NextResponse.json({ error: 'You do not have permission to delete this tag' }, { status: 403 });
    }

    tags.splice(targetIndex, 1);
    await redis.set(key, JSON.stringify(tags));

    const annotatedTags = tags.map(t => ({
      ...t,
      canDelete: Boolean(
        isAdminOrAdvisor ||
        (!t.isDefault && currentUserId && (t.userId === currentUserId || t.username === user.username))
      )
    }));

    return NextResponse.json({
      ok: true,
      message: 'Tag deleted successfully',
      tags: annotatedTags,
      totalTags: tags.length,
    });
  } catch (err) {
    console.error('DELETE /api/hwasi/tags error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
