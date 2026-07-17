'use client';
import { secureFetch } from '@/lib/crypto';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '../gallery/gallery.module.css'; // Reusing gallery styles for modals

export default function WatchClient({ videoId }) {
  const [user, setUser] = useState(null);
  const [viewStatus, setViewStatus] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loading, setLoading] = useState(true);
  const [videoSrc, setVideoSrc] = useState(null);

  // Browser fingerprint for free tier
  function getFingerprint() {
    try {
      const raw = [screen.width, screen.height, screen.colorDepth, Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language, navigator.hardwareConcurrency || ''].join('|');
      let hash = 0;
      for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0; }
      return 'fp_' + Math.abs(hash).toString(36);
    } catch { return 'fp_unknown'; }
  }

  useEffect(() => {
    async function init() {
      if (!videoId) {
        setLoading(false);
        return; // Invalid token
      }

      // Check views
      const fp = getFingerprint();
      const checkRes = await secureFetch('/api/hwasi/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, fingerprint: fp }),
      }).catch(() => ({ json: () => ({ allowed: true }) }));
      const check = await checkRes.json();
      setViewStatus(check);
      
      if (!check.allowed) {
        setShowUpgrade(true);
      } else if (check.token) {
        setVideoSrc('/api/v/' + check.token);
      }
      
      setLoading(false);
    }
    init();
  }, [videoId]);

  if (loading) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',background:'#0a0a0a',color:'#fff'}}>Loading...</div>;

  if (!videoId) {
    return <div style={{display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',height:'100vh',background:'#0a0a0a',color:'#fff'}}>
      <h2>Invalid or Expired Link</h2>
      <Link href="/gallery" style={{marginTop:20,color:'#ec4899'}}>Return to Gallery</Link>
    </div>;
  }

  if (showUpgrade) {
    return (
      <div className={styles.page}>
        <div className={styles.modalBg}>
          <div className={styles.upgradeBox} style={{ maxWidth: 520, background: 'linear-gradient(145deg,rgba(20,15,30,.95),rgba(10,5,15,.98))', border: '1px solid rgba(236,72,153,.3)', backdropFilter: 'blur(20px)', padding: '32px 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 44 }}>💎</div>
              <h2 style={{ margin: '8px 0 6px', fontSize: 22, fontWeight: 900, background: 'linear-gradient(to right,#fbcfe8,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Premium Access</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', margin: 0 }}>
                {viewStatus?.hoursLeft
                    ? `You've watched all ${viewStatus?.limit ?? 5} free videos. Come back in ${viewStatus.hoursLeft}h or upgrade now.`
                    : `You've used all your free videos today. Upgrade for unlimited access.`}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              <Link href="/login" style={{ padding: '10px 6px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, textAlign: 'center', color:'#fff', textDecoration:'none' }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Login</div>
              </Link>
              <Link href="/register" style={{ padding: '10px 6px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: 12, textAlign: 'center', color:'#fff', textDecoration:'none' }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Register</div>
              </Link>
              <Link href="/gallery" style={{ padding: '10px 6px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, textAlign: 'center', color:'#fff', textDecoration:'none' }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Gallery</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#000'}}>
      <div style={{padding:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <Link href="/gallery" style={{color:'#fff',textDecoration:'none',fontWeight:600}}>← Back to Gallery</Link>
        <Link href="/gallery" style={{background:'linear-gradient(90deg,#ec4899,#8b5cf6)',padding:'8px 16px',borderRadius:20,color:'#fff',textDecoration:'none',fontWeight:700,fontSize:14}}>View More</Link>
      </div>
      <div style={{flex:1,display:'flex',justifyContent:'center',alignItems:'center'}}>
        {videoSrc ? (
          <video 
            src={videoSrc} 
            controls 
            autoPlay 
            style={{maxWidth:'100%',maxHeight:'100%',width:'100%',backgroundColor:'#000'}} 
            controlsList="nodownload"
          />
        ) : (
          <div style={{color:'#fff'}}>Failed to load video stream</div>
        )}
      </div>
    </div>
  );
}
