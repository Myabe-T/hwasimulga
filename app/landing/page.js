'use client';
import { useState, useEffect } from 'react';
import styles from './landing.module.css';

// ── Global countdown: 34h cycle, fixed epoch — same for EVERYONE, doesn't reset on refresh
const EPOCH_START = 1704067200; // Jan 1 2025 00:00:00 UTC (seconds)
const PERIOD_SECS = 34 * 3600;  // 34 hours

function useGlobalCountdown() {
  const calc = () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const elapsed = (nowSec - EPOCH_START) % PERIOD_SECS;
    return PERIOD_SECS - elapsed;
  };
  const [secs, setSecs] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setSecs(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return {
    secs,
    label: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`,
    humanLeft: h > 0 ? `${h}h ${m}m left` : `${m}m ${s}s left`,
  };
}

const FEATURES = [
  { icon: '🔥', title: 'Hotter Than Summer', desc: "Huge collection of exclusive videos so steamy, your phone needs a cool-down break after every session 🥵" },
  { icon: '⚡', title: 'Instant Gratification', desc: "Loads so fast you'll forget loading screens exist. Zero wait, maximum... satisfaction." },
  { icon: '📱', title: 'Pocket-Sized Pleasure', desc: "Perfect on any screen — phone, tablet, laptop. Take it anywhere, anytime, nobody's watching 😉" },
  { icon: '🆕', title: 'Always Fresh, Never Boring', desc: "New drops every single day. Like a sneaker release but way more exciting." },
  { icon: '💾', title: 'Download & Keep', desc: "Save your favourites for offline mode. For those long flights where you need... entertainment." },
  { icon: '👑', title: 'VIP Access Unlocked', desc: "Go premium and get all-access. Because you deserve the entire collection, not just the preview." },
];


export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { secs, label, humanLeft } = useGlobalCountdown();

  // Dynamic pricing from admin panel
  const [plans, setPlans] = useState({
    basic: { price: 100, originalPrice: 200, days: 14 },
    plus:  { price: 300, originalPrice: 500, days: 60 },
    pro:   { price: 599, originalPrice: 999, days: 1095 },
  });
  useEffect(() => {
    fetch('/api/hwasi/plans').then(r => r.json()).then(d => {
      if (d.plans) setPlans(d.plans);
    }).catch(() => {});
  }, []);

  const fmtDays = (d) => {
    if (d >= 365) return `${Math.round(d/365)} year${Math.round(d/365)>1?'s':''} access`;
    if (d >= 30)  return `${Math.round(d/30)} month${Math.round(d/30)>1?'s':''} access`;
    return `${d} days access`;
  };

  return (
    <div className={styles.page}>

      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <a href="/" className={styles.navLogoWrap}>
          <img src="/logo.png" alt="Hwasimulga" className={styles.navLogoImg} />
          <span className={styles.navLogoText}>Hwasimulga</span>
        </a>

        <div className={styles.navCenter}>
          <a href="#features" className={styles.navLink}>Features</a>
          <a href="#pricing" className={styles.navLink}>Pricing</a>
          <a href="/gallery" className={styles.navLink}>Gallery</a>
        </div>

        <div className={styles.navRight}>
          <a href="/login" className={styles.btnOutline}>Login</a>
          <a href="/register" className={styles.btnPrimary}>Register Free</a>
        </div>
        <button className={styles.hamburger} onClick={() => setMobileOpen(o => !o)}>
          {mobileOpen ? '✕' : '☰'}
        </button>

        {mobileOpen && (
          <div className={styles.mobileMenu}>
            <a href="#features" onClick={() => setMobileOpen(false)}>Features</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)}>Pricing</a>
            <a href="/gallery" onClick={() => setMobileOpen(false)}>Gallery</a>
            <div className={styles.mobileMenuDivider} />
            <a href="/login">Login</a>
            <a href="/register" className={styles.mobileRegBtn}>Register Free</a>
          </div>
        )}
      </nav>

      {/* ── SALE BANNER ── */}
      <div className={styles.saleBanner}>
        <span className={styles.saleFire}>🔥</span>
        <span className={styles.saleText}>FLASH SALE — prices drop back in</span>
        <span className={styles.saleTimer}>{label}</span>
        <a href="/register" className={styles.saleLink}>Grab it →</a>
      </div>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroGlowLeft} />
        <div className={styles.heroGlowRight} />

        <div className={styles.heroBadge}>
          <img src="/logo.png" alt="" style={{width:16,height:16,borderRadius:3}} />
          Premium Video Platform
        </div>

        <h1 className={styles.heroTitle}>
          Unlimited HD Videos<br />
          <span className={styles.heroGradient}>Anytime, Anywhere</span>
        </h1>

        <p className={styles.heroSub}>
          Huge Collection Of Premium & Viral Videos · HD Quality · Daily Updates · Secure & Private
        </p>

        {/* Countdown hero box */}
        <div className={styles.heroPremiumOffer}>
          <div className={styles.heroPremiumLeft}>
            <span className={styles.heroPremiumIcon}>⏳</span>
            <div>
              <div className={styles.heroPremiumLabel}>Sale price resets in</div>
              <div className={styles.heroPremiumTimer}>{label}</div>
            </div>
          </div>
          <a href="/register" className={styles.heroPremiumCta}>Lock In Price →</a>
        </div>

        <div className={styles.heroActions}>
          <a href="/register" className={styles.btnHero}>🚀 Get Started Free</a>
          <a href="/gallery" className={styles.btnHeroOutline}>Browse Gallery →</a>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.stat}><span>🎬</span><label>Huge Collection</label></div>
          <div className={styles.statDiv} />
          <div className={styles.stat}><span>HD</span><label>Quality</label></div>
          <div className={styles.statDiv} />
          <div className={styles.stat}><span>Daily</span><label>Updates</label></div>
          <div className={styles.statDiv} />
          <div className={styles.stat}><span>100%</span><label>Private</label></div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className={styles.features} id="features">
        <h2 className={styles.sectionTitle}>Why you'll be obsessed 👀</h2>
        <p className={styles.sectionSub}>Honestly, fair warning — this is addictive</p>
        <div className={styles.featureGrid}>
          {FEATURES.map(f => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className={styles.pricing} id="pricing">
        <h2 className={styles.sectionTitle}>🔥 Limited Time Prices</h2>
        <p className={styles.sectionSub}>These deals disappear in <strong style={{color:'#a78bfa'}}>{humanLeft}</strong> — don't say we didn't warn you</p>

        {/* Global timer bar */}
        <div className={styles.pricingTimer}>
          <span>⏳</span>
          <span>Sale ends in</span>
          <span className={styles.pricingTimerClock}>{label}</span>
          <div className={styles.pricingTimerBar}>
            <div className={styles.pricingTimerFill} style={{width: `${((PERIOD_SECS - secs) / PERIOD_SECS) * 100}%`}} />
          </div>
        </div>

        <div className={styles.pricingGrid}>
          {/* Basic */}
          <div className={styles.pricingCard}>
            <div className={styles.pricingBadge} style={{background:'#7c3aed'}}>BASIC</div>
            <div className={styles.pricingPriceWrap}>
              <span className={styles.pricingOld}>₹{plans.basic.originalPrice}</span>
              <span className={styles.pricingPrice}>₹{plans.basic.price}</span>
            </div>
            <div className={styles.pricingPeriod}>{fmtDays(plans.basic.days)}</div>
            <div className={styles.pricingSave}>You save ₹{plans.basic.originalPrice - plans.basic.price} 🎉</div>
            <ul className={styles.pricingFeatures}>
              <li>✓ Huge premium video collection</li>
              <li>✓ HD quality</li>
              <li>✓ Download access</li>
            </ul>
            <a href="/register" className={styles.pricingBtn} style={{background:'#7c3aed'}}>Get Basic</a>
          </div>

          {/* Plus */}
          <div className={`${styles.pricingCard} ${styles.pricingFeatured}`}>
            <div className={styles.pricingPopular}>⭐ MOST POPULAR</div>
            <div className={styles.pricingBadge} style={{background:'#0ea5e9'}}>PLUS</div>
            <div className={styles.pricingPriceWrap}>
              <span className={styles.pricingOld}>₹{plans.plus.originalPrice}</span>
              <span className={styles.pricingPrice}>₹{plans.plus.price}</span>
            </div>
            <div className={styles.pricingPeriod}>{fmtDays(plans.plus.days)}</div>
            <div className={styles.pricingSave}>You save ₹{plans.plus.originalPrice - plans.plus.price} 🎉</div>
            <ul className={styles.pricingFeatures}>
              <li>✓ Everything in Basic</li>
              <li>✓ Priority access</li>
              <li>✓ Early drops</li>
            </ul>
            <a href="/register" className={styles.pricingBtn} style={{background:'#0ea5e9'}}>Get Plus</a>
          </div>

          {/* Pro */}
          <div className={styles.pricingCard}>
            <div className={styles.pricingBadge} style={{background:'#f59e0b'}}>PRO</div>
            <div className={styles.pricingPriceWrap}>
              <span className={styles.pricingOld}>₹{plans.pro.originalPrice}</span>
              <span className={styles.pricingPrice}>₹{plans.pro.price}</span>
            </div>
            <div className={styles.pricingPeriod}>{fmtDays(plans.pro.days)}</div>
            <div className={styles.pricingSave}>You save ₹{plans.pro.originalPrice - plans.pro.price} 🎉</div>
            <ul className={styles.pricingFeatures}>
              <li>✓ Everything in Plus</li>
              <li>✓ Lifetime-style access</li>
              <li>✓ Exclusive content</li>
            </ul>
            <a href="/register" className={styles.pricingBtn} style={{background:'#f59e0b'}}>Get Pro</a>
          </div>
        </div>

        <p className={styles.pricingNote}>
          After the timer hits zero, prices go back to normal. Your plan stays locked at the price you bought. 🔒
        </p>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <img src="/logo.png" alt="" style={{width:24,height:24,borderRadius:4,verticalAlign:'middle',marginRight:8}} />
          Hwasimulga
        </div>
        <p>Premium private video platform · {secs > 0 ? `Sale ends in ${humanLeft}` : 'Sale active'}</p>
        <div className={styles.footerLinks}>
          <a href="/login">Login</a>
          <a href="/register">Register</a>
        </div>
      </footer>
    </div>
  );
}
