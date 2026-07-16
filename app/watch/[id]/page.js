'use client';
export const runtime = 'edge';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function WatchPage() {
  const { id } = useParams();
  const [state, setState] = useState('loading'); // loading | auth | playing
  const [src, setSrc] = useState(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!id) return;
    async function init() {
      const r = await fetch('/api/verify');
      const d = await r.json();
      if (!d.auth) { setState('auth'); return; }
      // Load title
      fetch('/api/hwasi/titles').then(x=>x.json()).then(td=>{
        const titles = td.titles || {};
        setTitle(titles[String(id)] || `Video #${id}`);
      }).catch(()=>{});
      // Load video
      const sd = await fetch(`/api/hwasi/sign/${id}`).then(x=>x.json()).catch(()=>({}));
      if (sd.src) { setSrc(sd.src); setState('playing'); }
      else setState('auth');
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
      <p style={{color:'rgba(255,255,255,.6)',marginBottom:32,maxWidth:400}}>This video is exclusively for Hwasimulga members. Login or create a free account to watch.</p>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
        <a href={`/login?redirect=/watch/${id}`} style={{padding:'14px 28px',background:'linear-gradient(135deg,#ec4899,#8b5cf6)',borderRadius:14,color:'#fff',fontWeight:700,textDecoration:'none',fontSize:16}}>Login to Watch</a>
        <a href="/register" style={{padding:'14px 28px',background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',borderRadius:14,color:'#fff',fontWeight:700,textDecoration:'none',fontSize:16}}>Create Free Account</a>
      </div>
      <a href="/" style={{marginTop:24,color:'rgba(255,255,255,.4)',fontSize:14,textDecoration:'none'}}>← Back to Home</a>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#000',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'12px 20px',background:'rgba(255,255,255,.05)',borderBottom:'1px solid rgba(255,255,255,.08)',display:'flex',alignItems:'center',gap:12}}>
        <a href="/gallery" style={{color:'rgba(255,255,255,.6)',textDecoration:'none',fontSize:14}}>← Gallery</a>
        <span style={{color:'rgba(255,255,255,.2)'}}>|</span>
        <span style={{color:'#fff',fontWeight:600,fontSize:14}}>{title}</span>
      </div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <video src={src} controls autoPlay playsInline style={{maxWidth:'100%',maxHeight:'calc(100vh - 60px)',outline:'none'}} controlsList="nodownload" onContextMenu={e=>e.preventDefault()} />
      </div>
    </div>
  );
}
