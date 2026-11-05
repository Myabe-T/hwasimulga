'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SupportPage() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('General');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdTicket, setCreatedTicket] = useState(null);

  // User's previous tickets (if logged in)
  const [myTickets, setMyTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    fetch('/api/verify')
      .then(r => r.json())
      .then(d => {
        if (d.auth && d.user) {
          setUser(d.user);
          setName(d.user.displayName || d.user.username || '');
          setEmail(d.user.email || '');
          fetchUserTickets();
        }
      })
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, []);

  async function fetchUserTickets() {
    setLoadingTickets(true);
    try {
      const res = await fetch('/api/hwasi/tickets');
      if (res.ok) {
        const d = await res.json();
        setMyTickets(d.tickets || []);
      }
    } catch {}
    finally { setLoadingTickets(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (subject.trim().length < 3) {
      setError('Please provide a subject line (minimum 3 characters).');
      return;
    }
    if (message.trim().length < 5) {
      setError('Please describe your issue in more detail (minimum 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/hwasi/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          category,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setCreatedTicket(data.ticket);
        setSubject('');
        setMessage('');
        if (user) fetchUserTickets();
      } else {
        setError(data.error || 'Failed to submit ticket. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#f1f5f9', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Top Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,10,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/gallery" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Gallery
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 15 }}>
            <span style={{ color: '#ff2d78' }}>🔥</span> Desi<span style={{ color: '#ec4899' }}>Hawas</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(236,72,153,0.15)', color: '#ec4899', fontWeight: 700 }}>
              SUPPORT
            </span>
          </div>
        </div>

        <div>
          {user ? (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              Logged in as <strong style={{ color: '#fff' }}>@{user.username}</strong>
            </span>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <Link href="/login" style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                Login
              </Link>
              <Link href="/register" style={{ padding: '4px 10px', borderRadius: 6, background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', color: '#fff', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>
                Register
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Container ── */}
      <main style={{ maxWidth: 840, margin: '0 auto', padding: '36px 16px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🎧</div>
          <h1 style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 900, margin: '0 0 8px', color: '#fff' }}>
            DesiHawas Help &amp; Support Desk
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
            Encountered an issue, need help with VIP Premium, or want to report a broken stream? We are here to help.
          </p>
        </div>

        {/* ── Success Confirmation Screen ── */}
        {createdTicket ? (
          <div style={{
            background: 'linear-gradient(145deg, rgba(34,197,94,0.1), rgba(16,185,129,0.04))',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 16, padding: '28px 24px', textAlign: 'center', marginBottom: 32
          }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#4ade80', marginBottom: 8 }}>
              Ticket Submitted Successfully!
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', maxWidth: 480, margin: '0 auto 16px', lineHeight: 1.6 }}>
              Your support ticket reference is <strong style={{ color: '#fff', fontFamily: 'monospace', fontSize: 16 }}>#{createdTicket.id}</strong>.
              Our support team has been notified and will review your request shortly.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setCreatedTicket(null)}
                style={{ padding: '10px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                + Submit Another Ticket
              </button>
              <Link
                href="/gallery"
                style={{ padding: '10px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}
              >
                ← Back to Gallery
              </Link>
            </div>
          </div>
        ) : (
          /* ── Ticket Submission Form ── */
          <div style={{
            background: '#111116',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 18, padding: '28px 24px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)'
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 18, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📝</span> Submit a Request
            </h2>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16
              }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Guest Identity Fields (Name & Contact Email) */}
              {!user && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                      Your Name or Handle:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul, Anonymous"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                        color: '#fff', fontSize: 13, outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                      Email / Contact Info (Optional):
                    </label>
                    <input
                      type="email"
                      placeholder="To receive reply updates"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                        color: '#fff', fontSize: 13, outline: 'none'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Category */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                  Category:
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: 13, outline: 'none'
                  }}
                >
                  <option value="General" style={{ background: '#18181f' }}>General Inquiry / Question</option>
                  <option value="VIP Premium & Payment" style={{ background: '#18181f' }}>VIP Premium &amp; Payment Support</option>
                  <option value="Video Playback Issue" style={{ background: '#18181f' }}>Video Playback / Buffering Problem</option>
                  <option value="Broken Video / Report" style={{ background: '#18181f' }}>Broken Video / Content Report</option>
                  <option value="Account & Login" style={{ background: '#18181f' }}>Account, Login &amp; Password</option>
                  <option value="Feature Suggestion" style={{ background: '#18181f' }}>Feature Suggestion / Feedback</option>
                </select>
              </div>

              {/* Subject */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                  Subject Line:
                </label>
                <input
                  type="text"
                  placeholder="Brief summary of your request"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontSize: 13, outline: 'none'
                  }}
                />
              </div>

              {/* Message */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                  Description / Details:
                </label>
                <textarea
                  rows={5}
                  placeholder="Please describe the issue or inquiry in detail..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontSize: 13, outline: 'none', resize: 'vertical'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '12px 24px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  color: '#fff', border: 'none', fontWeight: 800, fontSize: 14,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  boxShadow: '0 4px 20px rgba(236,72,153,0.35)',
                  transition: 'transform 0.15s, opacity 0.15s'
                }}
              >
                {submitting ? 'Submitting...' : '🚀 Submit Support Ticket'}
              </button>
            </form>
          </div>
        )}

        {/* ── Member's Previous Tickets (if logged in) ── */}
        {user && myTickets.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📋</span> Your Support Tickets ({myTickets.length})
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {myTickets.map(t => (
                <div key={t.id} style={{
                  background: '#111116', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: '16px 18px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#a78bfa', fontSize: 12 }}>#{t.id}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>{t.category}</span>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: t.status === 'replied' ? 'rgba(74,222,128,0.15)' : t.status === 'closed' || t.status === 'resolved' ? 'rgba(156,163,175,0.15)' : 'rgba(245,158,11,0.15)',
                      color: t.status === 'replied' ? '#4ade80' : t.status === 'closed' || t.status === 'resolved' ? '#9ca3af' : '#fbbf24'
                    }}>
                      {t.status === 'replied' ? '✓ Replied' : t.status === 'closed' || t.status === 'resolved' ? 'Resolved' : 'Open'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>{t.subject}</h3>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '0 0 10px', lineHeight: 1.5 }}>{t.message}</p>

                  {/* Admin Reply */}
                  {t.adminReply && (
                    <div style={{
                      background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)',
                      borderRadius: 10, padding: '12px 14px', marginTop: 10
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#c084fc', marginBottom: 4 }}>
                        💬 Reply from {t.repliedBy || 'Support Desk'}:
                      </div>
                      <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.5 }}>
                        {t.adminReply}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
