export const runtime = 'edge';

import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';
import { getUsers } from '@/lib/redis';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

export async function POST(req) {
  try {
    const { username, password } = await req.json();
    const users = await getUsers();
    const user = users.find(
      u => u.username.toLowerCase() === username?.toLowerCase()?.trim() && u.password === password
    );
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
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/'
    });
    return res;
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
