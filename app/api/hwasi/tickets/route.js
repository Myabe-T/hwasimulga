export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { redis, KEYS } from '@/lib/redis';

const TICKETS_KEY = 'hwasi:tickets';

// Helper to generate a clean Ticket ID (e.g., TICK-9X4A2F)
function generateTicketId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TICK-${rand}`;
}

// GET /api/hwasi/tickets
// Admin/Advisor sees all tickets with stats; Regular users see only their own tickets
export async function GET(req) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const rawList = await redis.lrange(TICKETS_KEY, 0, 999).catch(() => []);
  const allTickets = (rawList || []).map(item => {
    try {
      return typeof item === 'string' ? JSON.parse(item) : item;
    } catch {
      return null;
    }
  }).filter(Boolean);

  const isAdminOrAdvisor = ['admin', 'advisor'].includes(session.role);

  if (isAdminOrAdvisor) {
    const stats = {
      total: allTickets.length,
      open: allTickets.filter(t => t.status === 'open' || !t.status).length,
      replied: allTickets.filter(t => t.status === 'replied').length,
      resolved: allTickets.filter(t => t.status === 'resolved').length,
    };
    return NextResponse.json({ ok: true, tickets: allTickets, stats });
  }

  // Regular user: filter to tickets belonging to this user
  const myTickets = allTickets.filter(
    t => String(t.userId) === String(session.sub) || t.username === session.username
  );

  const unreadReplies = myTickets.filter(t => t.userUnread === true).length;

  return NextResponse.json({
    ok: true,
    tickets: myTickets,
    unreadReplies,
    hasUnreadReplies: unreadReplies > 0,
  });
}

// POST /api/hwasi/tickets
// Creates a new support ticket
export async function POST(req) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Please log in to submit a ticket.' }, { status: 401 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON request' }, { status: 400 });
  }

  const subject = (body.subject || '').trim();
  const message = (body.message || '').trim();
  const category = (body.category || 'General').trim();

  if (subject.length < 3) {
    return NextResponse.json({ ok: false, error: 'Subject must be at least 3 characters long.' }, { status: 400 });
  }
  if (message.length < 5) {
    return NextResponse.json({ ok: false, error: 'Please provide more details in the message (min 5 characters).' }, { status: 400 });
  }

  const ticket = {
    id: generateTicketId(),
    userId: session.sub,
    username: session.username || 'user',
    displayName: session.displayName || session.username || 'User',
    role: session.role || 'viewer',
    category,
    subject,
    message,
    status: 'open',
    createdAt: new Date().toISOString(),
    adminReply: null,
    repliedAt: null,
    repliedBy: null,
    userUnread: false,
  };

  await redis.lpush(TICKETS_KEY, JSON.stringify(ticket));
  await redis.ltrim(TICKETS_KEY, 0, 999);

  return NextResponse.json({ ok: true, ticket });
}

// PATCH /api/hwasi/tickets
// Admin replies to ticket OR User marks ticket read / resolved
export async function PATCH(req) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { ticketId, reply, status, markRead } = body;
  if (!ticketId) {
    return NextResponse.json({ ok: false, error: 'ticketId required' }, { status: 400 });
  }

  const rawList = await redis.lrange(TICKETS_KEY, 0, 999).catch(() => []);
  let found = false;
  let updatedTicket = null;

  const isAdminOrAdvisor = ['admin', 'advisor'].includes(session.role);

  const newList = (rawList || []).map(item => {
    try {
      const t = typeof item === 'string' ? JSON.parse(item) : item;
      if (t.id === ticketId) {
        found = true;

        if (isAdminOrAdvisor && reply !== undefined) {
          // Admin replying to the ticket
          t.adminReply = reply.trim();
          t.repliedAt = new Date().toISOString();
          t.repliedBy = session.displayName || session.username || 'Admin';
          t.status = status || 'replied';
          t.userUnread = true; // Alerts user upon login
          updatedTicket = t;
        } else if (markRead) {
          // User reading the ticket
          t.userUnread = false;
          updatedTicket = t;
        } else if (status) {
          t.status = status;
          updatedTicket = t;
        }
        return JSON.stringify(t);
      }
      return typeof item === 'string' ? item : JSON.stringify(item);
    } catch {
      return item;
    }
  });

  if (!found) {
    return NextResponse.json({ ok: false, error: 'Ticket not found' }, { status: 404 });
  }

  // Atomically replace list
  await redis.del(TICKETS_KEY);
  if (newList.length > 0) {
    await redis.rpush(TICKETS_KEY, ...newList);
  }

  // If admin replied, send immediate notification to the user's notification box
  if (isAdminOrAdvisor && updatedTicket && reply) {
    try {
      const notifEntry = JSON.stringify({
        message: `Admin replied to your support ticket #${updatedTicket.id} ("${updatedTicket.subject}"):\n\n"${reply.trim()}"`,
        from: '🎧 Support Desk',
        timestamp: new Date().toISOString(),
        type: 'ticket_reply',
        ticketId: updatedTicket.id,
      });
      await redis.hset(KEYS.NOTIFICATIONS, { [String(updatedTicket.userId)]: notifEntry });
    } catch (notifErr) {
      console.error('Error dispatching ticket reply notification:', notifErr);
    }
  }

  return NextResponse.json({ ok: true, ticket: updatedTicket });
}
