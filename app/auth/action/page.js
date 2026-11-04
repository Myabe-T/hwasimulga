'use client';
export const runtime = 'edge';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from '../../login/login.module.css';
import { auth } from '@/lib/firebase';
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  checkActionCode,
} from 'firebase/auth';

function AuthActionHandler() {
  const params = useSearchParams();
  const router = useRouter();

  const mode = params.get('mode'); // 'resetPassword' | 'verifyEmail'
  const oobCode = params.get('oobCode');

  // State for Reset Password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);

  // State for Status & Feedback
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('loading'); // 'loading' | 'reset_form' | 'verified_success' | 'reset_success' | 'error'
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!oobCode || !mode) {
      setStatus('error');
      setErr('Invalid or missing authentication link parameters.');
      setLoading(false);
      return;
    }

    if (mode === 'resetPassword') {
      // 1. Verify code and obtain user email
      verifyPasswordResetCode(auth, oobCode)
        .then(userEmail => {
          setEmail(userEmail);
          setStatus('reset_form');
          setLoading(false);
        })
        .catch(error => {
          console.error('Verify reset code error:', error);
          setStatus('error');
          setErr('This password reset link has expired or has already been used. Please request a new one.');
          setLoading(false);
        });
    } else if (mode === 'verifyEmail') {
      // 2. Extract email from oobCode and apply email verification code
      checkActionCode(auth, oobCode)
        .then(async (info) => {
          const verifiedEmail = info.data?.email || auth.currentUser?.email;
          await applyActionCode(auth, oobCode);

          setStatus('verified_success');
          setMsg(`Email (${verifiedEmail || ''}) verified successfully!`);
          setLoading(false);

          // Sync email verification to Redis
          if (verifiedEmail) {
            await fetch('/api/hwasi/mark-verified', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: verifiedEmail }),
            }).catch(() => {});
          }

          // Auto redirect to login after 2 seconds
          setTimeout(() => {
            router.push(`/login?verified=1${verifiedEmail ? `&email=${encodeURIComponent(verifiedEmail)}` : ''}`);
          }, 2000);
        })
        .catch(async (error) => {
          // If checkActionCode fails, try applyActionCode directly
          try {
            await applyActionCode(auth, oobCode);
            setStatus('verified_success');
            setMsg('Email verified successfully!');
            setLoading(false);
            if (auth.currentUser?.email) {
              await fetch('/api/hwasi/mark-verified', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: auth.currentUser.email }),
              }).catch(() => {});
            }
            setTimeout(() => {
              router.push('/login?verified=1');
            }, 2000);
          } catch (err2) {
            console.error('Verify error:', error, err2);
            setStatus('error');
            setErr('This email verification link has expired or is invalid. Please sign in and request a new link.');
            setLoading(false);
          }
        });
    } else {
      setStatus('error');
      setErr(`Unsupported action mode: ${mode}`);
      setLoading(false);
    }
  }, [mode, oobCode, router]);

  function validatePassword(pass) {
    if (!pass || pass.length < 6) return 'Password must be at least 6 characters';
    if (!/[a-z]/.test(pass)) return 'Must contain at least 1 lowercase letter (a-z)';
    if (!/[A-Z]/.test(pass)) return 'Must contain at least 1 capital letter (A-Z)';
    if (!/\d/.test(pass)) return 'Must contain at least 1 number (0-9)';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pass)) return 'Must contain at least 1 symbol (!@#$%^&*...)';
    return null;
  }

  async function handleResetSubmit(e) {
    e.preventDefault();
    setErr('');
    const pErr = validatePassword(password);
    if (pErr) { setErr(pErr); return; }
    if (password !== confirmPass) { setErr('Passwords do not match'); return; }

    setLoading(true);
    try {
      // 1. Confirm password reset in Firebase Auth
      await confirmPasswordReset(auth, oobCode, password);

      // 2. Synchronize new password to Redis (both plaintext for admin & hash for login)
      await fetch('/api/hwasi/sync-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), newPassword: password }),
      }).catch(e => console.warn('Redis password sync warning:', e));

      setStatus('reset_success');
      setMsg('Your password has been changed successfully! Redirecting to login...');

      setTimeout(() => {
        router.push('/login?reset=1');
      }, 2500);
    } catch (fbErr) {
      console.error('Reset submit error:', fbErr);
      setErr(fbErr.message || 'Failed to reset password. Please try again or request a new link.');
    } finally {
      setLoading(false);
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
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <span className={styles.logoText}>DesiHawas</span>
          </div>

          {/* ── 1. LOADING STATE ── */}
          {status === 'loading' && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: 44, marginBottom: 16 }}>⏳</div>
              <h2 style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Verifying Request...</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>Please wait while we connect to secure authentication.</p>
            </div>
          )}

          {/* ── 2. EMAIL VERIFIED SUCCESS ── */}
          {status === 'verified_success' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>🎉</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 10 }}>Email Verified!</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.7)', lineHeight: 1.6, marginBottom: 20 }}>
                Your email address has been verified. You can now access your account and all features.
              </p>
              <div style={{ background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.3)', color: '#4ade80', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 24 }}>
                Auto-redirecting to sign in...
              </div>
              <a href="/login" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', color: '#fff', padding: '12px 28px', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
                Go to Sign In →
              </a>
            </div>
          )}

          {/* ── 3. PASSWORD RESET FORM ── */}
          {status === 'reset_form' && (
            <>
              <h1 className={styles.heading}>Reset Your Password</h1>
              <p className={styles.sub}>
                Enter a new password for <strong style={{ color: '#a78bfa' }}>{email}</strong>
              </p>

              {err && <div className={styles.error} style={{ marginBottom: 16 }}>{err}</div>}

              <form onSubmit={handleResetSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label}>New Password</label>
                  <div className={styles.inputWrap}>
                    <input
                      className={`input ${styles.input}`}
                      type={showPass ? 'text' : 'password'}
                      placeholder="Enter new password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{
                        position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 16, color: 'rgba(255,255,255,0.7)', padding: 4, display: 'flex', alignItems: 'center'
                      }}
                      title={showPass ? 'Hide Password' : 'Show Password'}
                    >
                      {showPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Confirm New Password</label>
                  <div className={styles.inputWrap}>
                    <input
                      className={`input ${styles.input}`}
                      type={showPass ? 'text' : 'password'}
                      placeholder="Confirm new password"
                      value={confirmPass}
                      onChange={e => setConfirmPass(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: password.length >= 6 ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.07)', color: password.length >= 6 ? '#4ade80' : 'rgba(255,255,255,.4)' }}>✓ 6+ chars</span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: /[A-Z]/.test(password) ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.07)', color: /[A-Z]/.test(password) ? '#4ade80' : 'rgba(255,255,255,.4)' }}>✓ Uppercase</span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: /[a-z]/.test(password) ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.07)', color: /[a-z]/.test(password) ? '#4ade80' : 'rgba(255,255,255,.4)' }}>✓ Lowercase</span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: /\d/.test(password) ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.07)', color: /\d/.test(password) ? '#4ade80' : 'rgba(255,255,255,.4)' }}>✓ Number</span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: /[^a-zA-Z0-9]/.test(password) ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.07)', color: /[^a-zA-Z0-9]/.test(password) ? '#4ade80' : 'rgba(255,255,255,.4)' }}>✓ Symbol</span>
                </div>

                <button type="submit" className={styles.submitBtn} disabled={loading || !password || !confirmPass}>
                  {loading ? 'Saving…' : '💾 Save New Password'}
                </button>
              </form>
            </>
          )}

          {/* ── 4. PASSWORD RESET SUCCESS ── */}
          {status === 'reset_success' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 10 }}>Password Updated!</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.7)', lineHeight: 1.6, marginBottom: 20 }}>
                {msg}
              </p>
              <a href="/login" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', padding: '12px 28px', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
                Sign In Now →
              </a>
            </div>
          )}

          {/* ── 5. ERROR STATE ── */}
          {status === 'error' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>⚠️</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Authentication Error</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, marginBottom: 24 }}>
                {err}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <a href="/forgot-password" style={{ display: 'inline-block', background: 'rgba(255,255,255,.1)', color: '#fff', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
                  Request Link
                </a>
                <a href="/login" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', padding: '10px 22px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                  Go to Login
                </a>
              </div>
            </div>
          )}

          <div style={{ marginTop: 28, textAlign: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(236,72,153,.3),transparent)' }} />
            <span style={{ background: '#0e0713', padding: '0 10px', position: 'relative', fontSize: 11, color: 'rgba(236,72,153,.6)', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 800 }}>
              DesiHawas Auth
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0713', color: '#fff' }}>
        Loading...
      </div>
    }>
      <AuthActionHandler />
    </Suspense>
  );
}
