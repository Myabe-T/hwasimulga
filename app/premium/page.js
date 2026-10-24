'use client';
import Link from 'next/link';
import { secureFetch } from '@/lib/crypto';
import { useState, useEffect } from 'react';
import styles from './premium.module.css';

// Global 34h countdown
const EPOCH_START = 1704067200;
const PERIOD_SECS = 34 * 3600;
function useTimer() {
  const calc = () => { const n = Math.floor(Date.now()/1000); const e = (n - EPOCH_START) % PERIOD_SECS; return PERIOD_SECS - e; };
  const [secs, setSecs] = useState(calc);
  useEffect(() => { const id = setInterval(() => setSecs(calc()), 1000); return () => clearInterval(id); }, []);
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Format usedAt timestamp nicely
function formatUsedAt(val) {
  if (!val) return '';
  let d = new Date(val);
  if (typeof val === 'number' && val < 10000000000) {
    d = new Date(val * 1000);
  } else if (typeof val === 'string' && !isNaN(Number(val)) && Number(val) < 10000000000) {
    d = new Date(Number(val) * 1000);
  }
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

const PLAN_META = {
  basic: { icon:'⚡', color:'#7c3aed', glow:'rgba(124,58,237,0.5)', features:['Unlimited videos all day','HD streaming up to 1080p','Download videos to device','Full watch history'] },
  plus:  { icon:'🚀', color:'#0ea5e9', glow:'rgba(14,165,233,0.5)',  features:['Everything in Basic','Access to newest uploads first','Priority playback speed','Extended HD 1440p quality'], popular:true },
  pro:   { icon:'👑', color:'#f59e0b', glow:'rgba(245,158,11,0.5)',  features:['Everything in Plus','2 years unlimited access','VIP support line','Exclusive members-only content'] },
};

const TEASER_QUOTES = [
  { icon:'🔥', text:'Thousands of exclusive adult videos — the kind you can\'t find anywhere else.' },
  { icon:'💦', text:'New uploads daily. Fresh, hot, and uncensored. Never run out of content.' },
  { icon:'🎭', text:'Desi, viral, leaked — all in one place. Organized, HD, and ready to stream.' },
  { icon:'🔒', text:'100% private. No ads. No traces. Just you and unlimited pleasure.' },
  { icon:'⚡', text:'Stream instantly. Download for offline. No buffering, no limits.' },
];

export default function PremiumPage() {
  const [plans,        setPlans]        = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [step,         setStep]         = useState('plans');   // plans | pay | rzp_success
  const [status,       setStatus]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [paySettings,  setPaySettings]  = useState({ maintenanceMode: false, upiId: 'admin@upi', qrUrl: '' });
  
  // Access key redemption states
  const [keyCode,      setKeyCode]      = useState('');
  const [keyLoading,   setKeyLoading]   = useState(false);
  const [keyError,     setKeyError]     = useState('');
  const [keyUsedAt,    setKeyUsedAt]    = useState(null);
  const [keySuccess,   setKeySuccess]   = useState(null);

  const [teaserIdx,    setTeaserIdx]    = useState(0);

  // Razorpay states
  const [rzpLoaded,    setRzpLoaded]    = useState(false);
  const [rzpLoading,   setRzpLoading]   = useState(false);
  const [rzpError,     setRzpError]     = useState('');
  const [rzpPaymentId, setRzpPaymentId] = useState('');
  const timer = useTimer();

  // Load initial data
  useEffect(() => {
    Promise.all([
      fetch('/api/hwasi/plans').then(r=>r.json()).catch(()=>({})),
      secureFetch('/api/hwasi/premium?me=1').then(r=>r.json()).catch(()=>({})),
      fetch('/api/hwasi/payment-settings').then(r=>r.json()).catch(()=>({})),
    ]).then(([pd, sub, ps]) => {
      setPlans(pd.plans || null);
      setStatus(sub.premium || null);
      if (ps.settings) setPaySettings(ps.settings);
      setLoading(false);
    });
  }, []);

  // Cycle teaser quotes
  useEffect(() => {
    const id = setInterval(() => setTeaserIdx(i => (i + 1) % TEASER_QUOTES.length), 3500);
    return () => clearInterval(id);
  }, []);

  // Load Razorpay checkout.js script
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.Razorpay) { setRzpLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRzpLoaded(true);
    script.onerror = () => console.warn('Razorpay script failed to load');
    document.head.appendChild(script);
  }, []);

  // ── Access Key verify & redeem ──
  async function redeemKey(codeToUse) {
    let raw = (codeToUse || keyCode || '').trim().toUpperCase();
    if (!raw) {
      setKeyError('Please enter an access key.');
      setKeyUsedAt(null);
      return;
    }
    // Auto prefix if user pasted only code body e.g. 7KM9-2XP4
    if (!raw.startsWith('FC-') && raw.length === 9 && raw.includes('-')) {
      raw = 'FC-' + raw;
      setKeyCode(raw);
    }

    const keyRegex = /^FC-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!keyRegex.test(raw)) {
      setKeyError('Invalid format. Access key must look like FC-XXXX-XXXX.');
      setKeyUsedAt(null);
      return;
    }

    setKeyLoading(true);
    setKeyError('');
    setKeyUsedAt(null);
    try {
      const res = await fetch('/api/hwasi/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: raw }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setKeySuccess(data);
        setStatus({ isPremium: true, expiresAt: data.expiresAt, plan: data.plan });
      } else {
        if (data.usedAt) {
          setKeyUsedAt(data.usedAt);
          setKeyError(`This access key has already been used on ${formatUsedAt(data.usedAt)}`);
        } else {
          setKeyError(data.error || 'Failed to activate access key. Please check the code.');
        }
      }
    } catch {
      setKeyError('Network error. Please check your connection and retry.');
    } finally {
      setKeyLoading(false);
    }
  }

  // ── Razorpay checkout ──
  async function payWithRazorpay() {
    if (!selected || !rzpLoaded) {
      setRzpError(!rzpLoaded ? 'Razorpay is loading, please wait…' : 'Please select a plan first.');
      return;
    }
    setRzpLoading(true); setRzpError('');
    try {
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selected.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRzpError(err.error || 'Could not create payment order. Contact support.');
        setRzpLoading(false);
        return;
      }
      const order = await res.json();
      setRzpLoading(false);

      const options = {
        key:         order.key,
        amount:      order.amount,
        currency:    order.currency || 'INR',
        order_id:    order.orderId,
        name:        'DesiHawas Premium',
        description: `${selected.label} Plan — ${order.days} days access`,
        image:       '/logo.png',
        prefill: {
          name:  order.displayName || order.username || '',
          email: order.email || '',
        },
        notes: { userId: order.userId, plan: order.plan },
        theme: { color: selected.color || '#7c3aed' },
        modal: { backdropclose: false, escape: false },
        handler: async function(response) {
          try {
            const vRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                plan:                order.plan,
              }),
            });
            const vData = await vRes.json();
            if (vData.ok) {
              setRzpPaymentId(response.razorpay_payment_id);
              setStep('rzp_success');
            } else {
              setRzpError(vData.error || 'Payment received but activation failed. Contact support with ID: ' + response.razorpay_payment_id);
            }
          } catch {
            setRzpError('Verification error. Contact support. Payment ID: ' + response.razorpay_payment_id);
          }
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function(resp) {
        setRzpError(`Payment failed: ${resp.error?.description || 'Unknown error'}. Please try again.`);
      });
      rzp.open();
    } catch {
      setRzpError('Failed to open payment. Try the ForCloud checkout link below.');
      setRzpLoading(false);
    }
  }

  // ── Loading screen ──
  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#050010'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:48,height:48,border:'3px solid rgba(236,72,153,.2)',borderTop:'3px solid #ec4899',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 16px'}} />
        <div style={{color:'rgba(255,255,255,.4)',fontSize:14}}>Loading...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const planList = plans ? Object.values(plans) : [];

  /* ── Maintenance Mode Screen ── */
  if (paySettings.maintenanceMode) return (
    <div style={{minHeight:'100vh',background:'linear-gradient(145deg,#050010,#0a0020)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:24}}>
      <div style={{fontSize:80,marginBottom:16}}>🚧</div>
      <h2 style={{fontSize:30,fontWeight:900,marginBottom:10,background:'linear-gradient(to right,#fbbf24,#f59e0b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
        Payment Under Maintenance
      </h2>
      <p style={{fontSize:15,color:'rgba(255,255,255,.5)',maxWidth:380,lineHeight:1.8,marginBottom:28}}>
        We're updating our payment system. Please check back shortly — it won't be long!
      </p>
      <div style={{padding:'14px 28px',background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.25)',borderRadius:16,fontSize:14,color:'#fbbf24',fontWeight:600}}>
        For urgent access, contact admin directly.
      </div>
      <Link href="/gallery" style={{display:'inline-block',marginTop:24,color:'rgba(255,255,255,.4)',fontSize:13,textDecoration:'none'}}>← Back to Gallery</Link>
    </div>
  );

  /* ── Already Premium Screen ── */
  if (status?.isPremium && !keySuccess) return (
    <div style={{minHeight:'100vh',background:'linear-gradient(145deg,#050010,#0a001a)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:24}}>
      <div style={{fontSize:80,marginBottom:16,filter:'drop-shadow(0 0 30px rgba(245,158,11,.6))'}}>👑</div>
      <h2 style={{fontSize:30,fontWeight:900,marginBottom:8,background:'linear-gradient(to right,#fbbf24,#f59e0b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
        You're Already Premium!
      </h2>
      <p style={{fontSize:15,color:'rgba(255,255,255,.5)',maxWidth:380,marginBottom:8,lineHeight:1.7}}>Your premium plan is active. Go enjoy unlimited access!</p>
      {status.expiresAt && (
        <p style={{fontSize:13,color:'#f59e0b',marginBottom:24}}>
          Expires: {new Date(status.expiresAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}
        </p>
      )}
      <Link href="/gallery" style={{padding:'14px 32px',borderRadius:16,background:'linear-gradient(135deg,#7c3aed,#ec4899)',color:'#fff',fontWeight:800,textDecoration:'none',fontSize:15,boxShadow:'0 12px 32px rgba(236,72,153,.35)'}}>
        🎬 Watch Videos Now
      </Link>
    </div>
  );

  /* ── Access Key Activated Screen ── */
  if (keySuccess) return (
    <div style={{minHeight:'100vh',background:'linear-gradient(145deg,#050010,#0a001a)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:24}}>
      <div style={{fontSize:80,marginBottom:16,filter:'drop-shadow(0 0 30px rgba(74,222,128,.5))'}}>🎉</div>
      <h2 style={{fontSize:30,fontWeight:900,marginBottom:8,background:'linear-gradient(to right,#4ade80,#22c55e)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
        Access Key Activated!
      </h2>
      <p style={{fontSize:15,color:'rgba(255,255,255,.7)',maxWidth:440,marginBottom:16,lineHeight:1.7}}>
        {keySuccess.message || `Your ${keySuccess.planName} plan is now active for ${keySuccess.days} days!`}
      </p>
      <div style={{padding:'12px 20px',background:'rgba(74,222,128,.08)',border:'1px solid rgba(74,222,128,.2)',borderRadius:14,fontSize:13,color:'#4ade80',marginBottom:24,fontFamily:'monospace'}}>
        Key: {keySuccess.code} • Plan: {keySuccess.planName} ({keySuccess.days} Days)
      </div>
      <Link href="/gallery" style={{padding:'14px 32px',borderRadius:16,background:'linear-gradient(135deg,#7c3aed,#ec4899)',color:'#fff',fontWeight:800,textDecoration:'none',fontSize:15,boxShadow:'0 12px 32px rgba(124,58,237,.4)'}}>
        🎬 Start Watching Now →
      </Link>
    </div>
  );

  /* ── Razorpay Payment Success Screen ── */
  if (step === 'rzp_success') return (
    <div style={{minHeight:'100vh',background:'linear-gradient(145deg,#050010,#0a001a)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:24}}>
      <div style={{fontSize:80,marginBottom:16,filter:'drop-shadow(0 0 30px rgba(74,222,128,.5))'}}>🎉</div>
      <h2 style={{fontSize:30,fontWeight:900,marginBottom:8,background:'linear-gradient(to right,#4ade80,#22c55e)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
        Payment Successful!
      </h2>
      <p style={{fontSize:15,color:'rgba(255,255,255,.6)',maxWidth:420,marginBottom:16,lineHeight:1.7}}>
        Your <strong style={{color:'#fff'}}>{selected?.label}</strong> plan is now active! Enjoy <strong style={{color:'#4ade80'}}>{selected?.days} days</strong> of unlimited access.
      </p>
      {rzpPaymentId && (
        <div style={{padding:'10px 20px',background:'rgba(74,222,128,.08)',border:'1px solid rgba(74,222,128,.2)',borderRadius:12,fontSize:13,color:'#4ade80',marginBottom:24,fontFamily:'monospace'}}>
          Payment ID: {rzpPaymentId}
        </div>
      )}
      <Link href="/gallery" style={{padding:'14px 32px',borderRadius:16,background:'linear-gradient(135deg,#7c3aed,#ec4899)',color:'#fff',fontWeight:800,textDecoration:'none',fontSize:15,boxShadow:'0 12px 32px rgba(124,58,237,.4)'}}>
        🎬 Start Watching Now →
      </Link>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#050010 0%,#080015 40%,#0a0020 100%)',color:'#fff',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes pulse-glow { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes slide-in { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      `}</style>

      {/* ── Fixed ambient orbs ── */}
      <div style={{position:'fixed',top:'-20%',left:'-10%',width:'50vw',height:'50vw',borderRadius:'50%',background:'radial-gradient(circle,rgba(124,58,237,.18),transparent 65%)',pointerEvents:'none',zIndex:0}} />
      <div style={{position:'fixed',bottom:'-20%',right:'-10%',width:'45vw',height:'45vw',borderRadius:'50%',background:'radial-gradient(circle,rgba(236,72,153,.14),transparent 65%)',pointerEvents:'none',zIndex:0}} />

      {/* ── Header ── */}
      <header style={{position:'sticky',top:0,zIndex:100,backdropFilter:'blur(20px)',background:'rgba(5,0,16,.8)',borderBottom:'1px solid rgba(255,255,255,.06)',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <a href="/gallery" style={{color:'rgba(255,255,255,.5)',textDecoration:'none',fontSize:14,display:'flex',alignItems:'center',gap:6,transition:'color .2s'}}
          onMouseOver={e=>e.currentTarget.style.color='#fff'} onMouseOut={e=>e.currentTarget.style.color='rgba(255,255,255,.5)'}>
          ← Gallery
        </a>
        <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:800,fontSize:16}}>
          <span style={{fontSize:20}}>🌶</span> DesiHawas <span style={{fontSize:11,padding:'2px 8px',borderRadius:6,background:'rgba(236,72,153,.15)',color:'#ec4899',fontWeight:700}}>PREMIUM</span>
        </div>
        <div style={{fontSize:13,color:'rgba(255,255,255,.4)',display:'flex',alignItems:'center',gap:6}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:'#4ade80',display:'inline-block',animation:'pulse-glow 2s ease infinite'}} />
          Live
        </div>
      </header>

      {/* ── PLANS STEP ── */}
      {step === 'plans' && (
        <div style={{position:'relative',zIndex:1,maxWidth:1100,margin:'0 auto',padding:'0 16px 60px'}}>

          {/* ── Hero ── */}
          <div style={{textAlign:'center',padding:'52px 16px 36px'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'6px 16px',borderRadius:20,background:'rgba(236,72,153,.12)',border:'1px solid rgba(236,72,153,.25)',marginBottom:16,fontSize:13,fontWeight:700,color:'#ec4899',letterSpacing:'.05em'}}>
              👑 PREMIUM ACCESS
            </div>
            <h1 style={{fontSize:'clamp(32px,6vw,62px)',fontWeight:900,lineHeight:1.1,margin:'0 0 16px',background:'linear-gradient(135deg,#fff 30%,rgba(255,255,255,.6))',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
              Unlock the Full<br/>
              <span style={{background:'linear-gradient(to right,#ec4899,#8b5cf6,#0ea5e9)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Experience</span>
            </h1>

            {/* Teaser quote */}
            <div style={{minHeight:52,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
              <div key={teaserIdx} style={{maxWidth:520,fontSize:15,color:'rgba(255,255,255,.65)',lineHeight:1.7,animation:'slide-in .4s ease'}}>
                <span style={{marginRight:8}}>{TEASER_QUOTES[teaserIdx].icon}</span>
                {TEASER_QUOTES[teaserIdx].text}
              </div>
            </div>

            {/* Countdown bar */}
            <div style={{display:'inline-flex',alignItems:'center',gap:10,padding:'10px 20px',borderRadius:50,background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.2)',fontSize:14}}>
              <span style={{color:'rgba(255,255,255,.5)'}}>⏰ Sale ends in</span>
              <span style={{fontWeight:900,fontFamily:'monospace',fontSize:17,color:'#fbbf24',letterSpacing:'.05em'}}>{timer}</span>
            </div>
          </div>

          {/* ── Feature highlights ── */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:44}}>
            {[
              {icon:'🎬',label:'Huge Library',sub:'700+ videos'},
              {icon:'🔥',label:'Daily Uploads',sub:'Fresh content every day'},
              {icon:'📱',label:'All Devices',sub:'Phone, tablet, PC'},
              {icon:'⬇️',label:'Download',sub:'Watch offline anytime'},
              {icon:'🔒',label:'100% Private',sub:'No logs, no traces'},
            ].map(f=>(
              <div key={f.label} style={{padding:'16px 14px',borderRadius:14,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',textAlign:'center'}}>
                <div style={{fontSize:26,marginBottom:6}}>{f.icon}</div>
                <div style={{fontWeight:700,fontSize:13,marginBottom:2}}>{f.label}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>{f.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Plan cards ── */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:20,marginBottom:32}}>
            {planList.map(plan => {
              const meta = PLAN_META[plan.id] || {};
              const save = (plan.originalPrice||0) - (plan.price||0);
              return (
                <div key={plan.id}
                  onClick={() => { setSelected({...plan,...meta}); setStep('pay'); setKeyError(''); setKeyUsedAt(null); setRzpError(''); }}
                  style={{
                    position:'relative',cursor:'pointer',borderRadius:20,
                    border:`1px solid ${meta.popular?meta.color:'rgba(255,255,255,.1)'}`,
                    background:meta.popular?`linear-gradient(145deg,rgba(14,165,233,.08),rgba(124,58,237,.06))`:'rgba(255,255,255,.03)',
                    padding:'28px 22px',transition:'all .25s',
                    boxShadow:meta.popular?`0 0 40px ${meta.glow},0 20px 60px rgba(0,0,0,.4)`:'none',
                    transform:meta.popular?'scale(1.03)':'scale(1)',
                  }}
                  onMouseOver={e=>{e.currentTarget.style.transform='scale(1.04)';e.currentTarget.style.borderColor=meta.color;}}
                  onMouseOut={e=>{e.currentTarget.style.transform=meta.popular?'scale(1.03)':'scale(1)';e.currentTarget.style.borderColor=meta.popular?meta.color:'rgba(255,255,255,.1)';}}
                >
                  {meta.popular && (
                    <div style={{position:'absolute',top:-14,left:'50%',transform:'translateX(-50%)',background:`linear-gradient(90deg,${meta.color},#7c3aed)`,color:'#fff',fontSize:11,fontWeight:800,padding:'4px 14px',borderRadius:20,whiteSpace:'nowrap',boxShadow:`0 6px 20px ${meta.glow}`,letterSpacing:'.05em'}}>
                      ⭐ MOST POPULAR
                    </div>
                  )}

                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:meta.color,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:4}}>{plan.label}</div>
                      <div style={{fontSize:34,fontWeight:900,lineHeight:1}}>
                        {plan.originalPrice && <span style={{fontSize:16,color:'rgba(255,255,255,.3)',textDecoration:'line-through',marginRight:6,fontWeight:600}}>₹{plan.originalPrice}</span>}
                        <span style={{color:'#fff'}}>₹{plan.price}</span>
                      </div>
                      <div style={{fontSize:12,color:'rgba(255,255,255,.4)',marginTop:4}}>{plan.days} days access</div>
                    </div>
                    <div style={{fontSize:44}}>{meta.icon}</div>
                  </div>

                  {save > 0 && (
                    <div style={{marginBottom:16,display:'inline-block',padding:'4px 12px',borderRadius:20,background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.25)',color:'#4ade80',fontSize:12,fontWeight:700}}>
                      You save ₹{save} ({Math.round(save/(plan.originalPrice||1)*100)}% off) 🎉
                    </div>
                  )}

                  <ul style={{listStyle:'none',padding:0,margin:'0 0 20px',display:'flex',flexDirection:'column',gap:8}}>
                    {(meta.features||[]).map(f=>(
                      <li key={f} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'rgba(255,255,255,.8)'}}>
                        <span style={{width:18,height:18,borderRadius:'50%',background:`${meta.color}25`,border:`1px solid ${meta.color}50`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:meta.color,flexShrink:0}}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button style={{width:'100%',padding:'14px',borderRadius:14,border:'none',background:`linear-gradient(135deg,${meta.color},${meta.popular?'#7c3aed':meta.color}dd)`,color:'#fff',fontWeight:800,fontSize:15,cursor:'pointer',boxShadow:`0 8px 24px ${meta.glow}`}}>
                    Get {plan.label} →
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── Quick Access Key Redemption ── */}
          <div style={{
            maxWidth: 520, margin: '20px auto 40px',
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 18, padding: '22px 24px', textAlign: 'center'
          }}>
            <div style={{fontSize:15, fontWeight:800, color:'rgba(255,255,255,.9)', marginBottom:4}}>
              🔑 Already Have an Access Key?
            </div>
            <p style={{fontSize:12, color:'rgba(255,255,255,.5)', margin:'0 0 14px', lineHeight:1.6}}>
              Purchased via ForCloud? Enter your <strong style={{color:'#a78bfa'}}>FC-XXXX-XXXX</strong> key to activate your plan instantly:
            </p>
            <div style={{display:'flex', gap:8}}>
              <input
                placeholder="FC-XXXX-XXXX"
                value={keyCode}
                onChange={e => { setKeyCode(e.target.value.toUpperCase()); setKeyError(''); setKeyUsedAt(null); }}
                onKeyDown={e => e.key === 'Enter' && redeemKey()}
                style={{
                  flex:1, padding:'12px 14px', borderRadius:12,
                  background:'rgba(255,255,255,.06)',
                  border:`1px solid ${keyError ? 'rgba(239,68,68,.5)' : 'rgba(255,255,255,.15)'}`,
                  color:'#fff', fontFamily:'monospace', fontSize:15, textAlign:'center',
                  letterSpacing:'.08em', outline:'none'
                }}
              />
              <button
                onClick={() => redeemKey()}
                disabled={keyLoading || !keyCode.trim()}
                style={{
                  padding:'12px 22px', borderRadius:12,
                  background: keyCode.trim() && !keyLoading ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : 'rgba(255,255,255,.08)',
                  color: keyCode.trim() && !keyLoading ? '#fff' : 'rgba(255,255,255,.3)',
                  fontWeight:800, fontSize:13, border:'none',
                  cursor: keyCode.trim() && !keyLoading ? 'pointer' : 'not-allowed',
                  whiteSpace:'nowrap', transition:'all .2s'
                }}
              >
                {keyLoading ? '...' : 'Activate'}
              </button>
            </div>
            {keyError && (
              <div style={{marginTop:12, fontSize:12, color:'#f87171', textAlign:'left', padding:'10px 14px', background:'rgba(239,68,68,.1)', borderRadius:10, border:'1px solid rgba(239,68,68,.25)'}}>
                <div style={{fontWeight:600}}>⚠️ {keyError}</div>
                {keyUsedAt && <div style={{marginTop:4, fontSize:11, color:'rgba(248,113,113,.9)'}}>Redeemed on: <strong style={{color:'#fff'}}>{formatUsedAt(keyUsedAt)}</strong></div>}
              </div>
            )}
          </div>

          {/* ── Trust badges ── */}
          <div style={{textAlign:'center',padding:'24px 16px',borderTop:'1px solid rgba(255,255,255,.06)'}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:16,justifyContent:'center',marginBottom:16}}>
              {['🔒 100% Secure','⚡ Instant Activation','💯 No Hidden Fees','🙈 Private & Discreet'].map(b=>(
                <div key={b} style={{fontSize:13,color:'rgba(255,255,255,.4)',display:'flex',alignItems:'center',gap:6}}>{b}</div>
              ))}
            </div>
            <p style={{fontSize:12,color:'rgba(255,255,255,.25)',maxWidth:500,margin:'0 auto',lineHeight:1.7}}>
              ForCloud and Razorpay payments activate instantly. Prices reset after the timer.
            </p>
          </div>
        </div>
      )}

      {/* ── PAYMENT STEP ── */}
      {step === 'pay' && selected && (
        <div style={{position:'relative',zIndex:1,maxWidth:560,margin:'0 auto',padding:'24px 16px 60px'}}>
          <button onClick={()=>setStep('plans')}
            style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,.5)',background:'none',border:'none',cursor:'pointer',fontSize:14,padding:'8px 0',marginBottom:20,transition:'color .2s'}}
            onMouseOver={e=>e.currentTarget.style.color='#fff'} onMouseOut={e=>e.currentTarget.style.color='rgba(255,255,255,.5)'}
          >← Choose Different Plan</button>

          {/* Plan summary card */}
          <div style={{borderRadius:20,border:`1px solid ${selected.color}40`,background:'rgba(255,255,255,.03)',padding:'22px 22px 20px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{fontSize:38}}>{selected.icon}</div>
              <div>
                <div style={{fontWeight:800,fontSize:18}}>{selected.label} Plan</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,.4)'}}>{selected.days} days access</div>
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              {selected.originalPrice && <div style={{fontSize:13,color:'rgba(255,255,255,.3)',textDecoration:'line-through'}}>₹{selected.originalPrice}</div>}
              <div style={{fontSize:30,fontWeight:900,color:selected.color}}>₹{selected.price}</div>
            </div>
          </div>

          {/* ── OPTION 1: ForCloud Online Checkout ── */}
          <div style={{borderRadius:20,border:'1px solid rgba(14,165,233,.3)',background:'rgba(14,165,233,.05)',padding:'22px',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(14,165,233,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>💳</div>
              <div>
                <div style={{fontWeight:800,fontSize:15,color:'#38bdf8'}}>Pay Online on ForCloud</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,.4)'}}>UPI, Cards, Net Banking & Crypto • Instant Access Key</div>
              </div>
            </div>

            <p style={{fontSize:13,color:'rgba(255,255,255,.65)',lineHeight:1.6,marginBottom:14}}>
              Purchase your access key directly on our official platform. After payment, your unique <strong style={{color:'#38bdf8'}}>FC-XXXX-XXXX</strong> key will be displayed to enter below.
            </p>

            <a
              href={`https://forcloud.pages.dev/checkout?plan=${selected.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:'flex',alignItems:'center',justifyContent:'center',gap:10,
                width:'100%',padding:'15px',borderRadius:14,
                background:`linear-gradient(135deg,#0ea5e9,${selected.color || '#7c3aed'})`,
                color:'#fff',fontWeight:800,fontSize:16,textDecoration:'none',
                boxShadow:'0 8px 24px rgba(14,165,233,.3)',transition:'all .2s',
              }}
            >
              <span>💳 Open ForCloud Checkout (₹{selected.price}) ↗</span>
            </a>
            <div style={{fontSize:11,color:'rgba(255,255,255,.35)',textAlign:'center',marginTop:8}}>
              Opens in a new tab · Complete payment and paste your key below
            </div>
          </div>

          {/* ── OPTION 2: Razorpay Instant (if script loaded) ── */}
          {rzpLoaded && (
            <div style={{borderRadius:20,border:'1px solid rgba(34,197,94,.25)',background:'rgba(34,197,94,.04)',padding:'20px',marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                <div style={{width:30,height:30,borderRadius:'50%',background:'rgba(34,197,94,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>⚡</div>
                <div>
                  <div style={{fontWeight:800,fontSize:14,color:'#4ade80'}}>Pay Directly with Razorpay</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>Instant activation inside this page</div>
                </div>
              </div>

              {rzpError && (
                <div style={{padding:'10px 14px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.25)',borderRadius:10,color:'#f87171',fontSize:13,marginBottom:12}}>
                  ⚠️ {rzpError}
                </div>
              )}

              <button
                onClick={payWithRazorpay}
                disabled={rzpLoading}
                style={{
                  width:'100%',padding:'13px',borderRadius:12,border:'none',
                  background: rzpLoading ? 'rgba(255,255,255,.1)' : 'linear-gradient(135deg,#10b981,#059669)',
                  color:'#fff',fontWeight:800,fontSize:14,cursor:rzpLoading?'not-allowed':'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',gap:10,
                  transition:'all .2s',opacity:rzpLoading?0.6:1,
                }}
              >
                {rzpLoading ? 'Opening Checkout...' : `⚡ Pay ₹${selected.price} via Razorpay`}
              </button>
            </div>
          )}

          {/* ── Divider ── */}
          <div style={{display:'flex',alignItems:'center',gap:12,margin:'20px 0',color:'rgba(255,255,255,.2)',fontSize:12}}>
            <div style={{flex:1,height:1,background:'rgba(255,255,255,.1)'}}/>
            ENTER ACCESS KEY TO ACTIVATE
            <div style={{flex:1,height:1,background:'rgba(255,255,255,.1)'}}/>
          </div>

          {/* ── ACCESS KEY ENTRY (Replaces old manual UTR section) ── */}
          <div style={{borderRadius:20,border:'1px solid rgba(255,255,255,.1)',background:'rgba(255,255,255,.03)',padding:'22px'}}>
            <h3 style={{fontWeight:800,fontSize:15,marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:28,height:28,borderRadius:'50%',background:'rgba(124,58,237,.2)',border:'1px solid rgba(124,58,237,.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>🔑</span>
              Activate Access Key
            </h3>
            <p style={{fontSize:13,color:'rgba(255,255,255,.6)',marginBottom:16,lineHeight:1.6}}>
              Enter the access key (FC-XXXX-XXXX) from your purchase to instantly activate your <strong style={{color:'#fff'}}>{selected.label}</strong> plan:
            </p>

            <input
              style={{
                width:'100%',padding:'14px 16px',borderRadius:12,
                border:`1px solid ${keyError ? 'rgba(239,68,68,.5)' : 'rgba(255,255,255,.15)'}`,
                background:'rgba(255,255,255,.06)',color:'#fff',fontSize:16,
                fontFamily:'monospace',letterSpacing:'.08em',textAlign:'center',
                marginBottom:10,outline:'none',transition:'border-color .2s'
              }}
              placeholder="FC-XXXX-XXXX"
              value={keyCode}
              onFocus={e=>e.target.style.borderColor='rgba(124,58,237,.7)'}
              onBlur={e=>e.target.style.borderColor=keyError?'rgba(239,68,68,.5)':'rgba(255,255,255,.15)'}
              onChange={e=>{ setKeyCode(e.target.value.toUpperCase()); setKeyError(''); setKeyUsedAt(null); }}
              onKeyDown={e=>e.key==='Enter' && redeemKey()}
            />

            {/* Error banner with formatted used date */}
            {keyError && (
              <div style={{
                padding:'12px 14px',background:'rgba(239,68,68,.1)',
                border:'1px solid rgba(239,68,68,.3)',borderRadius:10,
                color:'#f87171',fontSize:13,marginBottom:12,
                display:'flex',flexDirection:'column',gap:4
              }}>
                <div style={{display:'flex',alignItems:'center',gap:6,fontWeight:600}}>
                  <span>⚠️</span>
                  <span>{keyError}</span>
                </div>
                {keyUsedAt && (
                  <div style={{fontSize:12,color:'rgba(248,113,113,.95)',paddingLeft:22}}>
                    Already redeemed on: <strong style={{color:'#fff'}}>{formatUsedAt(keyUsedAt)}</strong>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => redeemKey()}
              disabled={keyLoading || !keyCode.trim()}
              style={{
                width:'100%',padding:'14px',borderRadius:14,border:'none',
                background:keyCode.trim()&&!keyLoading?`linear-gradient(135deg,${selected.color || '#7c3aed'},#ec4899)`:'rgba(255,255,255,.08)',
                color:keyCode.trim()&&!keyLoading?'#fff':'rgba(255,255,255,.3)',
                fontWeight:800,fontSize:15,cursor:keyCode.trim()&&!keyLoading?'pointer':'not-allowed',
                transition:'all .2s',
                boxShadow:keyCode.trim()&&!keyLoading?`0 8px 24px ${selected.glow || 'rgba(124,58,237,.4)'}`:'none'
              }}
            >
              {keyLoading ? (
                <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                  <span style={{width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'spin .7s linear infinite',display:'inline-block'}} />
                  Verifying & Activating...
                </span>
              ) : '⚡ Verify & Activate Access Key'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
