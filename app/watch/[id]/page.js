'use client';
export const runtime = 'edge';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { secureFetch } from '@/lib/crypto';
import CustomVideoPlayer from '@/components/CustomVideoPlayer';

// Common significant erotic/tag keywords for smart related video matching
const KEYWORDS = [
  'bhabhi', 'sis', 'sister', 'girlfriend', 'gf', 'boob', 'boobs', 'sexy', 'hot',
  'tamil', 'mallu', 'desi', 'mms', 'viral', 'milf', 'wife', 'aunt', 'cheating',
  'threesome', 'blowjob', 'creampie', 'pussy', 'dick', 'leaked', 'hard', 'couple',
  'teen', 'maid', 'daughter', 'hidden', 'scandal', 'romance', 'hindi'
];

function extractKeywords(title) {
  if (!title) return [];
  const lower = title.toLowerCase();
  const matched = KEYWORDS.filter(k => lower.includes(k));
  // Also extract alphanumeric words > 3 chars that aren't stop words
  const stopWords = new Set(['with', 'and', 'the', 'for', 'this', 'that', 'from', 'video', 'full', 'your', 'have', 'more']);
  const words = lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  return Array.from(new Set([...matched, ...words]));
}

function timeAgo(dateString) {
  if (!dateString) return 'Just now';
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params?.id;

  const [state, setState] = useState('loading'); // loading | auth | limit | playing | blocked
  const [src, setSrc] = useState(null);
  const [title, setTitle] = useState('');
  const [viewInfo, setViewInfo] = useState(null);
  const [user, setUser] = useState(null);

  // Likes & Dislikes state
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likesCount, setLikesCount] = useState(null);
  const [dislikesCount, setDislikesCount] = useState(null);

  // Bookmarks
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkToast, setBookmarkToast] = useState('');

  // Share
  const [shareCopied, setShareCopied] = useState(false);

  // Report Modal
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('Broken video');
  const [reportSuccess, setReportSuccess] = useState(false);

  // Comments state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const commentsSectionRef = useRef(null);

  // Related videos catalogue
  const [allTitles, setAllTitles] = useState({});
  const [thumbIds, setThumbIds] = useState(new Set());
  const [allVideoIds, setAllVideoIds] = useState([]);
  const [relatedLimit, setRelatedLimit] = useState(12);

  const thumbSrc = useCallback((id) => {
    return Number(id) >= 10000 ? `/api/hwasi/thumb-extra/${id}` : `/api/hwasi/thumbnail/${id}`;
  }, []);

  // 1. Initial Load: Check Auth, Stream Token, Titles, Thumbs
  useEffect(() => {
    if (!videoId) return;
    setState('loading');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    async function loadData() {
      try {
        // Auth check
        const authRes = await secureFetch('/api/verify').then(r => r.json()).catch(() => ({ auth: false }));
        setUser(authRes.auth ? authRes : null);

        // Fetch titles catalogue & thumbnail IDs for related grid
        Promise.all([
          fetch('/api/hwasi/titles').then(r => r.json()).catch(() => ({ titles: {} })),
          fetch('/api/hwasi/thumbnails').then(r => r.json()).catch(() => ({ ids: [] }))
        ]).then(([td, th]) => {
          const titles = td.titles || {};
          setAllTitles(titles);
          if (titles[String(videoId)]) {
            setTitle(titles[String(videoId)]);
          } else {
            setTitle(`Exclusive Video #${videoId}`);
          }
          const tIds = new Set((th.ids || []).map(Number));
          setThumbIds(tIds);
          const vIds = Object.keys(titles).map(Number).sort((a, b) => b - a);
          setAllVideoIds(vIds.length > 0 ? vIds : Array.from({ length: 1177 }, (_, i) => 1177 - i));
        });

        // Request video stream token from views API
        const viewRes = await secureFetch('/api/hwasi/views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: Number(videoId) }),
        });
        const vData = await viewRes.json();
        setViewInfo(vData);

        if (!vData.allowed) {
          if (viewRes.status === 401 || vData.code === 'LOGIN_REQUIRED') {
            setState('auth');
            return;
          }
          if (vData.code === 'INSTAVIRAL_PREMIUM_ONLY') {
            setState('blocked');
            return;
          }
          setState('limit');
          return;
        }

        if (vData.token) {
          setSrc('/api/v/' + vData.token);
          setState('playing');
        } else {
          setState('auth');
        }

        // Check if bookmarked
        fetch('/api/hwasi/bookmarks').then(r => r.json()).then(d => {
          if (d.ids) setIsBookmarked(d.ids.includes(Number(videoId)) || d.ids.includes(String(videoId)));
        }).catch(() => {});

        // Load Likes / Dislikes
        fetch(`/api/hwasi/likes?id=${videoId}`).then(r => r.json()).then(d => {
          setLiked(Boolean(d.liked));
          setDisliked(Boolean(d.disliked));
          if (d.likesCount !== undefined) setLikesCount(d.likesCount);
          if (d.dislikesCount !== undefined) setDislikesCount(d.dislikesCount);
        }).catch(() => {});

        // Load Comments
        fetch(`/api/hwasi/comments?id=${videoId}`).then(r => r.json()).then(d => {
          if (d.comments) setComments(d.comments);
        }).catch(() => {});

      } catch (err) {
        setState('auth');
      }
    }

    loadData();
  }, [videoId]);

  // Smart Related Videos: Rank catalogue videos by keyword similarity
  const relatedVideos = useMemo(() => {
    if (!videoId) return [];
    const currentKeywords = extractKeywords(title);
    const currId = Number(videoId);

    const candidates = [];
    for (const [idStr, t] of Object.entries(allTitles)) {
      const id = Number(idStr);
      if (id === currId) continue;
      const tLower = (t || '').toLowerCase();
      let score = 0;
      for (const kw of currentKeywords) {
        if (tLower.includes(kw)) score++;
      }
      candidates.push({ id, title: t, score });
    }

    // Sort by keyword match score descending, then fallback to recent IDs
    candidates.sort((a, b) => b.score - a.score || b.id - a.id);
    return candidates.map(c => c.id);
  }, [videoId, title, allTitles]);

  // Handle Like click (toggles like, hides count for viewers, visible to admin)
  const handleLike = async () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    if (nextLiked && disliked) setDisliked(false);

    try {
      const action = nextLiked ? 'like' : 'unlike';
      const res = await fetch('/api/hwasi/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: Number(videoId), action }),
      });
      const d = await res.json();
      if (d.likesCount !== undefined) setLikesCount(d.likesCount);
      if (d.dislikesCount !== undefined) setDislikesCount(d.dislikesCount);
    } catch {}
  };

  // Handle Dislike click
  const handleDislike = async () => {
    const nextDisliked = !disliked;
    setDisliked(nextDisliked);
    if (nextDisliked && liked) setLiked(false);

    try {
      const action = nextDisliked ? 'dislike' : 'undislike';
      const res = await fetch('/api/hwasi/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: Number(videoId), action }),
      });
      const d = await res.json();
      if (d.likesCount !== undefined) setLikesCount(d.likesCount);
      if (d.dislikesCount !== undefined) setDislikesCount(d.dislikesCount);
    } catch {}
  };

  // Handle Bookmark toggle (5 free limit, unlimited for premium)
  const handleToggleBookmark = async () => {
    if (!user) {
      router.push(`/login?redirect=/watch/${videoId}`);
      return;
    }
    const nextBm = !isBookmarked;
    setIsBookmarked(nextBm);
    setBookmarkToast(nextBm ? '★ Saved to Bookmarks!' : 'Removed from Bookmarks');
    setTimeout(() => setBookmarkToast(''), 2500);

    try {
      const res = await fetch('/api/hwasi/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: Number(videoId) }),
      });
      const d = await res.json();
      if (!res.ok && d.code === 'BOOKMARK_LIMIT_REACHED') {
        setIsBookmarked(false);
        setBookmarkToast('Free limit reached (max 5). Upgrade to Premium for unlimited bookmarks!');
        setTimeout(() => setBookmarkToast(''), 4000);
      }
    } catch {}
  };

  // Handle Download (Premium only gate)
  const handleDownload = () => {
    if (viewInfo?.isPremium || user?.role === 'admin' || user?.role === 'advisor') {
      window.location.href = `/api/download/${videoId}`;
    } else {
      router.push('/premium');
    }
  };

  // Handle Share link copy
  const handleShare = () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      navigator.share({ title, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  // Handle Submit Comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!user) {
      router.push(`/login?redirect=/watch/${videoId}`);
      return;
    }
    if (!newComment.trim() || commentLoading) return;

    setCommentLoading(true);
    try {
      const res = await fetch('/api/hwasi/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: Number(videoId), text: newComment }),
      });
      const d = await res.json();
      if (d.ok && d.comment) {
        setComments(prev => [d.comment, ...prev]);
        setNewComment('');
      }
    } catch {} finally {
      setCommentLoading(false);
    }
  };

  // Navigate to another video smoothly while updating URL & history
  const handleOpenRelated = (id) => {
    router.push(`/watch/${id}`);
  };

  // ── Auth, Limit, Blocked States ──
  if (state === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#080014', color: '#fff' }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(236,72,153,.3)', borderTop: '3px solid #ec4899', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        <span style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,.5)' }}>Loading media stream...</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (state === 'auth') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0a0015,#18002e)', color: '#fff', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 10, background: 'linear-gradient(to right,#fbcfe8,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Members Only</h1>
        <p style={{ color: 'rgba(255,255,255,.6)', marginBottom: 28, maxWidth: 420 }}>This exclusive video is available for DesiHawas registered members. Sign in or create a free account to watch.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href={`/login?redirect=/watch/${videoId}`} style={{ padding: '12px 26px', background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', borderRadius: 12, color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>Login to Watch</Link>
          <Link href="/register" style={{ padding: '12px 26px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>Create Free Account</Link>
        </div>
        <Link href="/gallery" style={{ marginTop: 24, color: 'rgba(255,255,255,.4)', fontSize: 13, textDecoration: 'none' }}>← Back to Gallery</Link>
      </div>
    );
  }

  if (state === 'limit') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0a0015,#18002e)', color: '#fff', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>💎</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 10, background: 'linear-gradient(to right,#fbcfe8,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Daily Limit Reached</h1>
        <p style={{ color: 'rgba(255,255,255,.6)', marginBottom: 8, maxWidth: 420 }}>You have used all {viewInfo?.limit ?? 5} free videos today.{viewInfo?.hoursLeft ? ` Resets in ${viewInfo.hoursLeft}h.` : ''}</p>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 13, marginBottom: 26, maxWidth: 380 }}>Upgrade to Premium for unlimited access to all 2,000+ exclusive videos!</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/premium" style={{ padding: '12px 26px', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', borderRadius: 12, color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>🚀 Get Premium</Link>
          <Link href="/gallery" style={{ padding: '12px 26px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>Back to Gallery</Link>
        </div>
      </div>
    );
  }

  if (state === 'blocked') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0a0015,#18002e)', color: '#fff', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>👑</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 10, background: 'linear-gradient(to right,#c4b5fd,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Insta Viral — VIP Only</h1>
        <p style={{ color: 'rgba(255,255,255,.6)', marginBottom: 24, maxWidth: 400 }}>This is an exclusive Insta Viral video and requires an active Premium membership.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/premium" style={{ padding: '12px 26px', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', borderRadius: 12, color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>👑 Get Premium VIP</Link>
          <Link href="/gallery" style={{ padding: '12px 26px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>Back to Gallery</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="watch-page-wrapper">
      {/* ── Top Navbar ── */}
      <header className="watch-header">
        <div className="watch-header-inner">
          <div className="watch-brand">
            <Link href="/gallery" className="brand-logo">
              <span className="brand-icon">🔥</span>
              <span className="brand-title">DesiHawas</span>
            </Link>
            <Link href="/gallery" className="back-link">
              ← Gallery
            </Link>
          </div>

          <div className="watch-header-right">
            {!viewInfo?.isPremium && viewInfo?.remaining >= 0 && (
              <span className="views-badge">
                {viewInfo.remaining} free views left
              </span>
            )}
            <Link href="/premium" className="vip-btn">
              👑 VIP Premium
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Watch Content Area ── */}
      <main className="watch-main-content">
        <div className="player-container">
          {/* Video Title & Meta Bar at Top */}
          <div className="video-title-row">
            <h1 className="video-main-heading">{title}</h1>
            <div className="video-badges-row">
              <span className="badge-item badge-quality">720p HD</span>
              <span className="badge-item badge-cat">Exclusive HD</span>
              {Number(videoId) >= 10000 && <span className="badge-item badge-cdn">HindiBF</span>}
            </div>
          </div>

          {/* Custom Video Player (Responsive Cinema Mode) */}
          <div className="player-viewport">
            <CustomVideoPlayer
              key={src || videoId}
              src={src}
              videoId={videoId}
              title={title}
              isPremium={Boolean(viewInfo?.isPremium || user?.role === 'admin' || user?.role === 'advisor')}
              isBookmarked={isBookmarked}
              onBookmark={handleToggleBookmark}
              onDownload={handleDownload}
              autoPlay={true}
              onNext={null} /* NO auto-play next video on ended */
            />
          </div>

          {/* Toast Notification */}
          {bookmarkToast && (
            <div className="toast-notification">
              {bookmarkToast}
            </div>
          )}

          {/* ── Eporner/YouTube Action Bar Directly Below Video ── */}
          <div className="video-action-bar">
            {/* Left: Views, Like & Dislike */}
            <div className="action-bar-left">
              <div className="views-counter">
                👁️ <strong>{Math.max(120, (Number(videoId) * 37) % 500000 + 450).toLocaleString()}</strong> views
              </div>

              <div className="like-dislike-group">
                {/* Like Button */}
                <button
                  type="button"
                  onClick={handleLike}
                  className={`action-btn vote-btn ${liked ? 'active-like' : ''}`}
                  title={user?.role === 'admin' ? `Likes: ${likesCount ?? 0}` : 'Like this video'}
                >
                  <span className="btn-icon">👍</span>
                  <span className="btn-txt">Like</span>
                  {user?.role === 'admin' && likesCount !== null && (
                    <span className="admin-vote-badge">{likesCount}</span>
                  )}
                </button>

                {/* Dislike Button */}
                <button
                  type="button"
                  onClick={handleDislike}
                  className={`action-btn vote-btn ${disliked ? 'active-dislike' : ''}`}
                  title={user?.role === 'admin' ? `Dislikes: ${dislikesCount ?? 0}` : 'Dislike this video'}
                >
                  <span className="btn-icon">👎</span>
                  <span className="btn-txt">Dislike</span>
                  {user?.role === 'admin' && dislikesCount !== null && (
                    <span className="admin-vote-badge">{dislikesCount}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Comments, Save, Report, Download, Share */}
            <div className="action-bar-right">
              <button
                type="button"
                className="action-btn"
                onClick={() => commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              >
                <span className="btn-icon">💬</span>
                <span className="btn-txt">Comments ({comments.length})</span>
              </button>

              <button
                type="button"
                className={`action-btn ${isBookmarked ? 'active-save' : ''}`}
                onClick={handleToggleBookmark}
              >
                <span className="btn-icon">{isBookmarked ? '★' : '🔖'}</span>
                <span className="btn-txt">{isBookmarked ? 'Saved' : 'Save'}</span>
              </button>

              <button
                type="button"
                className="action-btn"
                onClick={() => setShowReport(true)}
              >
                <span className="btn-icon">🚩</span>
                <span className="btn-txt">Report</span>
              </button>

              <button
                type="button"
                className="action-btn download-highlight"
                onClick={handleDownload}
              >
                <span className="btn-icon">⬇</span>
                <span className="btn-txt">Download</span>
                {!viewInfo?.isPremium && <span className="crown-mini">👑</span>}
              </button>

              <button
                type="button"
                className="action-btn"
                onClick={handleShare}
              >
                <span className="btn-icon">🔗</span>
                <span className="btn-txt">{shareCopied ? 'Copied!' : 'Share'}</span>
              </button>
            </div>
          </div>

          {/* ── Comments Section (Image 5) ── */}
          <section ref={commentsSectionRef} className="comments-section">
            <div className="comments-head">
              <h2 className="comments-heading">Comments ({comments.length})</h2>
              <p className="comments-sub">Write what you like in this video, so that others can see it too.</p>
            </div>

            {/* Add Comment Box */}
            <form onSubmit={handleAddComment} className="comment-input-box">
              <label className="comment-label">Your comment:</label>
              <textarea
                className="comment-textarea"
                rows={3}
                placeholder={user ? "Write a respectful comment..." : "Sign in to write a comment..."}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                maxLength={500}
                disabled={!user}
              />
              <div className="comment-form-footer">
                <span className="char-count">{newComment.length}/500</span>
                <button
                  type="submit"
                  className="btn-add-comment"
                  disabled={!user || !newComment.trim() || commentLoading}
                >
                  {commentLoading ? 'Posting...' : 'Add comment'}
                </button>
              </div>
            </form>

            {/* Comments List */}
            <div className="comments-list">
              {comments.length === 0 ? (
                <div className="no-comments">No comments yet. Be the first to comment on this video!</div>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="comment-card">
                    <div className="comment-avatar">
                      {c.displayName?.slice(0, 2).toUpperCase() || c.username?.slice(0, 2).toUpperCase() || 'U'}
                    </div>
                    <div className="comment-body">
                      <div className="comment-meta">
                        <span className="comment-author">@{c.username}</span>
                        <span className="comment-dot">·</span>
                        <span className="comment-time">{timeAgo(c.timestamp)}</span>
                      </div>
                      <div className="comment-text">{c.text}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ── Related Videos Grid (Images 3 & 4) ── */}
          <section className="related-videos-section">
            <div className="related-head">
              <h2 className="related-heading">
                Videos related to <span className="related-title-accent">{title.slice(0, 40)}...</span>
              </h2>
            </div>

            <div className="related-grid">
              {relatedVideos.slice(0, relatedLimit).map(relId => (
                <div
                  key={relId}
                  className="related-card"
                  onClick={() => handleOpenRelated(relId)}
                >
                  <div className="related-thumb-wrap">
                    <img
                      src={thumbSrc(relId)}
                      alt=""
                      className="related-thumb-img"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <span className="related-badge-dur">720p</span>
                  </div>
                  <div className="related-card-info">
                    <h3 className="related-card-title">
                      {allTitles[String(relId)] || `Exclusive Video #${relId}`}
                    </h3>
                    <div className="related-card-meta">
                      DesiHawas · #{relId}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* "Show more related videos" Button */}
            {relatedVideos.length > relatedLimit && (
              <div className="show-more-wrap">
                <button
                  type="button"
                  className="btn-show-more"
                  onClick={() => setRelatedLimit(prev => prev + 12)}
                >
                  Show more related videos ⬇
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ── Report Modal ── */}
      {showReport && (
        <div className="modal-overlay" onClick={() => setShowReport(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>🚩 Report Video #{videoId}</h3>
            {reportSuccess ? (
              <p style={{ color: '#22c55e', fontWeight: 700 }}>Thank you! Your report has been submitted to admin.</p>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 14 }}>Please select a reason for reporting this video:</p>
                <select
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', color: '#fff', marginBottom: 16 }}
                >
                  <option value="Broken video">Broken video / Won't play</option>
                  <option value="Audio issues">No sound / Audio out of sync</option>
                  <option value="Duplicate">Duplicate video</option>
                  <option value="Incorrect title">Wrong title or thumbnail</option>
                  <option value="Other">Other issue</option>
                </select>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#ec4899', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                    onClick={async () => {
                      try {
                        await fetch('/api/hwasi/report', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ videoId: Number(videoId), reason: reportReason }),
                        });
                        setReportSuccess(true);
                        setTimeout(() => { setShowReport(false); setReportSuccess(false); }, 1800);
                      } catch {}
                    }}
                  >
                    Submit Report
                  </button>
                  <button
                    type="button"
                    style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,.1)', color: '#fff', border: 'none', cursor: 'pointer' }}
                    onClick={() => setShowReport(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Responsive Styling ── */}
      <style>{`
        .watch-page-wrapper {
          min-height: 100vh;
          background: #060010;
          color: #f1f5f9;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
        }

        .watch-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(6, 0, 16, 0.95);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 10px 16px;
        }
        .watch-header-inner {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .watch-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .brand-logo {
          display: flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
          color: #fff;
          font-weight: 900;
          font-size: 18px;
          letter-spacing: -0.5px;
        }
        .brand-icon {
          font-size: 20px;
        }
        .back-link {
          color: rgba(255, 255, 255, 0.6);
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          transition: background 0.15s, color 0.15s;
        }
        .back-link:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }

        .watch-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .views-badge {
          font-size: 11px;
          font-weight: 700;
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.25);
          padding: 4px 10px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .vip-btn {
          font-size: 12px;
          font-weight: 800;
          color: #fff;
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
          padding: 6px 14px;
          border-radius: 20px;
          text-decoration: none;
          box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);
          white-space: nowrap;
        }

        .watch-main-content {
          flex: 1;
          max-width: 1280px;
          width: 100%;
          margin: 0 auto;
          padding: 16px 16px 60px 16px;
          box-sizing: border-box;
        }

        .player-container {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .video-title-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .video-main-heading {
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
          line-height: 1.35;
          letter-spacing: -0.3px;
        }
        .video-badges-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .badge-item {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
        }
        .badge-quality {
          background: rgba(59, 130, 246, 0.18);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .badge-cat {
          background: rgba(236, 72, 153, 0.15);
          color: #f472b6;
          border: 1px solid rgba(236, 72, 153, 0.28);
        }
        .badge-cdn {
          background: rgba(139, 92, 246, 0.15);
          color: #c084fc;
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        .player-viewport {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          max-height: 70vh;
          background: #000;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
        }

        .toast-notification {
          background: linear-gradient(90deg, #ec4899, #8b5cf6);
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          padding: 8px 16px;
          border-radius: 10px;
          text-align: center;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          animation: fadeIn 0.2s ease;
        }

        /* ── Eporner/YouTube Action Bar ── */
        .video-action-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          padding: 12px 0 16px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .action-bar-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        .views-counter {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.85);
          letter-spacing: -0.2px;
        }
        .views-counter strong {
          color: #fff;
          font-weight: 800;
        }

        .like-dislike-group {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.07);
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          overflow: hidden;
        }
        .vote-btn {
          border-radius: 0 !important;
          background: transparent !important;
          border: none !important;
        }
        .vote-btn:first-child {
          border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .active-like {
          background: rgba(236, 72, 153, 0.25) !important;
          color: #f472b6 !important;
        }
        .active-dislike {
          background: rgba(239, 68, 68, 0.25) !important;
          color: #f87171 !important;
        }
        .admin-vote-badge {
          font-size: 11px;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.15);
          padding: 1px 6px;
          border-radius: 10px;
          margin-left: 4px;
        }

        .action-bar-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #e2e8f0;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        .action-btn:hover {
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          transform: translateY(-1px);
        }
        .active-save {
          background: rgba(245, 158, 11, 0.22) !important;
          border-color: #f59e0b !important;
          color: #fbbf24 !important;
        }
        .download-highlight {
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(236, 72, 153, 0.3));
          border-color: rgba(236, 72, 153, 0.4);
          color: #fff;
        }
        .crown-mini {
          font-size: 10px;
          margin-left: 2px;
        }

        /* ── Comments Section ── */
        .comments-section {
          padding: 24px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .comments-heading {
          font-size: 18px;
          font-weight: 800;
          margin: 0 0 4px 0;
          color: #fff;
        }
        .comments-sub {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 16px 0;
        }

        .comment-input-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 24px;
        }
        .comment-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 8px;
        }
        .comment-textarea {
          width: 100%;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          padding: 12px;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          box-sizing: border-box;
          outline: none;
        }
        .comment-textarea:focus {
          border-color: #ec4899;
        }
        .comment-form-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 10px;
        }
        .char-count {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }
        .btn-add-comment {
          padding: 8px 20px;
          background: #ec4899;
          border: none;
          border-radius: 8px;
          color: #fff;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-add-comment:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .comments-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .no-comments {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
          padding: 12px 0;
        }
        .comment-card {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .comment-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
          color: #fff;
          font-weight: 800;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .comment-body {
          flex: 1;
        }
        .comment-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .comment-author {
          font-size: 13px;
          font-weight: 700;
          color: #f472b6;
        }
        .comment-dot {
          color: rgba(255, 255, 255, 0.3);
        }
        .comment-time {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }
        .comment-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.45;
        }

        /* ── Related Videos Grid (Images 3 & 4) ── */
        .related-videos-section {
          padding-top: 28px;
        }
        .related-heading {
          font-size: 18px;
          font-weight: 800;
          margin: 0 0 16px 0;
          color: #ffffff;
        }
        .related-title-accent {
          color: #ec4899;
        }

        .related-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .related-card {
          cursor: pointer;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.07);
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .related-card:hover {
          transform: translateY(-4px);
          border-color: rgba(236, 72, 153, 0.4);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
        }
        .related-thumb-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          background: #000;
          overflow: hidden;
        }
        .related-thumb-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.25s ease;
        }
        .related-card:hover .related-thumb-img {
          transform: scale(1.05);
        }
        .related-badge-dur {
          position: absolute;
          bottom: 6px;
          right: 6px;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 800;
          color: #fff;
        }

        .related-card-info {
          padding: 10px 12px;
        }
        .related-card-title {
          font-size: 13px;
          font-weight: 700;
          color: #e2e8f0;
          margin: 0 0 4px 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.35;
        }
        .related-card-meta {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }

        .show-more-wrap {
          margin-top: 24px;
          display: flex;
          justify-content: center;
        }
        .btn-show-more {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          padding: 12px 28px;
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          font-family: inherit;
        }
        .btn-show-more:hover {
          background: rgba(236, 72, 153, 0.2);
          border-color: #ec4899;
          color: #ec4899;
        }

        /* ── Modal Overlay ── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .modal-box {
          background: #140824;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 24px;
          width: 100%;
          max-width: 400px;
        }

        /* ── Responsive Mobile Optimizations ── */
        @media (max-width: 1024px) {
          .related-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 768px) {
          .related-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .video-main-heading {
            font-size: 17px;
          }
          .video-action-bar {
            flex-direction: column;
            align-items: flex-start;
          }
          .action-bar-right {
            width: 100%;
            overflow-x: auto;
            flex-wrap: nowrap;
            padding-bottom: 4px;
          }
        }
        @media (max-width: 480px) {
          .watch-main-content {
            padding: 10px 10px 40px 10px;
          }
          .video-main-heading {
            font-size: 15px;
          }
          .action-btn {
            padding: 6px 10px;
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
}
