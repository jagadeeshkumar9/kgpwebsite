# KGP Innovation Pvt. Ltd. — Website

A 5-page marketing site for KGP Innovation's Smart IoT platform, with a working
"Contact Us" form wired to a small Node/Express backend that emails submissions
via SMTP (Nodemailer).

```
kgp-website/
├── frontend/           Static site (plain HTML/CSS/JS, no build step)
│   ├── index.html       Home
│   ├── devices.html     Smart Devices & Their Uses
│   ├── platform.html    Core Platform Capabilities
│   ├── applications.html Applications
│   ├── contact.html     Contact form
│   ├── styles.css
│   └── app.js
└── backend/             Express API + static file server
    ├── server.js
    ├── package.json
    ├── .env.example
    └── submissions.log.jsonl   (created automatically, gitignored)
```

## 1. Run it locally (frontend + backend together)

The backend already serves the `frontend/` folder, so one process runs the
whole site.

```bash
cd backend
npm install
cp .env.example .env      # then edit .env — see step 2
npm start
```

Visit **http://localhost:3000**. The contact form posts to `/api/contact` on
the same origin, so nothing else needs configuring for local use.

## 2. Configure email sending

Open `backend/.env` and fill in:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` — your
  mailbox's SMTP credentials.
  - **Using Gmail** (e.g. `kgpinovation@gmail.com`): you cannot use the normal
    account password. Turn on 2-Step Verification, then create an
    [App Password](https://myaccount.google.com/apppasswords) and use that as
    `SMTP_PASS`. Keep `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`,
    `SMTP_SECURE=true`.
  - **Using a business inbox** (e.g. via your hosting provider or Zoho/Outlook),
    use the SMTP host/port/credentials they give you instead.
- `MAIL_FROM` — the "from" address shown on outgoing mail (usually the same as
  `SMTP_USER`).
- `MAIL_TO` — comma-separated address(es) that should receive enquiries, e.g.
  `admin@kgpinovation.in,kgpinovation@gmail.com`.

Until SMTP is configured, the form still works — submissions are safely
recorded to `backend/submissions.log.jsonl` — but no email is sent. The API
tells the browser this explicitly so you're not left guessing.

Check `http://localhost:3000/api/health` any time — it returns
`{"ok":true,"mailConfigured":true|false}`.

## 3. Deploying

**Option A — single host (simplest):** deploy the whole `kgp-website/` folder
to any Node host (Render, Railway, a VPS, etc.), set the environment variables
from `.env.example` in the host's dashboard, and run `npm start` from
`backend/`. The same server serves the pages and the API — no CORS setup
needed, and `kgpinovation.in` can point straight at it.

**Option B — split hosting:** if you'd rather host the static `frontend/`
folder on something like Netlify/Vercel/GitHub Pages and run only the API on
a Node host:

1. Set `ALLOWED_ORIGINS` in the backend's `.env` to your frontend's domain,
   e.g. `ALLOWED_ORIGINS=https://kgpinovation.in`.
2. In `frontend/contact.html`, uncomment and set the API URL before `app.js`
   loads:
   ```html
   <script>window.KGP_CONTACT_API = "https://api.kgpinovation.in/api/contact";</script>
   ```
3. Deploy `frontend/` and `backend/` separately.

## 4. Editing content

All copy lives directly in the HTML files under `frontend/` — there's no
templating layer, so update text/nav/footer in each page individually
(the same nav and footer markup is repeated across all 5 pages).

Design tokens (colors, type, spacing) are centralized as CSS custom
properties at the top of `frontend/styles.css` under `:root`.

## 5. Anti-spam

The contact form has:
- A **honeypot field** (`company_website`), hidden from real users via CSS —
  bots that auto-fill every input trip it and are silently ignored.
- **Rate limiting** on `/api/contact` (8 requests / 15 minutes per IP).
- Server-side validation of required fields and email format.

For heavier spam traffic, consider adding a CAPTCHA (e.g. Cloudflare Turnstile
or hCaptcha) on `contact.html` and verifying the token in `server.js` before
sending mail — the current form is intentionally kept CAPTCHA-free for
simplicity.
