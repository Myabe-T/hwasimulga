export const runtime = 'edge';

import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';
import { getUsers, getRegUsers } from '@/lib/redis';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'hwasi_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req) {
  try {
    const { username, password } = await req.json();
    
    // 1. Check static users (admin, demo, viewer) — plain-text password
    const staticUsers = await getUsers();
    let user = staticUsers.find(
      u => u.username.toLowerCase() === username?.toLowerCase()?.trim() && u.password === password
    );
    
    // 2. If not found in static, check registered users (hashed password)
    if (!user) {
      const regUsers = await getRegUsers();
      const pwHash = await hashPassword(password);
      user = regUsers.find(
        u => (u.username.toLowerCase() === username?.toLowerCase()?.trim() ||
              u.email?.toLowerCase() === username?.toLowerCase()?.trim()) &&
             u.passwordHash === pwHash
      );
    }
    
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const token = await new SignJWT({
      sub: user.id, username: user.username,
      displayName: user.displayName, role: user.role, avatar: user.avatar,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(SECRET);

    const res = NextResponse.json({ ok: true, username: user.username, displayName: user.displayName, role: user.role, avatar: user.avatar });
    res.cookies.set('hwasi_token', token, {
      httpOnly: true, secure: true,
      sameSite: 'strict', maxAge: 60 * 60 * 24 * 7, path: '/'
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}
