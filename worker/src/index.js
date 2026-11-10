// LR Solutions contact endpoint — Cloudflare Worker.
// POST /contact  { name, email, company?, phone?, type?, message, website (honeypot), cf-turnstile-response }
//
// Secrets (wrangler secret put …):  TURNSTILE_SECRET, MAIL_TO, MAIL_CC, [RESEND_API_KEY]
// Vars (wrangler.toml):             ALLOWED_ORIGINS, MAIL_FROM, MAIL_FROM_NAME
// Delivery: Resend if RESEND_API_KEY is set, otherwise the Cloudflare Email Routing `SEND_EMAIL` binding.

import { EmailMessage } from 'cloudflare:email';

const LIMITS = { name: 120, email: 200, company: 160, phone: 40, type: 80, message: 5000 };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' }
      : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: allowed.includes(origin) ? 204 : 403,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' },
      });
    }

    const json = (status, body) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, 'Content-Type': 'application/json' },
    });

    if (url.pathname !== '/contact') return json(404, { ok: false, error: 'Not found.' });
    if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });
    if (!allowed.includes(origin)) return json(403, { ok: false, error: 'Origin not allowed.' });

    let body;
    try {
      if (Number(request.headers.get('Content-Length') || 0) > 20000) throw new Error();
      body = await request.json();
    } catch {
      return json(400, { ok: false, error: 'Invalid request.' });
    }

    // Honeypot: bots fill hidden fields. Pretend success.
    if (body.website) return json(200, { ok: true });

    const f = {};
    for (const [k, max] of Object.entries(LIMITS)) f[k] = String(body[k] ?? '').trim().slice(0, max);
    if (!f.name || !f.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
      return json(400, { ok: false, error: 'Please add your name, a valid email and a message.' });
    }

    // Human verification (Cloudflare Turnstile)
    const human = await verifyTurnstile(env, body['cf-turnstile-response'], request.headers.get('CF-Connecting-IP'));
    if (!human) return json(400, { ok: false, error: 'Human check failed. Please retry it.' });

    const subject = `New enquiry: ${f.name}${f.company ? ` (${f.company})` : ''}`;
    const text = [
      `Name:     ${f.name}`,
      `Email:    ${f.email}`,
      `Business: ${f.company || '—'}`,
      `Phone:    ${f.phone || '—'}`,
      `Type:     ${f.type || '—'}`,
      '',
      f.message,
      '',
      '— Sent from the contact form on lr-solutions.com. Reply to this email to answer the sender directly.',
    ].join('\n');

    try {
      if (env.RESEND_API_KEY) await sendResend(env, { subject, text, replyTo: f.email });
      else await sendCloudflare(env, { subject, text, replyTo: f.email, replyName: f.name });
    } catch (err) {
      console.error('send failed', err?.message || err);
      return json(502, { ok: false, error: 'We could not send your message right now.' });
    }
    return json(200, { ok: true });
  },
};

async function verifyTurnstile(env, token, ip) {
  if (!token || !env.TURNSTILE_SECRET) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const d = await r.json().catch(() => ({}));
  return d.success === true;
}

const recipients = env => ({
  to: (env.MAIL_TO || '').split(',').map(s => s.trim()).filter(Boolean),
  cc: (env.MAIL_CC || '').split(',').map(s => s.trim()).filter(Boolean),
});

async function sendResend(env, { subject, text, replyTo }) {
  const { to, cc } = recipients(env);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${env.MAIL_FROM_NAME} <${env.MAIL_FROM}>`, to, cc, reply_to: replyTo, subject, text }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

// Cloudflare Email Routing only delivers to one verified address per message,
// so we send the same message (with a visible Cc header) once per recipient.
async function sendCloudflare(env, { subject, text, replyTo, replyName }) {
  if (!env.SEND_EMAIL) throw new Error('SEND_EMAIL binding missing');
  const { to, cc } = recipients(env);
  const domain = env.MAIL_FROM.split('@')[1];
  const headers = [
    `From: ${encodeWord(env.MAIL_FROM_NAME)} <${env.MAIL_FROM}>`,
    `To: ${to.join(', ')}`,
    cc.length ? `Cc: ${cc.join(', ')}` : null,
    `Reply-To: ${encodeWord(replyName)} <${replyTo.replace(/[\r\n<>]/g, '')}>`,
    `Subject: ${encodeWord(subject)}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
  ].filter(Boolean).join('\r\n');
  const raw = `${headers}\r\n\r\n${b64(text).replace(/.{76}/g, '$&\r\n')}`;
  for (const rcpt of [...to, ...cc]) {
    await env.SEND_EMAIL.send(new EmailMessage(env.MAIL_FROM, rcpt, raw));
  }
}

function b64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
const encodeWord = s => `=?UTF-8?B?${b64(String(s).replace(/[\r\n]/g, ' '))}?=`;
