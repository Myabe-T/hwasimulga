import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.VIDEO_SIGN_KEY || 'hwasi-sign-k3y-d3fault-2024-s3cur3!!'
);

// Sign a video ID with a 30-minute expiry
export async function signVideoId(id) {
  return await new SignJWT({ id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(SECRET);
}

// Verify and extract video ID from token. Returns null if invalid/expired.
export async function verifyVideoToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.id;
  } catch {
    return null;
  }
}
