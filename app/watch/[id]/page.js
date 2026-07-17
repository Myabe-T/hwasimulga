'use client';
export const runtime = 'edge';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { secureFetch } from '@/lib/crypto';

export default function WatchPage() {
  const { id } = useParams();
  const [state, setState] = useState('loading');
  const [src, setSrc] = useState(null);
  const [title, setTitle] = useState('');
  const [viewInfo, setViewInfo] = useState(null);

  useEffect(() => {
    if (!id) return;
    async function init() {
      // Get video token from views API (checks limits AND generates stream token server-side)
      try {
        const res = await secureFetch('/api/hwasi/views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: Number(id) }),
        });
        const data = await res.json();
        setViewInfo(data);
        if (!data.allowed) {
          // Check if not auth
          if (res.status === 401) { setState('auth'); return; }
          setState('limit');
          return;
        }
        if (data.token) {
          setSrc('/api/v/' + data.token);
          setState('playing');
          // Load title
          fetch('/api/hwasi/titles').then(x => x.json()).then(td => {
            setTitle((td.titles || {})[String(id)] || `Video #${id}`);
          }).catch(() => {});
        } else {
          setState('auth');
        }
      } catch {
        setState('auth');
      }
    }
    init();
  }, [id]);

  if (state === 'loading') return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#030010'}}>
      <div style={{width:40,height:40,border:'3px solid rgba(236,72,153,.3)',borderTop:'3px solid #ec4899',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (state === 'auth') return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#030010',color:'#fff',textAlign:'center',padding:24}}>
      <div style={{fontSize:60,marginBottom:20}}>🔒</div>
      <h1 style={{fontSize:28,fontWeight:900,marginBottom:12,background:'linear-gradient(to right,#fbcfe8,#ec4899)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Members Only</h1>
      <p style={{color:'rgba(255,255,255,.6)',marginBottom:32,maxWidth:400}}>This video is exclusively for DesiHawas members. Login or create a free account to watch.</p>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
        <a href={`/login?redirect=/watch/${id}`} style={{padding:'14px 28px',background:'linear-gradient(135deg,#ec4899,#8b5cf6)',borderRadius:14,color:'#fff',fontWeight:700,textDecoration:'none',fontSize:16}}>Login to Watch</a>
        <a href="/register" style={{padding:'14px 28px',background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',borderRadius:14,color:'#fff',fontWeight:700,textDecoration:'none',fontSize:16}}>Create Free Account</a>
      </div>
      <a href="/" style={{marginTop:24,color:'rgba(255,255,255,.4)',fontSize:14,textDecoration:'none'}}>← Back to Home</a>
    </div>
  );

  if (state === 'limit') return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#030010',color:'#fff',textAlign:'center',padding:24}}>
      <div style={{fontSize:60,marginBottom:16}}>💎</div>
      <h1 style={{fontSize:26,fontWeight:900,marginBottom:10,background:'linear-gradient(to right,#fbcfe8,#ec4899)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Daily Limit Reached</h1>
      <p style={{color:'rgba(255,255,255,.6)',marginBottom:8,maxWidth:400}}>You've used all {viewInfo?.limit ?? 5} free videos today.{viewInfo?.hoursLeft ? ` Resets in ${viewInfo.hoursLeft}h.` : ''}</p>
      <p style={{color:'rgba(255,255,255,.4)',fontSize:14,marginBottom:28,maxWidth:380}}>Upgrade to Premium for unlimited access to exclusive content!</p>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
        <a href="/premium" style={{padding:'14px 28px',background:'linear-gradient(135deg,#7c3aed,#ec4899)',borderRadius:14,color:'#fff',fontWeight:700,textDecoration:'none',fontSize:16}}>🚀 Get Premium</a>
        <a href="/gallery" style={{padding:'14px 28px',background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',borderRadius:14,color:'#fff',fontWeight:700,textDecoration:'none',fontSize:16}}>Back to Gallery</a>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#000',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'12px 20px',background:'rgba(255,255,255,.05)',borderBottom:'1px solid rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <a href="/gallery" style={{color:'rgba(255,255,255,.6)',textDecoration:'none',fontSize:14}}>← Gallery</a>
          <span style={{color:'rgba(255,255,255,.2)'}}>|</span>
          <span style={{color:'#fff',fontWeight:600,fontSize:14}}>{title}</span>
        </div>
        {!viewInfo?.isPremium && viewInfo?.remaining >= 0 && (
          <span style={{fontSize:12,color:'rgba(255,255,255,.5)',background:'rgba(255,255,255,.06)',padding:'4px 10px',borderRadius:20}}>
            {viewInfo.remaining} free views left
          </span>
        )}
      </div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <video src={src} controls autoPlay playsInline style={{maxWidth:'100%',maxHeight:'calc(100vh - 60px)',outline:'none'}} controlsList="nodownload" onContextMenu={e => e.preventDefault()} />
      </div>
    </div>
  );
}
