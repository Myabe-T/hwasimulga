export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getRegUsers, saveRegUsers, getUsers } from '@/lib/redis';

// Allowed email providers (MX-based real mail providers)
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
  const domain = email.split('@')[1].toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'hwasi_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateId() {
  return 'usr_reg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function avatarFromName(name) {
  return (name || 'U').substring(0, 2).toUpperCase();
}

export async function POST(req) {
  try {
    const { username, email, password, displayName } = await req.json();

    // Validate fields
    if (!username || !email || !password)
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    if (username.length < 3 || username.length > 20)
      return NextResponse.json({ error: 'Username must be 3–20 characters' }, { status: 400 });
    if (!/^[a-z0-9_]+$/i.test(username))
      return NextResponse.json({ error: 'Username: only letters, numbers, underscore' }, { status: 400 });
    if (password.length < 6)
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    // Email domain check
    if (!isAllowedEmail(email))
      return NextResponse.json({ error: 'Please use a real email (Gmail, Yahoo, Outlook, iCloud, Proton)' }, { status: 400 });

    // Check duplicate username/email
    const [regUsers, staticUsers] = await Promise.all([getRegUsers(), Promise.resolve([])]);
    const allUsers = [...regUsers];
    if (allUsers.some(u => u.username.toLowerCase() === username.toLowerCase()))
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    if (allUsers.some(u => u.email?.toLowerCase() === email.toLowerCase()))
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const newUser = {
      id: generateId(),
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName || username,
      role: 'viewer',
      avatar: avatarFromName(displayName || username),
      createdAt: new Date().toISOString(),
    };

    allUsers.push(newUser);
    await saveRegUsers(allUsers);

    // Auto-login: issue JWT
    const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');
    const token = await new SignJWT({
      sub: newUser.id,
      username: newUser.username,
      displayName: newUser.displayName,
      role: 'viewer',
      avatar: newUser.avatar,
    }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(SECRET);

    const res = NextResponse.json({ ok: true, username: newUser.username });
    res.cookies.set('hwasi_token', token, {
      httpOnly: true, secure: true, sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, path: '/',
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
