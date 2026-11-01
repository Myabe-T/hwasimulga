'use client';

import { useEffect, useState } from 'react';

export default function SecurityGuard() {
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

  useEffect(() => {
    // 1. Block right click across the entire site
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };
    document.addEventListener('contextmenu', handleContextMenu, true);

    // 2. Block inspection and source view keyboard shortcuts
    const handleKeyDown = (e) => {
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl) {
        // Ctrl+Shift+I (Inspect), Ctrl+Shift+J (Console), Ctrl+Shift+C (Inspect Element)
        if (e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        // Ctrl+U (View Source)
        if (e.key.toLowerCase() === 'u') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        // Ctrl+S (Save Page)
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);

    // 3. DevTools open detector
    let detected = false;
    const checkDevTools = () => {
      let open = false;

      // Check A: Docked DevTools (threshold > 180px)
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > 180 || heightDiff > 180) {
        open = true;
      }

      // Check B: Undocked DevTools via console getter trick
      let getterTriggered = false;
      const obj = {};
      Object.defineProperty(obj, 'id', {
        get: () => {
          getterTriggered = true;
          return '';
        },
      });
      // Trigger console inspection evaluation
      try {
        console.dir(obj);
      } catch {}
      if (getterTriggered) {
        open = true;
      }

      if (open !== detected) {
        detected = open;
        setIsDevToolsOpen(open);
        if (open) {
          // Pause all media playback
          document.querySelectorAll('video, audio').forEach(el => {
            try { el.pause(); } catch {}
          });
        }
      }
    };

    const interval = setInterval(checkDevTools, 800);
    window.addEventListener('resize', checkDevTools);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      clearInterval(interval);
      window.removeEventListener('resize', checkDevTools);
    };
  }, []);

  if (!isDevToolsOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        background: 'rgba(3, 0, 16, 0.98)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#fff',
        textAlign: 'center',
        userSelect: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        style={{
          maxWidth: '460px',
          width: '100%',
          background: 'linear-gradient(135deg, rgba(26, 0, 48, 0.95), rgba(15, 0, 26, 0.98))',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '24px',
          padding: '40px 28px',
          boxShadow: '0 0 80px rgba(239, 68, 68, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '38px',
            marginBottom: '20px',
            boxShadow: '0 0 30px rgba(239, 68, 68, 0.3)',
          }}
        >
          🛡️
        </div>

        <h2
          style={{
            fontSize: '22px',
            fontWeight: 900,
            marginBottom: '10px',
            background: 'linear-gradient(135deg, #f87171, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.02em',
          }}
        >
          Developer Tools Detected
        </h2>

        <p
          style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.7)',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}
        >
          Developer tools and element inspection are strictly disabled on <strong>DesiHawas</strong> to protect copyrighted media content and user privacy.
        </p>

        <div
          style={{
            padding: '12px 18px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            fontSize: '13px',
            color: '#fbcfe8',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⚠️</span>
          <span>Please close Developer Tools / Inspect to continue browsing.</span>
        </div>
      </div>
    </div>
  );
}
