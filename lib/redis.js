import { Redis } from '@upstash/redis';

export const redis = new Proxy({}, {
  get: (target, prop) => {
    if (!target.instance) {
      target.instance = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    }
    return target.instance[prop];
  }
});

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
  return typeof data === 'string' ? JSON.parse(data) : data;
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
// Store only raw base64 string (no "data:image/jpeg;base64," prefix)
// This avoids Upstash SDK auto-JSON-parse issues with data URIs
export async function getThumbnailB64(id) {
  const val = await redis.get(`hwasi:thumb:${id}`);
  if (!val) return null;
  // Handle both legacy (full dataUrl) and current (raw base64) formats
  if (typeof val === 'string' && val.startsWith('data:')) {
    return val.split(',')[1] || null;
  }
  return typeof val === 'string' ? val : null;
}
export async function getThumbnail(id) {
  return getThumbnailB64(id);
}
export async function setThumbnail(id, dataUrl) {
  // Strip prefix if present, store only raw base64
  const b64 = typeof dataUrl === 'string' && dataUrl.includes(',')
    ? dataUrl.split(',')[1]
    : dataUrl;
  // Use setex-style raw set to avoid SDK JSON encoding
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
