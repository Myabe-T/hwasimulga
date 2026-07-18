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
  { id: 'usr_admin_001', username: 'admin',  password: 'DesiHawas@2024', displayName: 'Admin',     role: 'admin',  avatar: 'AD', createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'usr_demo_001',  username: 'demo',   password: 'Demo@1234',        displayName: 'Demo User', role: 'viewer', avatar: 'DM', createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'usr_view_001',  username: 'viewer', password: 'Watch@2024',        displayName: 'Viewer',    role: 'viewer', avatar: 'VI', createdAt: '2024-01-01T00:00:00.000Z' },
];

export const DEFAULT_SETTINGS = { start: 51, end: 730, cdnId: 'desimms' };
export const DEFAULT_CURATED  = { trending: [], popular: [], instaviral: [] };

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
  // Migrate: rename old 'latest' key to 'popular'
  if (data.latest !== undefined && data.popular === undefined) {
    data.popular = data.latest;
    delete data.latest;
    await redis.set(KEYS.CURATED, JSON.stringify(data));
  }
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

// ── Premium subscriptions ──────────────────────────────────────────────────────
// hwasi:premium:{userId} → JSON { plan, expiresAt, addedAt, addedBy }
export async function getPremium(userId) {
  const data = parse(await redis.get(`hwasi:premium:${userId}`));
  if (!data) return null;
  // Check if expired
  if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
    await redis.del(`hwasi:premium:${userId}`);
    return null;
  }
  return data;
}
export async function setPremium(userId, plan, days, addedBy = 'admin') {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const rec = { plan, expiresAt, addedAt: new Date().toISOString(), addedBy, days };
  await redis.set(`hwasi:premium:${userId}`, JSON.stringify(rec));
  await redis.sadd('hwasi:premium:index', userId);
}
export async function revokePremium(userId) {
  await redis.del(`hwasi:premium:${userId}`);
  await redis.srem('hwasi:premium:index', userId);
}
export async function getAllPremiumIds() {
  return await redis.smembers('hwasi:premium:index');
}

// ── Daily view counts (free tier) ──────────────────────────────────────────────
// hwasi:views:{YYYY-MM-DD}:{key} → count   (TTL 25h)
function todayKey(trackingKey) {
  const d = new Date().toISOString().slice(0, 10);
  return `hwasi:views:${d}:${trackingKey}`;
}
export async function getViewCount(trackingKey) {
  const v = await redis.get(todayKey(trackingKey));
  return v ? Number(v) : 0;
}
export async function incrementViewCount(trackingKey) {
  const key = todayKey(trackingKey);
  // INCR + EXPIRE (90000s = 25h) via pipeline
  const env = getEnv();
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['INCR', key], ['EXPIRE', key, 90000]]),
  });
  const [incrResult] = await res.json();
  return incrResult.result;
}

export const PLANS = {
  basic: { label: 'Basic',  price: 100,  days: 14,         color: '#7c3aed' },
  plus:  { label: 'Plus',   price: 300,  days: 60,         color: '#0ea5e9' },
  pro:   { label: 'Pro',    price: 599,  days: 3 * 365,    color: '#f59e0b' },
};

// ── Bookmarks ──────────────────────────────────────────────────────────────────
// hwasi:bookmarks:{userId} → SET of video IDs
export async function getBookmarks(userId) {
  const members = await redis.smembers(`hwasi:bookmarks:${userId}`);
  return (members || []).map(Number);
}
export async function addBookmark(userId, videoId) {
  await redis.sadd(`hwasi:bookmarks:${userId}`, String(videoId));
}
export async function removeBookmark(userId, videoId) {
  await redis.srem(`hwasi:bookmarks:${userId}`, String(videoId));
}

// ── Reports ───────────────────────────────────────────────────────────────────
// hwasi:reports:{videoId} → LIST of JSON { userId, username, reason, timestamp }
export async function addReport(videoId, userId, username, reason) {
  const entry = JSON.stringify({ userId, username, reason, timestamp: new Date().toISOString() });
  await redis.lpush(`hwasi:reports:${videoId}`, entry);
  await redis.sadd('hwasi:reports:index', String(videoId));
}
export async function getReports(videoId) {
  const items = await redis.lrange(`hwasi:reports:${videoId}`, 0, 49);
  return (items || []).map(i => { try { return JSON.parse(i); } catch { return i; } });
}
export async function getAllReportedIds() {
  return await redis.smembers('hwasi:reports:index');
}
export async function clearReport(videoId) {
  await redis.del(`hwasi:reports:${videoId}`);
  await redis.srem('hwasi:reports:index', String(videoId));
}

// ── Deleted Videos Audit Log ──────────────────────────────────────────────────
// hwasi:deleted → LIST of JSON { id, deletedBy, role, reason, timestamp }
export async function logDeletedVideo(id, deletedBy, role, reason) {
  const entry = JSON.stringify({ id, deletedBy, role, reason, timestamp: new Date().toISOString() });
  await redis.lpush('hwasi:deleted', entry);
  await redis.ltrim('hwasi:deleted', 0, 999);
  await redis.sadd('hwasi:deleted:index', String(id));
}
export async function getDeletedVideos(limit = 100) {
  const items = await redis.lrange('hwasi:deleted', 0, limit - 1);
  return (items || []).map(i => { try { return JSON.parse(i); } catch { return i; } });
}
export async function isVideoDeleted(id) {
  const members = await redis.smembers('hwasi:deleted:index');
  return (members || []).includes(String(id));
}

// ── Registered Users ──────────────────────────────────────────────────────────
// hwasi:regusers → JSON array of { id, username, email, passwordHash, role, displayName, avatar, createdAt }
export async function getRegUsers() {
  const data = await redis.get('hwasi:regusers');
  if (!data) return [];
  try { return JSON.parse(data); } catch { return []; }
}
export async function saveRegUsers(users) {
  await redis.set('hwasi:regusers', JSON.stringify(users));
}

// ── Pending Users (registration approval queue) ────────────────────────────────
// hwasi:pending_users → JSON array of { id, username, email, passwordHash, displayName, avatar, createdAt }
export async function getPendingUsers() {
  const data = await redis.get('hwasi:pending_users');
  if (!data) return [];
  try { return JSON.parse(data); } catch { return []; }
}
export async function savePendingUsers(users) {
  await redis.set('hwasi:pending_users', JSON.stringify(users));
}

// ── Registration Approval Toggle ───────────────────────────────────────────────
// hwasi:reg_approval → '1' = ON (require approval), '0' = OFF (open)
export async function getRegApprovalRequired() {
  const v = await redis.get('hwasi:reg_approval');
  return v === '1';
}
export async function setRegApprovalRequired(on) {
  await redis.set('hwasi:reg_approval', on ? '1' : '0');
}

// ── Subscription Requests (advisor → admin) ────────────────────────────────────
// hwasi:sub_requests → JSON array of { id, requestedFor, requestedForDisplay, requestedBy, plan, days, status, timestamp }
export async function getSubRequests() {
  const data = await redis.get('hwasi:sub_requests');
  if (!data) return [];
  try { return JSON.parse(data); } catch { return []; }
}
export async function saveSubRequests(requests) {
  await redis.set('hwasi:sub_requests', JSON.stringify(requests));
}
export async function addSubRequest(entry) {
  const requests = await getSubRequests();
  requests.unshift({ ...entry, id: 'sreq_' + Date.now().toString(36), status: 'pending', timestamp: new Date().toISOString() });
  await saveSubRequests(requests.slice(0, 200));
}

// ── Video Titles (admin/advisor can label any video) ───────────────────────────
// hwasi:video_titles → JSON object { "123": "My Custom Title", ... }
export async function getVideoTitles() {
  const data = await redis.get('hwasi:video_titles');
  if (!data) return {};
  try { return typeof data === 'string' ? JSON.parse(data) : data; } catch { return {}; }
}
export async function setVideoTitle(id, title) {
  const titles = await getVideoTitles();
  if (title === null || title === '') {
    delete titles[String(id)];
  } else {
    titles[String(id)] = title.trim().slice(0, 80);
  }
  await redis.set('hwasi:video_titles', JSON.stringify(titles));
  return titles;
}

// ── Active Sessions (online presence) ─────────────────────────────────────────
// hwasi:active_sessions → JSON object { userId: { username, displayName, email, role, lastSeen } }
const IDLE_MS = 15 * 60 * 1000; // 15 minutes

export async function getActiveSessions() {
  const data = await redis.get('hwasi:active_sessions');
  if (!data) return {};
  try { return typeof data === 'string' ? JSON.parse(data) : data; } catch { return {}; }
}

export async function updateSession(userId, sessionData) {
  const sessions = await getActiveSessions();
  sessions[String(userId)] = { ...sessionData, lastSeen: new Date().toISOString() };
  await redis.set('hwasi:active_sessions', JSON.stringify(sessions));
}

export async function removeSession(userId) {
  const sessions = await getActiveSessions();
  delete sessions[String(userId)];
  await redis.set('hwasi:active_sessions', JSON.stringify(sessions));
}

export async function getOnlineUsers() {
  const sessions = await getActiveSessions();
  const now = Date.now();
  return Object.values(sessions).filter(s => s?.lastSeen && (now - new Date(s.lastSeen).getTime()) < IDLE_MS);
}

// ── Plans config (admin can edit pricing/duration) ────────────────────────────
// hwasi:plans → JSON with plan details
export const DEFAULT_PLANS = {
  basic: { id:'basic', label:'Basic', price:100, originalPrice:200, days:14, icon:'⚡', color:'#7c3aed', features:['Unlimited videos','HD streaming','Download access','Watch history'] },
  plus:  { id:'plus',  label:'Plus',  price:300, originalPrice:500, days:60, icon:'🚀', color:'#0ea5e9', popular:true, features:['Everything in Basic','2 months access','Priority support','Early access features'] },
  pro:   { id:'pro',   label:'Pro',   price:599, originalPrice:999, days:1095,icon:'👑', color:'#f59e0b', features:['Everything in Plus','3 years access','Lifetime updates','VIP support'] },
};
export async function getPlans() {
  const data = await redis.get('hwasi:plans');
  if (!data) return DEFAULT_PLANS;
  try { return typeof data === 'string' ? JSON.parse(data) : data; } catch { return DEFAULT_PLANS; }
}
export async function savePlans(plans) {
  await redis.set('hwasi:plans', JSON.stringify(plans));
}

// ── Device fingerprint tracking ──────────────────────────────────────────────
// hwasi:devices → JSON object { userId: { fingerprints: [], flagged: bool, blocked: bool } }
export async function getDeviceData() {
  const data = await redis.get('hwasi:devices');
  if (!data) return {};
  try { return typeof data === 'string' ? JSON.parse(data) : data; } catch { return {}; }
}
export async function saveDeviceData(data) {
  await redis.set('hwasi:devices', JSON.stringify(data));
}
export async function recordDevice(userId, fingerprint, username, displayName, deviceLabel) {
  const data = await getDeviceData();
  const entry = data[String(userId)] || { devices: {}, flagged: false, blocked: false, username, displayName };
  
  // Migrate old array format to new object format
  if (Array.isArray(entry.fingerprints)) {
    const migratedDevices = {};
    for (const fp of entry.fingerprints) migratedDevices[fp] = { label: 'Unknown Device', firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString() };
    entry.devices = migratedDevices;
    delete entry.fingerprints;
  }
  if (!entry.devices) entry.devices = {};

  const now = new Date().toISOString();
  if (!entry.devices[fingerprint]) {
    entry.devices[fingerprint] = { label: deviceLabel || 'Unknown Device', firstSeen: now, lastSeen: now };
  } else {
    entry.devices[fingerprint].lastSeen = now;
    if (deviceLabel) entry.devices[fingerprint].label = deviceLabel;
  }
  entry.username    = username;
  entry.displayName = displayName;

  // Flag if more than 3 unique hardware devices (1 phone + 1 PC + 1 more = normal use is 2, flag at 4+)
  const deviceCount = Object.keys(entry.devices).length;
  if (deviceCount > 3) entry.flagged = true;

  data[String(userId)] = entry;
  await saveDeviceData(data);
  return entry;
}
export async function setUserBlocked(userId, blocked, reason) {
  const data = await getDeviceData();
  if (!data[String(userId)]) data[String(userId)] = { devices: {}, flagged: false, blocked, username: '', displayName: '' };
  data[String(userId)].blocked = blocked;
  if (blocked && reason) data[String(userId)].blockReason = reason;
  if (!blocked) { data[String(userId)].flagged = false; delete data[String(userId)].blockReason; }
  await saveDeviceData(data);
}
export async function isUserBlocked(userId) {
  const data = await getDeviceData();
  return data[String(userId)]?.blocked === true;
}
export async function getBlockReason(userId) {
  const data = await getDeviceData();
  return data[String(userId)]?.blockReason || null;
}
