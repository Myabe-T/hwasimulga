export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import {
  getRegUsers, saveRegUsers,
  getPendingUsers, savePendingUsers,
  getRegApprovalRequired, getUsers,
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
    const { username, email, password, displayName } = await req.json();

    if (!username || !email || !password)
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    if (username.length < 3 || username.length > 20)
      return NextResponse.json({ error: 'Username must be 3–20 characters' }, { status: 400 });
    if (!/^[a-z0-9_]+$/i.test(username))
      return NextResponse.json({ error: 'Username: only letters, numbers, underscore' }, { status: 400 });
    if (password.length < 6)
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    if (!isAllowedEmail(email))
      return NextResponse.json({ error: 'Please use Gmail, Yahoo, Outlook, iCloud or Proton email' }, { status: 400 });

    // Duplicate check across all user stores
    const [regUsers, pendingUsers, staticUsers] = await Promise.all([getRegUsers(), getPendingUsers(), getUsers()]);
    const allExisting = [...regUsers, ...pendingUsers, ...staticUsers];
    if (allExisting.some(u => u.username?.toLowerCase() === username.toLowerCase()))
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    if (allExisting.some(u => u.email?.toLowerCase() === email.toLowerCase()))
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const newUser = {
      id: generateId(),
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName || username,
      role: 'viewer',
      avatar: (displayName || username).substring(0, 2).toUpperCase(),
      createdAt: new Date().toISOString(),
    };

    // Check if admin approval is required
    const approvalRequired = await getRegApprovalRequired();
    if (approvalRequired) {
      // Add to pending queue
      pendingUsers.push(newUser);
      await savePendingUsers(pendingUsers);
      return NextResponse.json({
        ok: true,
        pending: true,
        message: 'Registration submitted! An admin will review and approve your account shortly.',
      });
    }

    // Auto-approve: add to active users + auto-login
    regUsers.push(newUser);
    await saveRegUsers(regUsers);

    const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');
    const token = await new SignJWT({
      sub: newUser.id, username: newUser.username,
      displayName: newUser.displayName, role: 'viewer', avatar: newUser.avatar,
    }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(SECRET);

    const res = NextResponse.json({ ok: true, pending: false, username: newUser.username });
    res.cookies.set('hwasi_token', token, {
      httpOnly: true, secure: true, sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, path: '/',
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
