'use client';
import { useState, useEffect } from 'react';
import styles from './premium.module.css';

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
  const [plans,        setPlans]        = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [step,         setStep]         = useState('plans');
  const [status,       setStatus]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [paySettings,  setPaySettings]  = useState({ maintenanceMode: false, upiId: 'admin@upi', qrUrl: '' });
  const [utrInput,     setUtrInput]     = useState('');
  const [utrSubmitted, setUtrSubmitted] = useState(false);
  const [utrError,     setUtrError]     = useState('');
  const [utrSending,   setUtrSending]   = useState(false);
  const timer = useTimer();

  useEffect(() => {
    Promise.all([
      fetch('/api/hwasi/plans').then(r=>r.json()).catch(()=>({})),
      fetch('/api/hwasi/premium?me=1').then(r=>r.json()).catch(()=>({})),
      fetch('/api/hwasi/payment-settings').then(r=>r.json()).catch(()=>({})),
    ]).then(([pd, sub, ps]) => {
      setPlans(pd.plans || null);
      setStatus(sub.premium || null);
      if (ps.settings) setPaySettings(ps.settings);
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
  const upiId = paySettings.upiId || 'admin@upi';

  async function submitUtr() {
    if (utrInput.trim().length < 6) { setUtrError('Please enter a valid UTR / Transaction ID (min 6 chars)'); return; }
    setUtrSending(true); setUtrError('');
    try {
      const r = await fetch('/api/hwasi/utr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utrId: utrInput.trim(), plan: selected?.label || selected?.id || 'unknown' }),
      });
      if (r.ok) { setUtrSubmitted(true); }
      else { const d = await r.json(); setUtrError(d.error || 'Failed to submit'); }
    } catch { setUtrError('Network error. Please try again.'); }
    setUtrSending(false);
  }

  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />

      {/* Header */}
      <header className={styles.header}>
        <a href="/gallery" className={styles.back}>← Back to Gallery</a>
        <div className={styles.logo}>
          <img src="/logo.png" alt="" style={{width:22,height:22,borderRadius:5}} />
          <span>Hwasimulga</span>
        </div>
        <div />
      </header>

      {/* ── MAINTENANCE MODE ── */}
      {paySettings.maintenanceMode && (
        <div style={{minHeight:'80vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:24}}>
          <div style={{fontSize:72,marginBottom:16}}>🚧</div>
          <h2 style={{fontSize:28,fontWeight:900,marginBottom:10,background:'linear-gradient(to right,#fbbf24,#f59e0b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Payment System Under Maintenance</h2>
          <p style={{fontSize:15,color:'rgba(255,255,255,.5)',maxWidth:400,lineHeight:1.7,marginBottom:24}}>
            We're currently updating our payment system. Please come back later — we'll be back shortly!
          </p>
          <div style={{padding:'12px 24px',background:'rgba(245,158,11,.1)',border:'1px solid rgba(245,158,11,.3)',borderRadius:14,fontSize:14,color:'#fbbf24',fontWeight:600}}>
            For urgent access, contact admin directly.
          </div>
        </div>
      )}

      {/* ── ALREADY PREMIUM ── */}
      {!paySettings.maintenanceMode && status?.isPremium && (
        <div style={{minHeight:'80vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:24}}>
          <div style={{fontSize:72,marginBottom:16}}>👑</div>
          <h2 style={{fontSize:28,fontWeight:900,marginBottom:10,background:'linear-gradient(to right,#fbbf24,#f59e0b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>You're Already Premium!</h2>
          <p style={{fontSize:15,color:'rgba(255,255,255,.5)',maxWidth:400,lineHeight:1.7,marginBottom:8}}>
            Your premium plan is active. Enjoy unlimited access!
          </p>
          {status.expiresAt && (
            <p style={{fontSize:13,color:'#f59e0b',marginBottom:24}}>
              Expires: {new Date(status.expiresAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}
            </p>
          )}
          <a href="/gallery" style={{padding:'13px 28px',borderRadius:14,background:'linear-gradient(135deg,#7c3aed,#ec4899)',color:'#fff',fontWeight:800,textDecoration:'none',fontSize:15}}>
            → Go Watch Videos
          </a>
        </div>
      )}

      {/* ── PLANS STEP ── */}
      {!paySettings.maintenanceMode && !status?.isPremium && step === 'plans' && (
        <>
          <div className={styles.heroSection}>
            <div className={styles.heroBadge}>👑 Premium Access</div>
            <h1 className={styles.heroTitle}>Unlock Everything</h1>
            <p className={styles.heroSub}>Get unlimited access to all videos · HD quality · No limits</p>
            <div className={styles.timerBar}>
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
                  onClick={() => { setSelected({...plan, ...meta}); setStep('pay'); setUtrSubmitted(false); setUtrInput(''); }}
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

      {/* ── PAYMENT STEP ── */}
      {!paySettings.maintenanceMode && !status?.isPremium && step === 'pay' && selected && (
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

            {/* Instructions */}
            <div className={styles.payInstructions}>
              <h3>How to pay</h3>
              <ol>
                <li>Send <strong>₹{selected.price}</strong> via UPI to <code>{upiId}</code></li>
                <li>Copy the UTR / Transaction ID from your payment app</li>
                <li>Paste it below and click Submit</li>
                <li>Your plan will be activated within <strong>15–30 minutes</strong> ✅</li>
              </ol>
            </div>

            {/* UPI Box */}
            <div className={styles.upiBox}>
              <div className={styles.upiLabel}>UPI ID</div>
              <div className={styles.upiId}>{upiId}</div>
              <button className={styles.copyBtn} onClick={() => { navigator.clipboard.writeText(upiId); }}>Copy UPI ID</button>
            </div>

            {/* QR Code */}
            {paySettings.qrUrl && (
              <div style={{textAlign:'center',margin:'16px 0'}}>
                <p style={{fontSize:13,color:'rgba(255,255,255,.5)',marginBottom:10}}>Or scan QR code:</p>
                <img src={paySettings.qrUrl} alt="Payment QR" style={{width:180,height:180,objectFit:'contain',borderRadius:12,border:'1px solid rgba(255,255,255,.15)',background:'#fff',padding:8}} />
              </div>
            )}

            <div className={styles.divider} />

            {/* UTR Submission */}
            {!utrSubmitted ? (
              <div style={{marginTop:8}}>
                <h3 style={{fontWeight:800,fontSize:15,marginBottom:6}}>📋 Submit Your UTR ID</h3>
                <p style={{fontSize:13,color:'rgba(255,255,255,.5)',marginBottom:12,lineHeight:1.6}}>
                  After payment, enter your UTR / Transaction ID here. We'll verify and activate your plan in <strong style={{color:'#4ade80'}}>15–30 minutes</strong>.
                </p>
                <input
                  style={{width:'100%',padding:'12px 16px',borderRadius:12,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.06)',color:'#fff',fontSize:14,boxSizing:'border-box',marginBottom:10}}
                  placeholder="e.g. 123456789012 (UTR / Ref ID)"
                  value={utrInput}
                  onChange={e=>setUtrInput(e.target.value)}
                />
                {utrError && <div style={{color:'#f87171',fontSize:13,marginBottom:8}}>⚠️ {utrError}</div>}
                <button
                  onClick={submitUtr}
                  disabled={utrSending || !utrInput.trim()}
                  style={{width:'100%',padding:'13px',borderRadius:12,border:'none',background:utrInput.trim()?'linear-gradient(135deg,#7c3aed,#ec4899)':'rgba(124,58,237,.3)',color:'#fff',fontWeight:800,fontSize:15,cursor:utrInput.trim()?'pointer':'not-allowed',transition:'all .2s'}}
                >
                  {utrSending ? 'Submitting...' : '✅ Submit UTR ID'}
                </button>
              </div>
            ) : (
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <div style={{fontSize:48,marginBottom:12}}>🎉</div>
                <h3 style={{fontWeight:900,fontSize:18,marginBottom:6,color:'#4ade80'}}>UTR Submitted!</h3>
                <p style={{fontSize:14,color:'rgba(255,255,255,.6)',lineHeight:1.7}}>
                  We've received your payment claim. Your <strong style={{color:'#fff'}}>{selected.label}</strong> plan will be activated within <strong style={{color:'#4ade80'}}>15–30 minutes</strong>. Don't worry!
                </p>
                <a href="/gallery" style={{display:'inline-block',marginTop:16,padding:'12px 24px',borderRadius:12,background:'linear-gradient(135deg,#7c3aed,#ec4899)',color:'#fff',fontWeight:800,textDecoration:'none'}}>
                  ← Go to Gallery
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
