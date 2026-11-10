# L&R Solutions — lr-solutions.com

Static one-page website on GitHub Pages. The contact-form API lives in a separate private repo.

```
site/            → the website (deployed to GitHub Pages)
  index.html       single-page site
  brand/           brand kit page (lr-solutions.com/brand/, not indexed)
  assets/          css (tokens.css = brand tokens), js, logo SVGs
  CNAME            lr-solutions.com
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

## 2. Contact form API

The form posts to `https://api.lr-solutions.com/contact`, a Cloudflare Worker kept in the private repo **dlebee/lr-solutions-api** (checked out locally in `worker/`, which this repo ignores). The Turnstile site key in `site/index.html` is public by design; the secret, the Resend key and the recipient addresses live only as Worker secrets.

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
