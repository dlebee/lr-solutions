# L&R Solutions — lr-solutions.com

Static one-page website (GitHub Pages) plus a free contact-form API (Cloudflare Worker + Turnstile).

```
site/            → the website (deployed to GitHub Pages)
  index.html       single-page site
  brand/           brand kit page (lr-solutions.com/brand/, not indexed)
  assets/          css (tokens.css = brand tokens), js, logo SVGs
  CNAME            lr-solutions.com
worker/          → contact form API (Cloudflare Worker)
```

Cost: **$0**. GitHub Pages is free, Cloudflare Workers' free tier allows 100k requests a day, and Turnstile and Email Routing are free.

---

## 1. Website on GitHub Pages

> ✅ DNS is already configured in Cloudflare (2026-11-10): 4 A + 4 AAAA records on the root and `www` → `dlebee.github.io`, all **DNS only**. Email records (M365) were left untouched.

1. Create a GitHub repo (public, so Pages is free) and push this folder to `main`.
2. Repo → **Settings → Pages → Source: GitHub Actions**. The included workflow deploys `site/` on every push.
3. Same page → **Custom domain:** `lr-solutions.com` → Save, then tick **Enforce HTTPS** once the certificate is issued.
4. DNS records for `lr-solutions.com`:

| Type  | Name | Value |
|-------|------|-------|
| A     | @    | 185.199.108.153 |
| A     | @    | 185.199.109.153 |
| A     | @    | 185.199.110.153 |
| A     | @    | 185.199.111.153 |
| CNAME | www  | `<your-github-username>.github.io` |

If DNS is on Cloudflare, set these records to **DNS only** (grey cloud) so GitHub can issue the HTTPS certificate.

## 2. Human verification (Cloudflare Turnstile)

1. Cloudflare dashboard → **Turnstile → Add widget**. Hostnames: `lr-solutions.com`, `www.lr-solutions.com`, `localhost`. Mode: *Managed*.
2. Copy the **site key** into `site/index.html` (replace `1x00000000000000000000AA` in the `cf-turnstile` div).
3. Keep the **secret key** for step 3.

## 3. Contact API (Cloudflare Worker)

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put TURNSTILE_SECRET   # from step 2
npx wrangler secret put MAIL_TO            # bruiz@lr-solutions.com
npx wrangler secret put MAIL_CC            # david@lr-solutions.com
npx wrangler deploy
```

`deploy` prints a URL like `https://lr-contact.<you>.workers.dev`. Put `<that URL>/contact` into `data-endpoint` on the `<form>` in `site/index.html` and push.

The recipient addresses are stored only as encrypted Worker secrets. They never appear in the website, the browser, or this repo.

### Email delivery: use Resend (Option B)

> **lr-solutions.com mail is on Microsoft 365** (MX → outlook.com). Do **not** enable Cloudflare Email Routing on the root domain: it would replace the MX record and break incoming mail. Use Option B.

**Option A: Cloudflare Email Routing (all Cloudflare, free).** Needs `lr-solutions.com` DNS on Cloudflare.
1. Cloudflare → `lr-solutions.com` → **Email → Email Routing → Enable**.
2. **Destination addresses:** add `bruiz@…` and `david@…`. Each person clicks the verification link sent to them.
3. Nothing else to do. The Worker uses the `SEND_EMAIL` binding automatically.

> ⚠️ Enabling Email Routing replaces the domain's **MX records** with Cloudflare's. If `@lr-solutions.com` mailboxes live at Google Workspace or Microsoft 365, enabling it on the root domain would break incoming mail. In that case, enable Email Routing on a subdomain (for example `mail.lr-solutions.com`), set `MAIL_FROM = "website@mail.lr-solutions.com"` in `wrangler.toml`, or use Option B.

**Option B: Resend (free tier, 3,000 emails a month, real CC, doesn't touch MX).**
1. Sign up at resend.com, add the domain `lr-solutions.com`, and add the DNS records it shows.
2. `npx wrangler secret put RESEND_API_KEY`, then `npx wrangler deploy`. When this key is set the Worker uses Resend instead of Option A.

### Optional: nicer API URL
If the zone is on Cloudflare, uncomment the `routes` line in `wrangler.toml` to serve at `https://api.lr-solutions.com`, and update `data-endpoint`.

## Local development

```bash
cp worker/.dev.vars.example worker/.dev.vars
cd worker && npm run dev                      # API on :8787 (emails are written to .wrangler/tmp)
python3 -m http.server 8080 --directory site  # site on :8080 (form auto-targets localhost:8787)
```

## How the form is protected
- Cloudflare Turnstile token, verified server-side
- Hidden honeypot field (bots get a fake success)
- Only accepts requests from `ALLOWED_ORIGINS`
- Field length limits, plain-text email only (no HTML injection), 20 KB body cap
- Reply-To is set to the visitor, so hitting Reply in your inbox answers them directly
