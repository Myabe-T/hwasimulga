'use client';
export const runtime = 'edge';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { secureFetch } from '@/lib/crypto';
import CustomVideoPlayer from '@/components/CustomVideoPlayer';
import { encodeVideoId, decodeVideoId } from '@/lib/videoToken';

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

  // URL token decoding: supports both encrypted "v_..." and legacy raw IDs
  const rawParam = params?.id;
  const rawVideoId = decodeVideoId(rawParam) || rawParam;
  const encodedVideoId = encodeVideoId(rawVideoId);

  const [state, setState] = useState('loading'); // loading | auth | limit | playing | blocked
  const [src, setSrc] = useState(null);
  const [title, setTitle] = useState('');
  const [viewInfo, setViewInfo] = useState(null);
  const [user, setUser] = useState(null);

  // Drawer state (☰ Hamburger Menu)
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // Header Search State
  const [headerSearch, setHeaderSearch] = useState('');

  // Video Aspect Ratio / Portrait Mode (removes black bars for vertical videos)
  const [isPortrait, setIsPortrait] = useState(false);
  const [activeRelatedPreviewId, setActiveRelatedPreviewId] = useState(null);

  // Interactive Video Tags State (Image 3)
  const [tags, setTags] = useState([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagError, setTagError] = useState('');
  const [tagSubmitting, setTagSubmitting] = useState(false);
  const [userHasAddedTag, setUserHasAddedTag] = useState(false);

  const thumbSrc = useCallback((id) => {
    return Number(id) >= 10000 ? `/api/hwasi/thumb-extra/${id}` : `/api/hwasi/thumbnail/${id}`;
  }, []);

  // 1. Silently replace raw numbers in browser address bar with encrypted "v_..." token
  useEffect(() => {
    if (typeof window !== 'undefined' && rawParam && rawParam !== encodedVideoId) {
      window.history.replaceState(null, '', '/watch/' + encodedVideoId);
    }
  }, [rawParam, encodedVideoId]);

  // 2. Initial Load: Check Auth, Stream Token, Titles, Thumbs
  useEffect(() => {
    if (!rawVideoId) return;
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
          const curTitle = titles[String(rawVideoId)] || '';
          if (curTitle) {
            setTitle(curTitle);
          } else {
            setTitle(user?.role === 'admin' || user?.role === 'advisor' ? `Exclusive Video #${rawVideoId}` : 'Exclusive DesiHawas Video');
          }
          const tIds = new Set((th.ids || []).map(Number));
          setThumbIds(tIds);
          const vIds = Object.keys(titles).map(Number).sort((a, b) => b - a);
          setAllVideoIds(vIds.length > 0 ? vIds : Array.from({ length: 1177 }, (_, i) => 1177 - i));

          // Load / Initialize Tags with video title
          fetch(`/api/hwasi/tags?videoId=${rawVideoId}&title=${encodeURIComponent(curTitle)}`)
            .then(r => r.json())
            .then(d => {
              if (d.tags) {
                setTags(d.tags);
                setUserHasAddedTag(Boolean(d.userHasAdded));
              }
            })
            .catch(() => {});
        });

        // Request video stream token from views API
        const viewRes = await secureFetch('/api/hwasi/views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: Number(rawVideoId) }),
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
          if (d.ids) setIsBookmarked(d.ids.includes(Number(rawVideoId)) || d.ids.includes(String(rawVideoId)));
        }).catch(() => {});

        // Load Likes / Dislikes
        fetch(`/api/hwasi/likes?id=${rawVideoId}`).then(r => r.json()).then(d => {
          setLiked(Boolean(d.liked));
          setDisliked(Boolean(d.disliked));
          if (d.likesCount !== undefined) setLikesCount(d.likesCount);
          if (d.dislikesCount !== undefined) setDislikesCount(d.dislikesCount);
        }).catch(() => {});

        // Load Comments
        fetch(`/api/hwasi/comments?id=${rawVideoId}`).then(r => r.json()).then(d => {
          if (d.comments) setComments(d.comments);
        }).catch(() => {});

      } catch (err) {
        setState('auth');
      }
    }

    loadData();
  }, [rawVideoId]);

  // Smart Related Videos: Rank catalogue videos by keyword similarity
  const relatedVideos = useMemo(() => {
    if (!rawVideoId) return [];
    const currentKeywords = extractKeywords(title);
    const currId = Number(rawVideoId);

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
  }, [rawVideoId, title, allTitles]);

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
        body: JSON.stringify({ videoId: Number(rawVideoId), action }),
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
        body: JSON.stringify({ videoId: Number(rawVideoId), action }),
      });
      const d = await res.json();
      if (d.likesCount !== undefined) setLikesCount(d.likesCount);
      if (d.dislikesCount !== undefined) setDislikesCount(d.dislikesCount);
    } catch {}
  };

  // Handle Bookmark toggle (5 free limit, unlimited for premium)
  const handleToggleBookmark = async () => {
    if (!user) {
      router.push(`/login?redirect=/watch/${encodedVideoId}`);
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
        body: JSON.stringify({ videoId: Number(rawVideoId) }),
      });
      const d = await res.json();
      if (!res.ok && d.code === 'BOOKMARK_LIMIT_REACHED') {
        setIsBookmarked(false);
        setBookmarkToast('Free limit reached (max 5). Upgrade to Premium for unlimited bookmarks!');
        setTimeout(() => setBookmarkToast(''), 4000);
      }
    } catch {}
  };

  // Handle Download (Premium only gate, encrypted token)
  const handleDownload = () => {
    if (viewInfo?.isPremium || user?.role === 'admin' || user?.role === 'advisor') {
      window.location.href = `/api/download/${encodedVideoId}`;
    } else {
      router.push('/premium');
    }
  };

  // Handle Share link copy (encrypted URL)
  const handleShare = () => {
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/watch/${encodedVideoId}` : '';
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
      router.push(`/login?redirect=/watch/${encodedVideoId}`);
      return;
    }
    if (!newComment.trim() || commentLoading) return;

    setCommentLoading(true);
    try {
      const res = await fetch('/api/hwasi/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: Number(rawVideoId), text: newComment }),
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

  // Handle Add Tag (Image 3)
  const handleAddTag = async (customTag) => {
    const tagText = (customTag || newTagInput).trim();
    if (!tagText) return;
    if (!user) {
      router.push(`/login?redirect=/watch/${encodedVideoId}`);
      return;
    }
    setTagError('');
    setTagSubmitting(true);
    try {
      const res = await fetch('/api/hwasi/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: Number(rawVideoId),
          tag: tagText,
          title: title || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTagError(data.error || 'Failed to add tag');
      } else {
        setTags(data.tags || []);
        setUserHasAddedTag(true);
        setNewTagInput('');
        setShowTagModal(false);
      }
    } catch (e) {
      setTagError('Network error while adding tag');
    } finally {
      setTagSubmitting(false);
    }
  };

  // Handle Delete Tag (Image 3)
  const handleDeleteTag = async (tagObj) => {
    if (!user) return;
    try {
      const res = await fetch('/api/hwasi/tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: Number(rawVideoId),
          tagId: tagObj.id,
          tag: tagObj.tag,
        }),
      });
      const data = await res.json();
      if (res.ok && data.tags) {
        setTags(data.tags);
        const currentUserId = user.id || user.username;
        const stillHas = data.tags.some(t => !t.isDefault && (t.userId === currentUserId || t.username === user.username));
        setUserHasAddedTag(stillHas);
      }
    } catch (e) {
      console.warn('Failed to delete tag:', e);
    }
  };

  // Navigate to another video smoothly with encrypted URL
  const handleOpenRelated = (id) => {
    setActiveRelatedPreviewId(null);
    router.push(`/watch/${encodeVideoId(id)}`);
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
          <Link href={`/login?redirect=/watch/${encodedVideoId}`} style={{ padding: '12px 26px', background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', borderRadius: 12, color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>Login to Watch</Link>
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
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 13, marginBottom: 26, maxWidth: 380 }}>Upgrade to Premium for unlimited access to all 20,000+ exclusive videos!</p>
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
      {/* ── Slide-out Left Navigation Drawer (Screenshot 5) ── */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
      )}
      <aside className={`drawer-sidebar ${drawerOpen ? 'drawer-open' : ''}`}>
        <div className="drawer-header">
          <div className="drawer-user-info">
            <div className="drawer-avatar">
              {user?.displayName?.slice(0, 2).toUpperCase() || user?.username?.slice(0, 2).toUpperCase() || 'DH'}
            </div>
            <div className="drawer-user-meta">
              <span className="drawer-user-name">{user?.displayName || user?.username || 'Guest Viewer'}</span>
              <span className="drawer-user-plan">
                {user?.role === 'admin'
                  ? '🛡️ Administrator'
                  : user?.role === 'advisor'
                  ? '💼 Advisor'
                  : viewInfo?.isPremium
                  ? `👑 ${viewInfo?.plan || 'VIP Premium'}`
                  : user
                  ? `Free (${(viewInfo?.viewsToday ?? viewInfo?.count) ?? 0}/${viewInfo?.limit ?? 5})`
                  : 'Guest'}
              </span>
            </div>
          </div>
          <button className="drawer-close-btn" onClick={() => setDrawerOpen(false)} aria-label="Close menu">✕</button>
        </div>

        <nav className="drawer-nav">
          <Link href="/gallery" className="drawer-nav-item" onClick={() => setDrawerOpen(false)}>
            <span className="drawer-nav-icon">🎬</span>
            <span>Home &amp; Gallery</span>
          </Link>
          <Link href="/gallery?view=bookmarks" className="drawer-nav-item" onClick={() => setDrawerOpen(false)}>
            <span className="drawer-nav-icon">🔖</span>
            <span>My Bookmarks</span>
          </Link>
          <Link href="/gallery?view=history" className="drawer-nav-item" onClick={() => setDrawerOpen(false)}>
            <span className="drawer-nav-icon">🕒</span>
            <span>Watch History</span>
          </Link>
          <Link href="/premium" className="drawer-nav-item drawer-nav-highlight" onClick={() => setDrawerOpen(false)}>
            <span className="drawer-nav-icon">👑</span>
            <span>{viewInfo?.isPremium ? 'Extend Premium' : 'Buy VIP Premium'}</span>
          </Link>
          <Link href="/gallery?view=profile" className="drawer-nav-item" onClick={() => setDrawerOpen(false)}>
            <span className="drawer-nav-icon">👤</span>
            <span>My Profile</span>
          </Link>
          <Link href="/gallery?view=support" className="drawer-nav-item" onClick={() => setDrawerOpen(false)}>
            <span className="drawer-nav-icon">💬</span>
            <span>Help &amp; Support</span>
          </Link>
          {user?.role === 'admin' && (
            <Link href="/admin" className="drawer-nav-item" onClick={() => setDrawerOpen(false)}>
              <span className="drawer-nav-icon">⚙️</span>
              <span>Admin Panel</span>
            </Link>
          )}
          {user?.role === 'advisor' && (
            <Link href="/advisor" className="drawer-nav-item" onClick={() => setDrawerOpen(false)}>
              <span className="drawer-nav-icon">💼</span>
              <span>Advisor Panel</span>
            </Link>
          )}
          <Link href="/terms" className="drawer-nav-item" onClick={() => setDrawerOpen(false)}>
            <span className="drawer-nav-icon">📄</span>
            <span>Terms of Service</span>
          </Link>
        </nav>

        {user && (
          <div className="drawer-footer">
            <button
              className="drawer-logout-btn"
              onClick={async () => {
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/login';
              }}
            >
              ⏏ Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* ── Top Navbar ── */}
      <header className="watch-header">
        <div className="watch-header-inner">
          <div className="watch-brand">
            <button
              type="button"
              className="hamburger-btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open Navigation Menu"
            >
              ☰
            </button>
            <Link href="/gallery" className="brand-logo">
              <span className="brand-icon">🔥</span>
              <span className="brand-title">DesiHawas</span>
            </Link>
            <Link href="/gallery" className="back-link">
              ← Gallery
            </Link>
          </div>

          {/* Header Search Banner */}
          <form
            className="watch-search-wrap"
            onSubmit={(e) => {
              e.preventDefault();
              if (headerSearch.trim()) {
                router.push('/gallery?q=' + encodeURIComponent(headerSearch.trim()));
              }
            }}
          >
            <span className="watch-search-icon">🔍</span>
            <input
              type="text"
              className="watch-search-input"
              placeholder="Search 20k+ videos..."
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
            />
            {headerSearch && (
              <button
                type="button"
                className="watch-search-clear"
                onClick={() => setHeaderSearch('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </form>

          <div className="watch-header-right">
            {user?.role === 'admin' ? (
              <span className="vip-badge-pill admin-pill">🛡️ Admin</span>
            ) : user?.role === 'advisor' ? (
              <span className="vip-badge-pill advisor-pill">💼 Advisor</span>
            ) : viewInfo?.isPremium ? (
              <span className="vip-badge-pill premium-pill">👑 {viewInfo?.plan || 'VIP Premium'}</span>
            ) : user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="views-badge">
                  Free ({(viewInfo?.viewsToday ?? viewInfo?.count) ?? 0}/{viewInfo?.limit ?? 5})
                </span>
                <Link href="/premium" className="vip-btn">
                  🚀 Upgrade
                </Link>
              </div>
            ) : (
              <Link href={`/login?redirect=/watch/${encodedVideoId}`} className="vip-btn">
                Sign In
              </Link>
            )}
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
              {(user?.role === 'admin' || user?.role === 'advisor') && Number(rawVideoId) >= 10000 && (
                <span className="badge-item badge-cdn">HindiBF</span>
              )}

              {/* ── Interactive Tags Row (Matching Image 3) ── */}
              <div className="tags-row-wrapper">
                <span className="tags-heading-label">Tags:</span>
                <div className="tags-pills-container">
                  {tags.map((t) => (
                    <span
                      key={t.id || t.tag}
                      className="tag-badge-pill"
                      onClick={() => router.push(`/gallery?q=${encodeURIComponent(t.tag)}`)}
                      title={`Filter by tag "${t.tag}"`}
                    >
                      {t.tag}
                      {t.canDelete && (
                        <button
                          type="button"
                          className="tag-delete-x"
                          title="Delete tag"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTag(t);
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  ))}

                  {/* ✏️ Edit tags button (Image 3) */}
                  {tags.length < 10 && (
                    <button
                      type="button"
                      className="edit-tags-action-btn"
                      onClick={() => {
                        if (!user) {
                          router.push(`/login?redirect=/watch/${encodedVideoId}`);
                          return;
                        }
                        setShowTagModal(true);
                        setTagError('');
                      }}
                      title={userHasAddedTag ? 'Edit or delete your tag' : 'Add a tag to this video'}
                    >
                      ✏️ Edit tags
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Custom Video Player (Responsive Cinema Mode) */}
          <div className={`player-viewport ${isPortrait ? 'portrait-mode' : 'landscape-mode'}`}>
            <CustomVideoPlayer
              key={src || rawVideoId}
              src={src}
              videoId={rawVideoId}
              title={title}
              isPremium={Boolean(viewInfo?.isPremium || user?.role === 'admin' || user?.role === 'advisor')}
              autoPlay={true}
              onAspectChange={({ isPortrait }) => setIsPortrait(Boolean(isPortrait))}
              onNext={null} /* NO auto-play next video on ended */
            />
          </div>

          {/* Toast Notification */}
          {bookmarkToast && (
            <div className="toast-notification">
              {bookmarkToast}
            </div>
          )}

          {/* ── Interactive Tag Editor Modal (Image 3) ── */}
          {showTagModal && (
            <div className="tag-modal-overlay" onClick={() => setShowTagModal(false)}>
              <div className="tag-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="tag-modal-header">
                  <h3 className="tag-modal-title">🏷️ Video Tags ({tags.length}/10)</h3>
                  <button type="button" className="tag-modal-close" onClick={() => setShowTagModal(false)}>✕</button>
                </div>

                <p className="tag-modal-sub">
                  {user?.role === 'admin' || user?.role === 'advisor'
                    ? '🛡️ Admin Mode: You can add and delete any tag on this video (max 10).'
                    : userHasAddedTag
                    ? '✓ You have added 1 tag to this video. You can delete or edit it below.'
                    : 'Add 1 relevant tag to this video (e.g. bhabhi, boobs, romantic). Max 10 per video.'}
                </p>

                {tagError && <div className="tag-modal-err">{tagError}</div>}

                {/* Add new tag form if user has not added or is admin */}
                {(user?.role === 'admin' || user?.role === 'advisor' || !userHasAddedTag) && tags.length < 10 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddTag();
                    }}
                    className="tag-modal-form"
                  >
                    <input
                      type="text"
                      className="tag-modal-input"
                      placeholder="e.g. big boobs, bhabhi, cute..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      maxLength={25}
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="tag-modal-submit-btn"
                      disabled={tagSubmitting || !newTagInput.trim()}
                    >
                      {tagSubmitting ? 'Adding...' : '+ Add Tag'}
                    </button>
                  </form>
                )}

                {/* Quick suggestions */}
                {(!userHasAddedTag || user?.role === 'admin' || user?.role === 'advisor') && tags.length < 10 && (
                  <div className="tag-suggestions-wrap">
                    <span className="tag-sugg-title">Quick suggestions:</span>
                    <div className="tag-sugg-pills">
                      {['bhabhi', 'boobs', 'sexy', 'desi', 'mms', 'viral', 'romantic', 'cute']
                        .filter(s => !tags.some(t => t.tag.toLowerCase() === s))
                        .slice(0, 6)
                        .map(s => (
                          <button
                            key={s}
                            type="button"
                            className="tag-sugg-chip"
                            onClick={() => handleAddTag(s)}
                            disabled={tagSubmitting}
                          >
                            +{s}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Current tags in this video */}
                <div className="tag-modal-current">
                  <div className="tag-current-heading">Active tags on this video:</div>
                  <div className="tag-current-list">
                    {tags.map(t => (
                      <div key={t.id || t.tag} className="tag-current-item">
                        <span className="tag-badge-pill static-view">{t.tag}</span>
                        {t.canDelete && (
                          <button
                            type="button"
                            className="tag-current-del-btn"
                            onClick={() => handleDeleteTag(t)}
                            title="Delete this tag"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Eporner/YouTube Action Bar Directly Below Video ── */}
          <div className="video-action-bar">
            {/* Left: Views, Like & Dislike */}
            <div className="action-bar-left">
              <div className="views-counter">
                👁️ <strong>{Math.max(120, (Number(rawVideoId) * 37) % 500000 + 450).toLocaleString()}</strong> views
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

            {/* Right: Comments Shortcut, Save, Report, Download, Share */}
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

          {/* ── 1. Related Videos Grid (Positioned directly after action bar) ── */}
          <section className="related-videos-section">
            <div className="related-head">
              <h2 className="related-heading">
                Videos related to <span className="related-title-accent">{title.slice(0, 40)}...</span>
              </h2>
            </div>

            <div className="related-grid">
              {relatedVideos.slice(0, relatedLimit).map(relId => (
                <RelatedVideoCard
                  key={relId}
                  relId={relId}
                  title={allTitles[String(relId)] || (user?.role === 'admin' || user?.role === 'advisor' ? `Exclusive Video #${relId}` : 'Exclusive DesiHawas Video')}
                  thumbSrc={thumbSrc}
                  user={user}
                  activePreviewId={activeRelatedPreviewId}
                  setActivePreviewId={setActiveRelatedPreviewId}
                  onOpen={handleOpenRelated}
                />
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

          {/* ── 2. Comments Section (Positioned at the very bottom) ── */}
          <section ref={commentsSectionRef} className="comments-section">
            <div className="comments-head">
              <h2 className="comments-heading">Comments ({comments.length})</h2>
              <p className="comments-sub">Share your thoughts on this video with other members.</p>
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
        </div>
      </main>

      {/* ── Report Modal ── */}
      {showReport && (
        <div className="modal-overlay" onClick={() => setShowReport(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>🚩 Report Video</h3>
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
                          body: JSON.stringify({ videoId: Number(rawVideoId), reason: reportReason }),
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

        /* ── Slide-out Left Drawer ── */
        .drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 99;
          animation: fadeIn 0.2s ease;
        }
        .drawer-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 280px;
          max-width: 85vw;
          background: #0e0717;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          z-index: 100;
          display: flex;
          flex-direction: column;
          transform: translateX(-100%);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 10px 0 30px rgba(0, 0, 0, 0.6);
        }
        .drawer-sidebar.drawer-open {
          transform: translateX(0);
        }
        .drawer-header {
          padding: 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .drawer-user-info {
          display: flex;
          align-items: center;
          gap: 12px;
          overflow: hidden;
        }
        .drawer-avatar {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
          color: #fff;
          font-weight: 800;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .drawer-user-meta {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .drawer-user-name {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .drawer-user-plan {
          font-size: 11px;
          color: #a78bfa;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .drawer-close-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          font-size: 18px;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
        }
        .drawer-close-btn:hover {
          color: #fff;
        }
        .drawer-nav {
          flex: 1;
          overflow-y: auto;
          padding: 14px 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .drawer-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.85);
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          transition: background 0.15s, color 0.15s;
        }
        .drawer-nav-item:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        .drawer-nav-icon {
          font-size: 16px;
          width: 22px;
          text-align: center;
        }
        .drawer-nav-highlight {
          background: rgba(236, 72, 153, 0.12);
          border: 1px solid rgba(236, 72, 153, 0.25);
          color: #f472b6;
        }
        .drawer-footer {
          padding: 14px 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .drawer-logout-btn {
          width: 100%;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #f87171;
          font-weight: 700;
          font-size: 13px;
          padding: 10px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .drawer-logout-btn:hover {
          background: rgba(239, 68, 68, 0.22);
        }

        /* ── Top Header ── */
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
          gap: 12px;
        }
        .hamburger-btn {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #fff;
          font-size: 18px;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s;
        }
        .hamburger-btn:hover {
          background: rgba(255, 255, 255, 0.16);
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

        /* ── Header Search ── */
        .watch-search-wrap {
          flex: 1;
          max-width: 480px;
          margin: 0 12px;
          position: relative;
          display: flex;
          align-items: center;
        }
        .watch-search-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 20px;
          color: #fff;
          font-size: 13px;
          padding: 7px 32px 7px 34px;
          outline: none;
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .watch-search-input:focus {
          background: rgba(255, 255, 255, 0.12);
          border-color: #ec4899;
          box-shadow: 0 0 12px rgba(236, 72, 153, 0.25);
        }
        .watch-search-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        .watch-search-icon {
          position: absolute;
          left: 11px;
          font-size: 13px;
          pointer-events: none;
          opacity: 0.7;
        }
        .watch-search-clear {
          position: absolute;
          right: 9px;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
          cursor: pointer;
          padding: 2px 5px;
          border-radius: 50%;
        }
        .watch-search-clear:hover {
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
        .vip-badge-pill {
          font-size: 12px;
          font-weight: 800;
          padding: 5px 12px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .admin-pill {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #f87171;
        }
        .advisor-pill {
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.35);
          color: #60a5fa;
        }
        .premium-pill {
          background: linear-gradient(135deg, #7c3aed, #ec4899);
          color: #fff;
          box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);
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

        /* ── Tags Row (Image 3) ── */
        .tags-row-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-left: 4px;
        }
        .tags-heading-label {
          font-style: italic;
          text-decoration: underline;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.3px;
          user-select: none;
        }
        .tags-pills-container {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .tag-badge-pill {
          background: #3b82f6;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          text-decoration: none;
          letter-spacing: 0.2px;
          box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
          transition: background 0.15s, transform 0.1s;
          white-space: nowrap;
        }
        .tag-badge-pill:hover {
          background: #2563eb;
          transform: translateY(-1px);
        }
        .tag-badge-pill.static-view {
          cursor: default;
          transform: none;
        }
        .tag-delete-x {
          background: rgba(0, 0, 0, 0.25);
          border: none;
          color: #fff;
          font-size: 9px;
          border-radius: 50%;
          width: 14px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          transition: background 0.1s;
        }
        .tag-delete-x:hover {
          background: rgba(239, 68, 68, 0.85);
        }
        .edit-tags-action-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          transition: color 0.15s, background 0.15s;
        }
        .edit-tags-action-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        /* ── Player Viewport (Cinema Mode) ── */
        .player-viewport {
          position: relative;
          width: 100%;
          background: #000;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
        }
        .player-viewport.landscape-mode {
          aspect-ratio: 16/9;
          max-height: 70vh;
        }
        .player-viewport.portrait-mode {
          aspect-ratio: auto;
          max-height: 75vh;
          height: 65vh;
        }
        @media (max-width: 768px) {
          .player-viewport.landscape-mode {
            aspect-ratio: 16/9;
            max-height: 50vh;
          }
          .player-viewport.portrait-mode {
            max-height: 72vh;
            height: 62vh;
          }
        }

        /* ── Tag Editor Modal ── */
        .tag-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(6px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .tag-modal-box {
          background: #130a21;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          width: 100%;
          max-width: 480px;
          padding: 22px;
          box-shadow: 0 16px 50px rgba(0, 0, 0, 0.8);
          animation: fadeIn 0.2s ease;
        }
        .tag-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .tag-modal-title {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          margin: 0;
        }
        .tag-modal-close {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          font-size: 18px;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
        }
        .tag-modal-close:hover {
          color: #fff;
        }
        .tag-modal-sub {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.65);
          line-height: 1.5;
          margin: 0 0 16px 0;
        }
        .tag-modal-err {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #f87171;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          margin-bottom: 12px;
        }
        .tag-modal-form {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .tag-modal-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 10px;
          padding: 10px 14px;
          color: #fff;
          font-size: 14px;
          outline: none;
        }
        .tag-modal-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
        }
        .tag-modal-submit-btn {
          background: #3b82f6;
          border: none;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          padding: 0 16px;
          border-radius: 10px;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
        }
        .tag-modal-submit-btn:hover:not(:disabled) {
          background: #2563eb;
        }
        .tag-modal-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .tag-suggestions-wrap {
          margin-bottom: 18px;
        }
        .tag-sugg-title {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: block;
          margin-bottom: 6px;
        }
        .tag-sugg-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .tag-sugg-chip {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.85);
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .tag-sugg-chip:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.2);
          border-color: #3b82f6;
          color: #fff;
        }
        .tag-modal-current {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 14px;
        }
        .tag-current-heading {
          font-size: 12px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 10px;
        }
        .tag-current-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .tag-current-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 8px;
          border-radius: 6px;
        }
        .tag-current-del-btn {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          cursor: pointer;
        }
        .tag-current-del-btn:hover {
          background: rgba(239, 68, 68, 0.35);
          color: #fff;
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
          gap: 12px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
        }
        .action-bar-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        .views-counter {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
        }
        .views-counter strong {
          color: #fff;
          font-weight: 800;
        }
        .like-dislike-group {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 2px;
        }
        .vote-btn {
          border: none !important;
          background: transparent !important;
          border-radius: 18px !important;
          padding: 5px 12px !important;
        }
        .active-like {
          color: #4ade80 !important;
          background: rgba(74, 222, 128, 0.15) !important;
        }
        .active-dislike {
          color: #f87171 !important;
          background: rgba(248, 113, 113, 0.15) !important;
        }
        .admin-vote-badge {
          background: rgba(255, 255, 255, 0.15);
          padding: 1px 6px;
          border-radius: 10px;
          font-size: 10px;
          margin-left: 4px;
          color: #fff;
        }

        .action-bar-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.85);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s, color 0.15s;
          white-space: nowrap;
        }
        .action-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          transform: translateY(-1px);
        }
        .active-save {
          background: rgba(245, 158, 11, 0.18) !important;
          border-color: #f59e0b !important;
          color: #f59e0b !important;
        }
        .download-highlight {
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(236, 72, 153, 0.25));
          border-color: rgba(236, 72, 153, 0.4);
          color: #fff;
        }
        .crown-mini {
          font-size: 11px;
          margin-left: 2px;
        }

        /* ── Related Videos Grid ── */
        .related-videos-section {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 10px;
        }
        .related-heading {
          font-size: 16px;
          font-weight: 800;
          color: #fff;
          margin: 0;
        }
        .related-title-accent {
          color: #ec4899;
        }
        .related-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 14px;
        }
        .related-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
          display: flex;
          flex-direction: column;
        }
        .related-card:hover {
          transform: translateY(-3px);
          border-color: rgba(236, 72, 153, 0.4);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        }
        .related-thumb-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          background: #110822;
          overflow: hidden;
        }
        .related-thumb-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .related-badge-dur {
          position: absolute;
          bottom: 6px;
          right: 6px;
          background: rgba(0, 0, 0, 0.75);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .related-card-info {
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .related-card-title {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.35;
        }
        .related-card-meta {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          font-weight: 500;
        }
        .show-more-wrap {
          display: flex;
          justify-content: center;
          margin-top: 10px;
        }
        .btn-show-more {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          padding: 10px 24px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s, transform 0.15s;
        }
        .btn-show-more:hover {
          background: rgba(236, 72, 153, 0.25);
          border-color: #ec4899;
          transform: translateY(-1px);
        }

        /* ── Comments Section (At the Bottom) ── */
        .comments-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 16px;
        }
        .comments-head {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .comments-heading {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          margin: 0;
        }
        .comments-sub {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }
        .comment-input-box {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 12px;
        }
        .comment-label {
          font-size: 12px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.8);
        }
        .comment-textarea {
          width: 100%;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          padding: 10px 12px;
          font-size: 13px;
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
        }
        .char-count {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }
        .btn-add-comment {
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
          border: none;
          color: #fff;
          font-weight: 700;
          font-size: 12px;
          padding: 7px 18px;
          border-radius: 8px;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .btn-add-comment:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .comments-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .no-comments {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
          text-align: center;
          padding: 16px 0;
        }
        .comment-card {
          display: flex;
          gap: 12px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .comment-avatar {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: #fff;
          font-weight: 800;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .comment-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .comment-meta {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .comment-author {
          font-size: 12px;
          font-weight: 700;
          color: #a78bfa;
        }
        .comment-dot {
          color: rgba(255, 255, 255, 0.3);
          font-size: 10px;
        }
        .comment-time {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }
        .comment-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.45;
          word-break: break-word;
        }

        /* ── Modal Overlay ── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 100;
        }
        .modal-box {
          background: #110722;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          padding: 24px;
          max-width: 420px;
          width: 100%;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* ── Mobile & Tablet Responsiveness ── */
        @media (max-width: 768px) {
          .watch-search-wrap {
            max-width: 180px;
            margin: 0 4px;
          }
          .watch-search-input {
            font-size: 11px;
            padding: 5px 22px 5px 26px;
          }
          .watch-search-icon {
            left: 7px;
            font-size: 11px;
          }
          .watch-main-content {
            padding: 10px 10px 50px 10px;
          }
          .video-main-heading {
            font-size: 17px;
          }
          .video-action-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .action-bar-left, .action-bar-right {
            justify-content: space-between;
            width: 100%;
          }
          .related-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .action-btn {
            padding: 5px 9px;
            font-size: 11px;
          }
        }
        @media (max-width: 480px) {
          .back-link {
            display: none;
          }
          .brand-title {
            display: none;
          }
          .watch-search-wrap {
            max-width: 140px;
          }
        }
      `}</style>
    </div>
  );
}

function RelatedVideoCard({ relId, title, thumbSrc, user, onOpen, activePreviewId, setActivePreviewId }) {
  const isHovered = activePreviewId === relId;
  const [isPlayingFrame, setIsPlayingFrame] = useState(false);
  const hoverTimer = useRef(null);
  const touchStartTimeRef = useRef(0);
  const touchMovedRef = useRef(false);
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const videoObjRef = useRef(null);

  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      if (setActivePreviewId) setActivePreviewId(relId);
    }, 20); // 20ms ultra-fast hover response
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (setActivePreviewId && activePreviewId === relId) {
      setActivePreviewId(null);
    }
  };

  const handleTouchStart = () => {
    touchStartTimeRef.current = Date.now();
    touchMovedRef.current = false;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      if (setActivePreviewId) setActivePreviewId(relId);
    }, 30);
  };

  const handleTouchMove = () => {
    touchMovedRef.current = true;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (setActivePreviewId && activePreviewId === relId) {
      setActivePreviewId(null);
    }
  };

  const handleTouchEnd = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (touchMovedRef.current) {
      if (setActivePreviewId && activePreviewId === relId) {
        setActivePreviewId(null);
      }
    }
  };

  const handleCardClick = (e) => {
    const holdDuration = Date.now() - touchStartTimeRef.current;
    if (touchStartTimeRef.current > 0 && holdDuration > 250 && !touchMovedRef.current) {
      touchStartTimeRef.current = 0;
      return;
    }
    touchStartTimeRef.current = 0;
    if (setActivePreviewId) setActivePreviewId(null);
    if (onOpen) onOpen(relId);
  };

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isHovered) {
      setIsPlayingFrame(false);
      if (videoObjRef.current) {
        try {
          videoObjRef.current.pause();
          videoObjRef.current.src = '';
          videoObjRef.current.removeAttribute('src');
          videoObjRef.current.load();
        } catch (_) {}
        videoObjRef.current = null;
      }
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.loop = true;
    v.preload = 'auto';
    v.src = `/api/hwasi/preview/${relId}`;
    videoObjRef.current = v;

    let isCancelled = false;

    const render = () => {
      if (isCancelled || !canvas) return;
      if (v.readyState >= 2 && v.videoWidth > 0) {
        if (canvas.width !== v.videoWidth) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
        }
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        setIsPlayingFrame(true);
      }
      if (v.currentTime > 5) {
        v.currentTime = 0.2; // loop preview smoothly
      }
      animRef.current = requestAnimationFrame(render);
    };

    const startPlayback = () => {
      if (isCancelled) return;
      v.play().catch(() => {});
      if (!animRef.current) {
        animRef.current = requestAnimationFrame(render);
      }
    };

    v.addEventListener('loadedmetadata', startPlayback);
    v.addEventListener('loadeddata', startPlayback);
    v.addEventListener('canplay', startPlayback);
    v.addEventListener('playing', startPlayback);

    v.play().then(() => {
      if (!isCancelled && !animRef.current) {
        animRef.current = requestAnimationFrame(render);
      }
    }).catch(() => {});

    return () => {
      isCancelled = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      try {
        v.pause();
        v.src = '';
        v.removeAttribute('src');
        v.load();
      } catch (_) {}
    };
  }, [isHovered, relId]);

  return (
    <div
      className="related-card"
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="related-thumb-wrap" style={{ position: 'relative', overflow: 'hidden' }}>
        <img
          src={thumbSrc(relId)}
          alt=""
          className="related-thumb-img"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        {isHovered && (
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 3,
              pointerEvents: 'none',
              borderRadius: 8,
              opacity: isPlayingFrame ? 1 : 0,
              transition: 'opacity .2s ease-in',
            }}
          />
        )}
        <span className="related-badge-dur" style={{ zIndex: 4 }}>720p</span>
      </div>
      <div className="related-card-info">
        <h3 className="related-card-title">{title}</h3>
        <div className="related-card-meta">
          {(user?.role === 'admin' || user?.role === 'advisor')
            ? `DesiHawas · #${relId}`
            : 'DesiHawas · Exclusive HD'}
        </div>
      </div>
    </div>
  );
}
