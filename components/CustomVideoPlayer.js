'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const remSec = s % 60;
  if (m < 60) {
    return `${m}:${remSec < 10 ? '0' : ''}${remSec}`;
  }
  const h = Math.floor(m / 60);
  const remMin = m % 60;
  return `${h}:${remMin < 10 ? '0' : ''}${remMin}:${remSec < 10 ? '0' : ''}${remSec}`;
}

export default function CustomVideoPlayer({
  src,
  loading = false,
  videoId,
  title,
  isPremium = false,
  isBookmarked = false,
  onBookmark,
  onDownload,
  onPrev,
  onNext,
  onAspectChange,
  autoPlay = true,
}) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const timelineRef = useRef(null);
  const hideControlsTimer = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPos, setHoverPos] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showVolSlider, setShowVolSlider] = useState(false);
  const [showPlaySplash, setShowPlaySplash] = useState(false);

  // YouTube-style double-tap seeking state
  const lastTapRef = useRef({ time: 0, x: 0, y: 0, side: null });
  const singleTapTimerRef = useRef(null);
  const rippleTimerRef = useRef(null);
  const [seekRipple, setSeekRipple] = useState(null); // { side: 'left' | 'right', seconds: 10, key: 123 }

  // Quality states
  const [nativeQuality, setNativeQuality] = useState(1080);
  const [selectedQuality, setSelectedQuality] = useState('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [qualityToast, setQualityToast] = useState('');

  // Controls auto-hide
  const triggerShowControls = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
        setShowQualityMenu(false);
      }, 2800);
    }
  }, [isPlaying]);

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setShowPlaySplash(true);
      setTimeout(() => setShowPlaySplash(false), 500);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowPlaySplash(true);
      setTimeout(() => setShowPlaySplash(false), 500);
    }
  }, []);

  const seekRelative = useCallback((sec) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + sec));
    triggerShowControls();
  }, [triggerShowControls]);

  // Auto-play when new src arrives
  useEffect(() => {
    if (!videoRef.current || !src) return;
    if (autoPlay) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [src, autoPlay]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekRelative(10);
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, seekRelative]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Active defense against IDM (Internet Download Manager) floating panels
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const purgeIdm = () => {
      try {
        const idmNodes = document.querySelectorAll('div[id*="idm" i], div[class*="idm" i], embed[type*="idm" i], [class*="download-panel" i], [id*="download-panel" i]');
        idmNodes.forEach(n => n.remove());

        // Also remove any injected element containing "Download this video" or "Download video from this page"
        const candidates = document.querySelectorAll('div, a, button, span');
        for (let i = 0; i < candidates.length; i++) {
          const el = candidates[i];
          if (el.closest?.('.custom-player-container') && !el.className?.includes('idm')) continue;
          const txt = (el.textContent || '').trim().toLowerCase();
          if (
            txt.includes('download this video with idm') ||
            txt === 'download this video' ||
            txt.includes('download video from this page') ||
            txt.includes('download with idm') ||
            (txt.includes('download all') && txt.includes('mp4 file'))
          ) {
            el.remove();
          }
        }
      } catch (_) {}
    };

    purgeIdm();
    const interval = setInterval(purgeIdm, 250);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            const el = node;
            const text = (el.textContent || '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            const cls = (el.className || '').toLowerCase();
            if (
              id.includes('idm') ||
              cls.includes('idm') ||
              text.includes('download this video') ||
              text.includes('download video from this page') ||
              text.includes('download with idm') ||
              (text.includes('download all') && text.includes('mp4 file'))
            ) {
              try { el.remove(); } catch (_) {}
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (newVol) => {
    if (!videoRef.current) return;
    const v = Math.max(0, Math.min(1, newVol));
    videoRef.current.volume = v;
    setVolume(v);
    if (v === 0) {
      videoRef.current.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const cycleSpeed = () => {
    if (!videoRef.current) return;
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const currIdx = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currIdx + 1) % speeds.length];
    videoRef.current.playbackRate = nextSpeed;
    setPlaybackRate(nextSpeed);
    triggerShowControls();
  };

  const toggleFullscreen = () => {
    if (!playerRef.current) return;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (playerRef.current.requestFullscreen) {
        playerRef.current.requestFullscreen().catch(() => {});
      } else if (playerRef.current.webkitRequestFullscreen) {
        playerRef.current.webkitRequestFullscreen();
      } else if (videoRef.current && videoRef.current.webkitEnterFullscreen) {
        videoRef.current.webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  // YouTube-style Double-Tap (Left: -10s, Right: +10s, Center: Fullscreen)
  const handleGestureAreaClick = (e) => {
    const rect = playerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const width = rect.width;

    const isLeft = clickX < width * 0.4;
    const isRight = clickX > width * 0.6;
    const isCenter = !isLeft && !isRight;

    const now = Date.now();
    const timeDiff = now - lastTapRef.current.time;
    const distDiff = Math.hypot(e.clientX - lastTapRef.current.x, e.clientY - lastTapRef.current.y);

    // Double tap detected (within 350ms and 80px radius)
    if (timeDiff < 350 && distDiff < 80) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }

      if (isLeft) {
        seekRelative(-10);
        setSeekRipple((prev) => ({
          side: 'left',
          seconds: prev && prev.side === 'left' ? prev.seconds + 10 : 10,
          key: now,
        }));
        if (rippleTimerRef.current) clearTimeout(rippleTimerRef.current);
        rippleTimerRef.current = setTimeout(() => setSeekRipple(null), 650);
        lastTapRef.current = { time: now, x: e.clientX, y: e.clientY, side: 'left' };
        return;
      } else if (isRight) {
        seekRelative(10);
        setSeekRipple((prev) => ({
          side: 'right',
          seconds: prev && prev.side === 'right' ? prev.seconds + 10 : 10,
          key: now,
        }));
        if (rippleTimerRef.current) clearTimeout(rippleTimerRef.current);
        rippleTimerRef.current = setTimeout(() => setSeekRipple(null), 650);
        lastTapRef.current = { time: now, x: e.clientX, y: e.clientY, side: 'right' };
        return;
      } else {
        toggleFullscreen();
        lastTapRef.current = { time: 0, x: 0, y: 0, side: null };
        return;
      }
    }

    // First tap: wait for potential double-tap, else trigger single tap
    lastTapRef.current = { time: now, x: e.clientX, y: e.clientY, side: isLeft ? 'left' : isRight ? 'right' : 'center' };

    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = setTimeout(() => {
      // Single tap: toggle play / pause and show controls
      togglePlay();
      triggerShowControls();
      singleTapTimerRef.current = null;
    }, 280);
  };

  // Timeline seeking calculation
  const getTimelinePercent = (e) => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return rect.width > 0 ? offsetX / rect.width : 0;
  };

  const handleTimelineMouseDown = (e) => {
    if (!videoRef.current || !duration) return;
    setIsDragging(true);
    const pct = getTimelinePercent(e);
    const target = pct * duration;
    videoRef.current.currentTime = target;
    setCurrentTime(target);

    const onMouseMove = (moveEvt) => {
      const p = getTimelinePercent(moveEvt);
      const t = p * duration;
      if (videoRef.current) videoRef.current.currentTime = t;
      setCurrentTime(t);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onMouseMove);
      window.removeEventListener('touchend', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onMouseMove);
    window.addEventListener('touchend', onMouseUp);
  };

  const handleTimelineHover = (e) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const pct = rect.width > 0 ? offsetX / rect.width : 0;
    setHoverPos(offsetX);
    setHoverTime(pct * duration);
  };

  // Time & Buffer updates
  const handleTimeUpdate = () => {
    if (!videoRef.current || isDragging) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleProgress = () => {
    if (!videoRef.current || !videoRef.current.duration) return;
    const buf = videoRef.current.buffered;
    if (buf.length > 0) {
      setBuffered((buf.end(buf.length - 1) / videoRef.current.duration) * 100);
    }
  };

  // Calculate quality options ladder: user can only see steps <= video resolution
  const allQualitySteps = [
    { label: '1080p FHD', res: 1080, badge: '1080p' },
    { label: '720p HD',   res: 720,  badge: '720p' },
    { label: '480p SD',   res: 480,  badge: '480p' },
    { label: '360p Low',  res: 360,  badge: '360p' },
  ];

  const maxRes = Math.max(nativeQuality, 480);
  const availableQualities = allQualitySteps.filter(q => q.res <= maxRes);

  const handleSelectQuality = (res) => {
    setSelectedQuality(res);
    setShowQualityMenu(false);
    const label = res === 'auto' ? `Auto (${maxRes}p)` : `${res}p`;
    setQualityToast(`Quality set to ${label}`);
    setTimeout(() => setQualityToast(''), 2200);
  };

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={playerRef}
      onMouseMove={triggerShowControls}
      onTouchStart={triggerShowControls}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '260px',
        maxHeight: isFullscreen ? '100vh' : (isPortrait ? '75vh' : '70vh'),
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        outline: 'none',
      }}
    >
      {/* ── Native video element (hidden native controls, never exposes CDN) ── */}
      {src && !loading ? (
        <video
          ref={videoRef}
          src={src}
          autoPlay={autoPlay}
          playsInline
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          onContextMenu={(e) => e.preventDefault()}
          onTimeUpdate={handleTimeUpdate}
          onProgress={handleProgress}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
              const vh = videoRef.current.videoHeight;
              const vw = videoRef.current.videoWidth;
              if (vh && vh > 0) setNativeQuality(vh);
              if (vw && vh) {
                const ratio = vw / vh;
                setAspectRatio(ratio);
                const portrait = ratio < 0.95;
                setIsPortrait(portrait);
                if (onAspectChange) {
                  onAspectChange({ isPortrait: portrait, ratio, width: vw, height: vh });
                }
              }
              if (autoPlay) {
                videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
              }
            }
          }}
          onCanPlay={() => {
            if (autoPlay && videoRef.current && videoRef.current.paused) {
              videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onEnded={() => {
            setIsPlaying(false);
          }}
          style={{
            width: '100%',
            height: '100%',
            maxHeight: isFullscreen ? '100vh' : (isPortrait ? '75vh' : '70vh'),
            objectFit: 'contain',
            display: 'block',
            background: '#000',
          }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '280px', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              border: '3px solid rgba(236,72,153,.25)',
              borderTop: '3px solid #ec4899',
              borderRadius: '50%',
              animation: 'spin .8s linear infinite',
            }}
          />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,.5)' }}>Loading media...</span>
        </div>
      )}

      {/* ── Transparent Interactive Gesture Layer (Double tap Left: -10s, Right: +10s, Single tap: Play/Pause) ── */}
      {src && !loading && (
        <div
          onClick={handleGestureAreaClick}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: '50px',
            zIndex: 15,
            cursor: isPlaying && !showControls ? 'none' : 'pointer',
            touchAction: 'manipulation',
          }}
        />
      )}

      {/* ── YouTube-Style Double-Tap Seek Ripples ── */}
      {seekRipple && (
        <div
          key={seekRipple.key}
          className={`double-tap-ripple ${seekRipple.side}`}
        >
          <div className="ripple-content">
            <div className="ripple-arrows">
              {seekRipple.side === 'left' ? '◀◀◀' : '▶▶▶'}
            </div>
            <div className="ripple-text">
              {seekRipple.seconds} seconds
            </div>
          </div>
        </div>
      )}

      {/* ── Central Buffering Spinner ── */}
      {isBuffering && (
        <div style={{ position: 'absolute', pointerEvents: 'none', zIndex: 12 }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid rgba(236,72,153,.3)',
              borderTop: '4px solid #ec4899',
              borderRadius: '50%',
              animation: 'spin .7s linear infinite',
            }}
          />
        </div>
      )}

      {/* ── Central Play Splash Indicator ── */}
      {showPlaySplash && (
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            zIndex: 14,
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: 'rgba(0,0,0,.65)',
            backdropFilter: 'blur(8px)',
            border: '2px solid rgba(236,72,153,.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            color: '#fff',
            animation: 'pingFade .45s ease-out forwards',
          }}
        >
          {isPlaying ? '▶' : '⏸'}
        </div>
      )}

      {/* ── Quality Change Toast ── */}
      {qualityToast && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            background: 'rgba(15, 0, 30, 0.92)',
            border: '1px solid rgba(236,72,153,.5)',
            color: '#fbcfe8',
            fontSize: '12px',
            fontWeight: 800,
            padding: '6px 14px',
            borderRadius: '20px',
            zIndex: 25,
            boxShadow: '0 4px 20px rgba(0,0,0,.8)',
            animation: 'fadeIn .2s ease',
          }}
        >
          ⚙️ {qualityToast}
        </div>
      )}

      {/* ── Quality Popup Menu ── */}
      {showQualityMenu && (
        <div
          style={{
            position: 'absolute',
            bottom: '68px',
            right: '72px',
            background: 'linear-gradient(135deg, rgba(26,0,48,0.96), rgba(15,0,26,0.98))',
            border: '1px solid rgba(236,72,153,.4)',
            borderRadius: '12px',
            padding: '8px',
            zIndex: 35,
            minWidth: '140px',
            boxShadow: '0 8px 32px rgba(0,0,0,.8)',
            backdropFilter: 'blur(12px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', padding: '4px 8px 6px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            Video Quality
          </div>
          <button
            type="button"
            onClick={() => handleSelectQuality('auto')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 8px',
              border: 'none',
              background: selectedQuality === 'auto' ? 'rgba(236,72,153,.2)' : 'transparent',
              color: selectedQuality === 'auto' ? '#ec4899' : '#e2e8f0',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            <span>Auto</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,.4)' }}>{maxRes}p</span>
          </button>
          {availableQualities.map((q) => (
            <button
              key={q.res}
              type="button"
              onClick={() => handleSelectQuality(q.res)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 8px',
                border: 'none',
                background: selectedQuality === q.res ? 'rgba(236,72,153,.2)' : 'transparent',
                color: selectedQuality === q.res ? '#ec4899' : '#e2e8f0',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span>{q.label}</span>
              {selectedQuality === q.res && <span>✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* ── Sleek Responsive Custom Controls Bar ── */}
      {src && (
        <div
          className="player-controls-bar"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            padding: '14px 14px 10px 14px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.55) 65%, transparent 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            opacity: showControls || !isPlaying ? 1 : 0,
            transform: showControls || !isPlaying ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            pointerEvents: showControls || !isPlaying ? 'auto' : 'none',
            boxSizing: 'border-box',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Full-Width Timeline Scrubber Bar */}
          <div
            ref={timelineRef}
            onMouseDown={handleTimelineMouseDown}
            onTouchStart={handleTimelineMouseDown}
            onMouseMove={handleTimelineHover}
            onMouseLeave={() => setHoverTime(null)}
            style={{
              position: 'relative',
              width: '100%',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              touchAction: 'none',
            }}
          >
            {/* Scrubber Background Track */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '6px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.22)',
                overflow: 'hidden',
              }}
            >
              {/* Buffered Progress */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${buffered}%`,
                  background: 'rgba(255, 255, 255, 0.38)',
                  borderRadius: '6px',
                  transition: 'width 0.2s ease',
                }}
              />
              {/* Played Progress (Glowing Gradient) */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${playedPct}%`,
                  background: 'linear-gradient(90deg, #ec4899, #8b5cf6)',
                  borderRadius: '6px',
                }}
              />
            </div>

            {/* Glowing Scrubber Thumb Circle */}
            <div
              style={{
                position: 'absolute',
                left: `${playedPct}%`,
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#ec4899',
                boxShadow: '0 0 10px rgba(236,72,153,0.9), 0 0 4px #fff',
                transform: 'translate(-50%, 0)',
                pointerEvents: 'none',
                transition: isDragging ? 'none' : 'transform 0.1s ease',
              }}
            />

            {/* Hover Tooltip Timestamp */}
            {hoverTime !== null && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '24px',
                  left: `${hoverPos}px`,
                  transform: 'translateX(-50%)',
                  background: 'rgba(15, 0, 30, 0.95)',
                  border: '1px solid rgba(236,72,153,0.4)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: 'monospace, sans-serif',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* 2. Control Buttons & Status Row */}
          <div
            className="controls-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'nowrap',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {/* Left Controls: Play/Pause, Rewind/Forward (desktop), Volume, Time */}
            <div className="controls-left" style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              {/* Play / Pause */}
              <button
                type="button"
                onClick={togglePlay}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'transform 0.15s, color 0.15s',
                  flexShrink: 0,
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = '#ec4899'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'scale(1)'; }}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              {/* Desktop Rewind -10s button */}
              <button
                type="button"
                className="desktop-seek"
                onClick={() => seekRelative(-10)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,.8)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '4px 5px',
                  borderRadius: '6px',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#ec4899'}
                onMouseOut={(e) => e.currentTarget.style.color = 'rgba(255,255,255,.8)'}
                title="Rewind 10s (Double-tap left screen / Left Arrow)"
              >
                ↺ 10s
              </button>

              {/* Desktop Fast Forward +10s button */}
              <button
                type="button"
                className="desktop-seek"
                onClick={() => seekRelative(10)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,.8)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '4px 5px',
                  borderRadius: '6px',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#ec4899'}
                onMouseOut={(e) => e.currentTarget.style.color = 'rgba(255,255,255,.8)'}
                title="Forward 10s (Double-tap right screen / Right Arrow)"
              >
                10s ↻
              </button>

              {/* Volume / Mute with Hover Slider */}
              <div
                style={{ display: 'flex', alignItems: 'center', position: 'relative', flexShrink: 0 }}
                onMouseEnter={() => setShowVolSlider(true)}
                onMouseLeave={() => setShowVolSlider(false)}
              >
                <button
                  type="button"
                  onClick={toggleMute}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    fontSize: '15px',
                    cursor: 'pointer',
                    padding: '4px 5px',
                    borderRadius: '6px',
                  }}
                  title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                >
                  {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                </button>

                {showVolSlider && (
                  <div className="volume-slider-wrap" style={{ width: '55px', display: 'flex', alignItems: 'center', marginLeft: '3px' }}>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      style={{
                        width: '100%',
                        height: '4px',
                        accentColor: '#ec4899',
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Monospaced Video Time Display */}
              <div
                className="video-time-display"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: 'monospace, sans-serif',
                  color: '#e2e8f0',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                  marginLeft: '2px',
                  flexShrink: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <span>{formatTime(currentTime)}</span>
                <span className="time-divider" style={{ color: 'rgba(255,255,255,.4)', margin: '0 2px' }}>/</span>
                <span className="time-total">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Controls: Quality, Speed, Fullscreen (Permanently Anchored) */}
            <div className="controls-right" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: 'auto' }}>
              {/* Quality Selector Button */}
              <button
                type="button"
                className="player-btn quality-btn"
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                style={{
                  background: showQualityMenu ? 'rgba(236,72,153,.25)' : 'rgba(255,255,255,.08)',
                  border: showQualityMenu ? '1px solid #ec4899' : '1px solid rgba(255,255,255,.18)',
                  borderRadius: '6px',
                  color: showQualityMenu ? '#ec4899' : '#fff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  flexShrink: 0,
                }}
                title="Change Video Quality"
              >
                <span>⚙️</span>
                <span className="quality-text">{selectedQuality === 'auto' ? `${maxRes}p` : `${selectedQuality}p`}</span>
              </button>

              {/* Playback Speed selector */}
              <button
                type="button"
                className="player-btn speed-btn"
                onClick={cycleSpeed}
                style={{
                  background: 'rgba(255,255,255,.08)',
                  border: '1px solid rgba(255,255,255,.18)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 6px',
                  cursor: 'pointer',
                  fontFamily: 'monospace, sans-serif',
                  flexShrink: 0,
                }}
                title="Playback speed"
              >
                {playbackRate}x
              </button>

              {/* Fullscreen toggle (Always Anchored and Fully Visible on Mobile) */}
              <button
                type="button"
                className="player-btn fullscreen-btn"
                onClick={toggleFullscreen}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '16px',
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: '6px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '28px',
                }}
                title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
              >
                {isFullscreen ? '✕' : '⛶'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Animations & Responsive Mobile Stylesheet ── */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pingFade {
          0% { transform: scale(0.7); opacity: 0.9; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* YouTube-Style Double-Tap Seek Ripples */
        .double-tap-ripple {
          position: absolute;
          top: 0;
          bottom: 50px;
          width: 42%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 22;
          overflow: hidden;
        }
        .double-tap-ripple.left {
          left: 0;
          border-top-right-radius: 50% 100%;
          border-bottom-right-radius: 50% 100%;
          background: radial-gradient(circle at 15% 50%, rgba(236,72,153,0.38) 0%, rgba(139,92,246,0.18) 50%, transparent 100%);
          animation: rippleFadeLeft 0.65s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
        }
        .double-tap-ripple.right {
          right: 0;
          border-top-left-radius: 50% 100%;
          border-bottom-left-radius: 50% 100%;
          background: radial-gradient(circle at 85% 50%, rgba(236,72,153,0.38) 0%, rgba(139,92,246,0.18) 50%, transparent 100%);
          animation: rippleFadeRight 0.65s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
        }
        .ripple-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          color: #ffffff;
          text-shadow: 0 2px 8px rgba(0,0,0,0.85);
          user-select: none;
        }
        .ripple-arrows {
          font-size: 26px;
          letter-spacing: -2px;
          color: #fbcfe8;
          animation: arrowPulse 0.35s ease-in-out infinite alternate;
        }
        .ripple-text {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #fff;
        }
        @keyframes rippleFadeLeft {
          0% { opacity: 0; transform: scale(0.85); }
          30% { opacity: 0.95; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.05); }
        }
        @keyframes rippleFadeRight {
          0% { opacity: 0; transform: scale(0.85); }
          30% { opacity: 0.95; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.05); }
        }
        @keyframes arrowPulse {
          0% { transform: scale(0.9); opacity: 0.7; }
          100% { transform: scale(1.15); opacity: 1; }
        }

        /* ── Mobile Responsive Optimizations (< 640px) ── */
        @media (max-width: 640px) {
          .player-controls-bar {
            padding: 8px 8px 6px 8px !important;
          }
          .controls-row {
            gap: 4px !important;
          }
          .controls-left {
            gap: 4px !important;
          }
          .controls-right {
            gap: 4px !important;
          }
          /* Hide inline text ↺ 10s and 10s ↻ buttons on mobile since double-tap handles seeking */
          .desktop-seek {
            display: none !important;
          }
          /* Hide text words in Bookmark and Download buttons on mobile to keep icons compact */
          .btn-text {
            display: none !important;
          }
          .player-btn {
            padding: 3px 6px !important;
            font-size: 11px !important;
          }
          .video-time-display {
            font-size: 10px !important;
          }
        }

        /* Narrow screens (< 420px) */
        @media (max-width: 420px) {
          .controls-row {
            gap: 3px !important;
          }
          .controls-left {
            gap: 3px !important;
          }
          .controls-right {
            gap: 3px !important;
          }
          .player-btn {
            padding: 2px 5px !important;
            font-size: 10px !important;
          }
          .video-time-display {
            font-size: 9px !important;
          }
          .quality-text {
            font-size: 9px !important;
          }
        }

        /* Ultra-narrow screens (< 360px) */
        @media (max-width: 360px) {
          .time-total, .time-divider {
            display: none !important;
          }
        }

        /* Suppress IDM extension download panel inside the player container */
        div[id*="idm"], div[class*="idm"], .idm_panel, #idm-panel, embed[type*="idm"], object[type*="idm"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>
    </div>
  );
}
