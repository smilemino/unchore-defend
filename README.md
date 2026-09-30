# Unchore Defend

**Security help for the person protecting the system.** Two tools, no install, works in Claude Code, Claude Desktop, any MCP client, or a plain terminal.

[English](README.md) · [한국어](README.ko.md)

| Tool | What you get | Needs |
|---|---|---|
| **site check** | Your site's security headers graded A–F, the one-line fix for each gap, and a README badge | Nothing — no account, no key |
| **defend** | Paste a log, code, config or a suspicious message → what happened, how bad it is, what to fix first | An OpenRouter key *or* an Unchore key |

```
$ node skills/site-check/scripts/site-check.mjs example.com
https://example.com/ → F (37/100) · HTTP 200

✓ Served over HTTPS
✗ HSTS (browsers stay on HTTPS) (−15) — fix: Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
✗ Content-Security-Policy set (−15) — fix: Add a Content-Security-Policy; start with `default-src 'self'` …
…
```

## Install

**Claude Code** (skills + MCP tools):

```
/plugin marketplace add smilemino/unchore-defend
/plugin install unchore-defend@unchore
```

Then just ask: *"check the security headers of mysite.com and fix what you can"* or *"read access.log — were we attacked?"*

**Claude Desktop:** download `unchore-defend.mcpb` from [Releases](https://github.com/smilemino/unchore-defend/releases) and open it.

**Any MCP client** (Cursor, VS Code, Windsurf, …) — clone this repo, then add:

```json
{
  "mcpServers": {
    "unchore-defend": {
      "command": "node",
      "args": ["/path/to/unchore-defend/mcp/server.mjs"],
      "env": { "OPENROUTER_API_KEY": "sk-or-…" }
    }
  }
}
```

**Terminal only:** Node 22+, nothing to install.

```
node skills/site-check/scripts/site-check.mjs mysite.com
node skills/unchore-defend/scripts/defend.mjs "Who got in, and what did they take?" --file access.log
tail -n 500 access.log | node skills/unchore-defend/scripts/defend.mjs "Is this an attack?"
```

## Site check

Nine checks, weighted: HTTPS (25), HSTS (15), Content-Security-Policy (15), clickjacking protection (10), `nosniff` (10), Referrer-Policy (8), Permissions-Policy (5), cookie flags (7), server version hidden (5). A ≥ 90 · B ≥ 75 · C ≥ 60 · D ≥ 40.

It sends one ordinary GET to the site and nothing anywhere else. Private, local and cloud-metadata addresses are refused, every redirect is checked again, and it stops after 3 redirects, 8 seconds or 200 KB.

Put the grade in your README — the output gives you the line:

[![Security headers: B (80/100) — checked with Unchore](https://img.shields.io/badge/security%20headers-B%20(80%2F100)-green)](https://unchore.ai/tools/site-check?utm_source=badge&utm_campaign=site-check)

The badge says what was measured: response headers. It is not a full security audit.

Rather click than type? The same check runs at [unchore.ai/tools/site-check](https://unchore.ai/tools/site-check?utm_source=github&utm_campaign=defend-readme).

## Defend

For "we were hit — what happened?", "is this log an attack?", "what did this script do?".

- **Masked before sending:** phone numbers, ID/card/account numbers, e-mails, API keys, tokens and private keys. IP addresses, paths and timestamps stay — they are the evidence.
- **If one AI refuses, the next answers.** Some safety filters refuse even defenders. Defend asks Claude first, then GPT, GLM and DeepSeek — only when the one before refused. GLM and DeepSeek run on US hosts, and every request asks OpenRouter to route only to providers that don't collect data (`data_collection: deny`).
- **Defensive use only.** It explains an attack as far as needed to detect and stop it. The AIs are told not to write exploits or malware.

Pay for the AI one of two ways:

- `OPENROUTER_API_KEY` — your own key; requests go straight from your machine to OpenRouter.
- `UNCHORE_TOKEN` — no AI account needed. Sign in at [unchore.ai](https://unchore.ai/?utm_source=github&utm_campaign=defend-readme) → Settings → AI → Unchore credit → *New key*.

`--chain glm,deepseek` sets the order, `--own` forces your OpenRouter key, `--json` prints machine-readable output.

## Why this exists

[Unchore](https://unchore.ai/?utm_source=github&utm_campaign=defend-readme) is a personal AI that notices when you ask for the same thing twice and offers to do it for you from then on. These two tools are pieces of it that also work on their own.

## Contributing

Issues and pull requests are welcome. Run `node --test test/*.test.mjs` before sending. Security problems: see [SECURITY.md](SECURITY.md).

MIT © 2026 Unchore
