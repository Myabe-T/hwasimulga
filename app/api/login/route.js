export const runtime = 'edge';

import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';
import { getUsers, getRegUsers, getPendingUsers, getDeviceData, getBlockReason } from '@/lib/redis';
import { adminLookupUserByEmail, verifyFirebasePassword } from '@/lib/firebaseAdmin';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'hwasi_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

import { decryptPayload, encryptPayload } from '@/lib/crypto';

export async function POST(req) {
  try {
    const rawBody = await req.json();
    
    // Decrypt the payload if it's encrypted
    let username, password, idToken, fbEmailVerified;
    if (rawBody.cipher && rawBody.iv) {
      const decrypted = await decryptPayload(rawBody.cipher, rawBody.iv);
      if (!decrypted) return NextResponse.json(await encryptPayload({ error: 'Decryption failed. Check AES key.' }), { status: 400 });
      username = decrypted.username;
      password = decrypted.password;
      idToken = decrypted.idToken || rawBody.idToken;
      fbEmailVerified = decrypted.fbEmailVerified ?? rawBody.fbEmailVerified;
    } else {
      // Fallback for unencrypted (or if we want to enforce encryption, we could throw here)
      username = rawBody.username;
      password = rawBody.password;
      idToken = rawBody.idToken;
      fbEmailVerified = rawBody.fbEmailVerified;
    }

    const usernameClean = (username || rawBody.identifier || rawBody.email || '')?.toLowerCase()?.trim();

    // ── 1. Check static users (admin, demo, viewer) — plain-text password ──
    const staticUsers = await getUsers();
    let user = staticUsers.find(
      u => (u.username.toLowerCase() === usernameClean || u.email?.toLowerCase() === usernameClean) && u.password === password
    );

    // ── 2. Check registered users (hashed password) ──
    if (!user) {
      const regUsers = await getRegUsers();
      const pwHash = await hashPassword(password);
      user = regUsers.find(
        u => (u.username?.toLowerCase() === usernameClean ||
              u.email?.toLowerCase() === usernameClean) &&
             u.passwordHash === pwHash
      );

      // If password hash mismatched in Redis, check if Firebase Auth has the updated password (e.g. after password reset)
      if (!user) {
        const candidateIdx = regUsers.findIndex(
          u => u.username?.toLowerCase() === usernameClean ||
               u.email?.toLowerCase() === usernameClean
        );
        if (candidateIdx !== -1) {
          const candidate = regUsers[candidateIdx];
          if (candidate.email) {
            const fbAuth = await verifyFirebasePassword(candidate.email, password);
            if (fbAuth.ok) {
              // Firebase authenticated this user with this new password!
              regUsers[candidateIdx].password = password;
              regUsers[candidateIdx].passwordHash = pwHash;
              if (fbAuth.emailVerified) {
                regUsers[candidateIdx].emailVerified = true;
              }
              await saveRegUsers(regUsers);
              user = regUsers[candidateIdx];
            }
          }
        }
      }

      // If user matched and Firebase confirmed email is verified, update Redis
      if (user && fbEmailVerified && user.emailVerified !== true) {
        const userIdx = regUsers.findIndex(u => u.id === user.id);
        if (userIdx !== -1) {
          regUsers[userIdx].emailVerified = true;
          await saveRegUsers(regUsers);
          user.emailVerified = true;
        }
      }
    }

    // ── 3. If still not found, check if they're in PENDING queue ──
    if (!user) {
      const pendingUsers = await getPendingUsers();
      const pwHash = await hashPassword(password);
      const pendingMatch = pendingUsers.find(
        u => (u.username?.toLowerCase() === usernameClean ||
              u.email?.toLowerCase() === usernameClean) &&
             u.passwordHash === pwHash
      );
      if (pendingMatch) {
        return NextResponse.json(await encryptPayload({ error: '⏳ Your account is pending admin approval. Please wait — you will be notified once approved.', code: 'PENDING_APPROVAL' }), { status: 403 });
      }
      // Not found anywhere
      return NextResponse.json(await encryptPayload({ error: 'Invalid credentials. Check your username/email and password.' }), { status: 401 });
    }

    // ── 4. Check if this user's account is blocked ──
    const deviceData = await getDeviceData();
    const devEntry = deviceData[String(user.id)];
    if (devEntry?.blocked) {
      const reason = devEntry.blockReason || 'Terms of service violation';
      return NextResponse.json(await encryptPayload({
        error: `🚫 Your account has been blocked.\n\nReason: ${reason}\n\nContact support to resolve this issue.`,
        code: 'ACCOUNT_BLOCKED',
        reason,
      }), { status: 403 });
    }

    // ── 4b. Check if email is verified (registered accounts only, exempting admin & advisor) ──
    if (user.role !== 'admin' && user.role !== 'advisor') {
      let isVerified = Boolean(user.emailVerified);

      // If not marked verified in Redis, verify in real-time against Firebase Auth
      if (!isVerified && user.email) {
        const fbLookup = await adminLookupUserByEmail(user.email).catch(() => null);
        if (fbLookup?.emailVerified) {
          isVerified = true;
          // Auto-sync verified state to Redis
          const regUsers = await getRegUsers();
          const uIdx = regUsers.findIndex(u => u.id === user.id);
          if (uIdx !== -1) {
            regUsers[uIdx].emailVerified = true;
            await saveRegUsers(regUsers);
          }
        }
      }

      if (!isVerified) {
        return NextResponse.json(await encryptPayload({
          error: `Please verify your email address before logging in. A verification link was sent to ${user.email}. Check your inbox and spam folder.`,
          code: 'EMAIL_NOT_VERIFIED',
          email: user.email,
        }), { status: 403 });
      }
    }

    // ── 5. Issue JWT token ──
    const token = await new SignJWT({
      sub: user.id, username: user.username,
      displayName: user.displayName, role: user.role, avatar: user.avatar,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(SECRET);

    const payloadData = await encryptPayload({ ok: true, username: user.username, displayName: user.displayName, role: user.role, avatar: user.avatar });
    const res = NextResponse.json(payloadData);
    res.cookies.set('hwasi_token', token, {
      httpOnly: true, secure: true,
      sameSite: 'strict', maxAge: 60 * 60 * 24 * 7, path: '/'
    });
    return res;
  } catch (e) {
    return NextResponse.json(await encryptPayload({ error: e.message || 'Server error' }), { status: 500 });
  }
}
