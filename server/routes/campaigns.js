/**
 * Campaigns routes
 * GET  /campaigns           → list all campaigns with status
 * GET  /campaigns/:id       → detail for one campaign (stats + emails)
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('better-sqlite3');

const WS = '/home/ubuntu/.openclaw/workspace';

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function getDailyStats(campaignId) {
  console.log('[DEBUG getDailyStats] campaignId:', campaignId);
  try {
    const filePath = path.join(__dirname, `../../daily_stats_${campaignId}.json`);
    console.log('[DEBUG getDailyStats] filePath:', filePath);
    console.log('[DEBUG getDailyStats] exists:', fs.existsSync(filePath));
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('[DEBUG getDailyStats] error:', e.message);
    return null;
  }
}

// ── Email sequences ────────────────────────────────────────────────────────

const EASYBOOKED_EMAILS = [
  {
    step: 1,
    subject: 'Stop losing bookings from unanswered Instagram DMs',
    preview: 'Quick question — when a customer DMs your salon on Instagram or Facebook asking to book...',
    body: `Hi {name},

Quick question — when a customer DMs your salon on Instagram or Facebook asking to book, what happens if you don't reply straight away?

They book somewhere else.

EasyBooked fixes that. It's an AI assistant that replies to your DMs instantly — 24/7 — checks your availability, and confirms the appointment. No missed messages, no back-and-forth, no double-bookings.

Everything's included for £49/month:
- AI that replies to Instagram & Facebook DMs and books clients automatically
- Online booking page with your services, staff and pricing
- Calendar management with Google Calendar sync
- Deposit collection and cancellation policies
- Staff accounts and business dashboard
- No per-booking fees — your revenue stays yours

There's a 14-day free trial — no credit card needed, cancel any time.

See how it works → easybooked.co.uk

Best,
The EasyBooked Team

---
To unsubscribe, reply with "unsubscribe".`,
  },
  {
    step: 2,
    subject: 'Following up — EasyBooked',
    preview: 'Just following up on my previous message about EasyBooked...',
    body: `Hi {name},

Just following up on my previous message about EasyBooked.

A lot of salon owners tell us the same thing — they lose bookings not because they're bad at their job, but because they can't always respond to Instagram DMs instantly. A customer asks to book at 9pm, gets no reply, and books with someone else by morning.

EasyBooked handles that automatically. The AI replies, checks your calendar, and confirms the appointment — while you sleep.

14-day free trial, no card needed: easybooked.co.uk

Kind regards,
The EasyBooked Team

---
To unsubscribe, reply with "unsubscribe".`,
  },
  {
    step: 3,
    subject: 'Every unanswered DM is a lost booking',
    preview: 'Studies show that responding within 5 minutes makes you 100x more likely to convert...',
    body: `Hi {name},

A quick thought — studies show that responding to a customer enquiry within 5 minutes makes you 100x more likely to convert them than responding an hour later.

For a busy salon, that's almost impossible to do manually. That's exactly what EasyBooked solves.

Your AI assistant is always on — replying to DMs, checking availability, confirming bookings and collecting deposits — so you never miss a customer, even when you're in the middle of a cut.

Free to try for 14 days: easybooked.co.uk

Kind regards,
The EasyBooked Team

---
To unsubscribe, reply with "unsubscribe".`,
  },
  {
    step: 4,
    subject: 'Two minutes to set up — EasyBooked',
    preview: 'I\'ll keep this one short — I know you\'ve heard from us a few times now...',
    body: `Hi {name},

I'll keep this one short — I know you've heard from us a few times now.

EasyBooked takes about two minutes to connect to your Instagram and Facebook. You add your services, set your hours, and the AI does the rest. Most salons are up and running the same day.

If you've got five minutes this week, it's worth a look.

easybooked.co.uk — free trial, no card required.

Kind regards,
The EasyBooked Team

---
To unsubscribe, reply with "unsubscribe".`,
  },
  {
    step: 5,
    subject: 'Is this goodbye?',
    preview: 'This will be our last message — we don\'t want to keep filling your inbox...',
    body: `Hi {name},

This will be our last message — we don't want to keep filling your inbox.

If you ever find yourself losing bookings to unanswered DMs, or just want a smarter way to manage appointments, EasyBooked will be there.

easybooked.co.uk

It's been good reaching out. Wishing you and the salon well.

The EasyBooked Team

---
To unsubscribe, reply with "unsubscribe".`,
  },
];

const CAMPSITE_EMAILS = [
  {
    step: 1,
    subject: 'Your campsite website — a thought from a fellow caravanner',
    preview: 'I\'m a caravanner myself — I came across {site_name} and built a free demo...',
    body: `Hi there,

I'm a caravanner myself — spend most summers touring with the family and book a lot of sites through Google.

I came across {site_name} and thought I'd do something different rather than just send a cold email — I've actually gone ahead and built a free demo of what a modern website could look like for you:

👉 {demo_url}

It's mobile-friendly, loads fast, and honestly I think it does the site justice. No obligation — just have a look and see what you think.

If you'd like to make it live, it's just £19 a month. No big upfront cost, no long contract — most owners say one extra booking a month covers it easily.

Would love to know what you think — just hit reply.

Steve Males
Brightstack Labs
steve.males@brightstacklabs.co.uk
brightstacklabs.co.uk

---
You're receiving this because your campsite is listed publicly online. Reply STOP to be removed.`,
  },
  {
    step: 2,
    subject: 'Re: Your campsite website',
    preview: 'Just following up on my message from a few days ago...',
    body: `Hi,

Just following up on my message from a few days ago.

I wanted to be upfront about how this works — there's no big upfront fee. It's just £19 a month, and that covers everything: the new site, hosting, and any updates you need. No contract trap either — just a 3-month minimum then it's rolling.

Most campsite owners tell me one extra booking a month more than covers it.

Happy to put together a free mockup of what your site could look like — no obligation at all.

Steve Males
Brightstack Labs
steve.males@brightstacklabs.co.uk
brightstacklabs.co.uk

---
Reply STOP to be removed from this list.`,
  },
  {
    step: 3,
    subject: 'Last message — campsite website',
    preview: 'Last one from me, I promise. If now\'s not the right time, no problem at all...',
    body: `Hi,

Last one from me, I promise.

If now's not the right time, no problem at all. If you ever want to revisit a website refresh for {site_name}, you know where I am.

Steve Males
Brightstack Labs
steve.males@brightstacklabs.co.uk
brightstacklabs.co.uk`,
  },
];

const INVOICEWIZARD_EMAILS = [
  {
    step: 1,
    subject: 'Turn your messy notes into invoices in seconds',
    preview: 'Hi, I wanted to introduce you to InvoiceWizard...',
    body: `Hi {name},

Quick one — how long does it take you to write up an invoice after a job?

If you're like most tradespeople, you're scribbling notes on your phone or a bit of paper, then typing it all up later. It takes ages and it's the last thing you want to do after a long day.

InvoiceWizard fixes that. You paste your notes — however messy — and it generates a clean, professional invoice in seconds. Send it straight from your phone.

It's free to try: invoicewizard.co.uk

Best,
The InvoiceWizard Team

---
To unsubscribe, reply with "unsubscribe".`,
  },
  {
    step: 2,
    subject: 'Following up — InvoiceWizard',
    preview: 'Just a quick follow-up to see if InvoiceWizard might save you some time...',
    body: `Hi {name},

Just a quick follow-up on InvoiceWizard.

A lot of tradespeople we speak to spend 20-30 minutes per invoice — writing it up, formatting it, sending it. That's time you could be on another job.

InvoiceWizard cuts that to under a minute. Paste your job notes, done.

invoicewizard.co.uk — free to try.

Kind regards,
The InvoiceWizard Team

---
To unsubscribe, reply with "unsubscribe".`,
  },
  {
    step: 3,
    subject: 'One last thing about InvoiceWizard',
    preview: 'I\'ll keep this brief — this is my last email...',
    body: `Hi {name},

I'll keep this brief — this is my last email.

If invoicing is taking up more time than it should, InvoiceWizard is there when you're ready.

invoicewizard.co.uk

Good luck with everything.

The InvoiceWizard Team

---
To unsubscribe, reply with "unsubscribe".`,
  },
];

// ── EasyBooked stats ───────────────────────────────────────────────────────

function getEasybookedStats() {
  try {
    const leadsRaw = fs.readFileSync(`${WS}/easybooked-campaign/leads-clean.json`, 'utf8');
    const leads = JSON.parse(leadsRaw);
    const stateRaw = fs.readFileSync(`${WS}/easybooked-campaign/send-state.json`, 'utf8');
    const state = JSON.parse(stateRaw);

    const sent = state.sent || [];
    const byStep = {};
    sent.forEach(s => {
      const n = s.emailNum || 1;
      byStep[n] = (byStep[n] || 0) + 1;
    });

    const uniqueContacted = new Set(sent.map(s => s.email)).size;
    const completed = sent.filter(s => s.emailNum >= 5).length;

    return {
      id: 'easybooked',
      name: 'EasyBooked — AI Salon Booking',
      active: true,
      product: 'EasyBooked',
      target: 'Hair & beauty salons',
      total_leads: leads.length,
      contacted: uniqueContacted,
      completed_sequence: completed,
      emails_sent: sent.length,
      daily_limit: 30,
      email_count: 5,
      by_step: byStep,
      last_sent: sent.length > 0 ? sent[sent.length - 1]?.sentAt : null,
      emails: EASYBOOKED_EMAILS,
    };
  } catch (e) {
    return { id: 'easybooked', name: 'EasyBooked — AI Salon Booking', active: true, error: e.message };
  }
}

// ── Campsite stats ─────────────────────────────────────────────────────────

function getCampsiteStats() {
  try {
    const db = sqlite3(`${WS}/campsite-campaign/leads.db`, { readonly: true });
    const total = db.prepare('SELECT COUNT(*) as n FROM leads').get().n;
    const byStatus = db.prepare('SELECT status, COUNT(*) as n FROM leads GROUP BY status ORDER BY n DESC').all();
    const recent = db.prepare('SELECT site_name, email, status, email1_sent_at, email2_sent_at, email3_sent_at FROM leads WHERE email1_sent_at IS NOT NULL ORDER BY email1_sent_at DESC LIMIT 5').all();
    db.close();

    const statusMap = {};
    byStatus.forEach(r => { statusMap[r.status] = r.n; });
    const emailed = byStatus.filter(r => r.status.includes('email') || r.status === 'demo_built').reduce((a, r) => a + r.n, 0);

    return {
      id: 'campsite',
      name: 'CampBook — Campsite Booking SaaS',
      active: true,
      product: 'CampBook',
      target: 'UK campsites',
      total_leads: total,
      contacted: emailed,
      completed_sequence: statusMap['email3_sent'] || 0,
      emails_sent: (statusMap['email1_sent'] || 0) + (statusMap['email2_sent'] || 0) + (statusMap['email3_sent'] || 0),
      daily_limit: null,
      email_count: 3,
      by_status: statusMap,
      emails: CAMPSITE_EMAILS,
    };
  } catch (e) {
    return { id: 'campsite', name: 'CampBook — Campsite Booking SaaS', active: true, error: e.message };
  }
}

// ── InvoiceWizard stats ────────────────────────────────────────────────────

function getInvoiceWizardStats() {
  return {
    id: 'invoicewizard',
    name: 'InvoiceWizard — AI Invoicing',
    active: false,
    paused_reason: 'Paused pending strategy review',
    product: 'InvoiceWizard',
    target: 'Tradespeople & small businesses',
    total_leads: 174,
    contacted: 174,
    completed_sequence: 0,
    emails_sent: 174,
    daily_limit: 30,
    email_count: 3,
    emails: INVOICEWIZARD_EMAILS,
  };
}

// ── Router ─────────────────────────────────────────────────────────────────

module.exports = async function campaignsRoutes(req, res) {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/campaigns') {
    const campaigns = [
      getEasybookedStats(),
      getCampsiteStats(),
      getInvoiceWizardStats(),
    ].map(c => ({
      id: c.id,
      name: c.name,
      active: c.active,
      product: c.product,
      target: c.target,
      total_leads: c.total_leads,
      contacted: c.contacted,
      emails_sent: c.emails_sent,
      completed_sequence: c.completed_sequence,
      email_count: c.email_count,
      paused_reason: c.paused_reason,
    }));
    return json(res, 200, campaigns);
  }

  const detailMatch = url.match(/^\/campaigns\/([a-z0-9_-]+)$/);
  if (req.method === 'GET' && detailMatch) {
    const id = detailMatch[1];
    console.log('[DEBUG] Campaign detail requested:', id);
    let data;
    if (id === 'easybooked') data = getEasybookedStats();
    else if (id === 'campsite') data = getCampsiteStats();
    else if (id === 'invoicewizard') data = getInvoiceWizardStats();
    else return json(res, 404, { error: 'Campaign not found' });
    
    const daily_stats = await getDailyStats(id);
    data.daily_stats = daily_stats;
    console.log('[DEBUG] Returning data with daily_stats:', !!data.daily_stats);
    return json(res, 200, data);
  }

  json(res, 404, { error: 'Not found' });

  // Daily stats endpoint
  if (req.method === 'GET' && url === '/daily-stats') {
    return json(res, 200, {
      easybooked: JSON.parse(fs.readFileSync(path.join(__dirname, '../../daily_stats_easybooked.json'))),
      campsite: JSON.parse(fs.readFileSync(path.join(__dirname, '../../daily_stats_campsite.json')))
    });
  }
};
