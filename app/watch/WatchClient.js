'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function WatchClient({ shareToken }) {
  const [status, setStatus] = useState('loading');
  const [videoSrc, setVideoSrc] = useState(null);
  const [viewInfo, setViewInfo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shareToken) { setStatus('error'); setError('Invalid or missing share link.'); return; }
    async function init() {
      try {
        const res = await fetch('/api/hwasi/watch-shared', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareToken }),
        });

        let data;
        try {
          const raw = await res.json();
          // Handle AES-encrypted response
          if (raw.cipher && raw.iv) {
            const { decryptPayload } = await import('@/lib/crypto');
            data = await decryptPayload(raw.cipher, raw.iv);
          } else {
            data = raw;
          }
        } catch { data = {}; }

        if (res.status === 401 || data.code === 'LOGIN_REQUIRED') { setStatus('login'); return; }
        if (!data.allowed) { setViewInfo(data); setStatus('upgrade'); return; }
        if (data.token) {
          setVideoSrc('/api/v/' + data.token);
          setViewInfo(data);
          setStatus('playing');
        } else {
          setStatus('error'); setError('Failed to get video stream.');
        }
      } catch (e) {
        setStatus('error'); setError('Something went wrong. Please try again.');
      }
    }
    init();
  }, [shareToken]);

  const S = {
    page: { minHeight: '100vh', background: 'linear-gradient(135deg,#0a0015,#1a0030,#0d0020)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter',sans-serif", color: '#fff', padding: 20 },
    card: { maxWidth: 440, width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(236,72,153,.2)', borderRadius: 24, padding: '36px 28px', textAlign: 'center', backdropFilter: 'blur(20px)' },
    btn1: { padding: '12px 28px', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', borderRadius: 12, color: '#fff', textDecoration: 'none', fontWeight: 700, display: 'inline-block' },
    btn2: { padding: '12px 28px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#fff', textDecoration: 'none', fontWeight: 700, display: 'inline-block' },
  };

  if (status === 'loading') return (
    <div style={S.page}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: '3px solid rgba(236,72,153,.3)', borderTopColor: '#ec4899', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'rgba(255,255,255,.5)' }}>Loading video…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (status === 'login') return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Login Required</h2>
        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, marginBottom: 24 }}>Please log in to watch this shared video.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login" style={S.btn1}>Login</Link>
          <Link href="/register" style={S.btn2}>Register Free</Link>
        </div>
      </div>
    </div>
  );

  if (status === 'upgrade') return (
    <div style={S.page}>
      <div style={{ ...S.card, border: '1px solid rgba(236,72,153,.35)' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>💎</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, background: 'linear-gradient(to right,#fbcfe8,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Daily Limit Reached
        </h2>
        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, marginBottom: 6 }}>
          You've used all {viewInfo?.limit ?? 5} free videos today.
          {viewInfo?.hoursLeft ? ` Resets in ${viewInfo.hoursLeft}h.` : ''}
        </p>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 13, marginBottom: 28 }}>
          Upgrade to Premium for unlimited access!
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/premium" style={S.btn1}>🚀 Get Premium</Link>
          <Link href="/gallery" style={S.btn2}>Back to Gallery</Link>
        </div>
      </div>
    </div>
  );

  if (status === 'error') return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Oops!</h2>
        <p style={{ color: 'rgba(255,255,255,.6)', marginBottom: 24 }}>{error}</p>
        <Link href="/gallery" style={S.btn1}>Back to Gallery</Link>
      </div>
    </div>
  );

  // Playing state — full viewport video
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#000' }}>
      <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(10px)', flexShrink: 0 }}>
        <Link href="/gallery" style={{ color: 'rgba(255,255,255,.7)', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
          ← Gallery
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!viewInfo?.isPremium && viewInfo?.remaining >= 0 && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', background: 'rgba(255,255,255,.06)', padding: '3px 10px', borderRadius: 20 }}>
              {viewInfo.remaining} free views left
            </span>
          )}
          <Link href="/premium" style={{ background: 'linear-gradient(90deg,#ec4899,#8b5cf6)', padding: '6px 14px', borderRadius: 20, color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 12 }}>
            💎 Premium
          </Link>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000', overflow: 'hidden' }}>
        <video
          key={videoSrc}
          src={videoSrc}
          controls
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
          controlsList="nodownload"
          onContextMenu={e => e.preventDefault()}
          onError={() => { setStatus('error'); setError('Failed to load video. The link may have expired.'); }}
        />
      </div>
    </div>
  );
}
