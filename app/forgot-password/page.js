'use client';
import { useState } from 'react';
import styles from '../login/login.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [err, setErr]         = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const r = await fetch('/api/hwasi/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Always show success (never reveal if email exists — anti-enumeration)
      setDone(true);
    } catch { setErr('Network error. Please try again.'); }
    finally { setLoading(false); }
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

          {done ? (
            <div style={{textAlign:'center',padding:'24px 0'}}>
              <div style={{fontSize:52,marginBottom:14}}>✉️</div>
              <h2 style={{fontSize:20,fontWeight:800,color:'#fff',marginBottom:8}}>Check your inbox!</h2>
              <p style={{fontSize:14,color:'rgba(255,255,255,.6)',lineHeight:1.7,marginBottom:6}}>
                If an account exists for <strong style={{color:'#a78bfa'}}>{email}</strong>, we've sent a password reset link.
              </p>
              <p style={{fontSize:13,color:'rgba(255,255,255,.35)',marginBottom:24}}>
                The link expires in <strong>20 minutes</strong>. Check your spam folder too.
              </p>
              <a href="/login" style={{display:'inline-block',background:'linear-gradient(135deg,#7c3aed,#ec4899)',color:'#fff',padding:'11px 28px',borderRadius:12,textDecoration:'none',fontWeight:700,fontSize:14}}>
                ← Back to Login
              </a>
            </div>
          ) : (
            <>
              <h1 className={styles.heading}>Forgot Password?</h1>
              <p className={styles.sub}>Enter your email — we'll send a secure reset link</p>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label}>Email Address</label>
                  <div className={styles.inputWrap}>
                    <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <input className={`input ${styles.input}`} type="email" placeholder="you@gmail.com"
                      value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                </div>
                {err && <div className={styles.error}>{err}</div>}
                <button type="submit" className={styles.submitBtn} disabled={loading || !email}>
                  {loading ? 'Sending…' : '🔑 Send Reset Link'}
                </button>
                <div className={styles.registerLink}>Remember your password? <a href="/login">Sign in</a></div>
              </form>
            </>
          )}

          <div style={{marginTop:28,textAlign:'center',position:'relative'}}>
            <div style={{position:'absolute',top:'50%',left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(236,72,153,.3),transparent)'}} />
            <span style={{background:'#0e0713',padding:'0 10px',position:'relative',fontSize:11,color:'rgba(236,72,153,.6)',letterSpacing:'.1em',textTransform:'uppercase',fontWeight:800}}>Secure &amp; Private</span>
          </div>
        </div>
      </div>
    </main>
  );
}
