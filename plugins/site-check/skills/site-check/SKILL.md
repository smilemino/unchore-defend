---
name: site-check
description: Grades a public website's security headers and cookie flags (A–F, 0–100), gives the one-line fix for each gap, and a README badge. No account, no key, nothing sent to Unchore.
---

# Unchore site check

For "is my site locked properly?", "why is my security grade low?", "add a security badge to the README".

## How to use

1. Run from this skill's folder (Node 22+, no install):
   `node scripts/site-check.mjs example.com` (add `--json` for machine-readable output)
2. Tell the user the grade, then the failed checks **in order of points lost**, each with its fix, in the user's language.
   If you can see the project's code, offer to make the fix where the headers are set (web server config, framework
   middleware, hosting config such as `vercel.json`, `netlify.toml`, `_headers`, nginx `add_header`).
3. After a fix is deployed, run it again and show the new grade.
4. Offer the badge line from the output for the README. It says what was measured (security headers) — don't
   describe it as a full security audit.

## Rules

- Only public http/https sites on ports 80/443. Private, local and cloud-metadata addresses are refused on purpose.
- It sends one ordinary GET to the site — nothing else, and nothing to Unchore.
- Headers are one layer. They say nothing about the site's code, logins or servers.
