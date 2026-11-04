// lib/firebaseAdmin.js
// Firebase Admin authentication and management via Google Identity Toolkit REST API
// 100% compatible with Cloudflare Pages Edge runtime (uses Web Crypto & jose)

import { SignJWT, importPKCS8 } from 'jose';

const SERVICE_ACCOUNT = {
  project_id: "desiproject-maybe",
  client_email: "firebase-adminsdk-fbsvc@desiproject-maybe.iam.gserviceaccount.com",
  private_key: process.env.FIREBASE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDFrcAwmA3oqkq1
3e85f4s57oXWgi8XRCC0k0P+Fqk/rd2YOUQwO0KTE7VtXmRKTAS/CXaVyq7Z4R7f
1oRvyuP1VqPjN7POzuno+Lj+qg+lyzVQwA7SwfpZP5f/+n+V9yRaAZcmP+79pVXE
aP/IhnrVjBJQJlkNGQRqA34Mq9vfUPVy4PtYkpBdVzPaETdDi+zzmPDTGsYFjqlB
KwMWgW+sAZQO8Iduq5XDylhbK411zp5w9UW/7UBPvULppUnomnDZlJ3QGTuuorH0
jvHZkX2AjEtctl1dseqBpAuEMHQ4Pmcg4/y0qyShiP80+cU/rnWMVv8u1nSoal7x
7is3YiIRAgMBAAECggEACExRnIvNgN5UXr6o+HaiFaj6Uk8w6RIEw3L8VphR7rV+
opGI1/N5r6qsoe4yWV7hwuxqEqipXvkQ+2ywYfCYHo6BnuirZVUqdlhDWWFllCkF
g6HEULswcxQOoYHwK1xU2NIA3wV6o7tcidWuIxdOGCFjC9B7fYEqCvjUwkIDa72r
fYXlwVU87jzpxKT2+Z3VQqnDe7TEDqPBypajKGxIvJgrtXUb0FLHCyxmmV5pSVne
9ypD/HgmjV2oVztzeVzVSwhLRtK64GlC2ijxuc62Wd1++42qY03i9EfQzM+0JYQv
RFiRmqnh8upmgaHTnDClG8vsgSmmhDMiJ+5m/f0uKQKBgQDl2dcvmC7Cb8W956Bo
3R0DKo8VFG7DxWQEwmTnJE47ARaJYRzlu1TU2s6hgaAqcoCmpFCEJItTbKmqA5Zs
axsDEMrAQKbdq4vt3ou6+zp4+NChyhBjdEQOdZT50a7Mbu3ofsp9nWASLM5uO9se
RqM141pdjdRBTkk3cZj+J6t3zQKBgQDcKu3REkS383HzwnMmPpsDdYxq7ekjoOUB
8d6KbrOysTeYwDGgutScmug2d2i6ekJQ7EBDSIiMx5ZruznpR2LpeXiEYEb3jl5A
0o7qytUSdABU4U1ZGWj1oXDVSMmu0cLEIdTAxkqPI4aJtj+Pt5gaqtqtDEHVKJCB
p64AvZ/HVQKBgFOYDY3uwBrRAc7WXd2lhTawlMcq3jnvITgl5wK1joohFCw0mIjo
v6qGRZ4xganOaQGyQuI8VDusCmydz2hw76sGwWZ4XPfDuylwxcrkMdjrTR16WsmA
8Ht9wge1feg18+qZqlVTFiymBRHMTR3OvO8NV8EsouR5b2FtvCG7Fb6FAoGATGTI
6AaCuaFLJN2PvvFyMB0Vf/TVNHuberVGFpqa16IOPH5TugWZyE0nzd5ZBHtvj0yq
b643U0Hdu7vXOE6Az6pKWwRdG4DWy39D/8wpaqG9i7YxdH0QokpGMHt1H6fBAPUM
MWecb1ZQVHBcVa3KpVYrUmgyX5gXrCVWhwNE8ZECgYA91FhR89INccAC8/FUfTW5
E8HTTYT163o5Ivp4giJ7BbEjAzx4LjZARJMPuOOEZE0sKnfW6PxjgznAXnVZJIpW
MbWn1K6tTc8lbCUWcUi+Lwk1jcmgoAU5IPf2MQGdQkbOawZ2QV3MIzmHqziDhk/f
oPs+QDJQUfOQXRHAwQGXNw==
-----END PRIVATE KEY-----`
};

let cachedToken = null;
let tokenExpiresAt = 0;

// Obtain Google OAuth2 access token for Identity Toolkit API
export async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiresAt > now + 60) {
    return cachedToken;
  }

  try {
    const formattedKey = SERVICE_ACCOUNT.private_key.replace(/\\n/g, '\n');
    const privateKey = await importPKCS8(formattedKey, 'RS256');

    const assertion = await new SignJWT({
      iss: SERVICE_ACCOUNT.client_email,
      sub: SERVICE_ACCOUNT.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase',
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    const data = await res.json();
    if (!data.access_token) {
      throw new Error(data.error_description || data.error || 'Failed to get access token');
    }

    cachedToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in || 3600);
    return cachedToken;
  } catch (err) {
    console.error('getGoogleAccessToken error:', err);
    throw err;
  }
}

// Find Firebase user by email
export async function adminLookupUserByEmail(email) {
  try {
    const token = await getGoogleAccessToken();
    const cleanEmail = email.toLowerCase().trim();
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/accounts:lookup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: [cleanEmail] }),
    });

    const data = await res.json();
    if (data.users && data.users.length > 0) {
      return data.users[0];
    }
    return null;
  } catch (err) {
    console.warn('adminLookupUserByEmail error:', err);
    return null;
  }
}

// Delete user from Firebase Auth by email or UID (used when admin deletes a user)
export async function adminDeleteUserByEmail(email) {
  try {
    const user = await adminLookupUserByEmail(email);
    if (!user || !user.localId) return false;

    const token = await getGoogleAccessToken();
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/accounts:delete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ localId: user.localId }),
    });

    const data = await res.json();
    return res.ok;
  } catch (err) {
    console.warn('adminDeleteUserByEmail error:', err);
    return false;
  }
}

// Mark user email as verified directly in Firebase Auth (used when Admin clicks "Verify User")
export async function adminSetEmailVerified(email, verified = true) {
  try {
    const user = await adminLookupUserByEmail(email);
    if (!user || !user.localId) return false;

    const token = await getGoogleAccessToken();
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/accounts:update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        localId: user.localId,
        emailVerified: verified,
      }),
    });

    return res.ok;
  } catch (err) {
    console.warn('adminSetEmailVerified error:', err);
    return false;
  }
}

// Update user password directly in Firebase Auth (used when Admin edits password in Admin panel)
export async function adminUpdateUserPasswordByEmail(email, newPassword) {
  try {
    const user = await adminLookupUserByEmail(email);
    if (!user || !user.localId) return false;

    const token = await getGoogleAccessToken();
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/accounts:update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        localId: user.localId,
        password: newPassword,
      }),
    });

    return res.ok;
  } catch (err) {
    console.warn('adminUpdateUserPasswordByEmail error:', err);
    return false;
  }
}

// Verify credentials directly with Firebase Auth Identity Toolkit REST API
// Used when user resets password via Firebase and attempts login with new password
export async function verifyFirebasePassword(email, password) {
  try {
    const apiKey = 'AIzaSyAjoncsvSwTjOiBXYBof4xCiiKYfpzi3T4';
    const cleanEmail = email.trim().toLowerCase();
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password, returnSecureToken: true }),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, emailVerified: Boolean(data.emailVerified), localId: data.localId };
  } catch (err) {
    console.warn('verifyFirebasePassword error:', err);
    return { ok: false };
  }
}
