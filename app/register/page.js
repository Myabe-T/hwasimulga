'use client';
import { secureFetch } from '@/lib/crypto';
import { useState, useEffect, useRef } from 'react';
import styles from '../login/login.module.css';

const ALLOWED_DOMAINS = ['gmail.com','yahoo.com','yahoo.in','outlook.com','hotmail.com','live.com','icloud.com','proton.me','protonmail.com','rediffmail.com','yandex.com','mail.com','zoho.com','tutanota.com','fastmail.com'];

function emailOk(email) {
  if (!email.includes('@')) return false;
  return ALLOWED_DOMAINS.includes(email.split('@')[1]?.toLowerCase());
}

export default function RegisterPage() {
  const [step, setStep]         = useState(1); // 1=form, 2=otp, 3=done
  const [form, setForm]         = useState({ username: '', email: '', password: '', displayName: '' });
  const [otp, setOtp]           = useState(['','','','','','']);
  const [err, setErr]           = useState('');
  const [info, setInfo]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [resendCd, setResendCd] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');
  const [otpRequired, setOtpRequired] = useState(true); // default ON until loaded
  const otpRefs = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    secureFetch('/api/verify').then(r => r.json()).then(d => {
      if (d.auth) window.location.href = '/gallery';
    }).catch(() => {});
    // Fetch OTP required setting (public flag endpoint)
    fetch('/api/hwasi/reg-settings').then(r => r.json()).then(d => {
      if (typeof d?.otpRequired === 'boolean') setOtpRequired(d.otpRequired);
    }).catch(() => setOtpRequired(false)); // Default OFF if fetch fails
    return () => clearInterval(timerRef.current);
  }, []);

  function startResendCooldown() {
    setResendCd(60);
    timerRef.current = setInterval(() => {
      setResendCd(p => { if (p <= 1) { clearInterval(timerRef.current); return 0; } return p - 1; });
    }, 1000);
  }

  async function sendOtp() {
    setErr(''); setInfo('');
    if (!form.email || !emailOk(form.email)) { setErr('Use Gmail, Yahoo, Outlook, iCloud, Proton or similar email'); return; }
    if (!form.username || form.username.length < 3) { setErr('Username must be at least 3 characters'); return; }
    if (!form.password || form.password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      // If OTP is disabled by admin, skip straight to registration
      if (!otpRequired) {
        const rr = await secureFetch('/api/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, emailVerified: false }),
        });
        const rd = await rr.json();
        if (!rr.ok) { setErr(rd.error || 'Registration failed'); return; }
        if (rd.pending) { setSuccessMsg(rd.message || 'Registration submitted! An admin will review your account shortly.'); setStep(3); }
        else window.location.href = '/gallery';
        return;
      }
      const r = await secureFetch('/api/hwasi/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, displayName: form.displayName || form.username }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Failed to send OTP'); return; }
      setStep(2);
      setInfo(`OTP sent to ${form.email} — check inbox & spam folder`);
      startResendCooldown();
    } catch { setErr('Network error. Try again.'); }
    finally { setLoading(false); }
  }

  function handleOtpChange(i, val) {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp]; next[i] = val.slice(-1); setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i, e) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }

  async function verifyAndRegister() {
    setErr(''); setInfo('');
    const otpValue = otp.join('');
    if (otpValue.length !== 6) { setErr('Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      // 1. Verify OTP
      const vr = await fetch('/api/hwasi/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, otp: otpValue }),
      });
      const vd = await vr.json();
      if (!vr.ok) { setErr(vd.error || 'Wrong OTP'); return; }

      // 2. Complete registration
      const rr = await secureFetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, emailVerified: true }),
      });
      const rd = await rr.json();
      if (!rr.ok) { setErr(rd.error || 'Registration failed'); return; }
      if (rd.pending) {
        setSuccessMsg(rd.message || 'Registration submitted! An admin will review and approve your account shortly.');
        setStep(3);
      } else {
        window.location.href = '/gallery';
      }
    } catch { setErr('Network error. Try again.'); }
    finally { setLoading(false); }
  }

  async function resendOtp() {
    if (resendCd > 0) return;
    setErr(''); setInfo('');
    setLoading(true);
    try {
      const r = await secureFetch('/api/hwasi/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, displayName: form.displayName }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Failed to resend'); return; }
      setOtp(['','','','','','']);
      setInfo('New OTP sent!');
      startResendCooldown();
    } catch { setErr('Network error'); }
    finally { setLoading(false); }
  }

  // ── STEP 3: Done ──────────────────────────────────────────────────────────
  if (step === 3) return (
    <main className={styles.main}>
      <div className={styles.orb1} /><div className={styles.orb2} /><div className={styles.orb3} />
      <div className={styles.cardWrap}><div className={styles.card}>
        <div style={{textAlign:'center',padding:'20px',background:'rgba(34,197,94,.1)',border:'1px solid rgba(34,197,94,.2)',borderRadius:16,color:'#4ade80'}}>
          <div style={{fontSize:48,marginBottom:10}}>✨</div>
          <strong style={{display:'block',fontSize:18,marginBottom:8}}>You're on the list!</strong>
          <div style={{fontSize:14,color:'rgba(255,255,255,.7)',lineHeight:1.6}}>{successMsg}</div>
          <a href="/login" style={{display:'inline-block',marginTop:20,background:'linear-gradient(135deg,#7c3aed,#ec4899)',color:'#fff',padding:'10px 28px',borderRadius:10,textDecoration:'none',fontWeight:700}}>Go to Login</a>
        </div>
      </div></div>
    </main>
  );

  return (
    <main className={styles.main}>
      <div className={styles.orb1} /><div className={styles.orb2} /><div className={styles.orb3} />
      <div className={styles.cardWrap}>
        <div className={styles.card}>
          {/* Logo */}
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 2L26 8.5V19.5L14 26L2 19.5V8.5L14 2Z" fill="url(#g1)" stroke="rgba(255,255,255,0.8)" strokeWidth="1"/>
                <path d="M10 10l8 4-8 4V10z" fill="white" opacity="0.9"/>
                <defs><linearGradient id="g1" x1="2" y1="2" x2="26" y2="26"><stop offset="0%" stopColor="#ec4899"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs>
              </svg>
            </div>
            <span className={styles.logoText}>DesiHawas</span>
          </div>

          {/* Step indicator — only show when OTP is required */}
          {otpRequired && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginBottom:20}}>
            {[1,2].map(s => (
              <div key={s} style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,
                  background: step >= s ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : 'rgba(255,255,255,.08)',
                  color: step >= s ? '#fff' : 'rgba(255,255,255,.3)',border: step >= s ? 'none' : '1px solid rgba(255,255,255,.1)'}}>
                  {step > s ? '✓' : s}
                </div>
                {s < 2 && <div style={{width:36,height:2,background: step > s ? 'linear-gradient(90deg,#7c3aed,#ec4899)' : 'rgba(255,255,255,.1)',borderRadius:1}} />}
              </div>
            ))}
          </div>
          )}

          <h1 className={styles.heading}>{step === 1 ? 'Create Account' : 'Verify Email'}</h1>
          <p className={styles.sub}>
            {step === 1 ? 'Join the exclusive premium gallery' : `Enter the 6-digit code sent to ${form.email}`}
          </p>

          {/* ── STEP 1: REGISTRATION FORM ── */}
          {step === 1 && (
            <form onSubmit={e => { e.preventDefault(); sendOtp(); }} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Display Name</label>
                <div className={styles.inputWrap}>
                  <input className={`input ${styles.input}`} style={{paddingLeft:16}} placeholder="Your name"
                    value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Username *</label>
                <div className={styles.inputWrap}>
                  <input className={`input ${styles.input}`} style={{paddingLeft:16}} placeholder="e.g. rahul123" required
                    value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'') }))} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email * {otpRequired && <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>OTP will be sent here</span>}</label>
                <div className={styles.inputWrap}>
                  <input className={`input ${styles.input}`} style={{paddingLeft:16}} type="email" placeholder="you@gmail.com" required
                    value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                {form.email && !emailOk(form.email) && (
                  <span style={{fontSize:11,color:'#f87171',marginTop:4,display:'block',paddingLeft:4}}>⚠ Use Gmail, Yahoo, Outlook, iCloud or Proton</span>
                )}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Password *</label>
                <div className={styles.inputWrap}>
                  <input className={`input ${styles.input}`} style={{paddingLeft:16}} type="password" placeholder="Min. 6 characters" required
                    value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                </div>
              </div>
              {err && <div className={styles.error}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{err}</div>}
               <button className={styles.submitBtn} type="submit" disabled={loading}>
                {loading ? (otpRequired ? 'Sending OTP…' : 'Creating account…') : (otpRequired ? '📧 Send Verification Code' : '🚀 Create Account')}
              </button>
              <div className={styles.registerLink}>Already have an account? <a href="/login">Sign in</a></div>
            </form>
          )}

          {/* ── STEP 2: OTP INPUT ── */}
          {step === 2 && (
            <div>
              {info && <div style={{textAlign:'center',color:'#4ade80',fontSize:13,marginBottom:14,padding:'8px 14px',background:'rgba(34,197,94,.08)',borderRadius:10}}>{info}</div>}
              {/* 6-box OTP input */}
              <div style={{display:'flex',gap:8,justifyContent:'center',margin:'20px 0'}}>
                {otp.map((v, i) => (
                  <input key={i} ref={el => otpRefs.current[i] = el}
                    type="text" inputMode="numeric" pattern="\d*" maxLength={1}
                    value={v}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    onPaste={e => {
                      e.preventDefault();
                      const digits = e.clipboardData.getData('text').replace(/\D/g,'').split('').slice(0,6);
                      const next = [...otp]; digits.forEach((d,j) => { if(i+j<6) next[i+j]=d; }); setOtp(next);
                      const focusIdx = Math.min(i + digits.length, 5);
                      otpRefs.current[focusIdx]?.focus();
                    }}
                    style={{width:44,height:52,textAlign:'center',fontSize:22,fontWeight:900,
                      background:'rgba(255,255,255,.06)',border:`1px solid ${v ? 'rgba(124,58,237,.7)' : 'rgba(255,255,255,.12)'}`,
                      borderRadius:10,color:'#fff',outline:'none',caretColor:'#ec4899',
                      boxShadow: v ? '0 0 0 2px rgba(124,58,237,.25)' : 'none',transition:'all .15s'}} />
                ))}
              </div>

              {err && <div className={styles.error}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{err}</div>}

              <button className={styles.submitBtn} onClick={verifyAndRegister} disabled={loading || otp.join('').length < 6}>
                {loading ? 'Verifying…' : '✅ Verify & Create Account'}
              </button>

              <div style={{textAlign:'center',marginTop:16,fontSize:13,color:'rgba(255,255,255,.4)'}}>
                Didn't receive it?{' '}
                {resendCd > 0
                  ? <span style={{color:'rgba(255,255,255,.3)'}}>Resend in {resendCd}s</span>
                  : <button onClick={resendOtp} style={{background:'none',border:'none',color:'#a78bfa',cursor:'pointer',fontWeight:700,fontSize:13}}>Resend OTP</button>
                }
              </div>
              <div style={{textAlign:'center',marginTop:10}}>
                <button onClick={() => { setStep(1); setErr(''); setInfo(''); }} style={{background:'none',border:'none',color:'rgba(255,255,255,.3)',cursor:'pointer',fontSize:12}}>
                  ← Change email or details
                </button>
              </div>
            </div>
          )}

          <div style={{marginTop:28,textAlign:'center',position:'relative'}}>
            <div style={{position:'absolute',top:'50%',left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(236,72,153,.3),transparent)'}} />
            <span style={{background:'#0e0713',padding:'0 10px',position:'relative',fontSize:11,color:'rgba(236,72,153,.6)',letterSpacing:'.1em',textTransform:'uppercase',fontWeight:800}}>Taste The Difference</span>
          </div>
        </div>
      </div>
    </main>
  );
}
