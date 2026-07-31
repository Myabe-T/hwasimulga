/**
 * One-time import script: reads hindibf new/ folder files and pushes
 * all video metadata (titles, base64 thumbnails, CDN mappings) directly
 * into Upstash Redis using the REST API.
 *
 * System IDs for hindibf = actual CDN video ID + 10000
 * e.g. hindibf video 58 → system gallery ID 10058
 * This avoids ID conflicts with the main desimms CDN (IDs 51-730).
 *
 * Run: node import-hindibf.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Upstash REST credentials ──────────────────────────────────────────────────
const REDIS_URL   = 'https://relaxed-joey-122660.upstash.io';
const REDIS_TOKEN = 'gQAAAAAAAd8kAQIgcDE5MDcyNTE5ODEzNTM0MjE5ODBkMmFkNDJhNzZmYzBkYQ';
const OFFSET      = 10000; // hindibf system ID = cdnVideoId + OFFSET

async function redisCmd(cmd) {
  const res = await fetch(`${REDIS_URL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  return res.json();
}

// ── Load the 3 JSON files ─────────────────────────────────────────────────────
const FOLDER = join(__dirname, 'hindibf new');

console.log('📂 Reading files from:', FOLDER);
const titles    = JSON.parse(readFileSync(join(FOLDER, 'titles.json'), 'utf8'));
const thumbsRaw = JSON.parse(readFileSync(join(FOLDER, 'thumbnails_base64.json'), 'utf8'));
const videos    = JSON.parse(readFileSync(join(FOLDER, 'videos1.json'), 'utf8'));

const cdnIds = Object.keys(titles).map(Number);
console.log(`📹 Videos:     ${videos.length}`);
console.log(`🏷️  Titles:     ${cdnIds.length}`);
console.log(`🖼️  Thumbnails: ${Object.keys(thumbsRaw).length}`);
console.log(`🔢  System ID range: ${OFFSET + Math.min(...cdnIds)} – ${OFFSET + Math.max(...cdnIds)}`);

// ── Step 1: Store CDN routing map (hwasi:video_cdn HASH) ──────────────────────
// Format: { "10058": '{"cdn":"hindibf","vid":"58"}' }
console.log('\n⏳ Step 1: Storing CDN mappings (system IDs)...');
const cdnMapArgs = [];
for (const cdnId of cdnIds) {
  const systemId = OFFSET + cdnId;
  cdnMapArgs.push(String(systemId));
  cdnMapArgs.push(JSON.stringify({ cdn: 'hindibf', vid: String(cdnId) }));
}
const r1 = await redisCmd(['HSET', 'hwasi:video_cdn', ...cdnMapArgs]);
console.log('   CDN map result:', JSON.stringify(r1));

// ── Step 2: Store titles under system IDs (hwasi:titles HASH) ─────────────────
console.log('⏳ Step 2: Storing titles under system IDs...');
const titleArgs = [];
for (const [cdnId, title] of Object.entries(titles)) {
  const systemId = OFFSET + Number(cdnId);
  titleArgs.push(String(systemId));
  titleArgs.push(title);
}
const r2 = await redisCmd(['HSET', 'hwasi:titles', ...titleArgs]);
console.log('   Titles result:', JSON.stringify(r2));

// ── Step 3: Store base64 thumbnails under system IDs in batches ───────────────
console.log('⏳ Step 3: Storing thumbnails in batches (system IDs)...');
const thumbEntries = Object.entries(thumbsRaw).map(([cdnId, b64]) => ({
  systemId: String(OFFSET + Number(cdnId)),
  dataUrl: `data:image/jpeg;base64,${b64}`,
}));
const BATCH = 10;
let stored = 0;
for (let i = 0; i < thumbEntries.length; i += BATCH) {
  const batch = thumbEntries.slice(i, i + BATCH);
  const thumbArgs = batch.flatMap(({ systemId, dataUrl }) => [systemId, dataUrl]);
  const r = await redisCmd(['HSET', 'hwasi:extra_thumbs', ...thumbArgs]);
  if (r.error) { console.error('\n   ERROR:', r.error); }
  stored += batch.length;
  process.stdout.write(`\r   Stored ${stored}/${thumbEntries.length} thumbnails...`);
}
console.log('\n   Thumbnails done!');

// ── Step 4: Save extra CDN source registry (hwasi:extra_cdns) ────────────────
console.log('⏳ Step 4: Saving CDN source registry...');
const minCdnId = Math.min(...cdnIds);
const maxCdnId = Math.max(...cdnIds);
const cdnEntry = {
  name:     'HindiBF',
  cdnId:    'hindibf',
  cdnBase:  'https://cdn.hindibf.com.co',
  count:    cdnIds.length,
  ids:      cdnIds.map(id => OFFSET + id),  // store system IDs
  cdnRange: { min: minCdnId, max: maxCdnId }, // actual CDN ID range
  systemRange: { start: OFFSET + minCdnId, end: OFFSET + maxCdnId },
  offset:   OFFSET,
  importedAt: new Date().toISOString(),
};
const r4 = await redisCmd(['SET', 'hwasi:extra_cdns', JSON.stringify([cdnEntry])]);
console.log('   Registry result:', JSON.stringify(r4));

// ── Step 5: Add extra range to settings so gallery shows these videos ─────────
console.log('⏳ Step 5: Adding hindibf range to gallery settings...');
const settingsRaw = await fetch(`${REDIS_URL}/get/hwasi:settings`, {
  headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
}).then(r => r.json());

let settings = {};
try {
  settings = typeof settingsRaw.result === 'string' ? JSON.parse(settingsRaw.result) : (settingsRaw.result || {});
} catch { settings = {}; }

const existingRanges = (settings.extraRanges || []).filter(r => r.cdnId !== 'hindibf');
const newRange = { start: OFFSET + minCdnId, end: OFFSET + maxCdnId, cdnId: 'hindibf' };
settings.extraRanges = [...existingRanges, newRange];

const r5 = await redisCmd(['SET', 'hwasi:settings', JSON.stringify(settings)]);
console.log('   Settings result:', JSON.stringify(r5));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n✅ Import complete!');
console.log(`   📹 ${cdnIds.length} videos (system IDs ${OFFSET + minCdnId}–${OFFSET + maxCdnId})`);
console.log(`   🌐 CDN: https://cdn.hindibf.com.co/{1-${maxCdnId}}.mp4`);
console.log(`   🏷️  ${cdnIds.length} titles stored`);
console.log(`   🖼️  ${stored} thumbnails stored (served from /api/hwasi/thumb-extra/[id])`);
console.log(`   ⚙️  Gallery extra range added: ${OFFSET + minCdnId}–${OFFSET + maxCdnId}`);
console.log('\n   🎉 Videos will now appear in the gallery automatically!');
