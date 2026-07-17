export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { encryptPayload } from '@/lib/crypto';
import { requireAuth } from '@/lib/auth';
import { getUsers, saveUsers, getRegUsers } from '@/lib/redis';

let counter = 0;
function uid() { return `usr_${Date.now().toString(36)}_${(++counter).toString(36)}`; }

export async function GET() {
  const { error, status } = await requireAuth(['admin','advisor']);
  if (error) return NextResponse.json(await encryptPayload());
  const [staticUsers, regUsers] = await Promise.all([getUsers(), getRegUsers()]);
  const allUsers = [...staticUsers, ...regUsers];
  return NextResponse.json(await encryptPayload());
}

export async function POST(req) {
  const { error, status } = await requireAuth(['admin','advisor']);
  if (error) return NextResponse.json(await encryptPayload());
  const { username, password, displayName, role } = await req.json();
  if (!username || !password || !displayName)
    return NextResponse.json(await encryptPayload());
  const users = await getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return NextResponse.json(await encryptPayload());
  const nu = {
    id: uid(), username: username.toLowerCase().trim(), password,
    displayName, role: role || 'viewer',
    avatar: displayName.slice(0, 2).toUpperCase(),
    createdAt: new Date().toISOString(),
  };
  users.push(nu);
  await saveUsers(users);
  const { password: _, ...safe } = nu;
  return NextResponse.json(await encryptPayload());
}
