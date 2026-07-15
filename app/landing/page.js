'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './landing.module.css';

// Live countdown — always shows ~23h remaining, live seconds
function useLiveCountdown() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    // Fixed "next reset" = next 23:00 from now (or just 23h from now)
    const target = Date.now() + 23 * 3600 * 1000;
    const tick = () => setSecs(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export default function LandingPage() {
  const [authModal, setAuthModal] = useState(null); // 'gallery' | null
  const [mobileOpen, setMobileOpen] = useState(false);
  const countdown = useLiveCountdown();

  function handleGalleryClick(e) {
    e.preventDefault();
    setAuthModal('gallery');
  }

  return (
    <div className={styles.page}>

      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <a href="/" className={styles.navLogoWrap}>
          <img src="/logo.png" alt="Hwasimulga" className={styles.navLogoImg} />
          <span className={styles.navLogoText}>Hwasimulga</span>
        </a>

        {/* Center nav links */}
        <div className={styles.navCenter}>
          <a href="#features" className={styles.navLink}>Features</a>
          <a href="#pricing" className={styles.navLink}>Pricing</a>
          <a href="/gallery" className={styles.navLink} onClick={handleGalleryClick}>Gallery</a>
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
            <a href="/gallery" onClick={(e) => { handleGalleryClick(e); setMobileOpen(false); }}>Gallery</a>
            <div className={styles.mobileMenuDivider} />
            <a href="/login">Login</a>
            <a href="/register" className={styles.mobileRegBtn}>Register Free</a>
          </div>
        )}
      </nav>

      {/* ── FREE COUNTDOWN BANNER ── */}
      <div className={styles.countdownBanner}>
        <span className={styles.countdownBannerDot} />
        <span>Free access resets in </span>
        <span className={styles.countdownTimer}>{countdown}</span>
        <span> · 5 free videos daily</span>
        <a href="/register" className={styles.countdownUpgrade}>Upgrade →</a>
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
          730+ exclusive videos · HD quality · Daily updates · Secure & private
        </p>

        {/* Premium countdown inside hero */}
        <div className={styles.heroPremiumOffer}>
          <div className={styles.heroPremiumLeft}>
            <span className={styles.heroPremiumIcon}>⏱</span>
            <div>
              <div className={styles.heroPremiumLabel}>Today's free access resets in</div>
              <div className={styles.heroPremiumTimer}>{countdown}</div>
            </div>
          </div>
          <a href="/register" className={styles.heroPremiumCta}>Get Unlimited →</a>
        </div>

        <div className={styles.heroActions}>
          <a href="/register" className={styles.btnHero}>🚀 Get Started Free</a>
          <a href="/gallery" className={styles.btnHeroOutline} onClick={handleGalleryClick}>Browse Gallery →</a>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.stat}><span>730+</span><label>Videos</label></div>
          <div className={styles.statDiv} />
          <div className={styles.stat}><span>HD</span><label>Quality</label></div>
          <div className={styles.statDiv} />
          <div className={styles.stat}><span>Daily</span><label>Updates</label></div>
          <div className={styles.statDiv} />
          <div className={styles.stat}><span>100%</span><label>Secure</label></div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className={styles.features} id="features">
        <h2 className={styles.sectionTitle}>Everything you need</h2>
        <p className={styles.sectionSub}>Built for premium video delivery at scale</p>
        <div className={styles.featureGrid}>
          {[
            { icon: '⚡', title: 'Ultra Fast CDN', desc: 'Global delivery ensures instant loading from anywhere worldwide' },
            { icon: '🔒', title: 'Token-Signed', desc: 'Every link is signed and expires. No direct CDN URLs ever exposed' },
            { icon: '📱', title: 'Mobile First', desc: 'Perfect experience on any device — phone, tablet or desktop' },
            { icon: '🔥', title: 'Daily Updates', desc: 'New exclusive content added every single day' },
            { icon: '⬇️', title: 'HD Download', desc: 'Download any video in full HD for offline viewing' },
            { icon: '👑', title: 'Premium Plans', desc: 'Unlock unlimited access with our affordable plans' },
          ].map(f => (
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
        <h2 className={styles.sectionTitle}>Simple Pricing</h2>
        <p className={styles.sectionSub}>Unlock all videos. Cancel anytime.</p>
        <div className={styles.pricingGrid}>
          <div className={styles.pricingCard}>
            <div className={styles.pricingBadge} style={{ background: '#7c3aed' }}>BASIC</div>
            <div className={styles.pricingPrice}>₹100</div>
            <div className={styles.pricingPeriod}>14 days access</div>
            <ul className={styles.pricingFeatures}>
              <li>✓ Unlimited videos</li>
              <li>✓ HD quality</li>
              <li>✓ Download access</li>
            </ul>
            <a href="/register" className={styles.pricingBtn} style={{ background: '#7c3aed' }}>Get Basic</a>
          </div>

          <div className={`${styles.pricingCard} ${styles.pricingFeatured}`}>
            <div className={styles.pricingPopular}>⭐ MOST POPULAR</div>
            <div className={styles.pricingBadge} style={{ background: '#0ea5e9' }}>PLUS</div>
            <div className={styles.pricingPrice}>₹300</div>
            <div className={styles.pricingPeriod}>60 days access</div>
            <ul className={styles.pricingFeatures}>
              <li>✓ Everything in Basic</li>
              <li>✓ Priority support</li>
              <li>✓ Early access</li>
            </ul>
            <a href="/register" className={styles.pricingBtn} style={{ background: '#0ea5e9' }}>Get Plus</a>
          </div>

          <div className={styles.pricingCard}>
            <div className={styles.pricingBadge} style={{ background: '#f59e0b' }}>PRO</div>
            <div className={styles.pricingPrice}>₹599</div>
            <div className={styles.pricingPeriod}>3 years access</div>
            <ul className={styles.pricingFeatures}>
              <li>✓ Everything in Plus</li>
              <li>✓ Lifetime-style access</li>
              <li>✓ Exclusive content</li>
            </ul>
            <a href="/register" className={styles.pricingBtn} style={{ background: '#f59e0b' }}>Get Pro</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <img src="/logo.png" alt="" style={{width:24,height:24,borderRadius:4,verticalAlign:'middle',marginRight:8}} />
          Hwasimulga
        </div>
        <p>Premium private video platform · Secure · Fast · Private</p>
        <div className={styles.footerLinks}>
          <a href="/login">Login</a>
          <a href="/register">Register</a>
        </div>
      </footer>

      {/* ── AUTH GATE MODAL (when clicking Gallery) ── */}
      {authModal && (
        <div className={styles.authModalBg} onClick={e => { if (e.target === e.currentTarget) setAuthModal(null); }}>
          <div className={styles.authModal}>
            <button className={styles.authModalClose} onClick={() => setAuthModal(null)}>✕</button>
            <img src="/logo.png" alt="" className={styles.authModalLogo} />
            <h2 className={styles.authModalTitle}>Access Gallery</h2>
            <p className={styles.authModalSub}>
              Sign in or create a free account to browse 730+ videos
            </p>

            {/* Live countdown in modal */}
            <div className={styles.authModalCountdown}>
              <span>⏱ Free access resets in</span>
              <strong className={styles.authModalTimer}>{countdown}</strong>
            </div>

            <div className={styles.authModalActions}>
              <a href="/login" className={styles.authModalLogin}>
                🔑 Sign In
              </a>
              <a href="/register" className={styles.authModalRegister}>
                🚀 Register Free
              </a>
            </div>

            <div className={styles.authModalPlans}>
              <div className={styles.authModalPlan} style={{'--c':'#7c3aed'}}>
                <span>⚡ Basic</span><strong>₹100 / 14d</strong>
              </div>
              <div className={styles.authModalPlan} style={{'--c':'#0ea5e9'}}>
                <span>🚀 Plus</span><strong>₹300 / 60d</strong>
              </div>
              <div className={styles.authModalPlan} style={{'--c':'#f59e0b'}}>
                <span>👑 Pro</span><strong>₹599 / 3yr</strong>
              </div>
            </div>
            <p style={{fontSize:11,textAlign:'center',color:'rgba(255,255,255,.3)',marginTop:8}}>
              5 free videos/day without premium
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
