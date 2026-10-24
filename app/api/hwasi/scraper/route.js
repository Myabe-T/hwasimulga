export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { decryptPayload } from '@/lib/crypto';
import {
  redis,
  KEYS,
  getSettings,
  getVideoTitles,
  setVideoTitle,
  setThumbnail,
  saveExtraThumb,
  getExtraCdnSources,
  saveExtraCdnSources
} from '@/lib/redis';

const SITE_CONFIG = {
  desimms: {
    name: 'DesiMMS',
    wpApi: 'https://www.desimms.com.co/wp-json/wp/v2/posts',
    cdnBase: 'https://cdn.desimms.com.co',
    cdnPattern: /https?:\/\/cdn\.desimms\.com\.co\/(\d+)\.mp4/i,
    isExtra: false,
    offset: 0,
  },
  hindibf: {
    name: 'HindiBF',
    wpApi: 'https://www.hindibf.com.co/wp-json/wp/v2/posts',
    cdnBase: 'https://cdn.hindibf.com.co',
    cdnPattern: /https?:\/\/cdn\.hindibf\.com\.co\/(\d+)\.mp4/i,
    isExtra: true,
    offset: 10000,
  },
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function bufferToBase64(buffer) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUtf8(b64) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf8');
  }
  return decodeURIComponent(escape(atob(b64)));
}

// GET /api/hwasi/scraper?site=desimms&pages=3
// Scans WordPress REST API for new videos, skips already-existing ones, and extracts CDN IDs
export async function GET(req) {
  const { error, status } = await requireAuth(['admin']);
  if (error) return NextResponse.json({ error }, { status });

  const url = new URL(req.url);
  const siteKey = (url.searchParams.get('site') || 'desimms').toLowerCase();
  const maxPages = Math.min(Math.max(parseInt(url.searchParams.get('pages') || '3', 10), 1), 10);
  const deepScan = url.searchParams.get('deep') === 'true';

  const cfg = SITE_CONFIG[siteKey] || SITE_CONFIG.desimms;

  try {
    // 1. Gather all currently known IDs in database
    const [titlesMap, settings, cdnHashKeys] = await Promise.all([
      getVideoTitles().catch(() => ({})),
      getSettings().catch(() => ({})),
      cfg.isExtra ? redis.hkeys(KEYS.VIDEO_CDN).catch(() => []) : Promise.resolve([]),
    ]);

    const knownSystemIds = new Set(Object.keys(titlesMap || {}));
    if (cfg.isExtra) {
      for (const k of cdnHashKeys || []) knownSystemIds.add(String(k));
    }

    // Also populate known IDs from settings range to ensure we don't duplicate
    if (!cfg.isExtra) {
      const sStart = settings.start || 1;
      const sEnd = settings.end || 0;
      for (let i = sStart; i <= sEnd; i++) knownSystemIds.add(String(i));
    } else {
      const hRange = (settings.extraRanges || []).find(r => r.cdnId === 'hindibf' || r.start >= 10000);
      if (hRange) {
        for (let i = hRange.start; i <= hRange.end; i++) knownSystemIds.add(String(i));
      }
    }

    const newVideos = [];
    let scannedPosts = 0;
    let knownCount = 0;
    let stopEarly = false;

    // 2. Scan WordPress API pages
    for (let pg = 1; pg <= maxPages && !stopEarly; pg++) {
      const apiUrl = `${cfg.wpApi}?per_page=20&page=${pg}&_fields=id,link,title,yoast_head_json`;
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': UA,
          'Accept': 'application/json',
          'Referer': cfg.cdnBase,
        },
      });

      if (!res.ok) {
        if (res.status === 400 || res.status === 404) break; // no more pages
        throw new Error(`WordPress API returned HTTP ${res.status}`);
      }

      const posts = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) break;

      scannedPosts += posts.length;
      let pageKnownCount = 0;

      // Inspect each post
      for (const p of posts) {
        const rawTitle = (p.title?.rendered || '').replace(/<[^>]+>/g, '').trim();
        const postLink = p.link || '';
        let thumbUrl = p.yoast_head_json?.og_image?.[0]?.url || '';

        if (!postLink) continue;

        try {
          // Fetch post HTML to extract player iframe base64 query param
          const pageRes = await fetch(postLink, {
            headers: {
              'User-Agent': UA,
              'Accept': 'text/html,application/xhtml+xml',
            },
          });

          if (!pageRes.ok) continue;

          const html = await pageRes.text();
          const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
          let cdnId = null;
          let cdnUrl = null;

          if (iframeMatch) {
            const iframeSrc = iframeMatch[1];
            const qMatch = iframeSrc.match(/q=([a-zA-Z0-9+/=]+)/);
            if (qMatch) {
              const decoded = base64ToUtf8(qMatch[1]);
              const urlDecoded = decodeURIComponent(decoded);

              const m = urlDecoded.match(cfg.cdnPattern);
              if (m) {
                cdnId = parseInt(m[1], 10);
                cdnUrl = m[0];
              }

              // Fallback for thumbnail from decoded video poster attribute
              if (!thumbUrl) {
                const posterMatch = urlDecoded.match(/poster=["']([^"']+)["']/i);
                if (posterMatch) thumbUrl = posterMatch[1];
              }
            }
          }

          // If no iframe match, fallback direct scan of HTML
          if (!cdnId) {
            const directMatch = html.match(cfg.cdnPattern);
            if (directMatch) {
              cdnId = parseInt(directMatch[1], 10);
              cdnUrl = directMatch[0];
            }
          }

          if (cdnId) {
            const systemId = cfg.isExtra ? (cfg.offset + cdnId) : cdnId;
            const strSysId = String(systemId);

            if (knownSystemIds.has(strSysId)) {
              knownCount++;
              pageKnownCount++;
            } else {
              // Mark seen in current run
              knownSystemIds.add(strSysId);
              newVideos.push({
                postId: p.id,
                cdnId,
                systemId,
                title: rawTitle,
                thumbnail: thumbUrl,
                cdnUrl: cdnUrl || `${cfg.cdnBase}/${cdnId}.mp4`,
                postUrl: postLink,
                site: siteKey,
              });
            }
          }
        } catch (itemErr) {
          console.warn(`Error scanning post ${p.id}:`, itemErr.message);
        }
      }

      // Stop early if not deep scan and majority of page was already known
      if (!deepScan && pageKnownCount >= 5 && newVideos.length > 0) {
        stopEarly = true;
      }
    }

    // Sort newest / highest ID first
    newVideos.sort((a, b) => b.systemId - a.systemId);

    return NextResponse.json({
      ok: true,
      site: siteKey,
      siteName: cfg.name,
      scannedPosts,
      newCount: newVideos.length,
      knownCount,
      newVideos,
    });
  } catch (err) {
    console.error('Scraper GET error:', err);
    return NextResponse.json({ error: err.message || 'Scraper failed' }, { status: 500 });
  }
}

// POST /api/hwasi/scraper
// Imports scraped or manually entered videos (thumbnail download -> base64 -> Redis, title -> Redis, range auto-update)
export async function POST(req) {
  const { error, status } = await requireAuth(['admin']);
  if (error) return NextResponse.json({ error }, { status });

  let body = {};
  try {
    const raw = await req.json();
    if (raw && raw.cipher && raw.iv) {
      body = await decryptPayload(raw.cipher, raw.iv);
    } else {
      body = raw;
    }
  } catch {
    body = {};
  }

  const { videos, video } = body;
  const items = Array.isArray(videos) ? videos : (video ? [video] : []);

  if (items.length === 0) {
    return NextResponse.json({ error: 'No video entries provided' }, { status: 400 });
  }

  try {
    const settings = await getSettings();
    let settingsChanged = false;
    const importedResults = [];

    for (const item of items) {
      const siteKey = (item.site || 'desimms').toLowerCase();
      const cfg = SITE_CONFIG[siteKey] || SITE_CONFIG.desimms;
      const cdnId = parseInt(item.cdnId, 10);
      const systemId = item.systemId ? parseInt(item.systemId, 10) : (cfg.isExtra ? cfg.offset + cdnId : cdnId);
      const title = (item.title || `Video #${systemId}`).trim();

      let dataUrl = item.dataUrl || '';

      // 1. If thumbnail is a remote HTTP URL and no dataUrl is provided, download and convert to base64
      if (!dataUrl && item.thumbnail && item.thumbnail.startsWith('http')) {
        try {
          const tRes = await fetch(item.thumbnail, {
            headers: {
              'User-Agent': UA,
              'Accept': 'image/*,*/*',
              'Referer': cfg.cdnBase,
            },
          });
          if (tRes.ok) {
            const buf = await tRes.arrayBuffer();
            const mime = tRes.headers.get('content-type') || 'image/jpeg';
            const b64 = bufferToBase64(buf);
            dataUrl = `data:${mime};base64,${b64}`;
          }
        } catch (tErr) {
          console.warn(`Failed to fetch thumbnail for #${systemId}:`, tErr.message);
        }
      }

      // 2. Save Title
      await setVideoTitle(systemId, title);

      // 3. Save Thumbnail & CDN Mapping
      if (cfg.isExtra || systemId >= 10000) {
        // Extra CDN (HindiBF)
        if (dataUrl) {
          await saveExtraThumb(systemId, dataUrl);
        }
        await redis.hset(KEYS.VIDEO_CDN, {
          [String(systemId)]: JSON.stringify({ cdn: cfg.isExtra ? 'hindibf' : siteKey, vid: String(cdnId) }),
        });
      } else {
        // Primary CDN (DesiMMS)
        if (dataUrl) {
          await setThumbnail(systemId, dataUrl);
        }
      }

      // 4. Update Range in Settings if new video extends current boundaries
      if (!cfg.isExtra && systemId < 10000) {
        if (systemId > (settings.end || 0)) {
          settings.end = systemId;
          settingsChanged = true;
        }
      } else if (cfg.isExtra || systemId >= 10000) {
        const extraRanges = settings.extraRanges || [];
        let hRange = extraRanges.find(r => r.cdnId === 'hindibf' || r.start >= 10000);
        if (hRange) {
          if (systemId > hRange.end) {
            hRange.end = systemId;
            settingsChanged = true;
          }
        } else {
          extraRanges.push({ start: 10001, end: systemId, cdnId: 'hindibf' });
          settingsChanged = true;
        }
        settings.extraRanges = extraRanges;

        // Also update extra CDNs registry
        try {
          const cdns = await getExtraCdnSources();
          const hCdn = (cdns || []).find(c => c.cdnId === 'hindibf');
          if (hCdn) {
            hCdn.cdnRange = { min: 1, max: Math.max(hCdn.cdnRange?.max || 0, cdnId) };
            hCdn.systemRange = { start: 10001, end: Math.max(hCdn.systemRange?.end || 10001, systemId) };
            hCdn.count = hCdn.cdnRange.max;
            await saveExtraCdnSources(cdns);
          }
        } catch {}
      }

      importedResults.push({
        systemId,
        cdnId,
        site: siteKey,
        title,
        hasThumb: Boolean(dataUrl),
      });
    }

    if (settingsChanged) {
      await redis.set(KEYS.SETTINGS, JSON.stringify(settings));
    }

    return NextResponse.json({
      ok: true,
      importedCount: importedResults.length,
      results: importedResults,
      updatedSettings: settings,
    });
  } catch (err) {
    console.error('Scraper POST error:', err);
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 });
  }
}
