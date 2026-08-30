// ---------- Mobile nav toggle ----------
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', links.classList.contains('open'));
    });
  }

  // ---------- Live telemetry panel simulation ----------
  // Purely illustrative client-side animation of the kind of live
  // readings the KGP platform surfaces over MQTT — no real device data.
  const tiles = document.querySelectorAll('[data-tele]');
  if (tiles.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const ranges = {
      water: { min: 42, max: 96, unit: '%' },
      quality: { min: 6.4, max: 7.8, unit: 'pH', decimals: 1 },
      bin: { min: 18, max: 88, unit: '%' },
      parking: { min: 4, max: 40, unit: '/48' },
      soil: { min: 22, max: 70, unit: '%' },
      street: { min: 0, max: 1, unit: '' },
    };
    function tick() {
      tiles.forEach(tile => {
        const kind = tile.getAttribute('data-tele');
        const cfg = ranges[kind];
        if (!cfg) return;
        const el = tile.querySelector('.tele-value');
        if (!el) return;
        const val = cfg.decimals
          ? (Math.random() * (cfg.max - cfg.min) + cfg.min).toFixed(cfg.decimals)
          : Math.round(Math.random() * (cfg.max - cfg.min) + cfg.min);
        el.textContent = val + (cfg.unit ? cfg.unit : '');
      });
    }
    tick();
    setInterval(tick, 2600);
  }
});

// ---------- Contact form submission ----------
const CONTACT_API = window.KGP_CONTACT_API || '/api/contact';

function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const statusEl = document.getElementById('form-status');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.classList.remove('show', 'ok', 'err');

    const data = Object.fromEntries(new FormData(form).entries());

    // Honeypot spam check
    if (data.company_website) return;

    if (!data.name || !data.email || !data.message) {
      showStatus('Please fill in your name, email and message.', 'err');
      return;
    }

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Sending…';

    try {
      const res = await fetch(CONTACT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));

      if (res.ok && result.success) {
        showStatus("Thanks — your message has been sent. We'll get back to you shortly.", 'ok');
        form.reset();
      } else {
        showStatus(result.message || 'Something went wrong sending your message. Please try again or email us directly.', 'err');
      }
    } catch (err) {
      showStatus('Could not reach the server. Please try again or email us directly at kgpinovation@gmail.com.', 'err');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.classList.add('show', type);
  }
}
document.addEventListener('DOMContentLoaded', initContactForm);
