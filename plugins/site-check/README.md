# Unchore Site Check

Grade any public website's security headers and cookie flags (A–F, 0–100), get the one-line fix for each gap, and a badge for your README.
No key, no account. It sends one ordinary request to the site you name and nothing anywhere else.

## Install (Claude Code)

```
/plugin marketplace add smilemino/unchore-defend
/plugin install unchore-site-check@unchore
```

Then ask: *"check the security headers of mysite.com and fix what you can"*.

## What it checks

HTTPS (25), HSTS (15), Content-Security-Policy (15), clickjacking protection (10), `nosniff` (10), Referrer-Policy (8), Permissions-Policy (5), cookie flags (7), server version hidden (5). A ≥ 90 · B ≥ 75 · C ≥ 60 · D ≥ 40.

Private, local and cloud-metadata addresses are refused, every redirect is checked again, and it stops after 3 redirects, 8 seconds or 200 KB.

```
https://example.com/ → F (37/100) · HTTP 200

✓ Served over HTTPS
✗ HSTS (browsers stay on HTTPS) (−15) — fix: Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
…
Badge for your README (it only claims what was measured):
[![Security headers: F (37/100) — checked with Unchore](https://img.shields.io/badge/security%20headers-F%20(37%2F100)-red)](https://unchore.ai/tools/site-check?utm_source=badge&utm_campaign=site-check)
```

The badge says what was measured: response headers. It is not a full security audit.

Also in a browser: [unchore.ai/tools/site-check](https://unchore.ai/tools/site-check?utm_source=github&utm_campaign=site-check-plugin). Privacy: [PRIVACY.md](../../PRIVACY.md). MIT © 2026 Unchore.
