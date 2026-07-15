'use client';
import { useState } from 'react';
import styles from '../login/login.module.css';

const ALLOWED_DOMAINS = ['gmail.com','yahoo.com','yahoo.in','outlook.com','hotmail.com','live.com','icloud.com','proton.me','protonmail.com','rediffmail.com','yandex.com'];

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', displayName: '' });
  const [err, setErr]   = useState('');
  const [loading, setLoading] = useState(false);

  function emailOk(email) {
    if (!email.includes('@')) return false;
    return ALLOWED_DOMAINS.includes(email.split('@')[1].toLowerCase());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    if (!emailOk(form.email)) {
      setErr('Please use Gmail, Yahoo, Outlook, iCloud or Proton email');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Registration failed'); return; }
      window.location.href = '/gallery';
    } catch { setErr('Network error. Try again.'); }
    finally { setLoading(false); }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>🔥</div>
        <h1 className={styles.title}>Create Account</h1>
        <p className={styles.sub}>Join Hwasimulga · Free viewer access</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Display Name</label>
            <input className={styles.input} placeholder="Your name" value={form.displayName}
              onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
          </div>
          <div className={styles.field}>
            <label>Username *</label>
            <input className={styles.input} placeholder="e.g. rahul123" required value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'') }))} />
          </div>
          <div className={styles.field}>
            <label>Email * <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>(Gmail/Yahoo/Outlook only)</span></label>
            <input className={styles.input} type="email" placeholder="you@gmail.com" required value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            {form.email && !emailOk(form.email) && (
              <span style={{fontSize:11,color:'#f87171',marginTop:4,display:'block'}}>
                ⚠ Use Gmail, Yahoo, Outlook, iCloud or Proton
              </span>
            )}
          </div>
          <div className={styles.field}>
            <label>Password *</label>
            <input className={styles.input} type="password" placeholder="Min. 6 characters" required value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>

          {err && <div className={styles.error}>{err}</div>}

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Creating account…' : '🚀 Register'}
          </button>
        </form>

        <p className={styles.switchLink}>
          Already have an account? <a href="/login">Sign in →</a>
        </p>

        <div style={{marginTop:16,padding:12,background:'rgba(255,255,255,.03)',borderRadius:10,fontSize:11,color:'rgba(255,255,255,.4)',textAlign:'center'}}>
          Accepted emails: Gmail · Yahoo · Outlook · iCloud · Proton · Rediffmail
        </div>
      </div>
    </div>
  );
}
