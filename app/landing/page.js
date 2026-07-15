'use client';
import { useState } from 'react';
import styles from './landing.module.css';

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.page}>
      {/* ── NAVBAR ── */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <div className={styles.logoIcon}>🔥</div>
          <span className={styles.logoText}>Hwasimulga</span>
        </div>
        <div className={styles.navLinks}>
          <a href="/gallery" className={styles.navLink}>Gallery</a>
          <a href="/login" className={styles.btnOutline}>Login</a>
          <a href="/register" className={styles.btnPrimary}>Register Free</a>
        </div>
        <button className={styles.hamburger} onClick={() => setMenuOpen(o => !o)}>☰</button>
        {menuOpen && (
          <div className={styles.mobileMenu}>
            <a href="/login" onClick={() => setMenuOpen(false)}>Login</a>
            <a href="/register" onClick={() => setMenuOpen(false)}>Register Free</a>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroBadge}>🔥 Premium Video Platform</div>
        <h1 className={styles.heroTitle}>
          Unlimited HD Videos<br />
          <span className={styles.heroGradient}>Anytime, Anywhere</span>
        </h1>
        <p className={styles.heroSub}>
          730+ exclusive videos · HD quality · Daily updates · Secure & private
        </p>
        <div className={styles.heroActions}>
          <a href="/register" className={styles.btnHero}>🚀 Get Started Free</a>
          <a href="/login" className={styles.btnHeroOutline}>Sign In →</a>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.stat}><span>730+</span><label>Videos</label></div>
          <div className={styles.statDivider} />
          <div className={styles.stat}><span>HD</span><label>Quality</label></div>
          <div className={styles.statDivider} />
          <div className={styles.stat}><span>Daily</span><label>Updates</label></div>
          <div className={styles.statDivider} />
          <div className={styles.stat}><span>100%</span><label>Secure</label></div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Everything you need</h2>
        <div className={styles.featureGrid}>
          {[
            { icon: '⚡', title: 'Ultra Fast', desc: 'Global CDN ensures instant video loading worldwide' },
            { icon: '🔒', title: 'Private & Secure', desc: 'Every video is token-signed. No direct links ever exposed' },
            { icon: '📱', title: 'Mobile First', desc: 'Perfect experience on any device — phone, tablet, desktop' },
            { icon: '🔥', title: 'Daily Updates', desc: 'New exclusive content added every single day' },
            { icon: '⬇️', title: 'HD Download', desc: 'Download any video in full HD quality for offline viewing' },
            { icon: '👑', title: 'Premium Access', desc: 'Unlock unlimited videos with our affordable plans' },
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
      <section className={styles.pricing}>
        <h2 className={styles.sectionTitle}>Simple Pricing</h2>
        <p className={styles.sectionSub}>Unlock all videos with premium. Cancel anytime.</p>
        <div className={styles.pricingGrid}>
          <div className={styles.pricingCard}>
            <div className={styles.pricingBadge} style={{ background: '#7c3aed' }}>BASIC</div>
            <div className={styles.pricingPrice}>₹100</div>
            <div className={styles.pricingPeriod}>14 days</div>
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
            <div className={styles.pricingPeriod}>60 days</div>
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
            <div className={styles.pricingPeriod}>3 years</div>
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
        <div className={styles.footerLogo}>🔥 Hwasimulga</div>
        <p>Premium private video platform · Secure · Fast · Private</p>
        <div className={styles.footerLinks}>
          <a href="/login">Login</a>
          <a href="/register">Register</a>
        </div>
      </footer>
    </div>
  );
}
