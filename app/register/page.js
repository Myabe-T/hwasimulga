'use client';
import { secureFetch } from '@/lib/crypto';
import { useState, useEffect, useRef } from 'react';
import styles from '../login/login.module.css';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';

async function safeSendEmailVerification(user) {
  try {
    const actionCodeSettings = {
      url: typeof window !== 'undefined' ? `${window.location.origin}/login?verified=1` : 'https://desihawas.pages.dev/login?verified=1',
      handleCodeInApp: false,
    };
    await sendEmailVerification(user, actionCodeSettings);
  } catch (err) {
    console.warn('Custom actionCodeSettings verification failed, attempting standard Firebase email:', err?.code || err?.message);
    // Standard Firebase email verification never fails with unauthorized-continue-uri
    await sendEmailVerification(user);
  }
}

const ALLOWED_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.in', 'outlook.com', 'hotmail.com',
  'live.com', 'icloud.com', 'proton.me', 'protonmail.com', 'rediffmail.com',
  'yandex.com', 'mail.com', 'zoho.com', 'tutanota.com', 'fastmail.com'
];

function emailOk(email) {
  if (!email || !email.includes('@')) return false;
  return ALLOWED_DOMAINS.includes(email.split('@')[1]?.toLowerCase());
}

export default function RegisterPage() {
  const [step, setStep]         = useState(1); // 1=form, 2=verify_email_sent, 3=done
  const [form, setForm]         = useState({ username: '', email: '', password: '', displayName: '' });
  const [err, setErr]           = useState('');
  const [info, setInfo]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [resendCd, setResendCd] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const [createdFirebaseUser, setCreatedFirebaseUser] = useState(null);
  const [allowAnyEmail, setAllowAnyEmail] = useState(false);
  const timerRef = useRef(null);

  function checkEmail(email) {
    if (!email || !email.includes('@')) return false;
    if (allowAnyEmail) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return emailOk(email);
  }

  function validateUsername(uname) {
    if (!uname || uname.length < 3) return 'Username must be at least 3 characters';
    if (uname.length > 20) return 'Username must be at most 20 characters';
    if (!/^[A-Z]/.test(uname)) return 'Username must start with a Capital letter (A-Z)';
    if (!/^[A-Z][A-Za-z0-9_]*$/.test(uname)) return 'Username can only contain letters, numbers, and underscores';
    return null;
  }

  function validatePassword(pass) {
    if (!pass || pass.length < 6) return 'Password must be at least 6 characters';
    if (!/[a-z]/.test(pass)) return 'Password must contain at least 1 lowercase letter (a-z)';
    if (!/[A-Z]/.test(pass)) return 'Password must contain at least 1 capital letter (A-Z)';
    if (!/\d/.test(pass)) return 'Password must contain at least 1 number (0-9)';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pass)) return 'Password must contain at least 1 symbol (!@#$%^&*...)';
    return null;
  }

  useEffect(() => {
    secureFetch('/api/verify').then(r => r.json()).then(d => {
      if (d.auth) window.location.href = '/gallery';
    }).catch(() => {});

    // Check if admin has enabled any email domain
    secureFetch('/api/hwasi/settings')
      .then(r => r.json())
      .then(d => {
        if (d?.allowAnyEmailDomain) setAllowAnyEmail(true);
      })
      .catch(() => {
        fetch('/api/hwasi/settings')
          .then(r => r.json())
          .then(d => {
            if (d?.allowAnyEmailDomain) setAllowAnyEmail(true);
          })
          .catch(() => {});
      });

    return () => clearInterval(timerRef.current);
  }, []);

  function startResendCooldown() {
    setResendCd(60);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendCd(p => {
        if (p <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
  }

  async function handleRegister(e) {
    e.preventDefault();
    setErr(''); setInfo('');

    if (!form.displayName || form.displayName.trim().length < 2) {
      setErr('Please enter your name (at least 2 characters)');
      return;
    }
    if (!form.email || !checkEmail(form.email)) {
      setErr(allowAnyEmail ? 'Please enter a valid email address' : 'Please use Gmail, Yahoo, Outlook, iCloud or Proton email');
      return;
    }
    const uErr = validateUsername(form.username);
    if (uErr) { setErr(uErr); return; }
    const pErr = validatePassword(form.password);
    if (pErr) { setErr(pErr); return; }

    setLoading(true);
    try {
      // 1. Create or connect user in Firebase Authentication
      let fbUser = null;
      try {
        const userCred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        fbUser = userCred.user;
        setCreatedFirebaseUser(fbUser);
      } catch (fbErr) {
        if (fbErr.code === 'auth/email-already-in-use') {
          // Check if user exists in the website database
          const chk = await fetch('/api/hwasi/check-email?email=' + encodeURIComponent(form.email.trim())).then(r => r.json()).catch(() => ({ exists: true }));
          if (chk.exists) {
            setErr('This email is already registered. Please sign in instead.');
            setLoading(false);
            return;
          }
          // User was deleted by admin from DB — try signing into Firebase to get fbUser
          try {
            const cred = await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
            fbUser = cred.user;
            setCreatedFirebaseUser(fbUser);
          } catch {
            console.log('Firebase user exists with different credentials, continuing backend registration');
          }
        } else if (fbErr.code === 'auth/weak-password') {
          setErr('Password is too weak. Please include letters, numbers, and symbols.');
          setLoading(false);
          return;
        } else {
          console.warn('Firebase registration notice:', fbErr.message);
        }
      }

      // 2. Safely send Firebase verification email (resilient to custom domains or standard delivery)
      if (fbUser) {
        try {
          await safeSendEmailVerification(fbUser);
        } catch (emailErr) {
          console.warn('Failed to send verification email on first attempt:', emailErr);
        }
      }

      // 3. Register user profile in backend database (with plaintext password for Admin view)
      const rr = await secureFetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          displayName: form.displayName || form.username,
          firebaseUid: fbUser?.uid || null,
          emailVerified: true,
        }),
      });
      const rd = await rr.json();

      if (!rr.ok) {
        setErr(rd.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // 4. Auto-login and redirect immediately to Gallery
      try {
        const loginRes = await secureFetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: form.username.trim(),
            password: form.password,
          }),
        });
        const loginData = await loginRes.json();
        if (loginRes.ok && loginData.ok) {
          window.location.href = '/gallery';
          return;
        }
      } catch (_) {}

      window.location.href = '/login?registered=1';
    } catch (err) {
      setErr(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (resendCd > 0) return;
    setErr(''); setInfo('');
    try {
      let targetUser = createdFirebaseUser || auth.currentUser;
      if (!targetUser && form.email && form.password) {
        try {
          const cred = await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
          targetUser = cred.user;
          setCreatedFirebaseUser(targetUser);
        } catch {}
      }
      if (!targetUser) {
        setErr('Unable to resend email right now. Please go to the Login page and try signing in to request a new verification link.');
        return;
      }
      await safeSendEmailVerification(targetUser);
      setInfo(`Verification link resent to ${form.email}! Please check your inbox and spam folder.`);
      startResendCooldown();
    } catch (e) {
      setErr(e.message || 'Failed to resend verification link.');
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.orb1} /><div className={styles.orb2} /><div className={styles.orb3} />
      <div className={styles.cardWrap}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className={styles.logoText}>DesiHawas</span>
          </div>

          {/* ── STEP 1: Registration Form ── */}
          {step === 1 && (
            <>
              <h1 className={styles.heading}>Create Account</h1>
              <p className={styles.sub}>Join DesiHawas for free instant access</p>

              <form onSubmit={handleRegister} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Username <span style={{ color: '#ec4899', fontSize: 11 }}>(Must start with Capital A-Z)</span>
                  </label>
                  <div className={styles.inputWrap}>
                    <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <input
                      className={`input ${styles.input}`}
                      type="text"
                      placeholder="e.g. Rohit_Sharma"
                      value={form.username}
                      onChange={e => {
                        let val = e.target.value.replace(/\s+/g, '');
                        if (val.length === 1) val = val.toUpperCase();
                        setForm(p => ({ ...p, username: val }));
                      }}
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Your Name</label>
                  <div className={styles.inputWrap}>
                    <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    </svg>
                    <input
                      className={`input ${styles.input}`}
                      type="text"
                      placeholder="Enter your name"
                      value={form.displayName}
                      onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                      required
                      minLength={2}
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Email Address</label>
                  <div className={styles.inputWrap}>
                    <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <input
                      className={`input ${styles.input}`}
                      type="email"
                      placeholder="you@gmail.com"
                      value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value.trim() }))}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    Password <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 11 }}>(min 6 chars, uppercase, lowercase, number, symbol)</span>
                  </label>
                  <div className={styles.inputWrap}>
                    <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <input
                      className={`input ${styles.input}`}
                      type={showPass ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 16,
                        color: 'rgba(255,255,255,0.7)',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title={showPass ? 'Hide Password' : 'Show Password'}
                    >
                      {showPass ? '🙈' : '👁️'}
                    </button>
                  </div>

                  {/* Password requirement badges */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: form.password.length >= 6 ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.07)', color: form.password.length >= 6 ? '#4ade80' : 'rgba(255,255,255,.4)' }}>✓ 6+ chars</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: /[a-z]/.test(form.password) ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.07)', color: /[a-z]/.test(form.password) ? '#4ade80' : 'rgba(255,255,255,.4)' }}>✓ a-z</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: /[A-Z]/.test(form.password) ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.07)', color: /[A-Z]/.test(form.password) ? '#4ade80' : 'rgba(255,255,255,.4)' }}>✓ A-Z</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: /\d/.test(form.password) ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.07)', color: /\d/.test(form.password) ? '#4ade80' : 'rgba(255,255,255,.4)' }}>✓ 0-9</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(form.password) ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.07)', color: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(form.password) ? '#4ade80' : 'rgba(255,255,255,.4)' }}>✓ Symbol (!@#...)</span>
                  </div>
                </div>

                {err && <div className={styles.error}>{err}</div>}

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Creating Account…' : '🚀 Create Free Account'}
                </button>

                <div className={styles.registerLink}>
                  Already have an account? <a href="/login">Sign in</a>
                </div>
              </form>
            </>
          )}

          {/* ── STEP 2: Email Verification Notice (Clickable link from Firebase) ── */}
          {step === 2 && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>✉️</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Verify your email</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.7)', lineHeight: 1.6, marginBottom: 12 }}>
                We sent a secure activation link to <strong style={{ color: '#f472b6' }}>{form.email}</strong>.
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', marginBottom: 24, lineHeight: 1.5 }}>
                Please check your inbox (and spam folder) and <strong>click the verification link</strong> to activate your account.
              </p>

              {info && <div style={{ background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.3)', color: '#4ade80', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{info}</div>}
              {err && <div className={styles.error} style={{ marginBottom: 16 }}>{err}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <a
                  href={`/login?email=${encodeURIComponent(form.email)}`}
                  style={{
                    display: 'block',
                    background: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
                    color: '#fff',
                    padding: '12px 24px',
                    borderRadius: 12,
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: 14,
                    textAlign: 'center',
                  }}
                >
                  ✓ I Have Verified My Email → Sign In
                </a>

                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendCd > 0}
                  style={{
                    background: 'rgba(255,255,255,.07)',
                    border: '1px solid rgba(255,255,255,.15)',
                    color: resendCd > 0 ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.8)',
                    padding: '10px 20px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: resendCd > 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {resendCd > 0 ? `Resend email in ${resendCd}s` : 'Resend Verification Email'}
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 28, textAlign: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(236,72,153,.3),transparent)' }} />
            <span style={{ background: '#0e0713', padding: '0 10px', position: 'relative', fontSize: 11, color: 'rgba(236,72,153,.6)', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 800 }}>
              100% Free &amp; Private
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
