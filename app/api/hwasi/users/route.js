export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUsers, saveUsers } from '@/lib/redis';

let counter = 0;
function uid() { return `usr_${Date.now().toString(36)}_${(++counter).toString(36)}`; }

export async function GET() {
  const { error, status } = await requireAuth(['admin','advisor']);
  if (error) return NextResponse.json({ error }, { status });
  const users = await getUsers();
  return NextResponse.json(users.map(({ password: _, ...u }) => u));
}

export async function POST(req) {
  const { error, status } = await requireAuth(['admin','advisor']);
  if (error) return NextResponse.json({ error }, { status });
  const { username, password, displayName, role } = await req.json();
  if (!username || !password || !displayName)
    return NextResponse.json({ error: 'username, password, displayName required' }, { status: 400 });
  const users = await getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
  const nu = {
    id: uid(), username: username.toLowerCase().trim(), password,
    displayName, role: role || 'viewer',
    avatar: displayName.slice(0, 2).toUpperCase(),
    createdAt: new Date().toISOString(),
  };
  users.push(nu);
  await saveUsers(users);
  const { password: _, ...safe } = nu;
  return NextResponse.json(safe, { status: 201 });
}
