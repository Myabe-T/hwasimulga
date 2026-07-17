'use client';
import { secureFetch } from '@/lib/crypto';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function WatchClient({ shareToken }) {
  const [status, setStatus] = useState('loading'); // loading | playing | upgrade | error | login
  const [videoSrc, setVideoSrc] = useState(null);
  const [viewInfo, setViewInfo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shareToken) { setStatus('error'); setError('Invalid or missing share link.'); return; }
    async function init() {
      try {
        const res = await secureFetch('/api/hwasi/watch-shared', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareToken }),
        });
        const data = await res.json();

        if (res.status === 401 || data.code === 'LOGIN_REQUIRED') {
          setStatus('login');
          return;
        }
        if (!data.allowed) {
          setViewInfo(data);
          setStatus('upgrade');
          return;
        }
        if (data.token) {
          setVideoSrc('/api/v/' + data.token);
          setViewInfo(data);
          setStatus('playing');
        } else {
          setStatus('error');
          setError('Failed to load video stream.');
        }
      } catch (e) {
        setStatus('error');
        setError('Something went wrong. Please try again.');
      }
    }
    init();
  }, [shareToken]);

  const boxStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg,#0a0015 0%,#1a0030 50%,#0d0020 100%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter','Segoe UI',sans-serif", color: '#fff', padding: 20,
  };

  if (status === 'loading') return (
    <div style={boxStyle}>
      <div style={{ width: 48, height: 48, border: '3px solid rgba(236,72,153,.3)', borderTopColor: '#ec4899', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
      <p style={{ color: 'rgba(255,255,255,.5)' }}>Loading video…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (status === 'login') return (
    <div style={boxStyle}>
      <div style={{ maxWidth: 400, width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(236,72,153,.25)', borderRadius: 24, padding: '36px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Login Required</h2>
        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, marginBottom: 24 }}>Please log in to watch this shared video.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link href="/login" style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', borderRadius: 12, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Login</Link>
          <Link href="/register" style={{ padding: '12px 28px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Register</Link>
        </div>
      </div>
    </div>
  );

  if (status === 'upgrade') return (
    <div style={boxStyle}>
      <div style={{ maxWidth: 460, width: '100%', background: 'linear-gradient(145deg,rgba(20,15,30,.98),rgba(10,5,15,.99))', border: '1px solid rgba(236,72,153,.3)', borderRadius: 24, padding: '36px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>💎</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, background: 'linear-gradient(to right,#fbcfe8,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Daily Limit Reached
        </h2>
        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, marginBottom: 8 }}>
          You've used all {viewInfo?.limit ?? 5} free videos today.
          {viewInfo?.hoursLeft ? ` Resets in ${viewInfo.hoursLeft} hours.` : ''}
        </p>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 13, marginBottom: 28 }}>
          🔥 Upgrade to Premium for unlimited access to all videos including exclusive content!
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/premium" style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', borderRadius: 12, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>
            🚀 Get Premium
          </Link>
          <Link href="/gallery" style={{ padding: '12px 28px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>
            Back to Gallery
          </Link>
        </div>
      </div>
    </div>
  );

  if (status === 'error') return (
    <div style={boxStyle}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Oops!</h2>
        <p style={{ color: 'rgba(255,255,255,.6)', marginBottom: 24 }}>{error}</p>
        <Link href="/gallery" style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', borderRadius: 12, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>
          Back to Gallery
        </Link>
      </div>
    </div>
  );

  // Playing
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000' }}>
      <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(10px)' }}>
        <Link href="/gallery" style={{ color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Back to Gallery
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!viewInfo?.isPremium && viewInfo?.remaining >= 0 && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', background: 'rgba(255,255,255,.06)', padding: '4px 10px', borderRadius: 20 }}>
              {viewInfo.remaining} free views left today
            </span>
          )}
          <Link href="/premium" style={{ background: 'linear-gradient(90deg,#ec4899,#8b5cf6)', padding: '7px 16px', borderRadius: 20, color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
            💎 Premium
          </Link>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000' }}>
        <video
          src={videoSrc}
          controls
          autoPlay
          playsInline
          style={{ maxWidth: '100%', maxHeight: '100%', width: '100%', backgroundColor: '#000' }}
          controlsList="nodownload"
          onError={() => { setStatus('error'); setError('Failed to load video stream. The link may have expired.'); }}
        />
      </div>
    </div>
  );
}
