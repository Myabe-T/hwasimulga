'use client';
import { useState, useEffect } from 'react';
import styles from './premium.module.css';

const UPI_ID = 'admin@upi';

// Global 34h countdown (same for everyone)
const EPOCH_START = 1704067200;
const PERIOD_SECS = 34 * 3600;
function useTimer() {
  const calc = () => { const n = Math.floor(Date.now()/1000); const e = (n - EPOCH_START) % PERIOD_SECS; return PERIOD_SECS - e; };
  const [secs, setSecs] = useState(calc);
  useEffect(() => { const id = setInterval(() => setSecs(calc()), 1000); return () => clearInterval(id); }, []);
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

const PLAN_META = {
  basic: { icon:'⚡', color:'#7c3aed', glow:'rgba(124,58,237,0.4)', features:['Unlimited videos','HD streaming','Download access','Watch history'] },
  plus:  { icon:'🚀', color:'#0ea5e9', glow:'rgba(14,165,233,0.4)',  features:['Everything in Basic','Priority support','Early access features'], popular:true },
  pro:   { icon:'👑', color:'#f59e0b', glow:'rgba(245,158,11,0.4)',  features:['Everything in Plus','3 years access','VIP support'] },
};

export default function PremiumPage() {
  const [plans,    setPlans]    = useState(null);
  const [selected, setSelected] = useState(null);
  const [step,     setStep]     = useState('plans');
  const [status,   setStatus]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const timer = useTimer();

  useEffect(() => {
    Promise.all([
      fetch('/api/hwasi/plans').then(r=>r.json()).catch(()=>({})),
      fetch('/api/hwasi/premium?me=1').then(r=>r.json()).catch(()=>({})),
    ]).then(([pd, sub]) => {
      setPlans(pd.plans || null);
      setStatus(sub.premium || null);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#030010'}}>
      <div style={{width:40,height:40,border:'3px solid rgba(236,72,153,.3)',borderTop:'3px solid #ec4899',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const planList = plans ? Object.values(plans) : [];

  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />

      {/* Header */}
      <header className={styles.header}>
        <a href="/gallery" className={styles.back}>← Back to Gallery</a>
        <div className={styles.logo}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 2L26 8.5V19.5L14 26L2 19.5V8.5L14 2Z" fill="url(#g1)"/>
            <path d="M10 10l8 4-8 4V10z" fill="white" opacity="0.9"/>
            <defs><linearGradient id="g1" x1="2" y1="2" x2="26" y2="26">
              <stop offset="0%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#ec4899"/>
            </linearGradient></defs>
          </svg>
          <span>Hwasimulga Premium</span>
        </div>
      </header>

      {status && (
        <div className={styles.activeBanner}>
          <span>✨</span>
          <span>You have <strong>{status.plan?.toUpperCase()}</strong> — expires {new Date(status.expiresAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
        </div>
      )}

      {step === 'plans' && (
        <>
          {/* Timer banner */}
          <div style={{textAlign:'center',padding:'12px 20px'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:10,background:'linear-gradient(90deg,rgba(236,72,153,.15),rgba(139,92,246,.15))',border:'1px solid rgba(236,72,153,.3)',borderRadius:30,padding:'8px 20px'}}>
              <span style={{fontSize:16}}>⏰</span>
              <span style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,.7)',letterSpacing:'.05em',textTransform:'uppercase'}}>LIMITED TIME OFFER</span>
              <span style={{fontFamily:"'Space Grotesk',monospace",fontWeight:900,fontSize:16,color:'#f472b6',letterSpacing:'0.08em'}}>{timer}</span>
            </div>
          </div>

          <div className={styles.hero}>
            <h1 className={styles.heroTitle}>Limited Time Prices</h1>
            <p className={styles.heroSub}>These deals disappear in <strong style={{color:'#f472b6'}}>{timer}</strong> — don&apos;t say we didn&apos;t warn you</p>
          </div>

          {/* Progress bar */}
          <div style={{maxWidth:700,margin:'0 auto 32px',padding:'0 20px'}}>
            <div style={{background:'rgba(255,255,255,.08)',borderRadius:20,padding:'10px 18px',display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:16}}>⌛</span>
              <span style={{fontSize:13,color:'rgba(255,255,255,.6)',whiteSpace:'nowrap'}}>Sale ends in <strong style={{color:'#f59e0b'}}>{timer}</strong></span>
              <div style={{flex:1,height:6,borderRadius:6,background:'rgba(255,255,255,.1)',overflow:'hidden'}}>
                <div style={{height:'100%',width:'45%',background:'linear-gradient(90deg,#7c3aed,#f59e0b)',borderRadius:6,transition:'width 1s linear'}} />
              </div>
            </div>
          </div>

          <div className={styles.grid}>
            {planList.map(plan => {
              const meta = PLAN_META[plan.id] || {};
              const save = (plan.originalPrice||0) - (plan.price||0);
              return (
                <div
                  key={plan.id}
                  className={`${styles.card} ${meta.popular ? styles.popular : ''}`}
                  style={{'--plan-color': meta.color, '--plan-glow': meta.glow}}
                  onClick={() => { setSelected({...plan, ...meta}); setStep('pay'); }}
                >
                  {meta.popular && <div className={styles.popularTag}>⭐ MOST POPULAR</div>}
                  <div style={{textAlign:'center',marginBottom:8}}>
                    <span style={{padding:'4px 12px',borderRadius:20,background:`${meta.color}22`,color:meta.color,fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em'}}>{plan.label}</span>
                  </div>
                  <div className={styles.cardIcon}>{meta.icon}</div>
                  <div className={styles.cardPrice}>
                    {plan.originalPrice && <span style={{fontSize:16,color:'rgba(255,255,255,.35)',textDecoration:'line-through',marginRight:6}}>₹{plan.originalPrice}</span>}
                    <span className={styles.currency}>₹</span>
                    <span className={styles.amount}>{plan.price}</span>
                  </div>
                  <div className={styles.cardPeriod}>{plan.days} days access</div>
                  {save > 0 && (
                    <div style={{textAlign:'center',marginTop:6,marginBottom:12}}>
                      <span style={{background:'rgba(34,197,94,.15)',border:'1px solid rgba(34,197,94,.25)',color:'#4ade80',fontSize:12,fontWeight:700,padding:'3px 10px',borderRadius:20}}>You save ₹{save} 🎉</span>
                    </div>
                  )}
                  <ul className={styles.features}>
                    {(meta.features||[]).map(f=>(
                      <li key={f}><span className={styles.check}>✓</span> {f}</li>
                    ))}
                  </ul>
                  <button className={styles.selectBtn} style={{background:meta.color}}>Get {plan.label}</button>
                </div>
              );
            })}
          </div>

          <div className={styles.freeNote}>
            After the timer hits zero, prices go back to normal. Your plan stays locked at the price you bought. 🔒
          </div>
        </>
      )}

      {step === 'pay' && selected && (
        <div className={styles.payWrap}>
          <button className={styles.backBtn} onClick={() => setStep('plans')}>← Back to plans</button>
          <div className={styles.payCard} style={{'--plan-color': selected.color, '--plan-glow': selected.glow}}>
            <div className={styles.payHeader}>
              <span className={styles.payIcon}>{selected.icon}</span>
              <div>
                <div className={styles.payLabel}>{selected.label} Plan</div>
                <div className={styles.payPeriod}>{selected.days} days</div>
              </div>
              <div className={styles.payPrice}>₹{selected.price}</div>
            </div>
            <div className={styles.divider} />
            <div className={styles.payInstructions}>
              <h3>How to pay</h3>
              <ol>
                <li>Send <strong>₹{selected.price}</strong> via UPI to <code>{UPI_ID}</code></li>
                <li>Screenshot your payment confirmation</li>
                <li>Send it to admin via WhatsApp / Telegram</li>
                <li>Admin will activate your plan within 1 hour</li>
              </ol>
            </div>
            <div className={styles.upiBox}>
              <div className={styles.upiLabel}>UPI ID</div>
              <div className={styles.upiId}>{UPI_ID}</div>
              <button className={styles.copyBtn} onClick={() => { navigator.clipboard.writeText(UPI_ID); }}>Copy UPI ID</button>
            </div>
            <div className={styles.contactBox}>
              <p>After payment, contact admin:</p>
              <a href="https://t.me/youradmin" className={styles.contactBtn} target="_blank" rel="noreferrer">📱 Contact on Telegram</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
