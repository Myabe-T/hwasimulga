import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.VIDEO_SIGN_KEY || 'hwasi-sign-k3y-d3fault-2024-s3cur3!!'
);

// Sign a video ID with a 30-minute expiry. cdnId and cdnVideoId are optional.
export async function signVideoId(id, cdnId, cdnVideoId) {
  const builder = new SignJWT({
    id,
    ...(cdnId ? { cdn: cdnId } : {}),
    ...(cdnVideoId ? { cid: String(cdnVideoId) } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m');
  return await builder.sign(SECRET);
}

// Verify and extract video info from token. Returns null if invalid/expired.
export async function verifyVideoToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      id: payload.id,
      cdn: payload.cdn || null,
      cid: payload.cid || null, // actual CDN video ID (may differ from system id)
    };
  } catch {
    return null;
  }
}
