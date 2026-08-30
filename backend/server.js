// ============================================================
// KGP Innovation — backend
// Serves the static frontend and handles the /api/contact form,
// sending mail via SMTP through Nodemailer.
// ============================================================
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const SUBMISSIONS_LOG = path.join(__dirname, 'submissions.log.jsonl');

// ---------- Middleware ----------
app.use(express.json({ limit: '20kb' }));

if (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.trim()) {
  const allowed = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
  app.use(cors({ origin: allowed }));
} else {
  // Same-origin deployment (frontend served by this same server) — no CORS needed,
  // but this keeps things working if you split hosting later without setting the env var.
  app.use(cors());
}

// Static site
app.use(express.static(FRONTEND_DIR));

// Rate limit the contact endpoint specifically to curb abuse
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages sent from this network. Please try again later.' },
});

// ---------- Mail transport ----------
function buildTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: String(SMTP_SECURE).toLowerCase() === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}
const transporter = buildTransport();

if (transporter) {
  transporter.verify()
    .then(() => console.log('[mail] SMTP transport ready'))
    .catch(err => console.warn('[mail] SMTP verify failed — check .env:', err.message));
} else {
  console.warn('[mail] SMTP not configured — contact form will log submissions but NOT send email. See backend/.env.example');
}

// ---------- Helpers ----------
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function logSubmission(entry) {
  try {
    fs.appendFileSync(SUBMISSIONS_LOG, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('[log] failed to write submission log:', err.message);
  }
}

// ---------- Routes ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, mailConfigured: Boolean(transporter) });
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, phone, organization, interest, message, company_website } = req.body || {};

  // Honeypot — bots fill every field, real users never see this one
  if (company_website) {
    return res.json({ success: true }); // silently pretend success to the bot
  }

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Name, email and message are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }
  if (String(message).length > 5000) {
    return res.status(400).json({ success: false, message: 'Message is too long.' });
  }

  const submission = {
    name: String(name).trim().slice(0, 200),
    email: String(email).trim().slice(0, 200),
    phone: phone ? String(phone).trim().slice(0, 60) : '',
    organization: organization ? String(organization).trim().slice(0, 200) : '',
    interest: interest ? String(interest).trim().slice(0, 120) : 'General enquiry',
    message: String(message).trim().slice(0, 5000),
    receivedAt: new Date().toISOString(),
    ip: req.ip,
  };

  logSubmission(submission);

  if (!transporter) {
    // Backend is up and the enquiry is safely logged, but SMTP isn't configured yet.
    return res.status(200).json({
      success: true,
      message: 'Message received. (Note: email delivery is not yet configured on the server.)',
    });
  }

  const mailTo = process.env.MAIL_TO || process.env.SMTP_USER;
  const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER;

  const html = `
    <div style="font-family:Arial,sans-serif; font-size:14px; color:#0A2540;">
      <h2 style="margin:0 0 12px;">New website enquiry — KGP Innovation</h2>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
        <tr><td><b>Name</b></td><td>${escapeHtml(submission.name)}</td></tr>
        <tr><td><b>Email</b></td><td>${escapeHtml(submission.email)}</td></tr>
        <tr><td><b>Phone</b></td><td>${escapeHtml(submission.phone) || '—'}</td></tr>
        <tr><td><b>Organization</b></td><td>${escapeHtml(submission.organization) || '—'}</td></tr>
        <tr><td><b>Interested in</b></td><td>${escapeHtml(submission.interest)}</td></tr>
        <tr><td valign="top"><b>Message</b></td><td>${escapeHtml(submission.message).replace(/\n/g, '<br>')}</td></tr>
      </table>
      <p style="color:#8398A2; font-size:12px; margin-top:16px;">Received ${submission.receivedAt}</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: mailFrom,
      to: mailTo,
      replyTo: submission.email,
      subject: `Website enquiry: ${submission.interest} — ${submission.name}`,
      html,
    });

    // Optional courtesy auto-reply to the sender
    await transporter.sendMail({
      from: mailFrom,
      to: submission.email,
      subject: 'We received your message — KGP Innovation',
      html: `
        <div style="font-family:Arial,sans-serif; font-size:14px; color:#0A2540;">
          <p>Hi ${escapeHtml(submission.name)},</p>
          <p>Thanks for reaching out to KGP Innovation. We've received your message about
             <b>${escapeHtml(submission.interest)}</b> and will get back to you within 1–2 business days.</p>
          <p>— KGP Innovation Pvt. Ltd.</p>
        </div>
      `,
    }).catch(err => console.warn('[mail] auto-reply failed (non-fatal):', err.message));

    return res.json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    console.error('[mail] send failed:', err.message);
    return res.status(502).json({
      success: false,
      message: 'Your message was received but email delivery failed. We will still follow up shortly.',
    });
  }
});

// Fallback to index.html for any unknown non-API route (simple multi-page site, so
// mostly unnecessary, but keeps direct links to e.g. /devices working without .html)
app.get(/^\/(?!api\/).*/, (req, res, next) => {
  const candidate = path.join(FRONTEND_DIR, req.path.endsWith('.html') ? req.path : `${req.path}.html`);
  if (fs.existsSync(candidate)) return res.sendFile(candidate);
  next();
});

app.listen(PORT, () => {
  console.log(`KGP Innovation site + API running at http://localhost:${PORT}`);
});
