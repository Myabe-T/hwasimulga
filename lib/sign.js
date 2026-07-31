import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.VIDEO_SIGN_KEY || 'hwasi-sign-k3y-d3fault-2024-s3cur3!!'
);

// Sign a video ID with a 30-minute expiry. cdnId is optional (defaults to main CDN).
export async function signVideoId(id, cdnId) {
  const builder = new SignJWT({ id, ...(cdnId ? { cdn: cdnId } : {}) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m');
  return await builder.sign(SECRET);
}

// Verify and extract video ID (and optional cdnId) from token. Returns null if invalid/expired.
export async function verifyVideoToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return { id: payload.id, cdn: payload.cdn || null };
  } catch {
    return null;
  }
}
