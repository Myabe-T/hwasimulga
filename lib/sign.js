import { createHmac } from 'crypto';

const KEY = process.env.VIDEO_SIGN_KEY || 'hwasi-sign-k3y-d3fault-2024-s3cur3!!';

// Sign a video ID with a 30-minute expiry
export function signVideoId(id) {
  const exp = Math.floor(Date.now() / 1000) + 1800; // 30 min
  const payload = `${id}:${exp}`;
  const sig = createHmac('sha256', KEY).update(payload).digest('hex').slice(0, 20);
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

// Verify and extract video ID from token. Returns null if invalid/expired.
export function verifyVideoToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    const [id, exp, sig] = parts;
    if (Date.now() / 1000 > Number(exp)) return null; // expired
    const payload = `${id}:${exp}`;
    const expected = createHmac('sha256', KEY).update(payload).digest('hex').slice(0, 20);
    if (sig !== expected) return null;
    return id;
  } catch { return null; }
}
