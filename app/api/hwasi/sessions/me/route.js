export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'hwasimulga-super-secret-key-2024');

function detectDevice(ua = '') {
  const s = ua.toLowerCase();
  if (s.includes('iphone') || s.includes('ipad') || s.includes('ios')) return { type: 'iOS', icon: '🍎' };
  if (s.includes('android')) return { type: 'Android', icon: '🤖' };
  if (s.includes('mac')) return { type: 'macOS', icon: '🖥️' };
  if (s.includes('windows')) return { type: 'Windows', icon: '🪟' };
  if (s.includes('linux')) return { type: 'Linux', icon: '🐧' };
  return { type: 'Unknown', icon: '💻' };
}

function detectBrowser(ua = '') {
  const s = ua.toLowerCase();
  if (s.includes('chrome') && !s.includes('edg') && !s.includes('opr')) return 'Chrome';
  if (s.includes('firefox')) return 'Firefox';
  if (s.includes('safari') && !s.includes('chrome')) return 'Safari';
  if (s.includes('edg')) return 'Edge';
  if (s.includes('opr') || s.includes('opera')) return 'Opera';
  return 'Browser';
}

// GET /api/hwasi/sessions/me — return current session info for any logged-in user
export async function GET(req) {
  const cookie = req.cookies.get('hwasi_token');
  if (!cookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { payload } = await jwtVerify(cookie.value, SECRET);
    const ua = req.headers.get('user-agent') || '';
    const device = detectDevice(ua);
    const browser = detectBrowser(ua);
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '—';

    const session = {
      id: 'current',
      username: payload.username,
      role: payload.role,
      loginAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : new Date().toISOString(),
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      device: device.type,
      deviceIcon: device.icon,
      browser,
      ip: ip.split(',')[0].trim(),
      current: true,
    };

    return NextResponse.json({ sessions: [session] });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
