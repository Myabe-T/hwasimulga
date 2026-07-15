'use client';
import { useState, useEffect } from 'react';
import styles from './premium.module.css';

const PLANS = [
  {
    id: 'basic',
    label: 'Basic',
    price: 100,
    days: 14,
    period: '14 Days',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.4)',
    features: ['Unlimited videos', 'HD streaming', 'Download access', 'Watch history'],
    icon: '⚡',
  },
  {
    id: 'plus',
    label: 'Plus',
    price: 300,
    days: 60,
    period: '2 Months',
    color: '#0ea5e9',
    glow: 'rgba(14,165,233,0.4)',
    features: ['Everything in Basic', '2 months access', 'Priority support', 'Early access features'],
    icon: '🚀',
    popular: true,
  },
  {
    id: 'pro',
    label: 'Pro',
    price: 599,
    days: 1095,
    period: '3 Years',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.4)',
    features: ['Everything in Plus', '3 years access', 'Lifetime updates', 'VIP support'],
    icon: '👑',
  },
];

const UPI_ID = 'admin@upi'; // Replace with real UPI ID

export default function PremiumPage() {
  const [selected, setSelected] = useState(null);
  const [step, setStep]         = useState('plans'); // 'plans' | 'pay' | 'done'
  const [status, setStatus]     = useState(null);    // current sub
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/hwasi/premium?me=1').then(r => r.json()).then(d => {
      setStatus(d.premium);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function selectPlan(plan) {
    setSelected(plan);
    setStep('pay');
  }

  if (loading) return (
    <div className={styles.splash}>
      <div className={styles.spinner} />
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Background orbs */}
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

      {/* Active subscription banner */}
      {status && (
        <div className={styles.activeBanner}>
          <span>✨</span>
          <span>You have <strong>{status.plan?.toUpperCase()}</strong> — expires {new Date(status.expiresAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>
        </div>
      )}

      {step === 'plans' && (
        <>
          <div className={styles.hero}>
            <div className={styles.heroBadge}>✨ Premium</div>
            <h1 className={styles.heroTitle}>Unlock Unlimited Access</h1>
            <p className={styles.heroSub}>Watch all videos without limits. Cancel anytime.</p>
          </div>

          <div className={styles.grid}>
            {PLANS.map(plan => (
              <div
                key={plan.id}
                className={`${styles.card} ${plan.popular ? styles.popular : ''}`}
                style={{ '--plan-color': plan.color, '--plan-glow': plan.glow }}
                onClick={() => selectPlan(plan)}
              >
                {plan.popular && <div className={styles.popularTag}>Most Popular</div>}
                <div className={styles.cardIcon}>{plan.icon}</div>
                <div className={styles.cardLabel}>{plan.label}</div>
                <div className={styles.cardPrice}>
                  <span className={styles.currency}>₹</span>
                  <span className={styles.amount}>{plan.price}</span>
                </div>
                <div className={styles.cardPeriod}>for {plan.period}</div>
                <ul className={styles.features}>
                  {plan.features.map(f => (
                    <li key={f}><span className={styles.check}>✓</span> {f}</li>
                  ))}
                </ul>
                <button className={styles.selectBtn}>Get {plan.label}</button>
              </div>
            ))}
          </div>

          <div className={styles.freeNote}>
            Free users get <strong>5 videos/day</strong>. Premium removes all limits.
          </div>
        </>
      )}

      {step === 'pay' && selected && (
        <div className={styles.payWrap}>
          <button className={styles.backBtn} onClick={() => setStep('plans')}>← Back to plans</button>
          <div className={styles.payCard} style={{ '--plan-color': selected.color, '--plan-glow': selected.glow }}>
            <div className={styles.payHeader}>
              <span className={styles.payIcon}>{selected.icon}</span>
              <div>
                <div className={styles.payLabel}>{selected.label} Plan</div>
                <div className={styles.payPeriod}>{selected.period}</div>
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
              <button className={styles.copyBtn} onClick={() => { navigator.clipboard.writeText(UPI_ID); }}>
                Copy UPI ID
              </button>
            </div>

            <div className={styles.contactBox}>
              <p>After payment, contact admin:</p>
              <a href="https://t.me/youradmin" className={styles.contactBtn} target="_blank" rel="noreferrer">
                📱 Contact on Telegram
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
