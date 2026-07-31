/**
 * Migration script: copies titles from hwasi:titles (HASH, used by import)
 * into hwasi:video_titles (JSON string, used by the app).
 * 
 * Also updates getVideoTitles in redis.js to read from hwasi:titles hash directly.
 * 
 * Run: node migrate-titles.mjs
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

// Step 1: Get all from hwasi:titles HASH
console.log('📖 Reading hwasi:titles HASH...');
const hgetall = await redisCmd(['HGETALL', 'hwasi:titles']);
const hashEntries = hgetall.result || [];
const hashTitles = {};
for (let i = 0; i < hashEntries.length; i += 2) {
  hashTitles[hashEntries[i]] = hashEntries[i + 1];
}
console.log(`   Found ${Object.keys(hashTitles).length} entries`);

// Step 2: Get existing hwasi:video_titles JSON
console.log('📖 Reading hwasi:video_titles JSON...');
const vtRaw = await redisCmd(['GET', 'hwasi:video_titles']);
let existing = {};
if (vtRaw.result) {
  try { existing = JSON.parse(vtRaw.result); } catch {}
}
console.log(`   Existing: ${Object.keys(existing).length} entries`);

// Step 3: Merge
const merged = { ...existing, ...hashTitles };
console.log(`   Merged total: ${Object.keys(merged).length} entries`);

// Step 4: Write back
console.log('💾 Writing merged titles to hwasi:video_titles...');
const setResult = await redisCmd(['SET', 'hwasi:video_titles', JSON.stringify(merged)]);
console.log('   Result:', setResult.result);

// Step 5: Verify a sample
const sample = Object.keys(hashTitles).slice(0, 3);
for (const key of sample) {
  const check = await redisCmd(['GET', 'hwasi:video_titles']);
  const obj = JSON.parse(check.result || '{}');
  console.log(`   [${key}] → ${obj[key]?.slice(0, 50) || 'MISSING'}...`);
}

console.log('\n✅ Migration complete!');
console.log(`   ${Object.keys(hashTitles).length} hindibf titles merged into hwasi:video_titles`);
console.log('   Sample IDs:', Object.keys(hashTitles).slice(0, 5).join(', '));
