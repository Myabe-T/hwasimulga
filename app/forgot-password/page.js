'use client';
import { useState } from 'react';
import styles from '../login/login.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success' or 'error'

  function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      // Let's just pretend we sent it
      setStatus('success');
    }, 1500);
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <span className={styles.logoText}>Reset Password</span>
          </div>

          <h1 className={styles.heading}>Forgot Password?</h1>
          <p className={styles.sub}>Enter your email to receive a reset link</p>

          {status === 'success' ? (
            <div style={{textAlign:'center', padding:'20px', background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.2)', borderRadius:16, color:'#4ade80', animation:'slideUp 0.5s ease'}}>
              <div style={{fontSize:40, marginBottom:10}}>✉️</div>
              <strong style={{display:'block', fontSize:16, marginBottom:8}}>Reset Link Sent!</strong>
              <div style={{fontSize:14, color:'rgba(255,255,255,.7)'}}>
                If an account exists for <b>{email}</b>, you will receive a password reset link shortly.
              </div>
              <a href="/login" style={{display:'inline-block', marginTop:16, color:'#fff', textDecoration:'underline'}}>Back to Login</a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Email Address</label>
                <div className={styles.inputWrap}>
                  <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <input
                    className={`input ${styles.input}`}
                    type="email"
                    placeholder="you@gmail.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading || !email}>
                {loading ? 'Sending Link...' : 'Send Reset Link'}
              </button>
              
              <div className={styles.registerLink}>
                Remember your password? <a href="/login">Sign in</a>
              </div>
            </form>
          )}

          {/* Sexy Flirty Line */}
          <div style={{marginTop:30, textAlign:'center', position:'relative'}}>
            <div style={{position:'absolute', top:'50%', left:0, right:0, height:1, background:'linear-gradient(90deg, transparent, rgba(236,72,153,.3), transparent)'}} />
            <span style={{background:'#0e0713', padding:'0 10px', position:'relative', fontSize:11, color:'rgba(236,72,153,.6)', letterSpacing:'.1em', textTransform:'uppercase', fontWeight:800}}>
              Secure & Private
            </span>
          </div>

        </div>
      </div>
    </main>
  );
}
