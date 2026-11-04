'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './login.module.css';
import { secureFetch } from '@/lib/crypto';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';

async function safeSendEmailVerification(user) {
  try {
    const actionCodeSettings = {
      url: typeof window !== 'undefined' ? `${window.location.origin}/auth/action` : 'https://desihawas.pages.dev/auth/action',
      handleCodeInApp: true,
    };
    await sendEmailVerification(user, actionCodeSettings);
  } catch (err) {
    console.warn('Custom actionCodeSettings verification failed, attempting standard Firebase email:', err?.code || err?.message);
    // Standard Firebase email verification never fails with unauthorized-continue-uri
    await sendEmailVerification(user);
  }
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState(''); // PENDING_APPROVAL | ACCOUNT_BLOCKED | EMAIL_NOT_VERIFIED | ''
  const [showPass, setShowPass] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendCd, setResendCd] = useState(0);
  const [resendInfo, setResendInfo] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    // Check URL parameters for banners
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('verified') === '1') {
        setSuccessBanner('🎉 Email verified successfully! Please enter your password to sign in.');
      } else if (sp.get('reset') === '1') {
        setSuccessBanner('✅ Password changed successfully! Please sign in with your new password.');
      }
      if (sp.get('email')) {
        setUsername(sp.get('email'));
      }
    }

    secureFetch('/api/verify').then(r => r.json()).then(d => {
      if (d.auth) window.location.replace('/gallery');
    }).catch(() => {});
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

  async function handleResendVerification() {
    if (resendCd > 0) return;
    setResendInfo(''); setError('');
    try {
      if (unverifiedUser) {
        await safeSendEmailVerification(unverifiedUser);
        setResendInfo(`Verification link resent to ${unverifiedUser.email}! Check your inbox & spam folder.`);
        startResendCooldown();
      } else {
        const targetEmail = unverifiedEmail || (username.includes('@') ? username.trim() : null);
        if (targetEmail && password) {
          try {
            const cred = await signInWithEmailAndPassword(auth, targetEmail, password);
            await safeSendEmailVerification(cred.user);
            setResendInfo(`Verification link resent to ${targetEmail}! Check your inbox & spam folder.`);
            startResendCooldown();
          } catch (e) {
            setResendInfo(`Verification link resent to ${targetEmail}! Check your inbox & spam folder.`);
            startResendCooldown();
          }
        } else {
          setError('Please provide your registered email and password to resend the verification link.');
        }
      }
    } catch (e) {
      setError(e.message || 'Failed to resend verification link');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setErrorCode('');
    setResendInfo('');
    setUnverifiedUser(null);

    const inputClean = username.trim();

    try {
      let idToken = null;
      let fbEmailVerified = null;

      // 1. If input is an email, authenticate with Firebase
      if (inputClean.includes('@')) {
        try {
          const userCred = await signInWithEmailAndPassword(auth, inputClean, password);
          const fbUser = userCred.user;
          fbEmailVerified = fbUser.emailVerified;

          // Block unverified users from accessing protected features
          if (!fbUser.emailVerified) {
            setUnverifiedUser(fbUser);
            setErrorCode('EMAIL_NOT_VERIFIED');
            setError(`Please verify your email address before signing in. We sent a verification link to ${fbUser.email}.`);
            setLoading(false);
            return;
          }

          idToken = await fbUser.getIdToken();
        } catch (fbErr) {
          // If not in Firebase (e.g. static admin user), fallback to local backend check
          console.log('Firebase auth fallback to local:', fbErr.code);
        }
      }

      // 2. Exchange credentials / ID token with backend session
      const res = await secureFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: inputClean, password, idToken, fbEmailVerified }),
      });

      if (!res.ok) {
        const d = await res.json();
        setErrorCode(d.code || '');
        if (d.email) setUnverifiedEmail(d.email);
        throw new Error(d.error || 'Login failed');
      }

      // Hard navigation so the cookie is picked up by middleware fresh
      window.location.replace('/gallery');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      {/* Floating orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />

      <div className={styles.cardWrap}>
        <div className={styles.card}>
          {/* Logo */}
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 2L26 8.5V19.5L14 26L2 19.5V8.5L14 2Z" fill="url(#g1)" stroke="rgba(255,255,255,0.8)" strokeWidth="1"/>
                <path d="M10 10l8 4-8 4V10z" fill="white" opacity="0.9"/>
                <defs>
                  <linearGradient id="g1" x1="2" y1="2" x2="26" y2="26">
                    <stop offset="0%" stopColor="#ec4899"/>
                    <stop offset="100%" stopColor="#8b5cf6"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className={styles.logoText}>DesiHawas</span>
          </div>

          <h1 className={styles.heading}>Welcome Back</h1>
          <p className={styles.sub}>Sign in to access your premium gallery</p>

          {successBanner && (
            <div style={{ background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.3)', color: '#4ade80', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: 'center', lineHeight: 1.5 }}>
              {successBanner}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Username or Email</label>
              <div className={styles.inputWrap}>
                <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  className={`input ${styles.input}`}
                  type="text"
                  placeholder="Enter username or email"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username email"
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <div className={styles.inputWrap}>
                <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  className={`input ${styles.input}`}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
                  {showPass ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className={`${styles.error} ${errorCode === 'ACCOUNT_BLOCKED' ? styles.blockedBox : ''}`}>
                {error}
              </div>
            )}

            {resendInfo && (
              <div style={{ background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.3)', color: '#4ade80', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
                {resendInfo}
              </div>
            )}

            {/* If email not verified, provide Resend button */}
            {errorCode === 'EMAIL_NOT_VERIFIED' && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendCd > 0}
                style={{
                  width: '100%',
                  marginBottom: 14,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(236,72,153,.15)',
                  border: '1px solid rgba(236,72,153,.35)',
                  color: resendCd > 0 ? 'rgba(255,255,255,.3)' : '#f472b6',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: resendCd > 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {resendCd > 0 ? `Resend link in ${resendCd}s` : '✉️ Resend Verification Link'}
              </button>
            )}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? (
                <span className={styles.spinnerWrap}>
                  <span className={styles.spinner} />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 13 }}>
              <a href="/forgot-password" className={styles.link} style={{ color: 'rgba(255,255,255,.5)' }}>
                Forgot password?
              </a>
              <a href="/register" className={styles.link} style={{ color: '#ec4899', fontWeight: 700 }}>
                Create account →
              </a>
            </div>
          </form>

          <div style={{ marginTop: 28, textAlign: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(236,72,153,.3),transparent)' }} />
            <span style={{ background: '#0e0713', padding: '0 10px', position: 'relative', fontSize: 11, color: 'rgba(236,72,153,.6)', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 800 }}>
              Encrypted &amp; Secure
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
