'use client';
import { secureFetch } from '@/lib/crypto';
import { useState, useEffect } from 'react';
import styles from '../login/login.module.css';

const ALLOWED_DOMAINS = ['gmail.com','yahoo.com','yahoo.in','outlook.com','hotmail.com','live.com','icloud.com','proton.me','protonmail.com','rediffmail.com','yandex.com'];

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', displayName: '' });
  const [err, setErr]   = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    secureFetch('/api/verify').then(r => r.json()).then(d => {
      if (d.auth) window.location.href = '/gallery';
    }).catch(() => {});
  }, []);

  function emailOk(email) {
    if (!email.includes('@')) return false;
    return ALLOWED_DOMAINS.includes(email.split('@')[1].toLowerCase());
  }

  const [successMsg, setSuccessMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setSuccessMsg('');
    if (!emailOk(form.email)) {
      setErr('Please use Gmail, Yahoo, Outlook, iCloud or Proton email');
      return;
    }
    setLoading(true);
    try {
      const r = await secureFetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Registration failed'); return; }
      
      if (d.pending) {
        setSuccessMsg(d.message || 'Registration submitted! An admin will review and approve your account shortly.');
        setForm({ username: '', email: '', password: '', displayName: '' });
      } else {
        window.location.href = '/gallery';
      }
    } catch { setErr('Network error. Try again.'); }
    finally { setLoading(false); }
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

          <h1 className={styles.heading}>Create Account</h1>
          <p className={styles.sub}>Join the exclusive premium gallery</p>

          {successMsg ? (
            <div style={{textAlign:'center', padding:'20px', background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.2)', borderRadius:16, color:'#4ade80', animation:'slideUp 0.5s ease'}}>
              <div style={{fontSize:40, marginBottom:10}}>✨</div>
              <strong style={{display:'block', fontSize:16, marginBottom:8}}>You're on the list!</strong>
              <div style={{fontSize:14, color:'rgba(255,255,255,.7)'}}>{successMsg}</div>
              <a href="/login" style={{display:'inline-block', marginTop:16, color:'#fff', textDecoration:'underline'}}>Go to Login</a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Display Name</label>
                <div className={styles.inputWrap}>
                  <input className={`input ${styles.input}`} style={{paddingLeft:16}} placeholder="Your name" value={form.displayName}
                    onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Username *</label>
                <div className={styles.inputWrap}>
                  <input className={`input ${styles.input}`} style={{paddingLeft:16}} placeholder="e.g. rahul123" required value={form.username}
                    onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'') }))} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email * <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>(Gmail/Yahoo/Outlook only)</span></label>
                <div className={styles.inputWrap}>
                  <input className={`input ${styles.input}`} style={{paddingLeft:16}} type="email" placeholder="you@gmail.com" required value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                {form.email && !emailOk(form.email) && (
                  <span style={{fontSize:11,color:'#f87171',marginTop:4,display:'block',paddingLeft:4}}>
                    ⚠ Use Gmail, Yahoo, Outlook, iCloud or Proton
                  </span>
                )}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Password *</label>
                <div className={styles.inputWrap}>
                  <input className={`input ${styles.input}`} style={{paddingLeft:16}} type="password" placeholder="Min. 6 characters" required value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                </div>
              </div>

              {err && (
                <div className={styles.error}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {err}
                </div>
              )}

              <button className={styles.submitBtn} type="submit" disabled={loading}>
                {loading ? 'Creating account…' : 'Unlock Premium Access 🚀'}
              </button>
              
              <div className={styles.registerLink}>
                Already have an account? <a href="/login">Sign in</a>
              </div>
            </form>
          )}

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
