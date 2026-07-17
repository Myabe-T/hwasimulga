'use client';
import { useState, useEffect } from 'react';
import styles from './login.module.css';
import { secureFetch } from '@/lib/crypto';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState(''); // PENDING_APPROVAL | ACCOUNT_BLOCKED | ''
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    secureFetch('/api/verify').then(r => r.json()).then(d => {
      if (d.auth) window.location.href = '/gallery';
    }).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setErrorCode('');
    try {
      const res = await secureFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const d = await res.json();
        setErrorCode(d.code || '');
        throw new Error(d.error || 'Login failed');
      }
      // Hard navigation so the cookie is picked up by middleware fresh
      window.location.href = '/gallery';
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

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Username</label>
              <div className={styles.inputWrap}>
                <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  className={`input ${styles.input}`}
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
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
              <div style={{textAlign:'right', marginTop:4}}>
                <a href="/forgot-password" style={{fontSize:12, color:'rgba(255,255,255,0.5)', textDecoration:'none', transition:'color 0.2s'}}>Forgot Password?</a>
              </div>
            </div>

            {error && errorCode === 'PENDING_APPROVAL' && (
              <div style={{
                padding:'14px 16px', borderRadius:12, marginBottom:4,
                background:'rgba(245,158,11,.12)', border:'1px solid rgba(245,158,11,.35)',
                display:'flex', gap:10, alignItems:'flex-start'
              }}>
                <span style={{fontSize:20,flexShrink:0}}>⏳</span>
                <div>
                  <div style={{fontWeight:800,fontSize:13,color:'#fbbf24',marginBottom:4}}>Account Pending Approval</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,.6)',lineHeight:1.6}}>
                    Your registration is waiting for admin review. You'll be able to log in once approved. Please check back later.
                  </div>
                </div>
              </div>
            )}

            {error && errorCode === 'ACCOUNT_BLOCKED' && (
              <div style={{
                padding:'14px 16px', borderRadius:12, marginBottom:4,
                background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)',
                display:'flex', gap:10, alignItems:'flex-start'
              }}>
                <span style={{fontSize:20,flexShrink:0}}>🚫</span>
                <div>
                  <div style={{fontWeight:800,fontSize:13,color:'#f87171',marginBottom:4}}>Account Blocked</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,.6)',lineHeight:1.6,whiteSpace:'pre-line'}}>
                    {error.replace('🚫 Your account has been blocked.\n\nReason: ','').replace('\n\nContact support to resolve this issue.','')}
                  </div>
                  <div style={{marginTop:8,fontSize:12,color:'rgba(255,255,255,.5)'}}>
                    To appeal, contact support: <strong style={{color:'#f87171'}}>support@DesiHawas.com</strong>
                  </div>
                </div>
              </div>
            )}

            {error && !errorCode && (
              <div className={styles.error}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
            
            <div className={styles.registerLink}>
              New here? <a href="/register">Create an account</a>
            </div>
          </form>

          {/* Sexy Flirty Line */}
          <div style={{marginTop:30, textAlign:'center', position:'relative'}}>
            <div style={{position:'absolute', top:'50%', left:0, right:0, height:1, background:'linear-gradient(90deg, transparent, rgba(236,72,153,.3), transparent)'}} />
            <span style={{background:'#0e0713', padding:'0 10px', position:'relative', fontSize:11, color:'rgba(236,72,153,.6)', letterSpacing:'.1em', textTransform:'uppercase', fontWeight:800}}>
              Taste The Difference
            </span>
          </div>

        </div>
      </div>
    </main>
  );
}
