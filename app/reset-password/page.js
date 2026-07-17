'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from '../login/login.module.css';

function ResetForm() {
  const params  = useSearchParams();
  const token   = params.get('token');
  const [pwd, setPwd]           = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState('idle'); // idle | success | error | invalid
  const [err, setErr]           = useState('');

  useEffect(() => {
    if (!token) setStatus('invalid');
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    if (pwd.length < 6) { setErr('Password must be at least 6 characters'); return; }
    if (pwd !== confirm) { setErr('Passwords do not match'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/hwasi/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: pwd }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Reset failed'); return; }
      setStatus('success');
    } catch { setErr('Network error. Try again.'); }
    finally { setLoading(false); }
  }

  const strength = pwd.length === 0 ? 0 : pwd.length < 6 ? 1 : pwd.length < 10 ? 2 : /[^a-zA-Z0-9]/.test(pwd) ? 4 : 3;
  const strengthLabel = ['','Weak','Fair','Strong','Very Strong'][strength];
  const strengthColor = ['','#f87171','#fbbf24','#4ade80','#34d399'][strength];

  if (status === 'invalid') return (
    <div style={{textAlign:'center',padding:'20px 0'}}>
      <div style={{fontSize:52,marginBottom:14}}>⚠️</div>
      <h2 style={{fontSize:20,fontWeight:800,color:'#fff',marginBottom:8}}>Invalid Link</h2>
      <p style={{color:'rgba(255,255,255,.55)',fontSize:14,marginBottom:24}}>This reset link is invalid or has expired.</p>
      <a href="/forgot-password" style={{display:'inline-block',background:'linear-gradient(135deg,#7c3aed,#ec4899)',color:'#fff',padding:'11px 28px',borderRadius:12,textDecoration:'none',fontWeight:700}}>Request New Link</a>
    </div>
  );

  if (status === 'success') return (
    <div style={{textAlign:'center',padding:'20px 0'}}>
      <div style={{fontSize:52,marginBottom:14}}>🎉</div>
      <h2 style={{fontSize:20,fontWeight:800,color:'#fff',marginBottom:8}}>Password Updated!</h2>
      <p style={{color:'rgba(255,255,255,.55)',fontSize:14,marginBottom:24}}>Your password has been reset successfully. You can now sign in.</p>
      <a href="/login" style={{display:'inline-block',background:'linear-gradient(135deg,#7c3aed,#ec4899)',color:'#fff',padding:'11px 28px',borderRadius:12,textDecoration:'none',fontWeight:700}}>Sign In →</a>
    </div>
  );

  return (
    <>
      <h1 className={styles.heading}>Set New Password</h1>
      <p className={styles.sub}>Choose a strong password for your account</p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>New Password *</label>
          <div className={styles.inputWrap} style={{position:'relative'}}>
            <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input className={`input ${styles.input}`} type={showPwd ? 'text' : 'password'}
              placeholder="Min. 6 characters" value={pwd}
              onChange={e => setPwd(e.target.value)} required />
            <button type="button" onClick={() => setShowPwd(s => !s)}
              style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'rgba(255,255,255,.4)',cursor:'pointer',fontSize:14}}>
              {showPwd ? '🙈' : '👁'}
            </button>
          </div>
          {pwd.length > 0 && (
            <div style={{marginTop:8,display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,height:3,borderRadius:2,background:'rgba(255,255,255,.08)',overflow:'hidden'}}>
                <div style={{width:`${strength * 25}%`,height:'100%',background:strengthColor,transition:'all .3s'}} />
              </div>
              <span style={{fontSize:11,color:strengthColor,fontWeight:700,minWidth:60}}>{strengthLabel}</span>
            </div>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Confirm Password *</label>
          <div className={styles.inputWrap}>
            <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input className={`input ${styles.input}`} type={showPwd ? 'text' : 'password'}
              placeholder="Re-enter password" value={confirm}
              onChange={e => setConfirm(e.target.value)} required />
          </div>
          {confirm && pwd !== confirm && <span style={{fontSize:11,color:'#f87171',marginTop:4,display:'block'}}>⚠ Passwords don't match</span>}
          {confirm && pwd === confirm && pwd.length >= 6 && <span style={{fontSize:11,color:'#4ade80',marginTop:4,display:'block'}}>✓ Passwords match</span>}
        </div>
        {err && <div className={styles.error}>{err}</div>}
        <button type="submit" className={styles.submitBtn} disabled={loading || pwd.length < 6 || pwd !== confirm}>
          {loading ? 'Updating…' : '🔐 Update Password'}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className={styles.main}>
      <div className={styles.orb1} /><div className={styles.orb2} /><div className={styles.orb3} />
      <div className={styles.cardWrap}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <span className={styles.logoText}>DesiHawas</span>
          </div>
          <Suspense fallback={<div style={{textAlign:'center',color:'rgba(255,255,255,.5)',padding:20}}>Loading…</div>}>
            <ResetForm />
          </Suspense>
          <div style={{marginTop:28,textAlign:'center',position:'relative'}}>
            <div style={{position:'absolute',top:'50%',left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(236,72,153,.3),transparent)'}} />
            <span style={{background:'#0e0713',padding:'0 10px',position:'relative',fontSize:11,color:'rgba(236,72,153,.6)',letterSpacing:'.1em',textTransform:'uppercase',fontWeight:800}}>Secure &amp; Private</span>
          </div>
        </div>
      </div>
    </main>
  );
}
