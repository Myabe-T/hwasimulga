export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { SignJWT } from 'jose';
import {
  getRegUsers, saveRegUsers,
  getPendingUsers, savePendingUsers,
  getRegApprovalRequired, getUsers, getSettings,
} from '@/lib/redis';

const ALLOWED_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.in', 'yahoo.co.uk', 'yahoo.co.in',
  'outlook.com', 'outlook.in', 'hotmail.com', 'live.com',
  'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com',
  'rediffmail.com', 'yandex.com', 'zoho.com',
];

function isAllowedEmail(email) {
  if (!email || !email.includes('@')) return false;
  return ALLOWED_DOMAINS.includes(email.split('@')[1].toLowerCase());
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password + 'hwasi_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateId() {
  return 'usr_reg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function POST(req) {
  try {
    const rawBody = await req.json();
    let username, email, password, displayName;
    if (rawBody.cipher && rawBody.iv) {
      const decrypted = await decryptPayload(rawBody.cipher, rawBody.iv);
      if (!decrypted) return NextResponse.json(await encryptPayload({ error: 'Decryption failed. Check AES key.' }), { status: 400 });
      username = decrypted.username;
      email = decrypted.email;
      password = decrypted.password;
      displayName = decrypted.displayName;
    } else {
      username = rawBody.username;
      email = rawBody.email;
      password = rawBody.password;
      displayName = rawBody.displayName;
    }

    if (!username || !email || !password || !displayName || displayName.trim().length < 2)
      return NextResponse.json(await encryptPayload({ error: 'All fields are required, including your Name (at least 2 characters)' }), { status: 400 });
    if (username.length < 3 || username.length > 20)
      return NextResponse.json(await encryptPayload({ error: 'Username must be 3–20 characters' }), { status: 400 });
    if (!/^[A-Z][a-zA-Z0-9_]*$/.test(username))
      return NextResponse.json(await encryptPayload({ error: 'Username must start with a Capital letter (A-Z) and contain only letters, numbers, and underscores' }), { status: 400 });
    if (password.length < 6)
      return NextResponse.json(await encryptPayload({ error: 'Password must be at least 6 characters' }), { status: 400 });
    if (!/[a-z]/.test(password))
      return NextResponse.json(await encryptPayload({ error: 'Password must contain at least 1 lowercase letter (a-z)' }), { status: 400 });
    if (!/[A-Z]/.test(password))
      return NextResponse.json(await encryptPayload({ error: 'Password must contain at least 1 capital letter (A-Z)' }), { status: 400 });
    if (!/\d/.test(password))
      return NextResponse.json(await encryptPayload({ error: 'Password must contain at least 1 number (0-9)' }), { status: 400 });
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password))
      return NextResponse.json(await encryptPayload({ error: 'Password must contain at least 1 symbol (!@#$%^&*...)' }), { status: 400 });
    const settings = await getSettings().catch(() => null);
    if (!settings?.allowAnyEmailDomain && !isAllowedEmail(email))
      return NextResponse.json(await encryptPayload({ error: 'Please use Gmail, Yahoo, Outlook, iCloud or Proton email' }), { status: 400 });

    // Duplicate check across all user stores
    const [regUsers, pendingUsers, staticUsers] = await Promise.all([getRegUsers(), getPendingUsers(), getUsers()]);
    const allExisting = [...regUsers, ...pendingUsers, ...staticUsers];
    if (allExisting.some(u => u.username?.toLowerCase() === username.toLowerCase()))
      return NextResponse.json(await encryptPayload({ error: 'Username already taken' }), { status: 409 });
    if (allExisting.some(u => u.email?.toLowerCase() === email.toLowerCase()))
      return NextResponse.json(await encryptPayload({ error: 'Email already registered' }), { status: 409 });

    const passwordHash = await hashPassword(password);
    const newUser = {
      id: generateId(),
      username: username,
      email: email.toLowerCase(),
      password: password,
      passwordHash,
      displayName: displayName || username,
      role: 'viewer',
      avatar: (displayName || username).substring(0, 2).toUpperCase(),
      createdAt: new Date().toISOString(),
      emailVerified: false,
    };

    // Check if admin approval is required
    const approvalRequired = await getRegApprovalRequired();
    if (approvalRequired) {
      // Add to pending queue
      pendingUsers.push(newUser);
      await savePendingUsers(pendingUsers);
      return NextResponse.json(await encryptPayload({
        ok: true,
        pending: true,
        message: 'Registration submitted! An admin will review and approve your account shortly.',
      }));
    }

    // Add to registered users (must verify email before login)
    regUsers.push(newUser);
    await saveRegUsers(regUsers);

    return NextResponse.json(await encryptPayload({
      ok: true,
      pending: false,
      emailVerified: false,
      username: newUser.username,
      message: 'Registration successful! Please check your email to verify your account.'
    }));
  } catch (e) {
    return NextResponse.json(await encryptPayload({ error: e.message }), { status: 500 });
  }
}
