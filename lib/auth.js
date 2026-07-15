import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024'
);

export async function getSession() {
  try {
    const store = await cookies();
    const token = store.get('hwasi_token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

// role can be a string ('admin') or array (['admin','advisor'])
export async function requireAuth(role = null) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized', status: 401 };
  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(session.role)) return { error: 'Forbidden', status: 403 };
  }
  return { session };
}
