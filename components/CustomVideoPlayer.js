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
  onDownload,
  onPrev,
  onNext,
  autoPlay = true,
}) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const timelineRef = useRef(null);
  const hideControlsTimer = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
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

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e) => {
      // Don't intercept if user is typing in an input
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
  }, [togglePlay]);

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

  // Controls auto-hide
  const triggerShowControls = () => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 2600);
    }
  };

  const seekRelative = (sec) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + sec));
    triggerShowControls();
  };

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
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
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
        maxHeight: isFullscreen ? '100vh' : '68vh',
        background: '#000',
        display: 'flex',
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
          onContextMenu={(e) => e.preventDefault()}
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
          onTimeUpdate={handleTimeUpdate}
          onProgress={handleProgress}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
              if (autoPlay) {
                videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
              }
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onEnded={() => {
            setIsPlaying(false);
            if (onNext) onNext();
          }}
          style={{
            width: '100%',
            height: '100%',
            maxHeight: isFullscreen ? '100vh' : '68vh',
            objectFit: 'contain',
            display: 'block',
            background: '#000',
            cursor: isPlaying && !showControls ? 'none' : 'pointer',
          }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '320px', gap: '12px' }}>
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

      {/* ── Sleek Custom Controls Bar ── */}
      {src && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            padding: '24px 14px 10px 14px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.45) 55%, transparent 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            opacity: showControls || !isPlaying ? 1 : 0,
            transform: showControls || !isPlaying ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            pointerEvents: showControls || !isPlaying ? 'auto' : 'none',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Full-Width Timeline Scrubber Bar (Never squished, always prominent!) */}
          <div
            ref={timelineRef}
            onMouseDown={handleTimelineMouseDown}
            onTouchStart={handleTimelineMouseDown}
            onMouseMove={handleTimelineHover}
            onMouseLeave={() => setHoverTime(null)}
            style={{
              position: 'relative',
              width: '100%',
              height: '20px',
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
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'nowrap',
            }}
          >
            {/* Left Controls: Play/Pause, Rewind/Forward, Volume, Time */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = '#ec4899'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'scale(1)'; }}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              {/* Rewind -10s */}
              <button
                type="button"
                onClick={() => seekRelative(-10)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,.8)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  fontFamily: 'inherit',
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#ec4899'}
                onMouseOut={(e) => e.currentTarget.style.color = 'rgba(255,255,255,.8)'}
                title="Rewind 10s (Left Arrow)"
              >
                ↺ 10s
              </button>

              {/* Fast Forward +10s */}
              <button
                type="button"
                onClick={() => seekRelative(10)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,.8)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  fontFamily: 'inherit',
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#ec4899'}
                onMouseOut={(e) => e.currentTarget.style.color = 'rgba(255,255,255,.8)'}
                title="Forward 10s (Right Arrow)"
              >
                10s ↻
              </button>

              {/* Volume / Mute with Hover Slider */}
              <div
                style={{ display: 'flex', alignItems: 'center', position: 'relative' }}
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
                    fontSize: '16px',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    borderRadius: '6px',
                  }}
                  title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                >
                  {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                </button>

                {showVolSlider && (
                  <div style={{ width: '60px', display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
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
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: 'monospace, sans-serif',
                  color: '#e2e8f0',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                  marginLeft: '4px',
                }}
              >
                {formatTime(currentTime)} <span style={{ color: 'rgba(255,255,255,.4)' }}>/</span> {formatTime(duration)}
              </div>
            </div>

            {/* Right Controls: Speed, Premium Download, Fullscreen */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Playback Speed selector */}
              <button
                type="button"
                onClick={cycleSpeed}
                style={{
                  background: 'rgba(255,255,255,.1)',
                  border: '1px solid rgba(255,255,255,.18)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 7px',
                  cursor: 'pointer',
                  fontFamily: 'monospace, sans-serif',
                }}
                title="Playback speed"
              >
                {playbackRate}x
              </button>

              {/* Dedicated Download Button (Gated to Premium) */}
              {onDownload && (
                <button
                  type="button"
                  onClick={onDownload}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: isPremium ? 'linear-gradient(135deg, #7c3aed, #ec4899)' : 'rgba(255,255,255,.1)',
                    border: isPremium ? 'none' : '1px solid rgba(236,72,153,.35)',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '5px 11px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'transform 0.15s, opacity 0.15s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  title={isPremium ? 'Download Video (MP4)' : 'Upgrade to Premium to Download'}
                >
                  <span>⬇</span>
                  <span>Download</span>
                  {!isPremium && <span style={{ fontSize: '10px', color: '#f59e0b' }}>👑</span>}
                </button>
              )}

              {/* Fullscreen toggle */}
              <button
                type="button"
                onClick={toggleFullscreen}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '16px',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '6px',
                }}
                title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
              >
                {isFullscreen ? '✕' : '⛶'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pingFade {
          0% { transform: scale(0.7); opacity: 0.9; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
