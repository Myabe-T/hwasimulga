// Direct Upstash REST client — avoids @upstash/redis SDK which sends
// `cache: 'no-store'` in fetch() init, crashing Cloudflare Pages Workers.

function getEnv() {
  try {
    const { getRequestContext } = require('@cloudflare/next-on-pages');
    const ctx = getRequestContext();
    if (ctx?.env?.UPSTASH_REDIS_REST_URL) return ctx.env;
  } catch (e) {}
  return process.env;
}

async function upstash(command) {
  const env = getEnv();
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Missing Upstash credentials');

  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([command]),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}: ${await res.text()}`);
  const [result] = await res.json();
  if (result.error) throw new Error(`Upstash error: ${result.error}`);
  return result.result;
}

async function upstashMulti(commands) {
  const env = getEnv();
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Missing Upstash credentials');

  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}: ${await res.text()}`);
  return await res.json();
}

// Minimal redis-like object
export const redis = {
  get: (key) => upstash(['GET', key]),
  set: (key, value) => upstash(['SET', key, value]),
  del: (key) => upstash(['DEL', key]),
  lpush: (key, value) => upstash(['LPUSH', key, value]),
  ltrim: (key, start, stop) => upstash(['LTRIM', key, start, stop]),
  lrange: (key, start, stop) => upstash(['LRANGE', key, start, stop]),
  sadd: (key, member) => upstash(['SADD', key, member]),
  srem: (key, member) => upstash(['SREM', key, member]),
  smembers: (key) => upstash(['SMEMBERS', key]),
};

export const KEYS = {
  USERS: 'hwasi:users',
  SETTINGS: 'hwasi:settings',
  CURATED: 'hwasi:curated',
  HISTORY: 'hwasi:history',
  THUMBS_SET: 'hwasi:thumbs',
};

export const DEFAULT_USERS = [
  { id: 'usr_admin_001', username: 'admin',  password: 'Hwasimulga@2024', displayName: 'Admin',     role: 'admin',  avatar: 'AD', createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'usr_demo_001',  username: 'demo',   password: 'Demo@1234',        displayName: 'Demo User', role: 'viewer', avatar: 'DM', createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'usr_view_001',  username: 'viewer', password: 'Watch@2024',        displayName: 'Viewer',    role: 'viewer', avatar: 'VI', createdAt: '2024-01-01T00:00:00.000Z' },
];

export const DEFAULT_SETTINGS = { start: 51, end: 730, cdnId: 'desimms' };
export const DEFAULT_CURATED  = { trending: [], latest: [] };

function parse(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return data; }
  }
  return data;
}

export async function getUsers() {
  const data = parse(await redis.get(KEYS.USERS));
  if (!data) { await redis.set(KEYS.USERS, JSON.stringify(DEFAULT_USERS)); return DEFAULT_USERS; }
  return data;
}
export async function saveUsers(users) {
  await redis.set(KEYS.USERS, JSON.stringify(users));
}
export async function getSettings() {
  const data = parse(await redis.get(KEYS.SETTINGS));
  if (!data) { await redis.set(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS)); return DEFAULT_SETTINGS; }
  return data;
}
export async function getCurated() {
  const data = parse(await redis.get(KEYS.CURATED));
  if (!data) { await redis.set(KEYS.CURATED, JSON.stringify(DEFAULT_CURATED)); return DEFAULT_CURATED; }
  return data;
}
export async function addHistory(entry) {
  await redis.lpush(KEYS.HISTORY, JSON.stringify(entry));
  await redis.ltrim(KEYS.HISTORY, 0, 999);
}
export async function getHistory(limit = 300) {
  const items = await redis.lrange(KEYS.HISTORY, 0, limit - 1);
  return items.map(i => parse(i) || i);
}

// ── Thumbnail storage ─────────────────────────────────────────────────────────
export async function getThumbnailB64(id) {
  const val = await redis.get(`hwasi:thumb:${id}`);
  if (!val) return null;
  if (typeof val === 'string' && val.startsWith('data:')) {
    return val.split(',')[1] || null;
  }
  return typeof val === 'string' ? val : null;
}
export async function getThumbnail(id) {
  return getThumbnailB64(id);
}
export async function setThumbnail(id, dataUrl) {
  const b64 = typeof dataUrl === 'string' && dataUrl.includes(',')
    ? dataUrl.split(',')[1]
    : dataUrl;
  await redis.set(`hwasi:thumb:${id}`, b64);
  await redis.sadd(KEYS.THUMBS_SET, String(id));
}
export async function deleteThumbnail(id) {
  await redis.del(`hwasi:thumb:${id}`);
  await redis.srem(KEYS.THUMBS_SET, String(id));
}
export async function getThumbnailIds() {
  return await redis.smembers(KEYS.THUMBS_SET);
}
