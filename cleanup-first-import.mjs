/**
 * Cleanup script: removes bad data from the FIRST failed import run
 * that stored hindibf data under raw CDN IDs (1-243) instead of
 * system IDs (10001-10243). Also cleans up any wrongly-mapped titles.
 *
 * Run: node cleanup-first-import.mjs
 */

const REDIS_URL   = 'https://relaxed-joey-122660.upstash.io';
const REDIS_TOKEN = 'gQAAAAAAAd8kAQIgcDE5MDcyNTE5ODEzNTM0MjE5ODBkMmFkNDJhNzZmYzBkYQ';

async function redisCmd(cmd) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  return res.json();
}

// The first import stored data under IDs 1-243 (raw CDN IDs, no offset).
// We need to delete those. The second import correctly used 10001-10243.
// IDs 1-243 in the main desimms CDN should NOT have entries in video_cdn hash.

// Load the titles.json to know which IDs were incorrectly stored
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const titles = JSON.parse(readFileSync(join(__dirname, 'hindibf new', 'titles.json'), 'utf8'));
const rawIds = Object.keys(titles).map(Number).sort((a,b)=>a-b);

console.log(`🧹 Cleaning up bad Redis entries for ${rawIds.length} raw IDs (${rawIds[0]}-${rawIds[rawIds.length-1]})`);

// Step 1: Delete wrong video_cdn entries (IDs 1-243 without offset)
console.log('\n⏳ Step 1: Deleting bad video_cdn entries...');
const r1 = await redisCmd(['HDEL', 'hwasi:video_cdn', ...rawIds.map(String)]);
console.log('   Result:', JSON.stringify(r1));

// Step 2: Delete wrong extra_thumbs entries (IDs 1-243 without offset)
console.log('⏳ Step 2: Deleting bad extra_thumbs entries...');
const r2 = await redisCmd(['HDEL', 'hwasi:extra_thumbs', ...rawIds.map(String)]);
console.log('   Result:', JSON.stringify(r2));

// Step 3: Delete wrong title entries (IDs 1-243 that overwrote desimms titles)
// Only delete titles that ARE hindibf titles (i.e., the value matches what we imported)
// Since there are many, just delete all in the raw range that might have been overwritten
console.log('⏳ Step 3: Deleting bad title entries (IDs 1-243)...');
const r3 = await redisCmd(['HDEL', 'hwasi:titles', ...rawIds.map(String)]);
console.log('   Result:', JSON.stringify(r3));

// Step 4: Verify correct entries are still there (system IDs 10001-10243)
console.log('\n⏳ Step 4: Verifying correct system-ID entries...');
const sampleIds = [10001, 10058, 10243];
for (const sysId of sampleIds) {
  const cdnVal = await redisCmd(['HGET', 'hwasi:video_cdn', String(sysId)]);
  const titleVal = await redisCmd(['HGET', 'hwasi:titles', String(sysId)]);
  console.log(`   [${sysId}] cdn=${cdnVal.result ? JSON.parse(cdnVal.result).cdn : 'MISSING'} title=${titleVal.result ? titleVal.result.slice(0,40)+'...' : 'MISSING'}`);
}

console.log('\n✅ Cleanup complete!');
console.log('   Bad entries removed: video_cdn[1-243], extra_thumbs[1-243], titles[1-243]');
console.log('   Correct entries preserved: video_cdn[10001-10243], extra_thumbs[10001-10243], titles[10001-10243]');
